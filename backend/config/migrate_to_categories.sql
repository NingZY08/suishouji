-- 数据库迁移脚本：从硬编码分类到分类表
-- 使用方法：
-- 1. 先备份数据库
-- 2. 登录MySQL: mysql -u NingZY -p
-- 3. 使用数据库: USE suishouji;
-- 4. 执行此脚本

-- ============================================
-- 步骤1：创建分类表
-- ============================================
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

-- ============================================
-- 步骤2：插入初始分类数据
-- ============================================

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
(3, 'AI', 2, 1),
(3, '编程', 2, 2),
(3, '英语', 2, 3);

-- 三级分类
INSERT INTO categories (parent_id, name, level, sort_order) VALUES
(5, '周会', 3, 1),
(5, '月会', 3, 2),
(5, '客户会议', 3, 3),
(6, '开发', 3, 1),
(6, '测试', 3, 2),
(6, '设计', 3, 3);

-- ============================================
-- 步骤3：修改Events表（保留旧字段，添加新字段
-- ============================================

-- 检查category_id列是否已存在，不存在则添加
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'Events' 
    AND COLUMN_NAME = 'category_id');

SET @sql = IF(@col_exists = 0,
    'ALTER TABLE Events 
    ADD COLUMN category_id INT DEFAULT NULL COMMENT "分类ID（指向第三级分类）" AFTER status,
    'SELECT "Column category_id already exists" AS message');

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 添加索引和外键约束（如果还没有）
SET @fk_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'Events' 
    AND CONSTRAINT_NAME = 'fk_events_category');

SET @sql = IF(@fk_exists = 0,
    'ALTER TABLE Events 
    ADD INDEX idx_category_id (category_id),
    ADD CONSTRAINT fk_events_category FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL',
    'SELECT "Foreign key fk_events_category already exists" AS message');

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ============================================
-- 步骤4：数据迁移（可选）
-- 将旧的type_level1/2/3转换为category_id
-- 注意：需要根据你的实际数据调整映射
-- ============================================

-- 示例：创建临时映射表
-- CREATE TEMPORARY TABLE category_mapping (
--     old_level1 VARCHAR(50),
--     old_level2 VARCHAR(50),
--     old_level3 VARCHAR(50),
--     category_id INT
-- );

-- 填充映射表并更新数据
-- UPDATE Events e
-- JOIN category_mapping m 
--     ON e.type_level1 = m.old_level1
--     AND (e.type_level2 = m.old_level2 OR (m.old_level2 IS NULL AND e.type_level2 IS NULL))
--     AND (e.type_level3 = m.old_level3 OR (m.old_level3 IS NULL AND e.type_level3 IS NULL))
-- SET e.category_id = m.category_id;

-- ============================================
-- 完成！验证
-- ============================================

SELECT 'Migration completed!' AS status;
SELECT COUNT(*) AS categories_count FROM categories;
SELECT 
    TABLE_NAME,
    COLUMN_NAME,
    CONSTRAINT_NAME,
    REFERENCED_TABLE_NAME
FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
WHERE TABLE_SCHEMA = DATABASE()
AND TABLE_NAME = 'Events';
