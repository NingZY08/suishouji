# 随手记

一个基于 Vue 3 + Express 的全栈事件记录应用，支持分类管理、文件上传、数据统计和导出功能。

## 功能特性

- 用户注册与登录（JWT 认证）
- 事件的增删改查
- 三级分类体系（工作/生活/学习等）
- 文件上传（图片等附件）
- 数据统计与可视化（ECharts）
- Excel 导入导出
- 响应式设计，支持移动端

## 技术栈

### 前端
- **Vue 3** + **TypeScript**
- **Vite** 构建工具
- **Element Plus** UI 组件库
- **Pinia** 状态管理
- **Vue Router** 路由管理
- **Axios** HTTP 客户端
- **ECharts** 数据可视化
- **Day.js** 日期处理

### 后端
- **Node.js** + **Express**
- **MySQL** 数据库
- **Sequelize** ORM
- **JWT** 身份认证
- **Multer** 文件上传
- **bcrypt** 密码加密

## 项目结构

```
suishouji/
├── frontend/              # 前端项目
│   ├── src/
│   │   ├── components/    # 公共组件
│   │   ├── views/         # 页面视图
│   │   ├── router/        # 路由配置
│   │   ├── store/         # Pinia 状态管理
│   │   └── utils/         # 工具函数
│   ├── .env               # 开发环境配置
│   └── .env.production    # 生产环境配置
├── backend/               # 后端项目
│   ├── config/            # 数据库配置
│   ├── models/            # 数据模型
│   ├── routes/            # 路由定义
│   ├── middleware/        # 中间件
│   ├── utils/             # 工具函数
│   └── uploads/           # 上传文件目录
└── .env                   # 后端环境变量
```

## 快速开始

### 环境要求

- Node.js >= 16
- MySQL >= 8.0
- npm 或 pnpm

### 安装步骤

#### 1. 克隆项目

```bash
git clone https://github.com/your-username/suishouji.git
cd suishouji
```

#### 2. 配置数据库

创建 MySQL 数据库并执行初始化脚本：

```bash
mysql -u your_username -p < backend/config/create_database.sql
```

#### 3. 配置后端

复制数据库配置模板并修改：

```bash
cp backend/config/database.example.js backend/config/database.js
```

编辑 `backend/config/database.js`，填入你的数据库凭据。

创建 `.env` 文件：

```bash
JWT_SECRET=your-jwt-secret-key
```

> **重要**：请务必修改 `JWT_SECRET` 为一个安全的随机字符串。

#### 4. 安装依赖并启动

**后端：**

```bash
cd backend
npm install
npm run dev
```

后端服务将运行在 `http://localhost:3001`

**前端：**

```bash
cd frontend
npm install
npm run dev
```

前端开发服务器将运行在 `http://localhost:5173`

## 环境变量

### 后端 (.env)

| 变量名 | 说明 | 必需 |
|--------|------|------|
| `JWT_SECRET` | JWT 签名密钥 | ✅ |

### 前端 (.env)

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `VITE_API_BASE_URL` | 后端 API 地址 | `http://localhost:3001` |

## API 接口

| 接口 | 方法 | 说明 | 认证 |
|------|------|------|------|
| `/api/auth/register` | POST | 用户注册 | ❌ |
| `/api/auth/login` | POST | 用户登录 | ❌ |
| `/api/events` | GET | 获取事件列表 | ✅ |
| `/api/events` | POST | 创建事件 | ✅ |
| `/api/events/:id` | GET | 获取事件详情 | ✅ |
| `/api/events/:id` | PUT | 更新事件 | ✅ |
| `/api/events/:id` | DELETE | 删除事件 | ✅ |
| `/api/categories` | GET | 获取分类列表 | ✅ |
| `/api/statistics` | GET | 获取统计数据 | ✅ |
| `/api/upload` | POST | 上传文件 | ✅ |

## 构建与部署

### 前端构建

```bash
cd frontend
npm run build
```

构建产物将输出到 `frontend/dist/` 目录。

### 部署文档

详细部署指南请参考 [DEPLOYMENT.md](./DEPLOYMENT.md)

## 数据库配置

项目使用 MySQL 数据库，相关配置说明：

- 数据库配置文件：`backend/config/database.js`
- 数据库初始化脚本：`backend/config/create_database.sql`
- 分类迁移脚本：`backend/config/migrate_to_categories.sql`

> **注意**：`database.js` 包含数据库凭据，已被 `.gitignore` 排除。请根据 `database.example.js` 模板创建自己的配置文件。

## 开发规范

- 代码换行符统一使用 LF
- 遵循现有代码风格和命名规范
- 修改 UI 时需确保响应式设计，兼容移动端

## License

MIT
