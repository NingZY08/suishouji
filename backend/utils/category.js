const { Category, Event } = require('../models');

/**
 * 根据category_id自动填充type_level1/2/3字段
 * @param {Event} event - 事件实例
 * @returns {Promise<Event>} 更新后的事件
 */
async function populateCategoryFields(event) {
  if (!event.categoryId) {
    event.typeLevel1 = null;
    event.typeLevel2 = null;
    event.typeLevel3 = null;
    return event;
  }

  const category = await Category.findByPk(event.categoryId, {
    include: [{
      model: Category,
      as: 'parent',
      include: [{
        model: Category,
        as: 'parent'
      }]
    }]
  });

  if (!category) {
    return event;
  }

  if (category.level === 1) {
    event.typeLevel1 = category.name;
    event.typeLevel2 = null;
    event.typeLevel3 = null;
  } else if (category.level === 2) {
    event.typeLevel1 = category.parent?.name || null;
    event.typeLevel2 = category.name;
    event.typeLevel3 = null;
  } else if (category.level === 3) {
    event.typeLevel1 = category.parent?.parent?.name || null;
    event.typeLevel2 = category.parent?.name || null;
    event.typeLevel3 = category.name;
  }

  return event;
}

/**
 * 根据type.level1/2/3查找对应的categoryId
 * @param {Object} type - 包含level1, level2, level3的对象
 * @returns {Promise<number|null>} 分类ID，如果没有找到返回null
 */
async function findCategoryIdByType(type) {
  if (!type || !type.level1) {
    return null;
  }

  try {
    if (type.level3) {
      const level3 = await Category.findOne({
        where: { name: type.level3, level: 3 },
        include: [{
          model: Category,
          as: 'parent',
          where: { name: type.level2, level: 2 },
          include: [{
            model: Category,
            as: 'parent',
            where: { name: type.level1, level: 1 }
          }]
        }]
      });
      return level3?.id || null;
    } else if (type.level2) {
      const level2 = await Category.findOne({
        where: { name: type.level2, level: 2 },
        include: [{
          model: Category,
          as: 'parent',
          where: { name: type.level1, level: 1 }
        }]
      });
      return level2?.id || null;
    } else if (type.level1) {
      const level1 = await Category.findOne({
        where: { name: type.level1, level: 1 }
      });
      return level1?.id || null;
    }
    return null;
  } catch (error) {
    console.error('查找分类ID失败:', error);
    return null;
  }
}

/**
 * 创建事件（自动填充分类字段）
 * @param {Object} eventData - 事件数据
 * @returns {Promise<Event>} 创建的事件
 */
async function createEventWithCategory(eventData) {
  console.log('createEventWithCategory - 接收到的 eventData:', eventData);
  let event = Event.build(eventData);
  console.log('createEventWithCategory - build 后的 event:', event.dataValues);
  event = await populateCategoryFields(event);
  console.log('createEventWithCategory - populateCategoryFields 后的 event:', event.dataValues);
  await event.save();
  console.log('createEventWithCategory - save 后的 event:', event.dataValues);
  return event;
}

/**
 * 更新事件（自动填充分类字段）
 * @param {Event} event - 事件实例
 * @param {Object} updateData - 更新数据
 * @returns {Promise<Event>} 更新后的事件
 */
async function updateEventWithCategory(event, updateData) {
  event.set(updateData);
  event = await populateCategoryFields(event);
  await event.save();
  return event;
}

/**
 * 获取完整的分类树
 * @returns {Promise<Array>} 分类树
 */
async function getCategoryTree() {
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
  return categories;
}

/**
 * 获取某个分类的完整路径（祖先链）
 * @param {number} categoryId - 分类ID
 * @returns {Promise<Object>} 包含level1, level2, level3的对象
 */
async function getCategoryPath(categoryId) {
  if (!categoryId) {
    return { level1: null, level2: null, level3: null };
  }

  const category = await Category.findByPk(categoryId, {
    include: [{
      model: Category,
      as: 'parent',
      include: [{
        model: Category,
        as: 'parent'
      }]
    }]
  });

  if (!category) {
    return { level1: null, level2: null, level3: null };
  }

  let path = {
    level1: null,
    level2: null,
    level3: null
  };

  if (category.level === 1) {
    path.level1 = category.name;
  } else if (category.level === 2) {
    path.level1 = category.parent?.name || null;
    path.level2 = category.name;
  } else if (category.level === 3) {
    path.level1 = category.parent?.parent?.name || null;
    path.level2 = category.parent?.name || null;
    path.level3 = category.name;
  }

  return path;
}

module.exports = {
  populateCategoryFields,
  createEventWithCategory,
  updateEventWithCategory,
  getCategoryTree,
  getCategoryPath,
  findCategoryIdByType
};