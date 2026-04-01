/**
 * 文章解析服务 —— 抓取网页 + 提取正文
 */
const axios = require('axios');
const cheerio = require('cheerio');

/**
 * 抓取 URL 并提取正文文本
 * @param {string} url
 * @returns {Promise<{title: string, text: string}>}
 */
async function fetchArticle(url) {
  const { data: html } = await axios.get(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; VocabMaster/1.0)',
    },
    timeout: 15000,
    responseType: 'text',
  });

  const $ = cheerio.load(html);

  // 移除无关标签
  $('script, style, nav, header, footer, iframe, noscript, aside, .ad, .sidebar').remove();

  const title = $('title').text().trim()
    || $('h1').first().text().trim()
    || '未知标题';

  // 提取正文：优先使用 article / main 标签，否则取 body
  let text = '';
  const mainEl = $('article').length ? $('article') : ($('main').length ? $('main') : $('body'));
  mainEl.find('p, h1, h2, h3, h4, li, td, th, blockquote').each((_, el) => {
    const t = $(el).text().trim();
    if (t) text += t + '\n';
  });

  if (!text.trim()) {
    text = mainEl.text().replace(/\s+/g, ' ').trim();
  }

  // 截取前 4000 字符，避免 LLM token 超限
  return {
    title,
    text: text.slice(0, 4000),
  };
}

module.exports = { fetchArticle };