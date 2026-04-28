const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// 强制要求 JWT_SECRET 在启动时存在，避免使用弱默认密钥
if (!process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET is not set. Please set JWT_SECRET in .env or environment variables. Exiting.');
  process.exit(1);
}

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const { User, Event } = require('./models');
const sequelize = require('./config/database');

const app = express();

// 中间件
app.use(cors());
app.use(helmet());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 静态文件服务
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 速率限制
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 100 
});
app.use(limiter);

// 认证中间件
const auth = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ message: '未提供认证令牌' });
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ message: '无效的认证令牌' });
  }
};

// 注册路由
app.post('/api/auth/register', async (req, res) => {
  const { username, email, password } = req.body;
  
  try {
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ message: '邮箱已被注册' });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const user = await User.create({
      username,
      email,
      password: hashedPassword
    });
    
    res.status(201).json({ message: '注册成功' });
  } catch (error) {
    console.error('注册失败:', error);
    res.status(500).json({ message: '注册失败，请稍后重试' });
  }
});

// 登录路由
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  
  try {
    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(401).json({ message: '邮箱或密码错误' });
    }
    
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: '邮箱或密码错误' });
    }
    
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    res.json({ token, user: { id: user.id, username: user.username, email: user.email } });
  } catch (error) {
    console.error('登录失败:', error);
    res.status(500).json({ message: '登录失败，请稍后重试' });
  }
});

// 注册模块化路由
app.use('/api/user', require('./routes/user'));
app.use('/api/events', require('./routes/event'));
app.use('/api/categories', require('./routes/category'));
app.use('/api/upload', require('./routes/upload'));
app.use('/api/statistics', require('./routes/statistics'));

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// 404处理
app.use((req, res) => {
  res.status(404).json({ message: '接口不存在' });
});

// 错误处理
app.use((err, req, res, next) => {
  console.error('错误:', err);
  res.status(500).json({ message: '服务器内部错误' });
});

// 启动服务器
sequelize.sync()
  .then(() => {
    app.listen(3001, () => {
      console.log('服务器运行在 http://localhost:3001');
    });
  })
  .catch((error) => {
    console.error('无法连接数据库:', error);
    process.exit(1);
  });