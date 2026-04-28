const User = require('./User');
const Event = require('./Event');
const Category = require('./Category');

// 建立关联关系
User.hasMany(Event, { foreignKey: 'userId' });
Event.belongsTo(User, { foreignKey: 'userId' });

Category.hasMany(Category, { foreignKey: 'parentId', as: 'children' });
Category.belongsTo(Category, { foreignKey: 'parentId', as: 'parent' });

Category.hasMany(Event, { foreignKey: 'categoryId' });
Event.belongsTo(Category, { foreignKey: 'categoryId', as: 'category' });

module.exports = {
  User,
  Event,
  Category
};