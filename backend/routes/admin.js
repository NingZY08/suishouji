// 管理员用户管理路由（挂载于 /api/admin，需 requireAdmin）
// 本期边界：仅管理普通用户资料；对其他用户的事件/统计/AI 数据零访问。
const express = require('express');
const { body, validationResult, query } = require('express-validator');
const bcrypt = require('bcrypt');
const { Op } = require('sequelize');
const { User } = require('../models');
const auth = require('../middleware/auth');
const requireAdmin = require('../middleware/admin');

const router = express.Router();
router.use(auth, requireAdmin);

const USER_FIELDS = ['id', 'username', 'email', 'role', 'createdAt'];
const PAGE_SIZES = [10, 20, 50, 100];
const sanitizeUser = (u) => ({
  id: u.id,
  username: u.username,
  email: u.email,
  role: u.role,
  createdAt: u.createdAt
});

// 目标必须存在且为普通用户（管理员仅管理普通用户）
const loadManageableUser = async (req, res) => {
  const target = await User.findByPk(req.params.id, { attributes: USER_FIELDS });
  if (!target) {
    res.status(404).json({ message: '用户不存在' });
    return null;
  }
  if (target.role === 'admin') {
    res.status(403).json({ message: '仅可管理普通用户' });
    return null;
  }
  return target;
};

// 用户列表：分页 + 关键词搜索（username/email 模糊匹配）
router.get('/users', [
  query('page').optional().isInt({ min: 1 }).withMessage('page 必须为正整数'),
  query('pageSize').optional().isIn(PAGE_SIZES.map(String)).withMessage('pageSize 取值无效'),
  query('keyword').optional().isString().isLength({ max: 100 }).withMessage('关键词过长')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const pageSize = PAGE_SIZES.includes(parseInt(req.query.pageSize, 10))
    ? parseInt(req.query.pageSize, 10) : 10;
  const keyword = (req.query.keyword || '').trim();

  const where = keyword
    ? {
        [Op.or]: [
          { username: { [Op.like]: `%${keyword}%` } },
          { email: { [Op.like]: `%${keyword}%` } }
        ]
      }
    : {};

  try {
    const { rows, count } = await User.findAndCountAll({
      where,
      attributes: USER_FIELDS,
      order: [['createdAt', 'DESC']],
      limit: pageSize,
      offset: (page - 1) * pageSize
    });
    res.json({ users: rows.map(sanitizeUser), total: count, page, pageSize });
  } catch (error) {
    console.error('管理员查询用户列表失败:', error);
    res.status(500).json({ message: '服务器内部错误' });
  }
});

// 用户详情
router.get('/users/:id', async (req, res) => {
  try {
    const target = await loadManageableUser(req, res);
    if (!target) return;
    res.json({ user: sanitizeUser(target) });
  } catch (error) {
    console.error('管理员查询用户详情失败:', error);
    res.status(500).json({ message: '服务器内部错误' });
  }
});

// 编辑资料（username/email）
router.put('/users/:id', [
  body('username').isLength({ min: 2, max: 20 }).withMessage('用户名长度在2到20个字符之间'),
  body('email').isEmail().withMessage('请输入正确的邮箱格式')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const target = await loadManageableUser(req, res);
    if (!target) return;

    const { username, email } = req.body;
    // 唯一性：排除目标自身后，username/email 不得与其他用户冲突
    const conflict = await User.findOne({
      where: {
        id: { [Op.ne]: target.id },
        [Op.or]: [{ username }, { email }]
      },
      attributes: ['username', 'email']
    });
    if (conflict) {
      const msg = conflict.username === username ? '用户名已被使用' : '邮箱已被使用';
      return res.status(400).json({ errors: [{ msg }] });
    }

    await target.update({ username, email });
    console.log(`[audit] 管理员编辑用户资料: admin=${req.user.userId} target=${target.id} username=${username} email=${email}`);
    res.json({ user: sanitizeUser(target) });
  } catch (error) {
    console.error('管理员编辑用户资料失败:', error);
    res.status(500).json({ message: '服务器内部错误' });
  }
});

// 重置密码：设置新密码并使目标用户全部旧登录态失效
router.put('/users/:id/password', [
  body('newPassword').isLength({ min: 6 }).withMessage('密码长度不能少于6个字符')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const target = await loadManageableUser(req, res);
    if (!target) return;

    const hashed = await bcrypt.hash(req.body.newPassword, 10);
    await target.update({ password: hashed });
    await target.increment('tokenVersion');
    console.log(`[audit] 管理员重置用户密码: admin=${req.user.userId} target=${target.id}`);
    res.json({ message: '密码已重置，该用户需使用新密码重新登录' });
  } catch (error) {
    console.error('管理员重置密码失败:', error);
    res.status(500).json({ message: '服务器内部错误' });
  }
});

module.exports = router;
