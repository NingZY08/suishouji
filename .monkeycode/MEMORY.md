# User Instruction Memory

This file records user instructions, preferences, and teachings for reference in future interactions.

## Format

### User Instruction Entry
User instruction entries should follow this format:

[User Instruction Summary]
- Date: [YYYY-MM-DD]
- Context: [Mentioned scenario or time]
- Instructions:
  - [Content of user teaching or instruction, described line by line]

## Deduplication Strategy
- Before adding a new entry, check for similar or identical instructions.
- If a duplicate is found, skip the new entry or merge it with the existing one.
- When merging, update the context or date information.
- This helps avoid redundant entries and keeps the memory file tidy.

## Entries

[User Instruction Summary]
- Date: 2026-10-19
- Context: AI 对话功能调试时，用户发现测试脚本使用了其 CLINE 配置之外的模型（claude-sonnet-4.5）而非用户自己配置的模型
- Instructions:
  - 测试 AI/LLM 相关功能时，必须使用用户在配置中设置的模型（从配置行读取），禁止擅自更换为其他模型，也禁止在测试脚本中硬编码模型名
  - 不准为了排查问题而随意更改用户已保存的 AI 配置（模型名、Key、Base URL）；如需临时替换，必须先征得用户明确同意，用完立即恢复
  - 用户明确表示其模型本身是正常的，排查方向应优先放在工具调用链路、参数构造、后端代码上
