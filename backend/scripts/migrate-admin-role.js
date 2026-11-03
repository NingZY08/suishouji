// 管理员角色迁移脚本（幂等）：
//   1. users 表新增 role ENUM('user','admin') DEFAULT 'user'
//   2. users 表新增 token_version INT DEFAULT 0
//   3. 可选参数 --set-admin <email>：将指定邮箱用户提升为 admin
// 用法: node scripts/migrate-admin-role.js [--set-admin someone@example.com]
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mysql = require('mysql2/promise');

(async () => {
  const conn = await mysql.createConnection({
    host: process.env.CLOUDSQLPUB_DB_HOST,
    port: Number(process.env.CLOUDSQLPUB_DB_PORT) || 3306,
    user: process.env.CLOUDSQLPUB_DB_USER,
    password: process.env.CLOUDSQLPUB_DB_PASSWORD,
    database: process.env.CLOUDSQLPUB_DB_NAME
  });

  const columnExists = async (table, column) => {
    const [rows] = await conn.query(
      `SELECT COUNT(*) AS n FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
      [process.env.CLOUDSQLPUB_DB_NAME, table, column]
    );
    return rows[0].n > 0;
  };

  if (!(await columnExists('users', 'role'))) {
    await conn.query("ALTER TABLE users ADD COLUMN role ENUM('user','admin') NOT NULL DEFAULT 'user'");
    console.log('[migrate] users.role 已添加');
  } else {
    console.log('[migrate] users.role 已存在，跳过');
  }

  if (!(await columnExists('users', 'token_version'))) {
    await conn.query('ALTER TABLE users ADD COLUMN token_version INT NOT NULL DEFAULT 0');
    console.log('[migrate] users.token_version 已添加');
  } else {
    console.log('[migrate] users.token_version 已存在，跳过');
  }

  const setAdminIdx = process.argv.indexOf('--set-admin');
  if (setAdminIdx > 0 && process.argv[setAdminIdx + 1]) {
    const email = process.argv[setAdminIdx + 1];
    const [result] = await conn.query(
      "UPDATE users SET role = 'admin' WHERE email = ? AND role <> 'admin'",
      [email]
    );
    if (result.affectedRows > 0) {
      console.log(`[migrate] 已将 ${email} 提升为 admin`);
    } else {
      console.log(`[migrate] 未找到该邮箱用户或已是 admin: ${email}`);
    }
  }

  await conn.end();
  console.log('[migrate] 完成');
})().catch((err) => {
  console.error('[migrate] 失败:', err.message);
  process.exit(1);
});
