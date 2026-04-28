const express = require('express');
const { Op, sequelize } = require('sequelize');
const auth = require('../middleware/auth');
const { Event } = require('../models');

const router = express.Router();

// 获取统计数据
router.get('/', auth, async (req, res) => {
  const { startDate, endDate, type } = req.query;

  try {
    const where = { userId: req.user.userId };

    if (startDate) {
      where.startDate = { [Op.gte]: startDate };
    }

    if (endDate) {
      where.endDate = { [Op.lte]: endDate };
    }

    if (type) {
      where.typeLevel1 = type;
    }

    // 获取事件类型分布
    const typeDistribution = await Event.findAll({
      where,
      attributes: ['typeLevel1', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
      group: ['typeLevel1']
    });

    // 获取事件状态分布
    const statusDistribution = await Event.findAll({
      where,
      attributes: ['status', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
      group: ['status']
    });

    // 获取事件趋势
    const trend = await Event.findAll({
      where,
      attributes: [
        [sequelize.fn('DATE', sequelize.col('createdAt')), 'date'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      group: [sequelize.fn('DATE', sequelize.col('createdAt'))],
      order: [[sequelize.fn('DATE', sequelize.col('createdAt')), 'ASC']]
    });

    res.json({
      typeDistribution: typeDistribution.map(item => ({
        name: item.typeLevel1,
        value: parseInt(item.dataValues.count)
      })),
      statusDistribution: statusDistribution.map(item => ({
        name: item.status,
        value: parseInt(item.dataValues.count)
      })),
      trend: trend.map(item => ({
        date: item.dataValues.date,
        count: parseInt(item.dataValues.count)
      }))
    });
  } catch (error) {
    console.error('获取统计数据失败:', error);
    res.status(500).json({ message: '获取统计数据失败' });
  }
});

module.exports = router;