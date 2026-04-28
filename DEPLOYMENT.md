# 随手记 - 部署配置指南

## 📦 当前架构

### 存储方案
- **图片文件**: 存储在 `backend/uploads/` 目录
- **数据库**: 只存储相对路径（如 `/uploads/file-xxx.jpg`）
- **访问方式**: Express 静态文件服务 (`/uploads`)

### 优势
✅ 数据库迁移简单（不包含二进制数据）
✅ 文件与数据分离，便于独立备份
✅ 易于扩展到 CDN

---

## 🚀 部署到服务器的步骤

### 1. 前端配置

#### 修改 `.env.production`
```bash
# 生产环境配置
VITE_API_BASE_URL=https://your-domain.com
```

#### 构建前端
```bash
cd frontend
npm run build
```

#### 部署到 Web 服务器
将 `dist/` 目录部署到 Nginx/Apache 等 Web 服务器

### 2. 后端配置

#### 修改 `.env`（生产环境）
```bash
# 数据库配置
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=suishouji

# JWT 密钥（必须设置）
JWT_SECRET=your-secret-key

# 服务器端口
PORT=3001

# 允许跨域的域名（可选）
ALLOWED_ORIGINS=https://your-domain.com
```

#### 启动后端服务
```bash
cd backend
npm start
```

### 3. Nginx 配置示例

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # 前端静态文件
    location / {
        root /var/www/suishouji/frontend/dist;
        try_files $uri $uri/ /index.html;
    }

    # 后端 API 代理
    location /api {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 图片文件代理（关键！）
    location /uploads {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

---

## ☁️ 多服务器部署方案

### 方案 1：共享存储（推荐）
使用 NFS、OSS、S3 等共享存储服务：

```javascript
// backend/middleware/upload.js 修改
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // 指向共享存储目录
    cb(null, '/mnt/shared-storage/uploads');
  },
  // ...
});
```

### 方案 2：对象存储（最佳实践）
使用阿里云 OSS、AWS S3 等：

```javascript
// 使用 multer-oss 等库
const OSS = require('ali-oss');
const client = new OSS({
  region: 'oss-cn-hangzhou',
  accessKeyId: 'your-access-key',
  accessKeySecret: 'your-access-secret',
  bucket: 'your-bucket'
});

// 上传到 OSS
const result = await client.put('uploads/' + filename, file);
const fileUrl = result.url; // https://bucket.oss-region.aliyuncs.com/uploads/xxx.jpg
```

### 方案 3：CDN 加速
将图片存储与 CDN 结合：

```javascript
// 后端返回完整 CDN URL
const CDN_BASE = 'https://cdn.your-domain.com';
const fileUrl = `${CDN_BASE}/uploads/${req.file.filename}`;
res.json({ url: fileUrl });
```

---

## 🔧 环境变量说明

### 前端环境变量
| 变量名 | 说明 | 开发环境 | 生产环境 |
|--------|------|----------|----------|
| `VITE_API_BASE_URL` | 后端 API 地址 | `http://localhost:3001` | `https://api.your-domain.com` |

### 后端环境变量
| 变量名 | 说明 | 必需 |
|--------|------|------|
| `DB_HOST` | 数据库主机 | ✅ |
| `DB_USER` | 数据库用户 | ✅ |
| `DB_PASSWORD` | 数据库密码 | ✅ |
| `DB_NAME` | 数据库名称 | ✅ |
| `JWT_SECRET` | JWT 密钥 | ✅ |
| `PORT` | 服务端口 | ❌ (默认 3001) |

---

## ⚠️ 注意事项

### 1. CORS 配置
生产环境需要在后端配置允许的域名：

```javascript
// backend/app.js
const cors = require('cors');
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS || 'http://localhost:3000',
  credentials: true
}));
```

### 2. 文件权限
确保 `uploads/` 目录有正确的读写权限：
```bash
chmod -R 755 backend/uploads
chown -R www-data:www-data backend/uploads
```

### 3. 备份策略
```bash
# 数据库备份
mysqldump -u root -p suishouji > backup_$(date +%Y%m%d).sql

# 文件备份
tar -czf uploads_backup_$(date +%Y%m%d).tar.gz backend/uploads/
```

### 4. HTTPS 配置
生产环境强烈建议使用 HTTPS：
```nginx
server {
    listen 443 ssl;
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    # ...
}
```

---

## 📊 扩展性对比

| 方案 | 单服务器 | 多服务器 | 成本 | 推荐场景 |
|------|---------|---------|------|---------|
| 本地存储 | ✅ | ❌ | 低 | 开发/测试 |
| NFS 共享存储 | ✅ | ✅ | 中 | 中小规模 |
| 对象存储 (OSS/S3) | ✅ | ✅ | 中 | 大规模 |
| CDN + 对象存储 | ✅ | ✅ | 高 | 高并发场景 |

---

## 🎯 当前方案评估

### 适合部署吗？
✅ **适合！** 但需要注意：

1. **单服务器部署**：完全没问题，按上述步骤配置即可
2. **多服务器部署**：需要升级为共享存储或对象存储
3. **高并发场景**：建议结合 CDN 加速

### 迁移成本低
- 数据库：只需迁移文本路径，无需处理二进制
- 文件：可以整体打包迁移
- 配置：通过环境变量灵活切换

---

## 📝 总结

当前的图片存储方案**非常适合部署到服务器**，具有：
- ✅ 架构清晰，职责分离
- ✅ 迁移简单，维护方便
- ✅ 易于扩展到更高级的方案（OSS、CDN）

只需注意在生产环境中正确配置环境变量和 Web 服务器即可！
