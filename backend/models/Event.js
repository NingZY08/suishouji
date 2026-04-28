const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Event = sequelize.define('Event', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'user_id',
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  title: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  content: {
    type: DataTypes.TEXT
  },
  startDate: {
    type: DataTypes.DATEONLY,
    field: 'start_date',
    allowNull: false
  },
  endDate: {
    type: DataTypes.DATEONLY,
    field: 'end_date'
  },
  result: {
    type: DataTypes.STRING(500)
  },
  status: {
    type: DataTypes.STRING(20),
    defaultValue: '进行中'
  },
  categoryId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'category_id',
    references: {
      model: 'categories',
      key: 'id'
    },
    comment: '分类ID（指向第三级分类）'
  },
  typeLevel1: {
    type: DataTypes.STRING(50),
    allowNull: true,
    field: 'type_level1',
    comment: '一级分类名称（冗余，便于查询）'
  },
  typeLevel2: {
    type: DataTypes.STRING(50),
    allowNull: true,
    field: 'type_level2',
    comment: '二级分类名称（冗余，便于查询）'
  },
  typeLevel3: {
    type: DataTypes.STRING(50),
    allowNull: true,
    field: 'type_level3',
    comment: '三级分类名称（冗余，便于查询）'
  },
  files: {
    type: DataTypes.JSON,
    defaultValue: null
  },
  createdAt: {
    type: DataTypes.DATE,
    field: 'created_at',
    defaultValue: DataTypes.NOW
  },
  updatedAt: {
    type: DataTypes.DATE,
    field: 'updated_at',
    defaultValue: DataTypes.NOW
  },
  deletedAt: {
    type: DataTypes.DATE,
    field: 'deleted_at'
  }
}, {
  tableName: 'events',
  paranoid: true,
  timestamps: true
});

module.exports = Event;