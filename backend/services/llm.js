// OpenAI 兼容 LLM 客户端：流式输出 + Function Calling 工具循环。
// 使用原生 fetch，零外部依赖；SSE 逐行解析，工具调用增量参数按 index 合并。

const TOOL_MAX_ROUNDS = 3;
const IDLE_TIMEOUT_MS = 30000;

const SEARCH_EVENTS_TOOL = {
  type: 'function',
  function: {
    name: 'search_events',
    description: '查询当前登录用户的事件记录列表。可根据关键词、日期范围、分类、状态过滤。返回字段包含：标题(title)、事件内容(content)、分类(type)、状态(status)、开始日期(startDate)、结束日期(endDate)。回答时应引用事件内容。',
    parameters: {
      type: 'object',
      properties: {
        keyword: { type: 'string', description: '标题或内容包含的关键词' },
        startDate: { type: 'string', description: '可选。事件开始日期不早于该值，格式 YYYY-MM-DD。仅当用户明确提及开始时间时传入' },
        startDateTo: { type: 'string', description: '可选。事件开始日期不晚于该值，格式 YYYY-MM-DD。与 startDate 搭配表达“开始日期在某区间”，例如用户问“10月开始的事件”时传 startDate=当月1日、startDateTo=当月最后一天' },
        endDate: { type: 'string', description: '可选。事件结束日期不晚于该值，格式 YYYY-MM-DD。仅当用户明确询问结束时间时传入，禁止用它表达开始日期范围' },
        typeLevel1: { type: 'string', description: '一级分类，例如：工作、生活、学习' },
        status: { type: 'string', enum: ['进行中', '已完成', '已取消'], description: '事件状态' },
        limit: { type: 'integer', description: '返回条数上限，默认 20，最大 50' }
      },
      required: []
    }
  }
};

class LLMError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const normalizeBaseUrl = (url) => String(url || '').trim().replace(/\/+$/, '');

// 非 200 响应转成用户可读的错误信息（尽量透传上游原始报错）
const describeHttpError = async (resp) => {
  let raw = '';
  try { raw = await resp.text(); } catch (_) { /* 忽略读取失败 */ }
  let detail = '';
  try {
    const body = JSON.parse(raw);
    if (typeof body?.error === 'string') detail = body.error;
    else detail = body?.error?.message || body?.message || '';
  } catch (_) { detail = raw; }
  detail = String(detail || '').replace(/\s+/g, ' ').trim().slice(0, 300);
  if (detail) console.log(`[llm] 上游响应 ${resp.status}: ${detail}`);
  if (resp.status === 401 || resp.status === 403) return new LLMError(resp.status, 'API Key 无效或无权限' + (detail ? `（${detail}）` : ''));
  if (resp.status === 404) return new LLMError(resp.status, 'Base URL 或模型名不正确，请检查 AI 设置' + (detail ? `（${detail}）` : ''));
  if (resp.status === 429) return new LLMError(resp.status, 'LLM 服务限流，请稍后重试');
  return new LLMError(resp.status, detail || `LLM 服务返回 ${resp.status}`);
};

// 逐行读取 SSE 字节流
async function* sseLines(body, onLine) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx;
    while ((idx = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, idx).replace(/\r$/, '');
      buffer = buffer.slice(idx + 1);
      if (onLine) onLine();
      yield line;
    }
  }
  if (buffer) yield buffer;
}

// 发起一次流式对话请求，返回 { content, toolCalls, finishReason }
async function callLLMStream({ baseUrl, apiKey, model, messages, tools, signal, onDelta, onLine }) {
  const resp = await fetch(`${normalizeBaseUrl(baseUrl)}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({ model, messages, tools, tool_choice: 'auto', stream: true }),
    signal
  });

  if (!resp.ok) {
    throw await describeHttpError(resp);
  }

  let content = '';
  const toolCalls = [];
  let finishReason = null;

  for await (const line of sseLines(resp.body, onLine)) {
    if (!line.startsWith('data:')) continue;
    const data = line.slice(5).trim();
    if (data === '[DONE]') break;
    let chunk;
    try {
      chunk = JSON.parse(data);
    } catch (_) {
      continue;
    }
    // 上游网关可能以 HTTP 200 + SSE 流内 error 事件返回故障，必须透传而非吞成空回答
    if (chunk.error) {
      const msg = typeof chunk.error === 'string' ? chunk.error : (chunk.error.message || JSON.stringify(chunk.error));
      throw new LLMError(502, String(msg).replace(/\s+/g, ' ').trim().slice(0, 300));
    }
    const choice = chunk.choices && chunk.choices[0];
    if (!choice) continue;
    if (choice.delta && choice.delta.content) {
      content += choice.delta.content;
      if (onDelta) onDelta(choice.delta.content);
    }
    if (choice.delta && Array.isArray(choice.delta.tool_calls)) {
      for (const tc of choice.delta.tool_calls) {
        const i = typeof tc.index === 'number' ? tc.index : 0;
        if (!toolCalls[i]) toolCalls[i] = { id: '', name: '', arguments: '' };
        if (tc.id) toolCalls[i].id = tc.id;
        if (tc.function && tc.function.name) toolCalls[i].name += tc.function.name;
        if (tc.function && tc.function.arguments) toolCalls[i].arguments += tc.function.arguments;
      }
    }
    if (choice.finish_reason) finishReason = choice.finish_reason;
  }

  return { content, toolCalls: toolCalls.filter(Boolean), finishReason };
}

// 完整对话：流式输出 + 工具调用循环（最多 TOOL_MAX_ROUNDS 轮）
async function streamChat({ baseUrl, apiKey, model, messages, tools, executor, onDelta, onToolEvents }) {
  const controller = new AbortController();
  let idleTimer = null;
  let idleReason = '';
  const resetIdle = () => {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      idleReason = 'AI 服务响应超时，请稍后重试';
      controller.abort();
    }, IDLE_TIMEOUT_MS);
  };

  try {
    resetIdle();
    const history = [...messages];

    for (let round = 0; round <= TOOL_MAX_ROUNDS; round++) {
      let { content, toolCalls, finishReason } = await callLLMStream({
        baseUrl, apiKey, model,
        messages: history,
        tools,
        signal: controller.signal,
        onDelta,
        onLine: resetIdle
      });

      // 网关偶发返回 200 但内容为空（无工具调用、无文本），自动重试一次
      if (!toolCalls.length && !content && round < TOOL_MAX_ROUNDS) {
        console.log(`[llm] 第${round + 1}轮上游返回空响应 (finishReason=${finishReason})，重试一次`);
        ({ content, toolCalls, finishReason } = await callLLMStream({
          baseUrl, apiKey, model,
          messages: history,
          tools,
          signal: controller.signal,
          onDelta,
          onLine: resetIdle
        }));
      }

      const shouldCallTools = toolCalls.length > 0 && round < TOOL_MAX_ROUNDS;

      if (shouldCallTools) {
        console.log(`[llm] 第${round + 1}轮收到工具调用 (finishReason=${finishReason}):`,
          toolCalls.map(t => `${t.name}(${t.arguments.slice(0, 200)})`).join('; '));
        history.push({
          role: 'assistant',
          content: content || null,
          tool_calls: toolCalls.map(t => ({
            id: t.id,
            type: 'function',
            function: { name: t.name, arguments: t.arguments }
          }))
        });

        for (const t of toolCalls) {
          let resultPayload;
          try {
            const args = t.arguments ? JSON.parse(t.arguments) : {};
            const events = await executor(args);
            if (onToolEvents && events.length > 0) onToolEvents(events);
            resultPayload = { ok: true, count: events.length, events };
          } catch (_) {
            resultPayload = { ok: false, error: '事件查询执行失败，请基于已有信息回答' };
          }
          history.push({ role: 'tool', tool_call_id: t.id, content: JSON.stringify(resultPayload) });
        }
        continue;
      }

      if (!toolCalls.length) {
        console.log(`[llm] 第${round + 1}轮模型直接回答 (finishReason=${finishReason}) content长度=${content.length} 片段=${content.slice(0, 80).replace(/\n/g, ' ')}`);
        if (!content) {
          throw new LLMError(502, 'AI 服务返回了空响应，请稍后重试');
        }
      }
      return content;
    }
    return '';
  } catch (error) {    if (idleReason) throw new LLMError(504, idleReason);
    if (error.name === 'AbortError') throw new LLMError(504, 'AI 服务响应超时，请稍后重试');
    throw error;
  } finally {
    if (idleTimer) clearTimeout(idleTimer);
  }
}

module.exports = { streamChat, SEARCH_EVENTS_TOOL, LLMError, normalizeBaseUrl, describeHttpError };
