/**
 * VocabMaster 后端服务入口
 *
 * 适配微信云托管：
 * - 默认监听 80 端口（PORT 环境变量可覆盖）
 * - MySQL 通过环境变量注入，连接失败降级为内存模式
 * - GET / 健康检查（容器探活必需，先于 DB 就绪）
 */
const express = require('express');
const cors = require('cors');
const config = require('./config');
const db = require('./db');

// 路由
const authRoutes = require('./routes/auth');
const vocabRoutes = require('./routes/vocab');
const articleRoutes = require('./routes/article');

const app = express();

// ---- 中间件 ----
app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

// ---- 健康检查（微信云托管容器探活，必须立即响应） ----
app.get('/', (_req, res) => {
  res.json({
    code: 0,
    message: 'VocabMaster API is running',
    version: '1.0.0',
    db: db.isMySQL() ? 'mysql' : 'memory',
  });
});

// ---- API 路由 ----
app.use('/api/auth', authRoutes);
app.use('/api/vocab', vocabRoutes);
app.use('/api/article', articleRoutes);

// ---- 全局错误处理 ----
app.use((err, _req, res, _next) => {
  console.error('[Global Error]', err);
  res.status(500).json({ code: -1, message: '服务器内部错误' });
});

// ---- 启动 ----
// 关键：先启动 HTTP 服务（让健康检查通过），再异步初始化 DB
const server = app.listen(config.port, '0.0.0.0', () => {
  console.log(`\n  ✨ VocabMaster 服务已启动`);
  console.log(`  📡 端口: ${config.port}`);
  console.log(`  💾 数据库: ${config.useMySQL ? 'MySQL（异步连接中...）' : '内存存储（本地开发）'}`);
  console.log(`  🤖 LLM: ${config.llm.apiKey ? config.llm.model : '未配置（使用正则提取）'}`);
  console.log();

  // HTTP 已就绪后，异步初始化数据库（不阻塞健康检查）
  db.init().catch(err => {
    console.error('[DB] 初始化异常（服务继续运行，使用内存模式）:', err.message);
  });
});

// 优雅关闭
process.on('SIGTERM', () => {
  console.log('[App] 收到 SIGTERM，优雅关闭...');
  server.close(() => process.exit(0));
});

process.on('SIGINT', () => {
  console.log('[App] 收到 SIGINT，优雅关闭...');
  server.close(() => process.exit(0));
});