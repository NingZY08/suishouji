const express = require('express');
const { body, param, validationResult } = require('express-validator');
const { Op } = require('sequelize');
const auth = require('../middleware/auth');
const { AiConfig, Event } = require('../models');
const { encrypt, decrypt } = require('../utils/crypto');
const { streamChat, SEARCH_EVENTS_TOOL, LLMError, normalizeBaseUrl, describeHttpError } = require('../services/llm');

const router = express.Router();

const configValidators = [
  body('name').trim().isLength({ min: 1, max: 50 }).withMessage('配置名称长度需在1到50个字符之间'),
  // require_tld: false 允许 localhost / 内网地址（如本地 Ollama）
  body('baseUrl').isURL({ require_tld: false }).withMessage('Base URL 必须是合法的 URL'),
  body('model').trim().notEmpty().withMessage('模型名必填')
];

// 解密指定配置的 Key（含属主校验）
const resolveConfig = async (userId, configId) => {
  const config = await AiConfig.findOne({ where: { id: configId, userId } });
  if (!config) return null;
  return { config, apiKey: decrypt(config.apiKeyEnc) };
};

// 当前用户的默认配置：is_default 优先，其次最早创建的一行
const findDefaultConfig = async (userId) => {
  return AiConfig.findOne({
    where: { userId },
    order: [['isDefault', 'DESC'], ['id', 'ASC']]
  });
};

// 获取当前用户的全部 AI 配置（Key 脱敏）
router.get('/configs', auth, async (req, res) => {
  try {
    const configs = await AiConfig.findAll({
      where: { userId: req.user.userId },
      order: [['isDefault', 'DESC'], ['id', 'ASC']]
    });
    res.json(configs.map(c => {
      let apiKeyMasked = '';
      try {
        apiKeyMasked = `****${decrypt(c.apiKeyEnc).slice(-4)}`;
      } catch (_) {
        apiKeyMasked = '****（已损坏）';
      }
      return {
        id: c.id,
        name: c.name,
        baseUrl: c.baseUrl,
        model: c.model,
        isDefault: c.isDefault,
        apiKeyMasked
      };
    }));
  } catch (error) {
    console.error('获取 AI 配置列表失败:', error);
    res.status(500).json({ message: '获取 AI 配置列表失败' });
  }
});

// 新建 AI 配置（Key 必填）
router.post('/configs', auth, [...configValidators, body('apiKey').trim().notEmpty().withMessage('API Key 必填')], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const count = await AiConfig.count({ where: { userId: req.user.userId } });
    const config = await AiConfig.create({
      userId: req.user.userId,
      name: String(req.body.name).trim(),
      baseUrl: normalizeBaseUrl(req.body.baseUrl),
      model: String(req.body.model).trim(),
      apiKeyEnc: encrypt(String(req.body.apiKey).trim()),
      isDefault: count === 0
    });
    res.status(201).json({ id: config.id, message: '创建成功' });
  } catch (error) {
    console.error('创建 AI 配置失败:', error);
    res.status(500).json({ message: '创建 AI 配置失败' });
  }
});

// 更新 AI 配置（apiKey 留空表示沿用已保存的 Key）
router.put('/configs/:id', auth, [...configValidators, param('id').isInt().withMessage('配置 ID 非法')], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const config = await AiConfig.findOne({ where: { id: req.params.id, userId: req.user.userId } });
    if (!config) {
      return res.status(404).json({ message: '配置不存在' });
    }
    const apiKey = String(req.body.apiKey || '').trim();
    await config.update({
      name: String(req.body.name).trim(),
      baseUrl: normalizeBaseUrl(req.body.baseUrl),
      model: String(req.body.model).trim(),
      ...(apiKey ? { apiKeyEnc: encrypt(apiKey) } : {})
    });
    res.json({ message: '保存成功' });
  } catch (error) {
    console.error('更新 AI 配置失败:', error);
    res.status(500).json({ message: '更新 AI 配置失败' });
  }
});

// 删除 AI 配置；删除默认配置后自动指定剩余最早一条为默认
router.delete('/configs/:id', auth, [param('id').isInt().withMessage('配置 ID 非法')], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const config = await AiConfig.findOne({ where: { id: req.params.id, userId: req.user.userId } });
    if (!config) {
      return res.status(404).json({ message: '配置不存在' });
    }
    const wasDefault = config.isDefault;
    await config.destroy();
    if (wasDefault) {
      const next = await findDefaultConfig(req.user.userId);
      if (next) {
        await next.update({ isDefault: true });
      }
    }
    res.json({ message: '删除成功' });
  } catch (error) {
    console.error('删除 AI 配置失败:', error);
    res.status(500).json({ message: '删除 AI 配置失败' });
  }
});

// 设为默认配置
router.put('/configs/:id/default', auth, [param('id').isInt().withMessage('配置 ID 非法')], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const config = await AiConfig.findOne({ where: { id: req.params.id, userId: req.user.userId } });
    if (!config) {
      return res.status(404).json({ message: '配置不存在' });
    }
    await AiConfig.update({ isDefault: false }, { where: { userId: req.user.userId } });
    await config.update({ isDefault: true });
    res.json({ message: '已设为默认' });
  } catch (error) {
    console.error('设置默认 AI 配置失败:', error);
    res.status(500).json({ message: '设置默认 AI 配置失败' });
  }
});

// 测试连接：向 LLM 发送最小请求。
// Key 取值优先级：表单明文 > configId 对应配置 > 默认配置。
router.post('/config/test', auth, configValidators, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const baseUrl = normalizeBaseUrl(req.body.baseUrl);
  const model = String(req.body.model).trim();
  const formKey = String(req.body.apiKey || '').trim();
  const configId = parseInt(req.body.configId, 10);

  try {
    let apiKey = formKey;
    if (!apiKey) {
      if (Number.isInteger(configId)) {
        const resolved = await resolveConfig(req.user.userId, configId);
        if (resolved) apiKey = resolved.apiKey;
      } else {
        const fallback = await findDefaultConfig(req.user.userId);
        if (fallback) apiKey = decrypt(fallback.apiKeyEnc);
      }
    }
    if (!apiKey) {
      return res.status(400).json({ message: 'API Key 必填' });
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    try {
      const resp = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: 'ping' }],
          max_tokens: 8,
          stream: false
        }),
        signal: controller.signal
      });
      if (!resp.ok) {
        throw await describeHttpError(resp);
      }
      res.json({ message: '连接成功' });
    } finally {
      clearTimeout(timer);
    }
  } catch (error) {
    if (error.name === 'AbortError') {
      return res.status(504).json({ message: '连接超时，请检查 Base URL' });
    }
    console.error('测试 AI 连接失败:', error);
    res.status(error.status || 502).json({ message: error.message || '连接失败' });
  }
});

// AI 对话（SSE）：configId 指定配置，缺省用默认配置；无任何配置返回 409
router.post('/chat', auth, async (req, res) => {
  const configId = parseInt(req.body.configId, 10);
  let config;
  if (Number.isInteger(configId)) {
    config = await AiConfig.findOne({ where: { id: configId, userId: req.user.userId } });
    if (!config) {
      return res.status(404).json({ message: '指定的 AI 配置不存在' });
    }
  } else {
    config = await findDefaultConfig(req.user.userId);
  }
  if (!config) {
    return res.status(409).json({ message: '尚未配置 AI 服务，请先前往 AI 设置页完成配置' });
  }

  // 仅接受 user/assistant 两类历史，且内容必须是字符串
  const rawHistory = Array.isArray(req.body.messages) ? req.body.messages : [];
  const history = rawHistory
    .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .slice(-10)
    .map(m => ({ role: m.role, content: m.content }));

  let apiKey;
  try {
    apiKey = decrypt(config.apiKeyEnc);
  } catch (error) {
    console.error('解密 AI 配置失败:', error);
    return res.status(500).json({ message: 'AI 配置已损坏，请重新保存 AI 设置' });
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no'
  });
  const send = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);

  // 工具执行：强制限定当前用户，忽略 LLM 参数中的任何用户标识
  const executor = async (args) => {
    console.log('[ai] 工具查询参数:', JSON.stringify(args));
    const where = { userId: req.user.userId };
    const keyword = typeof args.keyword === 'string' ? args.keyword.trim() : '';
    if (keyword) {
      where[Op.or] = [
        { title: { [Op.like]: `%${keyword}%` } },
        { content: { [Op.like]: `%${keyword}%` } }
      ];
    }
    if (args.startDate) where.startDate = { [Op.gte]: String(args.startDate).slice(0, 10) };
    if (args.startDateTo) {
      where.startDate = where.startDate || {};
      where.startDate[Op.lte] = String(args.startDateTo).slice(0, 10);
    }
    if (args.endDate) where.endDate = { [Op.lte]: String(args.endDate).slice(0, 10) };
    if (typeof args.typeLevel1 === 'string' && args.typeLevel1) where.typeLevel1 = args.typeLevel1;
    if (typeof args.status === 'string' && args.status) where.status = args.status;
    const limit = Math.min(Math.max(parseInt(args.limit, 10) || 20, 1), 50);

    const events = await Event.findAll({
      where,
      attributes: ['id', 'title', 'content', 'typeLevel1', 'status', 'startDate', 'endDate'],
      order: [['startDate', 'DESC']],
      limit
    });
    const result = events.map(e => ({
      id: e.id,
      title: e.title,
      // 事件内容回传给模型供引用，超长截断避免上下文膨胀
      content: (e.content || '').slice(0, 800) + ((e.content || '').length > 800 ? '…（内容过长已截断）' : ''),
      type: e.typeLevel1 || '未分类',
      status: e.status,
      startDate: e.startDate,
      endDate: e.endDate
    }));
    console.log(`[ai] 工具查询命中 ${result.length} 条`);
    return result;
  };

  const today = new Date().toISOString().slice(0, 10);
  const systemPrompt = '你是随手记应用的AI助手。用户会用自然语言询问自己记录的事件，'
    + `今天是 ${today}。你需要调用 search_events 工具查询数据后作答，禁止编造数据。`
    + '「今天」「这个月」「本周」等相对时间必须换算为具体日期传入工具；'
    + '查询“某个时间段开始的事件”时，用 startDate（区间起点）+ startDateTo（区间终点）表达，'
    + 'endDate 只用于用户明确询问结束时间的情况，禁止用 endDate 表达开始日期范围。'
    + '用户未明确提及时间范围时，日期参数保持留空，禁止猜测。'
    + '查询结果为空时，如实地告诉用户没有找到匹配的事件。'
    + '回答使用简体中文，简洁清晰；日期一律使用 YYYY-MM-DD 格式。'
    + '当问题与事件查询无关时，礼貌说明当前仅支持事件查询。';

  try {
    await streamChat({
      baseUrl: config.baseUrl,
      apiKey,
      model: config.model,
      messages: [{ role: 'system', content: systemPrompt }, ...history],
      tools: [SEARCH_EVENTS_TOOL],
      executor,
      onDelta: (t) => send({ type: 'delta', content: t }),
      onToolEvents: (events) => send({ type: 'tool', events })
    });
    send({ type: 'done' });
  } catch (error) {
    const message = error instanceof LLMError
      ? error.message
      : (error.message || 'AI 服务调用失败');
    console.error('AI 对话失败:', error);
    send({ type: 'error', message });
  } finally {
    res.end();
  }
});

module.exports = router;
