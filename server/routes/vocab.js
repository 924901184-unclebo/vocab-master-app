/**
 * 词汇路由 —— /api/vocab
 */
const { Router } = require('express');
const auth = require('../middleware/auth');
const db = require('../db');

const router = Router();

// 所有词汇接口都需要登录
router.use(auth);

/**
 * GET /api/vocab/list
 * 获取用户全部词汇（按字母排序）
 */
router.get('/list', async (req, res) => {
  try {
    const list = await db.getVocabList(req.userId);
    const count = list.length;
    res.json({ code: 0, data: { list, count } });
  } catch (err) {
    console.error('[Vocab] list error:', err);
    res.json({ code: -1, message: '获取词汇失败' });
  }
});

/**
 * GET /api/vocab/batch?limit=10
 * 随机获取一批词汇（用于词卡复习）
 */
router.get('/batch', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const list = await db.getVocabBatch(req.userId, limit);
    res.json({ code: 0, data: { list, count: list.length } });
  } catch (err) {
    console.error('[Vocab] batch error:', err);
    res.json({ code: -1, message: '获取词汇失败' });
  }
});

/**
 * GET /api/vocab/search?q=keyword
 * 模糊搜索术语或释义
 */
router.get('/search', async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (!q) {
      return res.json({ code: 0, data: { list: [], count: 0 } });
    }
    const list = await db.searchVocab(req.userId, q);
    res.json({ code: 0, data: { list, count: list.length } });
  } catch (err) {
    console.error('[Vocab] search error:', err);
    res.json({ code: -1, message: '搜索失败' });
  }
});

/**
 * POST /api/vocab/add
 * 添加单个词汇
 * Body: { term, meaning, phonetic?, context?, sourceUrl? }
 */
router.post('/add', async (req, res) => {
  try {
    const { term, meaning, phonetic, context, sourceUrl } = req.body;
    if (!term || !meaning) {
      return res.json({ code: -1, message: '术语和释义不能为空' });
    }

    const exists = await db.vocabExists(req.userId, term);
    if (exists) {
      return res.json({ code: 1, message: `"${term}" 已存在词库中` });
    }

    const id = await db.addVocab(req.userId, { term, meaning, phonetic, context, sourceUrl });
    res.json({ code: 0, message: '添加成功', data: { id } });
  } catch (err) {
    console.error('[Vocab] add error:', err);
    res.json({ code: -1, message: '添加失败' });
  }
});

/**
 * POST /api/vocab/batch-add
 * 批量添加词汇（文章提取后确认入库）
 * Body: { words: [{term, meaning, phonetic?, context?}], sourceUrl? }
 */
router.post('/batch-add', async (req, res) => {
  try {
    const { words, sourceUrl } = req.body;
    if (!words || !Array.isArray(words) || words.length === 0) {
      return res.json({ code: -1, message: '词汇列表不能为空' });
    }

    const added = await db.batchAddVocab(req.userId, words, sourceUrl || '');
    const total = await db.countVocab(req.userId);
    res.json({
      code: 0,
      message: `成功添加 ${added} 个术语`,
      data: { added, total },
    });
  } catch (err) {
    console.error('[Vocab] batch-add error:', err);
    res.json({ code: -1, message: '批量添加失败' });
  }
});

/**
 * DELETE /api/vocab/:id
 * 删除指定词汇
 */
router.delete('/:id', async (req, res) => {
  try {
    const vocabId = parseInt(req.params.id);
    if (!vocabId) {
      return res.json({ code: -1, message: '无效的 ID' });
    }

    const ok = await db.deleteVocab(req.userId, vocabId);
    if (!ok) {
      return res.json({ code: -1, message: '词汇不存在或无权删除' });
    }
    res.json({ code: 0, message: '删除成功' });
  } catch (err) {
    console.error('[Vocab] delete error:', err);
    res.json({ code: -1, message: '删除失败' });
  }
});

module.exports = router;