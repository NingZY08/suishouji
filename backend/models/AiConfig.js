const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const AiConfig = sequelize.define('AiConfig', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  name: {
    type: DataTypes.STRING(50),
    allowNull: false,
    defaultValue: '默认配置'
  },
  baseUrl: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  apiKeyEnc: {
    type: DataTypes.TEXT,
    allowNull: false,
    field: 'api_key_enc'
  },
  model: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  isDefault: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    field: 'is_default'
  }
}, {
  tableName: 'ai_configs',
  underscored: true,
  indexes: [
    { fields: ['user_id'] }
  ]
});

module.exports = AiConfig;
