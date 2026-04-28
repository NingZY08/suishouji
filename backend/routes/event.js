const express = require('express');
const { body, validationResult } = require('express-validator');
const { Op } = require('sequelize');
const auth = require('../middleware/auth');
const upload = require('../middleware/upload');
const { Event, Category } = require('../models');
const {
  createEventWithCategory,
  updateEventWithCategory,
  getCategoryTree,
  getCategoryPath,
  findCategoryIdByType
} = require('../utils/category');
const XLSX = require('xlsx');

const router = express.Router();

// 获取分类树
router.get('/categories', auth, async (req, res) => {
  try {
    const categories = await getCategoryTree();
    res.json(categories);
  } catch (error) {
    console.error('获取分类失败:', error);
    res.status(500).json({ message: '获取分类失败' });
  }
});

// 获取分类路径
router.get('/categories/:id/path', auth, async (req, res) => {
  try {
    const path = await getCategoryPath(parseInt(req.params.id));
    res.json(path);
  } catch (error) {
    console.error('获取分类路径失败:', error);
    res.status(500).json({ message: '获取分类路径失败' });
  }
});

// 获取事件列表
router.get('/', auth, async (req, res) => {
  const { keyword, type, status, page = 1, pageSize = 10 } = req.query;

  try {
    const where = { userId: req.user.userId };

    if (keyword) {
      where[Op.or] = [
        { title: { [Op.like]: `%${keyword}%` } },
        { content: { [Op.like]: `%${keyword}%` } }
      ];
    }

    if (type) {
      where.typeLevel1 = type;
    }

    if (status) {
      where.status = status;
    }

    const { count, rows } = await Event.findAndCountAll({
      where,
      include: [{ model: Category, as: 'category' }],
      limit: parseInt(pageSize),
      offset: (parseInt(page) - 1) * parseInt(pageSize),
      order: [['createdAt', 'DESC']]
    });

    const events = rows.map(event => ({
      id: event.id,
      title: event.title,
      content: event.content,
      startDate: event.startDate,
      endDate: event.endDate,
      result: event.result,
      status: event.status,
      categoryId: event.categoryId,
      type: {
        level1: event.typeLevel1,
        level2: event.typeLevel2,
        level3: event.typeLevel3
      },
      files: event.files,
      createdAt: event.createdAt
    }));

    res.json({ events, total: count });
  } catch (error) {
    console.error('获取事件列表失败:', error);
    res.status(500).json({ message: '获取事件列表失败' });
  }
});

// 获取事件详情
router.get('/:id', auth, async (req, res) => {
  try {
    const event = await Event.findOne({
      where: { id: req.params.id, userId: req.user.userId },
      include: [{ model: Category, as: 'category' }]
    });

    if (!event) {
      return res.status(404).json({ message: '事件不存在' });
    }

    res.json({
      id: event.id,
      title: event.title,
      content: event.content,
      startDate: event.startDate,
      endDate: event.endDate,
      result: event.result,
      status: event.status,
      categoryId: event.categoryId,
      type: {
        level1: event.typeLevel1,
        level2: event.typeLevel2,
        level3: event.typeLevel3
      },
      files: event.files
    });
  } catch (error) {
    console.error('获取事件详情失败:', error);
    res.status(500).json({ message: '获取事件详情失败' });
  }
});

// 创建事件
router.post('/', auth, [
  body('title').isLength({ min: 1, max: 100 }).withMessage('标题长度在1到100个字符之间'),
  body('startDate').notEmpty().withMessage('请选择开始日期'),
  body('status').isIn(['进行中', '已完成', '已取消']).withMessage('状态必须是进行中、已完成或已取消')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { title, content, startDate, endDate, result, status, type, categoryId, files } = req.body;

  try {
    let event;
    let finalCategoryId = categoryId;

    // 如果没有提供categoryId，但提供了type，根据type查找categoryId
    if (!finalCategoryId && type?.level1) {
      finalCategoryId = await findCategoryIdByType(type);
    }

    // 如果有categoryId，使用工具函数自动填充typeLevel字段
    if (finalCategoryId) {
      event = await createEventWithCategory({
        userId: req.user.userId,
        title,
        content: content || null,
        startDate,
        endDate: endDate && endDate !== 'Invalid date' ? endDate : null,
        result: result || null,
        status,
        categoryId: finalCategoryId,
        files: files || []
      });
    } else {
      // 如果没有categoryId，直接使用type字段
      event = await Event.create({
        userId: req.user.userId,
        title,
        content: content || null,
        startDate,
        endDate: endDate && endDate !== 'Invalid date' ? endDate : null,
        result: result || null,
        status,
        typeLevel1: type?.level1 || null,
        typeLevel2: type?.level2 || null,
        typeLevel3: type?.level3 || null,
        files: files || []
      });
    }

    res.json({
      id: event.id,
      title: event.title,
      content: event.content,
      startDate: event.startDate,
      endDate: event.endDate,
      result: event.result,
      status: event.status,
      categoryId: event.categoryId,
      type: {
        level1: event.typeLevel1,
        level2: event.typeLevel2,
        level3: event.typeLevel3
      },
      files: event.files
    });
  } catch (error) {
    console.error('创建事件失败:', error);
    res.status(500).json({ message: '创建事件失败' });
  }
});

// 更新事件
router.put('/:id', auth, [
  body('title').isLength({ min: 1, max: 100 }).withMessage('标题长度在1到100个字符之间'),
  body('startDate').notEmpty().withMessage('请选择开始日期'),
  body('status').isIn(['进行中', '已完成', '已取消']).withMessage('状态必须是进行中、已完成或已取消')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { title, content, startDate, endDate, result, status, type, categoryId, files } = req.body;

  try {
    const event = await Event.findOne({
      where: { id: req.params.id, userId: req.user.userId }
    });

    if (!event) {
      return res.status(404).json({ message: '事件不存在' });
    }

    let finalCategoryId = categoryId;

    // 如果没有提供categoryId，但提供了type，根据type查找categoryId
    if (!finalCategoryId && type?.level1) {
      finalCategoryId = await findCategoryIdByType(type);
    }

    // 如果有categoryId，使用工具函数自动填充typeLevel字段
    if (finalCategoryId) {
      const updatedEvent = await updateEventWithCategory(event, {
        title,
        content: content || null,
        startDate,
        endDate: endDate && endDate !== 'Invalid date' ? endDate : null,
        result: result || null,
        status,
        categoryId: finalCategoryId,
        files: files || []
      });

      return res.json({
        id: updatedEvent.id,
        title: updatedEvent.title,
        content: updatedEvent.content,
        startDate: updatedEvent.startDate,
        endDate: updatedEvent.endDate,
        result: updatedEvent.result,
        status: updatedEvent.status,
        categoryId: updatedEvent.categoryId,
        type: {
          level1: updatedEvent.typeLevel1,
          level2: updatedEvent.typeLevel2,
          level3: updatedEvent.typeLevel3
        },
        files: updatedEvent.files
      });
    }

    // 如果没有categoryId，直接使用type字段
    event.title = title;
    event.content = content || null;
    event.startDate = startDate;
    event.endDate = endDate && endDate !== 'Invalid date' ? endDate : null;
    event.result = result || null;
    event.status = status;
    event.categoryId = null;
    event.typeLevel1 = type?.level1 || null;
    event.typeLevel2 = type?.level2 || null;
    event.typeLevel3 = type?.level3 || null;
    event.files = files || [];

    await event.save();

    res.json({
      id: event.id,
      title: event.title,
      content: event.content,
      startDate: event.startDate,
      endDate: event.endDate,
      result: event.result,
      status: event.status,
      categoryId: event.categoryId,
      type: {
        level1: event.typeLevel1,
        level2: event.typeLevel2,
        level3: event.typeLevel3
      },
      files: event.files
    });
  } catch (error) {
    console.error('更新事件失败:', error);
    res.status(500).json({ message: '更新事件失败' });
  }
});

// 删除事件
router.delete('/:id', auth, async (req, res) => {
  try {
    const event = await Event.findOne({
      where: { id: req.params.id, userId: req.user.userId }
    });

    if (!event) {
      return res.status(404).json({ message: '事件不存在' });
    }

    await event.destroy();
    res.json({ message: '删除成功' });
  } catch (error) {
    console.error('删除事件失败:', error);
    res.status(500).json({ message: '删除事件失败' });
  }
});

// 批量删除事件
router.post('/batch-delete', auth, async (req, res) => {
  const { ids } = req.body;

  if (!Array.isArray(ids)) {
    return res.status(400).json({ message: '请提供要删除的事件ID列表' });
  }

  try {
    await Event.destroy({
      where: {
        id: ids,
        userId: req.user.userId
      }
    });

    res.json({ message: '批量删除成功' });
  } catch (error) {
    console.error('批量删除事件失败:', error);
    res.status(500).json({ message: '批量删除事件失败' });
  }
});

// 导出事件为Excel
router.get('/export', auth, async (req, res) => {
  const { keyword, type, status } = req.query;

  try {
    const where = { userId: req.user.userId };

    if (keyword) {
      where[Op.or] = [
        { title: { [Op.like]: `%${keyword}%` } },
        { content: { [Op.like]: `%${keyword}%` } }
      ];
    }

    if (type) {
      where.typeLevel1 = type;
    }

    if (status) {
      where.status = status;
    }

    const events = await Event.findAll({ where });

    const data = events.map(event => ({
      标题: event.title,
      一级分类: event.typeLevel1,
      二级分类: event.typeLevel2 || '',
      三级分类: event.typeLevel3 || '',
      开始日期: event.startDate,
      结束日期: event.endDate || '',
      状态: event.status,
      内容: event.content || '',
      结果: event.result || ''
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '事件列表');

    const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });

    res.setHeader('Content-Disposition', `attachment; filename=events_${new Date().toISOString().split('T')[0]}.xlsx`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } catch (error) {
    console.error('导出事件失败:', error);
    res.status(500).json({ message: '导出事件失败' });
  }
});

module.exports = router;