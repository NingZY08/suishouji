const express = require('express');
const router = express.Router();
const { Category, Event } = require('../models');
const {
  populateCategoryFields,
  createEventWithCategory,
  updateEventWithCategory,
  getCategoryTree,
  getCategoryPath
} = require('../utils/category');

/**
 * 获取分类树
 * GET /api/categories
 */
router.get('/', async (req, res) => {
  try {
    const categories = await getCategoryTree();
    res.json(categories);
  } catch (error) {
    console.error('获取分类失败:', error);
    res.status(500).json({ message: '获取分类失败' });
  }
});

/**
 * 获取某个分类的完整路径
 * GET /api/categories/:id/path
 */
router.get('/:id/path', async (req, res) => {
  try {
    const path = await getCategoryPath(parseInt(req.params.id));
    res.json(path);
  } catch (error) {
    console.error('获取分类路径失败:', error);
    res.status(500).json({ message: '获取分类路径失败' });
  }
});

/**
 * 创建事件（自动填充分类字段）
 * POST /api/events
 */
router.post('/', async (req, res) => {
  try {
    const event = await createEventWithCategory({
      ...req.body,
      userId: req.user.id // 假设使用了认证中间件
    });
    res.status(201).json(event);
  } catch (error) {
    console.error('创建事件失败:', error);
    res.status(500).json({ message: '创建事件失败' });
  }
});

/**
 * 更新事件（自动填充分类字段）
 * PUT /api/events/:id
 */
router.put('/:id', async (req, res) => {
  try {
    const event = await Event.findByPk(req.params.id);
    if (!event) {
      return res.status(404).json({ message: '事件不存在' });
    }

    const updatedEvent = await updateEventWithCategory(event, req.body);
    res.json(updatedEvent);
  } catch (error) {
    console.error('更新事件失败:', error);
    res.status(500).json({ message: '更新事件失败' });
  }
});

/**
 * 获取事件列表（包含完整分类信息）
 * GET /api/events
 */
router.get('/', async (req, res) => {
  try {
    const events = await Event.findAll({
      where: { userId: req.user.id },
      order: [['created_at', 'DESC']],
      include: [{
        model: Category,
        as: 'category'
      }]
    });
    res.json(events);
  } catch (error) {
    console.error('获取事件列表失败:', error);
    res.status(500).json({ message: '获取事件列表失败' });
  }
});

module.exports = router;
