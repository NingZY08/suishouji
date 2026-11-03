// 管理员权限中间件：必须置于 auth 之后（依赖 req.user.role）
const requireAdmin = (req, res, next) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ message: '无权限访问' });
  }
  next();
};

module.exports = requireAdmin;
