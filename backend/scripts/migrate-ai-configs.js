// 将旧版单行 ai_configs（userId 为主键）迁移为多行结构：
// 新增自增主键 id、配置名称 name、默认标记 is_default；旧配置数据保留并标记为默认。
// 幂等：每一步先检查 information_schema，已完成的步骤自动跳过，可重复执行。
// 注意：user_id 上有外键约束，必须先为其建立普通索引才能 DROP 原主键。
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const sequelize = require('../config/database');

const columnExists = (cols, name) => cols.some(c => c.COLUMN_NAME === name);
const indexExists = async (indexName) => {
  const [rows] = await sequelize.query(
    "SELECT INDEX_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ai_configs' AND INDEX_NAME = ?",
    { replacements: [indexName] }
  );
  return rows.length > 0;
};

(async () => {
  try {
    const [cols] = await sequelize.query(
      "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ai_configs'"
    );

    if (cols.length === 0) {
      console.log('ai_configs 表不存在，将由 sequelize.sync() 创建新结构');
      return;
    }

    if (!columnExists(cols, 'name')) {
      await sequelize.query("ALTER TABLE ai_configs ADD COLUMN name VARCHAR(50) NOT NULL DEFAULT '默认配置' AFTER user_id");
      console.log('已添加列 name');
    }
    if (!columnExists(cols, 'is_default')) {
      await sequelize.query('ALTER TABLE ai_configs ADD COLUMN is_default TINYINT(1) NOT NULL DEFAULT 0 AFTER model');
      console.log('已添加列 is_default');
    }
    if (!columnExists(cols, 'id')) {
      await sequelize.query('ALTER TABLE ai_configs ADD COLUMN id INT NOT NULL FIRST');
      await sequelize.query('ALTER TABLE ai_configs ADD INDEX idx_ai_configs_id (id)');
      console.log('已添加列 id 及普通索引');
    }
    if (!(await indexExists('idx_ai_configs_user_id'))) {
      await sequelize.query('ALTER TABLE ai_configs ADD INDEX idx_ai_configs_user_id (user_id)');
      console.log('已添加 user_id 普通索引（替代主键索引供外键使用）');
    }

    const [pk] = await sequelize.query(
      "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ai_configs' AND COLUMN_KEY = 'PRI'"
    );
    if (pk.length === 0 || pk[0].COLUMN_NAME !== 'id') {
      await sequelize.query('ALTER TABLE ai_configs DROP PRIMARY KEY');
      await sequelize.query('ALTER TABLE ai_configs MODIFY id INT NOT NULL AUTO_INCREMENT, ADD PRIMARY KEY (id)');
      console.log('主键已切换为 id');
    }

    // 旧数据迁移：若存在配置且没有默认行，把最早一行设为默认
    const [defaults] = await sequelize.query('SELECT COUNT(*) AS c FROM ai_configs WHERE is_default = 1');
    if (Number(defaults[0].c) === 0) {
      const [first] = await sequelize.query('SELECT id FROM ai_configs ORDER BY id ASC LIMIT 1');
      if (first.length > 0) {
        await sequelize.query('UPDATE ai_configs SET is_default = 1 WHERE id = ?', { replacements: [first[0].id] });
        console.log(`已将旧配置 id=${first[0].id} 标记为默认`);
      }
    }

    console.log('ai_configs 迁移完成');
  } catch (error) {
    console.error('迁移失败:', error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
})();
