# Requirements Document

## Introduction

为随手记应用引入管理员（admin）角色。管理员可以对其他用户的个人资料进行管理（查看、编辑），但在本期内对其他用户的事件数据保持零访问——不提供任何查看、检索、导出他人事件的接口与界面。普通用户的功能与体验保持不变。

## Glossary

- **管理员（Admin）**：`users.role = 'admin'` 的用户，具备管理其他普通用户个人资料的能力
- **普通用户（User）**：`users.role = 'user'` 的用户，即现有全部用户
- **个人资料**：用户的 username、email、createdAt 等账号基本信息；本期内不含密码、不含事件数据
- **用户管理页**：管理员专属前端页面，路由 `/admin/users`

## Requirements

### Requirement 1: 角色标识

**User Story:** AS 系统，我需要区分管理员与普通用户，以便实施差异化的访问控制。

#### Acceptance Criteria

1. THE 系统 SHALL 在 users 表提供 role 字段，取值限定为 `user` 或 `admin`
2. WHEN 新用户注册，系统 SHALL 将该用户 role 初始化为 `user`
3. THE 系统 SHALL 通过服务端脚本（一次性 CLI）设置首个管理员，role 的变更 SHALL 仅能通过该脚本或数据库操作完成

### Requirement 2: 用户列表与详情

**User Story:** AS 管理员，我希望查看用户列表与单个用户资料，以便定位并管理目标用户。

#### Acceptance Criteria

1. WHEN 管理员请求用户列表，系统 SHALL 返回全部分页用户资料（username、email、role、createdAt），每页默认 10 条
2. WHEN 管理员按 username 或 email 模糊搜索，系统 SHALL 返回匹配的用户列表
3. WHEN 管理员请求某普通用户详情，系统 SHALL 返回该用户完整个人资料
4. IF 请求者 role 为 `user`，系统 SHALL 以 HTTP 403 拒绝上述全部请求

### Requirement 3: 编辑他人资料

**User Story:** AS 管理员，我希望能修正其他用户的资料信息，以便处理用户自助修改不了的资料问题。

#### Acceptance Criteria

1. WHEN 管理员提交对某普通用户资料的修改，系统 SHALL 校验后保存，并返回更新后的资料
2. WHEN 管理员提交的 username 或 email 与其他用户冲突，系统 SHALL 以 HTTP 400 提示冲突且保留原值
3. WHEN 管理员试图修改自己的资料，系统 SHALL 引导其使用既有的个人资料页（/profile 接口），用户管理编辑入口对该场景置灰
4. IF 目标用户 role 为 `admin`，系统 SHALL 以 HTTP 403 拒绝编辑（管理员仅管理普通用户）

### Requirement 4: 事件数据隔离（本期边界）

**User Story:** AS 普通用户，我希望我的事件数据仅我本人可见，即使管理员也无法查看。

#### Acceptance Criteria

1. THE 系统 SHALL 对管理员与其他用户的事件数据实施完全隔离：本期提供 SHALL 为零个可供管理员查看他人事件的接口
2. WHILE 管理员使用既有的全部业务功能（事件、统计、AI 对话等），系统 SHALL 仅返回管理员本人作为 userId 的数据
3. IF 管理员或普通用户请求他人 userId 的事件数据，系统 SHALL 以 HTTP 403 或空结果响应，且 SHALL 在全部事件相关路由保持该行为

### Requirement 5: 前端入口与防护

**User Story:** AS 管理员，我希望登录后有一个清晰的用户管理入口，以便完成管理工作。

#### Acceptance Criteria

1. WHILE 登录用户 role 为 `admin`，侧边栏 SHALL 显示「用户管理」菜单项，路由 `/admin/users` 可访问
2. WHILE 登录用户 role 为 `user`，前端 SHALL 隐藏该菜单项，且访问 `/admin/users` 时重定向回事件列表页
3. WHEN 前端收到 403 响应，系统 SHALL 提示无权限并引导返回

## Out of Scope（本期不做）

- 查看/检索/导出其他用户的事件、统计、AI 对话数据
- 重置他人密码、禁用/冻结账号、删除用户（待需求确认后列入下一期）
- 细粒度权限体系（多角色、权限点配置）
- 管理员操作审计日志
