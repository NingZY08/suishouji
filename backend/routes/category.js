const express = require('express');
const { body, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const { Category } = require('../models');

const router = express.Router();

// 获取所有分类（树形结构）
router.get('/', auth, async (req, res) => {
  try {
    const categories = await Category.findAll({
      where: { level: 1 },
      order: [['sort_order', 'ASC']],
      include: [{
        model: Category,
        as: 'children',
        order: [['sort_order', 'ASC']],
        include: [{
          model: Category,
          as: 'children',
          order: [['sort_order', 'ASC']]
        }]
      }]
    });
    res.json(categories);
  } catch (error) {
    console.error('获取分类失败:', error);
    res.status(500).json({ message: '获取分类失败' });
  }
});

// 获取单个分类详情
router.get('/:id', auth, async (req, res) => {
  try {
    const category = await Category.findByPk(req.params.id);
    if (!category) {
      return res.status(404).json({ message: '分类不存在' });
    }
    res.json(category);
  } catch (error) {
    console.error('获取分类详情失败:', error);
    res.status(500).json({ message: '获取分类详情失败' });
  }
});

// 创建分类
router.post('/', auth, [
  body('name').isLength({ min: 1, max: 50 }).withMessage('分类名称长度在1到50个字符之间'),
  body('level').isIn([1, 2, 3]).withMessage('分类级别必须是1、2或3'),
  body('parentId').optional().isInt().withMessage('父分类ID必须是整数')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { name, level, parentId, sortOrder = 0 } = req.body;

  try {
    // 验证父分类是否存在且级别正确
    if (parentId) {
      const parentCategory = await Category.findByPk(parentId);
      if (!parentCategory) {
        return res.status(400).json({ message: '父分类不存在' });
      }
      if (parentCategory.level !== level - 1) {
        return res.status(400).json({ message: '父分类级别必须比当前分类级别小1' });
      }
    } else if (level !== 1) {
      return res.status(400).json({ message: '非一级分类必须指定父分类' });
    }

    const category = await Category.create({
      name,
      level,
      parentId: parentId || null,
      sortOrder
    });

    res.status(201).json(category);
  } catch (error) {
    console.error('创建分类失败:', error);
    res.status(500).json({ message: '创建分类失败' });
  }
});

// 更新分类
router.put('/:id', auth, [
  body('name').optional().isLength({ min: 1, max: 50 }).withMessage('分类名称长度在1到50个字符之间'),
  body('sortOrder').optional().isInt().withMessage('排序必须是整数')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { name, sortOrder } = req.body;

  try {
    const category = await Category.findByPk(req.params.id);
    if (!category) {
      return res.status(404).json({ message: '分类不存在' });
    }

    if (name !== undefined) {
      category.name = name;
    }
    if (sortOrder !== undefined) {
      category.sortOrder = sortOrder;
    }

    await category.save();
    res.json(category);
  } catch (error) {
    console.error('更新分类失败:', error);
    res.status(500).json({ message: '更新分类失败' });
  }
});

// 删除分类
router.delete('/:id', auth, async (req, res) => {
  try {
    const category = await Category.findByPk(req.params.id);
    if (!category) {
      return res.status(404).json({ message: '分类不存在' });
    }

    // 检查是否有子分类
    const childrenCount = await Category.count({ where: { parentId: req.params.id } });
    if (childrenCount > 0) {
      return res.status(400).json({ message: '该分类下有子分类，无法删除' });
    }

    await category.destroy();
    res.json({ message: '删除成功' });
  } catch (error) {
    console.error('删除分类失败:', error);
    res.status(500).json({ message: '删除分类失败' });
  }
});

module.exports = router;