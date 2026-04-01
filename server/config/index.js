/**
 * 配置中心 —— 本地读 .env，云托管读环境变量
 */
require('dotenv').config();

module.exports = {
  port: process.env.PORT || 80,

  // 微信小程序
  wx: {
    appid: process.env.WX_APPID || '',
    secret: process.env.WX_SECRET || '',
  },

  // MySQL（微信云托管注入的环境变量）
  mysql: {
    host: (process.env.MYSQL_ADDRESS || 'localhost:3306').split(':')[0],
    port: parseInt((process.env.MYSQL_ADDRESS || 'localhost:3306').split(':')[1] || '3306'),
    user: process.env.MYSQL_USERNAME || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'vocab_master',
  },

  // 是否使用 MySQL（云托管上有 MYSQL_ADDRESS 时自动启用）
  useMySQL: !!process.env.MYSQL_ADDRESS,

  // LLM API
  llm: {
    apiKey: process.env.LLM_API_KEY || '',
    apiUrl: process.env.LLM_API_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
    model: process.env.LLM_MODEL || 'qwen-turbo',
  },
};