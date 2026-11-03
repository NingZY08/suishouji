const express = require('express');
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcrypt');
const auth = require('../middleware/auth');
const { User } = require('../models');

const router = express.Router();

// 获取用户信息
router.get('/profile', auth, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.userId, {
      attributes: ['id', 'username', 'email', 'role']
    });
    if (!user) {
      return res.status(404).json({ message: '用户不存在' });
    }
    res.json(user);
  } catch (error) {
    console.error('获取用户信息失败:', error);
    res.status(500).json({ message: '获取用户信息失败' });
  }
});

// 更新用户信息
router.put('/profile', auth, [
  body('username').isLength({ min: 2, max: 20 }).withMessage('用户名长度在2到20个字符之间'),
  body('password').optional().isLength({ min: 6 }).withMessage('密码长度不能少于6个字符')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { username, password } = req.body;

  try {
    const user = await User.findByPk(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: '用户不存在' });
    }

    user.username = username;
    if (password) {
      user.password = await bcrypt.hash(password, 10);
    }

    await user.save();

    res.json({ id: user.id, username: user.username, email: user.email, role: user.role });
  } catch (error) {
    console.error('更新用户信息失败:', error);
    res.status(500).json({ message: '更新用户信息失败' });
  }
});

module.exports = router;