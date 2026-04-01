/**
 * 数据库层 —— 本地内存 / 云托管 MySQL 自动切换
 *
 * 修复云托管部署问题：
 * 1. 自动创建数据库（云托管不预建库）
 * 2. 连接失败不阻塞启动，带重试机制
 * 3. DB 未就绪时 API 降级为内存模式
 */
const mysql = require('mysql2/promise');
const config = require('../config');

let pool = null;
let dbReady = false;

// ============================================================
// 初始化（不抛异常，不阻塞启动）
// ============================================================
async function init() {
  if (!config.useMySQL) {
    console.log('[DB] 本地开发模式 —— 使用内存存储');
    dbReady = true;
    return;
  }

  // 异步初始化，不阻塞 HTTP 服务启动
  initMySQL().catch(err => {
    console.error('[DB] MySQL 初始化最终失败，降级为内存模式:', err.message);
  });
}

async function initMySQL(retries = 5) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`[DB] 第 ${attempt}/${retries} 次尝试连接 MySQL: ${config.mysql.host}:${config.mysql.port}`);

      // 1. 先不指定数据库，连接 MySQL 实例
      const tempConn = await mysql.createConnection({
        host: config.mysql.host,
        port: config.mysql.port,
        user: config.mysql.user,
        password: config.mysql.password,
        charset: 'utf8mb4',
        connectTimeout: 10000,
      });

      // 2. 自动创建数据库（如果不存在）
      await tempConn.execute(
        `CREATE DATABASE IF NOT EXISTS \`${config.mysql.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci`
      );
      console.log(`[DB] 数据库 "${config.mysql.database}" 已就绪`);
      await tempConn.end();

      // 3. 创建连接池（指定数据库）
      pool = mysql.createPool({
        host: config.mysql.host,
        port: config.mysql.port,
        user: config.mysql.user,
        password: config.mysql.password,
        database: config.mysql.database,
        waitForConnections: true,
        connectionLimit: 10,
        charset: 'utf8mb4',
        connectTimeout: 10000,
      });

      // 4. 验证连接
      const conn = await pool.getConnection();
      conn.release();

      // 5. 建表
      await pool.execute(`
        CREATE TABLE IF NOT EXISTS t_user (
          id          BIGINT AUTO_INCREMENT PRIMARY KEY,
          openid      VARCHAR(64)  NOT NULL UNIQUE,
          session_key VARCHAR(128) DEFAULT '',
          nickname    VARCHAR(64)  DEFAULT '',
          avatar_url  VARCHAR(512) DEFAULT '',
          created_at  DATETIME     DEFAULT CURRENT_TIMESTAMP,
          updated_at  DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);

      await pool.execute(`
        CREATE TABLE IF NOT EXISTS t_vocabulary (
          id          BIGINT AUTO_INCREMENT PRIMARY KEY,
          user_id     BIGINT       NOT NULL,
          term        VARCHAR(128) NOT NULL,
          meaning     VARCHAR(512) NOT NULL,
          phonetic    VARCHAR(128) DEFAULT '',
          context     VARCHAR(1024) DEFAULT '',
          source_url  VARCHAR(1024) DEFAULT '',
          created_at  DATETIME     DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY uk_user_term (user_id, term),
          INDEX idx_user_id (user_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);

      dbReady = true;
      console.log('[DB] ✅ MySQL 初始化完成');
      return; // 成功，退出重试

    } catch (err) {
      console.error(`[DB] 第 ${attempt} 次连接失败: ${err.message}`);
      if (attempt < retries) {
        const delay = attempt * 3000; // 3s, 6s, 9s, 12s, 15s
        console.log(`[DB] ${delay / 1000}s 后重试...`);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }
}

/** 是否使用 MySQL（已连接且就绪） */
function isMySQL() {
  return pool !== null && dbReady;
}

// ============================================================
// 内存存储（本地开发 & MySQL 降级兜底）
// ============================================================
const memStore = {
  users: [],
  vocabulary: [],
  _userId: 0,
  _vocabId: 0,
};

// ============================================================
// User 操作
// ============================================================
async function findUserByOpenid(openid) {
  if (isMySQL()) {
    const [rows] = await pool.execute('SELECT * FROM t_user WHERE openid = ?', [openid]);
    return rows[0] || null;
  }
  return memStore.users.find(u => u.openid === openid) || null;
}

async function createUser(openid, sessionKey) {
  if (isMySQL()) {
    const [result] = await pool.execute(
      'INSERT INTO t_user (openid, session_key) VALUES (?, ?)',
      [openid, sessionKey]
    );
    return { id: result.insertId, openid, sessionKey };
  }
  const user = {
    id: ++memStore._userId,
    openid,
    sessionKey,
    nickname: '',
    avatarUrl: '',
    createdAt: new Date().toISOString(),
  };
  memStore.users.push(user);
  return user;
}

async function updateUserSession(id, sessionKey) {
  if (isMySQL()) {
    await pool.execute('UPDATE t_user SET session_key = ? WHERE id = ?', [sessionKey, id]);
    return;
  }
  const user = memStore.users.find(u => u.id === id);
  if (user) user.sessionKey = sessionKey;
}

// ============================================================
// Vocabulary 操作
// ============================================================
async function getVocabList(userId) {
  if (isMySQL()) {
    const [rows] = await pool.execute(
      'SELECT * FROM t_vocabulary WHERE user_id = ? ORDER BY term ASC',
      [userId]
    );
    return rows;
  }
  return memStore.vocabulary
    .filter(v => v.userId === userId)
    .sort((a, b) => a.term.localeCompare(b.term));
}

async function getVocabBatch(userId, limit = 10) {
  if (isMySQL()) {
    const [rows] = await pool.execute(
      'SELECT * FROM t_vocabulary WHERE user_id = ? ORDER BY RAND() LIMIT ?',
      [userId, limit]
    );
    return rows;
  }
  const userWords = memStore.vocabulary.filter(v => v.userId === userId);
  const shuffled = [...userWords].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, limit);
}

async function searchVocab(userId, query) {
  const q = `%${query}%`;
  if (isMySQL()) {
    const [rows] = await pool.execute(
      `SELECT * FROM t_vocabulary WHERE user_id = ?
       AND (LOWER(term) LIKE LOWER(?) OR LOWER(meaning) LIKE LOWER(?))
       ORDER BY term ASC`,
      [userId, q, q]
    );
    return rows;
  }
  const lq = query.toLowerCase();
  return memStore.vocabulary
    .filter(v => v.userId === userId &&
      (v.term.toLowerCase().includes(lq) || v.meaning.toLowerCase().includes(lq)))
    .sort((a, b) => a.term.localeCompare(b.term));
}

async function vocabExists(userId, term) {
  if (isMySQL()) {
    const [rows] = await pool.execute(
      'SELECT id FROM t_vocabulary WHERE user_id = ? AND LOWER(term) = LOWER(?)',
      [userId, term]
    );
    return rows.length > 0;
  }
  return memStore.vocabulary.some(
    v => v.userId === userId && v.term.toLowerCase() === term.toLowerCase()
  );
}

async function addVocab(userId, { term, meaning, phonetic, context, sourceUrl }) {
  if (isMySQL()) {
    const [result] = await pool.execute(
      `INSERT IGNORE INTO t_vocabulary (user_id, term, meaning, phonetic, context, source_url)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, term, meaning, phonetic || '', context || '', sourceUrl || '']
    );
    return result.insertId;
  }
  if (await vocabExists(userId, term)) return null;
  const vocab = {
    id: ++memStore._vocabId,
    userId,
    term,
    meaning,
    phonetic: phonetic || '',
    context: context || '',
    sourceUrl: sourceUrl || '',
    createdAt: new Date().toISOString(),
  };
  memStore.vocabulary.push(vocab);
  return vocab.id;
}

async function batchAddVocab(userId, words, sourceUrl) {
  let added = 0;
  for (const w of words) {
    const id = await addVocab(userId, {
      term: w.term,
      meaning: w.meaning,
      phonetic: w.phonetic,
      context: w.context,
      sourceUrl: w.sourceUrl || sourceUrl,
    });
    if (id) added++;
  }
  return added;
}

async function deleteVocab(userId, vocabId) {
  if (isMySQL()) {
    const [result] = await pool.execute(
      'DELETE FROM t_vocabulary WHERE id = ? AND user_id = ?',
      [vocabId, userId]
    );
    return result.affectedRows > 0;
  }
  const idx = memStore.vocabulary.findIndex(v => v.id === vocabId && v.userId === userId);
  if (idx === -1) return false;
  memStore.vocabulary.splice(idx, 1);
  return true;
}

async function countVocab(userId) {
  if (isMySQL()) {
    const [rows] = await pool.execute(
      'SELECT COUNT(*) AS cnt FROM t_vocabulary WHERE user_id = ?',
      [userId]
    );
    return rows[0].cnt;
  }
  return memStore.vocabulary.filter(v => v.userId === userId).length;
}

module.exports = {
  init,
  isMySQL,
  findUserByOpenid,
  createUser,
  updateUserSession,
  getVocabList,
  getVocabBatch,
  searchVocab,
  vocabExists,
  addVocab,
  batchAddVocab,
  deleteVocab,
  countVocab,
};