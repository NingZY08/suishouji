const mysql = require('mysql2/promise');

async function checkEvents() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    port: 3306,
    user: 'NingZY',
    password: '788107',
    database: 'suishouji'
  });

  const [rows] = await connection.query('SELECT id, title, files FROM events ORDER BY created_at DESC LIMIT 5');
  console.log('最近 5 个事件的 files 数据:');
  rows.forEach((row, i) => {
    console.log(`${i+1}. ID: ${row.id}`);
    console.log(`   标题: ${row.title}`);
    console.log(`   files: ${JSON.stringify(row.files)}`);
    console.log('');
  });

  await connection.end();
}

checkEvents().catch(e => console.error('错误:', e.message));
