const { Sequelize } = require('sequelize');

// 使用MySQL数据库
const sequelize = new Sequelize({
  dialect: 'mysql',
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  username: process.env.DB_USER || 'your_username',
  password: process.env.DB_PASSWORD || 'your_password',
  database: process.env.DB_NAME || 'suishouji',
  logging: false,
  dialectOptions: {
    connectTimeout: 10000
  }
});

module.exports = sequelize;
