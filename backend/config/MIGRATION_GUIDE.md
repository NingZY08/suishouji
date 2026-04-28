# 数据库迁移指南

## 设计说明：混合分类架构

本项目采用**混合设计**，同时保留两种方式：

| 字段 | 说明 |
|------|------|
| `category_id` | 外键，指向 `categories` 表（标准化、可维护） |
| `type_level1/2/3` | 冗余字段，存储分类名称（便于查询、避免多次JOIN） |

**优势**：
1. `category_id` 作为主外键，分类管理标准化
2. `type_level1/2/3` 作为冗余字段，前端直接读取显示，无需JOIN查询
3. 利用 `utils/category.js` 自动维护两个字段的一致性

---

## 方案一：全新创建（推荐用于新数据库）

如果还没有数据，可以直接执行完整的SQL脚本：

```bash
mysql -u NingZY -p < backend/config/create_database.sql
```

## 方案二：逐步迁移（已有数据时使用）

如果已有用户数据，按以下步骤操作：

### 步骤1：备份数据库（重要！）

```bash
mysqldump -u NingZY -p suishouji > backup_$(date +%Y%m%d).sql
```

### 步骤2：创建分类表

```sql
USE suishouji;

-- 创建分类表
CREATE TABLE IF NOT EXISTS categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    parent_id INT DEFAULT NULL,
    name VARCHAR(50) NOT NULL,
    level TINYINT NOT NULL COMMENT '分类级别 (1, 2, 3)',
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE CASCADE,
    INDEX idx_parent_id (parent_id),
    INDEX idx_level (level)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

### 步骤3：插入初始分类数据

```sql
-- 一级分类
INSERT INTO categories (name, level, sort_order) VALUES
('工作', 1, 1),
('生活', 1, 2),
('学习', 1, 3),
('其他', 1, 4);

-- 二级分类
INSERT INTO categories (parent_id, name, level, sort_order) VALUES
(1, '会议', 2, 1),
(1, '项目', 2, 2),
(1, '文档', 2, 3),
(2, '购物', 2, 1),
(2, '健康', 2, 2),
(2, '娱乐', 2, 3),
(3, '课程', 2, 1),
(3, '阅读', 2, 2),
(3, '考证', 2, 3);

-- 三级分类
INSERT INTO categories (parent_id, name, level, sort_order) VALUES
(5, '周会', 3, 1),
(5, '月会', 3, 2),
(5, '客户会议', 3, 3),
(6, '开发', 3, 1),
(6, '测试', 3, 2),
(6, '设计', 3, 3);
```

### 步骤4：修改Events表

#### 方法A：直接修改（保留旧字段（推荐）

```sql
-- 添加category_id字段
ALTER TABLE Events 
ADD COLUMN category_id INT DEFAULT NULL COMMENT '分类ID' AFTER status,
ADD INDEX idx_category_id (category_id),
ADD CONSTRAINT fk_events_category FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL;
```

#### 方法B：完全重建Events表（删除旧字段）

```sql
-- 备份Events表数据
CREATE TABLE Events_backup LIKE Events;
INSERT INTO Events_backup SELECT * FROM Events;

-- 删除旧表并创建新表
DROP TABLE Events;

-- 使用新结构创建Events表
CREATE TABLE Events (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  user_id INT NOT NULL,
  title VARCHAR(100) NOT NULL,
  content TEXT,
  start_date DATE NOT NULL,
  end_date DATE,
  result VARCHAR(500),
  status VARCHAR(20) DEFAULT '进行中',
  category_id INT DEFAULT NULL COMMENT '分类ID',
  files JSON DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME DEFAULT NULL,
  INDEX idx_user_id (user_id),
  INDEX idx_status (status),
  INDEX idx_start_date (start_date),
  INDEX idx_deleted_at (deleted_at),
  INDEX idx_category_id (category_id),
  CONSTRAINT fk_events_user FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE,
  CONSTRAINT fk_events_category FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 恢复数据（需要手动映射旧分类到新的category_id）
INSERT INTO Events 
(id, user_id, title, content, start_date, end_date, result, status, files, created_at, updated_at, deleted_at)
SELECT id, user_id, title, content, start_date, end_date, result, status, files, created_at, updated_at, deleted_at 
FROM Events_backup;

-- 可选：删除备份表
DROP TABLE Events_backup;
```

### 步骤5：验证迁移

```sql
-- 检查表结构
DESC categories;
DESC Events;

-- 查看分类数据
SELECT * FROM categories ORDER BY level, sort_order;

-- 查看外键约束
SELECT 
    TABLE_NAME,
    COLUMN_NAME,
    CONSTRAINT_NAME,
    REFERENCED_TABLE_NAME
FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
WHERE TABLE_SCHEMA = 'suishouji'
AND TABLE_NAME = 'Events';
```

## 常用SQL操作示例

### 1. 查询分类

```sql
-- 查询一级分类
SELECT * FROM categories WHERE level = 1 ORDER BY sort_order;

-- 查询某个分类的子分类
SELECT * FROM categories WHERE parent_id = 1 ORDER BY sort_order;

-- 查询完整分类树（三级）
SELECT 
    c1.name AS level1,
    c2.name AS level2,
    c3.name AS level3
FROM categories c1
LEFT JOIN categories c2 ON c1.id = c2.parent_id
LEFT JOIN categories c3 ON c2.id = c3.parent_id
WHERE c1.level = 1
ORDER BY c1.sort_order, c2.sort_order, c3.sort_order;
```

### 2. 操作事件

```sql
-- 添加新事件
INSERT INTO Events 
(title, user_id, start_date, category_id)
VALUES
('项目周会', 1, '2024-01-01', 7);

-- 查询事件及其分类
SELECT 
    e.*, c.name AS category_name
FROM Events e
LEFT JOIN categories c ON e.category_id = c.id
WHERE e.user_id = 1;
```

### 3. 添加新分类

```sql
-- 添加一级分类
INSERT INTO categories (name, level, sort_order) VALUES ('旅行', 1, 5);

-- 添加子分类
INSERT INTO categories (parent_id, name, level, sort_order) VALUES 
(4, '待办事项', 2, 4);
```

## Sequelize模型查询示例

在你的后端代码中使用：

```javascript
const { Category, Event } = require('./models');

// 获取分类树
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

// 创建带分类的事件
async function createEventWithCategory(eventData) {
  const event = await Event.create({
    ...eventData,
    include: [Category]
  });
  return event;
}
```
