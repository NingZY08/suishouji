const sequelize = require('../config/database');
const User = require('./User');
const Event = require('./Event');
const Category = require('./Category');
const File = require('./File');
const AiConfig = require('./AiConfig');

// 建立关联关系
User.hasMany(Event, { foreignKey: 'userId' });
Event.belongsTo(User, { foreignKey: 'userId' });

User.hasMany(File, { foreignKey: 'userId' });
File.belongsTo(User, { foreignKey: 'userId' });

User.hasOne(AiConfig, { foreignKey: 'userId' });
AiConfig.belongsTo(User, { foreignKey: 'userId' });

Category.hasMany(Category, { foreignKey: 'parentId', as: 'children' });
Category.belongsTo(Category, { foreignKey: 'parentId', as: 'parent' });

Category.hasMany(Event, { foreignKey: 'categoryId' });
Event.belongsTo(Category, { foreignKey: 'categoryId', as: 'category' });

module.exports = {
  sequelize,
  User,
  Event,
  Category,
  File,
  AiConfig
};