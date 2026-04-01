/**
 * 文章解析路由 —— /api/article
 */
const { Router } = require('express');
const auth = require('../middleware/auth');
const { fetchArticle } = require('../services/parser');
const { extractTerms } = require('../services/llm');
const db = require('../db');

const router = Router();

router.use(auth);

/**
 * POST /api/article/parse
 * Body: { url: "文章链接" }
 *
 * 1. 抓取网页正文
 * 2. 调用 LLM 提取术语
 * 3. 标记已存在的术语
 */
router.post('/parse', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) {
      return res.json({ code: -1, message: '文章 URL 不能为空' });
    }

    // 1. 抓取文章
    const { title, text } = await fetchArticle(url);
    if (!text || text.length < 10) {
      return res.json({ code: -1, message: '文章内容为空或无法解析' });
    }

    // 2. AI 提取术语
    const terms = await extractTerms(text);

    // 3. 标记是否已存在于词库
    const enrichedTerms = await Promise.all(
      terms.map(async (t) => ({
        term: t.term,
        meaning: t.meaning || '',
        context: t.context || '',
        existsInLibrary: await db.vocabExists(req.userId, t.term),
      }))
    );

    res.json({
      code: 0,
      data: {
        title,
        terms: enrichedTerms,
      },
    });
  } catch (err) {
    console.error('[Article] parse error:', err);

    if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
      return res.json({ code: -1, message: '无法访问该链接，请检查 URL' });
    }
    res.json({ code: -1, message: '文章解析失败: ' + err.message });
  }
});

module.exports = router;