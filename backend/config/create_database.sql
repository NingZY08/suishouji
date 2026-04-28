-- 创建数据库
CREATE DATABASE IF NOT EXISTS suishouji 
CHARACTER SET utf8mb4 
COLLATE utf8mb4_0900_ai_ci;

-- 使用数据库
USE suishouji;

-- 创建用户表
CREATE TABLE IF NOT EXISTS Users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  username VARCHAR(50) NOT NULL,
  email VARCHAR(100) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

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

-- 创建事件表
CREATE TABLE IF NOT EXISTS Events (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  user_id INT NOT NULL,
  title VARCHAR(100) NOT NULL,
  content TEXT,
  start_date DATE NOT NULL,
  end_date DATE,
  result VARCHAR(500),
  status VARCHAR(20) DEFAULT '进行中',
  category_id INT DEFAULT NULL COMMENT '分类ID（指向第三级分类）',
  type_level1 VARCHAR(50) DEFAULT NULL COMMENT '一级分类名称（冗余，便于查询）',
  type_level2 VARCHAR(50) DEFAULT NULL COMMENT '二级分类名称（冗余，便于查询）',
  type_level3 VARCHAR(50) DEFAULT NULL COMMENT '三级分类名称（冗余，便于查询）',
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

-- 插入初始分类数据
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
