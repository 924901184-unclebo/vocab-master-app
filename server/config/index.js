/**
 * 配置中心 —— 本地读 .env，云托管读环境变量
 */
require('dotenv').config();

// 解析 MYSQL_ADDRESS（兼容多种格式）
function parseMySQLAddress(addr) {
  if (!addr) return { host: 'localhost', port: 3306 };
  // 去掉可能的协议头
  addr = addr.replace(/^mysql:\/\//, '').replace(/\/.*$/, '');
  const parts = addr.split(':');
  return {
    host: parts[0] || 'localhost',
    port: parseInt(parts[1]) || 3306,
  };
}

const mysqlAddr = parseMySQLAddress(process.env.MYSQL_ADDRESS);

module.exports = {
  port: process.env.PORT || 80,

  // 微信小程序
  wx: {
    appid: process.env.WX_APPID || '',
    secret: process.env.WX_SECRET || '',
  },

  // MySQL（微信云托管注入的环境变量）
  mysql: {
    host: mysqlAddr.host,
    port: mysqlAddr.port,
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