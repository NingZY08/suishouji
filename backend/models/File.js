const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const File = sequelize.define('File', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'user_id',
    references: {
      model: 'Users',
      key: 'id',
    },
  },
  hash: {
    type: DataTypes.STRING(64), // SHA-256 64字符十六进制
    allowNull: false,
    unique: true,
  },
  key: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'R2 中的对象键（包括 uploads/ 前缀）',
  },
  url: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: '公开访问的 URL',
  },
  size: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '文件字节大小',
  },
  createdAt: {
    type: DataTypes.DATE,
    field: 'created_at',
    defaultValue: DataTypes.NOW,
  },
  updatedAt: {
    type: DataTypes.DATE,
    field: 'updated_at',
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: 'files',
  timestamps: true,
});

module.exports = File;
