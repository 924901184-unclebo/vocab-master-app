/**
 * VocabMaster 后端服务入口
 *
 * 适配微信云托管：
 * - 默认监听 80 端口
 * - MySQL 通过环境变量注入
 * - 提供 GET / 健康检查
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

// ---- 健康检查（微信云托管必需） ----
app.get('/', (_req, res) => {
  res.json({
    code: 0,
    message: 'VocabMaster API is running',
    version: '1.0.0',
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
async function start() {
  try {
    await db.init();
    app.listen(config.port, '0.0.0.0', () => {
      console.log(`\n  ✨ VocabMaster 服务已启动`);
      console.log(`  📡 端口: ${config.port}`);
      console.log(`  💾 数据库: ${config.useMySQL ? 'MySQL' : '内存存储（本地开发）'}`);
      console.log(`  🤖 LLM: ${config.llm.apiKey ? config.llm.model : '未配置（使用正则提取）'}`);
      console.log();
    });
  } catch (err) {
    console.error('启动失败:', err);
    process.exit(1);
  }
}

start();