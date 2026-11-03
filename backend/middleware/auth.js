const jwt = require('jsonwebtoken');
const { User } = require('../models');

// 认证中间件：验签 + 查库校验登录态版本与角色
// 重置密码时 token_version+1，目标用户全部旧 token 立即失效
const auth = async (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ message: '未提供认证令牌' });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    return res.status(401).json({ message: '无效的认证令牌' });
  }

  try {
    const user = await User.findByPk(decoded.userId, {
      attributes: ['tokenVersion', 'role']
    });
    if (!user) {
      return res.status(401).json({ message: '用户不存在或已被删除' });
    }
    // 存量 token 无 tv 字段，视为版本 0
    const tv = decoded.tv === undefined ? 0 : decoded.tv;
    if (tv !== user.tokenVersion) {
      return res.status(401).json({ message: '登录状态已失效，请重新登录' });
    }
    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      role: user.role,
      tokenVersion: user.tokenVersion
    };
    next();
  } catch (error) {
    console.error('认证中间件异常:', error);
    return res.status(500).json({ message: '服务器内部错误' });
  }
};

module.exports = auth;
