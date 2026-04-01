/**
 * 数据库层 —— 本地 SQLite / 云托管 MySQL 自动切换
 *
 * 本地开发无需安装 MySQL，使用内存 Map 模拟（零依赖）。
 * 部署到微信云托管后，通过 MYSQL_ADDRESS 环境变量自动切换到 MySQL。
 */
const mysql = require('mysql2/promise');
const config = require('../config');

let pool = null;

// ============================================================
// 初始化
// ============================================================
async function init() {
  if (!config.useMySQL) {
    console.log('[DB] 本地开发模式 —— 使用内存存储');
    return;
  }

  console.log(`[DB] 连接 MySQL: ${config.mysql.host}:${config.mysql.port}`);
  pool = mysql.createPool({
    host: config.mysql.host,
    port: config.mysql.port,
    user: config.mysql.user,
    password: config.mysql.password,
    database: config.mysql.database,
    waitForConnections: true,
    connectionLimit: 10,
    charset: 'utf8mb4',
  });

  // 建表
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

  console.log('[DB] MySQL 初始化完成');
}

// ============================================================
// 内存存储（本地开发用）
// ============================================================
const memStore = {
  users: [],       // { id, openid, sessionKey, nickname, avatarUrl, createdAt }
  vocabulary: [],  // { id, userId, term, meaning, phonetic, context, sourceUrl, createdAt }
  _userId: 0,
  _vocabId: 0,
};

// ============================================================
// User 操作
// ============================================================
async function findUserByOpenid(openid) {
  if (pool) {
    const [rows] = await pool.execute('SELECT * FROM t_user WHERE openid = ?', [openid]);
    return rows[0] || null;
  }
  return memStore.users.find(u => u.openid === openid) || null;
}

async function createUser(openid, sessionKey) {
  if (pool) {
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
  if (pool) {
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
  if (pool) {
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
  if (pool) {
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
  if (pool) {
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
  if (pool) {
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
  if (pool) {
    const [result] = await pool.execute(
      `INSERT IGNORE INTO t_vocabulary (user_id, term, meaning, phonetic, context, source_url)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, term, meaning, phonetic || '', context || '', sourceUrl || '']
    );
    return result.insertId;
  }
  // 内存去重
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
  if (pool) {
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
  if (pool) {
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