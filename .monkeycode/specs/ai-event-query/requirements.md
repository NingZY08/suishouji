# Requirements Document

Feature Name: ai-event-query
Updated: 2026-10-17

## Introduction

本功能为随手记应用接入 AI 能力。先期范围：用户通过自然语言对话查询本人事件；用户可在 AI 设置页配置 OpenAI 兼容服务（Base URL、API Key、模型名），配置由后端加密存储。后端以 Function Calling（工具调用）方式让 AI 按需查询数据库，回答流式输出。

## Glossary

- **LLM 服务**: 用户自行配置的 OpenAI 兼容对话接口（如 DeepSeek、通义、Kimi、OpenAI 等）
- **AI 配置**: Base URL、API Key、模型名三项参数的组合
- **工具调用 (Function Calling)**: LLM 在对话中请求系统执行预定义函数并回传结果的标准协议
- **事件查询工具 (search_events)**: 系统提供给 LLM 的唯一工具，按条件查询当前用户的事件列表
- **AI 设置页**: 前端路由 /ai-settings，用于查看与修改 AI 配置
- **AI 对话框**: 全局悬浮球展开的侧滑抽屉，所有页面可用

## Requirements

### Requirement 1: AI 服务配置管理

**User Story:** AS 用户, I want 配置并验证 LLM 服务的地址、密钥与模型, so that AI 对话功能可以按我的账号生效。

#### Acceptance Criteria

1. WHEN 用户在 AI 设置页填写 Base URL、API Key、模型名并点击保存, THE 系统 SHALL 将 API Key 以 AES-256-GCM 加密后写入 ai_configs 表, 并返回保存成功提示。
2. WHEN 用户打开 AI 设置页且配置已存在, THE 系统 SHALL 回显 Base URL 与模型名, 并以占位符形式展示 Key 状态（明文 Key 原样返回）。
3. WHEN 用户点击「测试连接」, THE 系统 SHALL 使用当前表单配置向 LLM 服务发送一条最小对话请求, 并在 10 秒内显示连接成功或失败原因。
4. IF Base URL 为空、API Key 为空或模型名为空, THE 系统 SHALL 阻止保存并提示对应字段必填。
5. IF LLM 服务返回 401、404、429 或网络超时, THE 系统 SHALL 在测试连接结果中显示对应的服务商错误信息。

### Requirement 2: 自然语言事件查询对话

**User Story:** AS 用户, I want 用自然语言提问并让 AI 查询我的事件, so that 我无需手动构造筛选条件即可获得答案。

#### Acceptance Criteria

1. WHEN 用户在 AI 对话框发送一条消息且 AI 配置存在, THE 系统 SHALL 将消息、最近对话历史与 search_events 工具定义发送给 LLM 服务, 并以流式方式在对话框中渲染回答。
2. WHEN LLM 发起 search_events 工具调用, THE 系统 SHALL 按工具参数以当前登录用户身份执行事件查询, 并将结果回传给 LLM 生成最终回答。
3. WHEN 一轮回答完成且该轮发生过工具调用, THE 系统 SHALL 在回答下方展示命中的事件列表（标题、类型、状态、起止日期）。
4. WHEN 用户发送消息且 AI 配置不存在, THE 系统 SHALL 在对话框中提示前往 AI 设置页完成配置。
5. IF LLM 请求超时（30 秒无输出）或流式中断, THE 系统 SHALL 在对话框中显示错误信息, 并保留已生成的部分内容供用户重试。

### Requirement 3: 安全与数据隔离

**User Story:** AS 用户, I want AI 查询严格限定在我的数据范围内, so that 其他用户的事件与我的密钥不受影响。

#### Acceptance Criteria

1. THE 系统 SHALL 对 /api/ai/config 与 /api/ai/chat 全部接口执行登录校验（auth 中间件）。
2. WHEN 系统执行 search_events 工具调用, THE 系统 SHALL 强制查询条件 userId 等于当前登录用户 id, 且 SHALL 忽略 LLM 参数中出现的任何用户标识。
3. THE 系统 SHALL 在配置读取接口的响应中脱敏 API Key（仅返回 Key 的末 4 位）。
4. WHEN ai_configs 表中不存在当前用户的配置, THE 系统 SHALL 在对话接口返回明确的未配置状态码（409）而非尝试调用 LLM。
