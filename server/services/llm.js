/**
 * LLM 服务 —— 调用大模型 API 提取专业术语
 *
 * 兼容 OpenAI Chat Completions 格式（通义千问 / DeepSeek / OpenAI 均可）
 */
const axios = require('axios');
const config = require('../config');

/**
 * 从文章正文中提取专业英文术语
 * @param {string} text - 文章正文
 * @returns {Promise<Array<{term: string, meaning: string, context: string}>>}
 */
async function extractTerms(text) {
  if (!config.llm.apiKey) {
    console.warn('[LLM] 未配置 API Key，使用 fallback 正则提取');
    return fallbackExtract(text);
  }

  try {
    const { data } = await axios.post(
      config.llm.apiUrl,
      {
        model: config.llm.model,
        messages: [
          {
            role: 'system',
            content: `你是一位专业术语提取助手。用户会给你一段中文技术文章，请从中提取所有专业英文术语、专有名词及缩写。

要求：
1. 只提取英文术语，不要提取中文词汇
2. 忽略常见英文单词（the, is, and 等），只保留专业术语
3. 为每个术语提供简洁的中文释义（30字以内）
4. 提取该术语在原文中出现的语境句子

严格以如下 JSON 数组格式返回，不要输出其他内容：
[{"term":"术语","meaning":"中文释义","context":"原文语境句"}]`,
          },
          {
            role: 'user',
            content: text,
          },
        ],
        temperature: 0.3,
        max_tokens: 2000,
      },
      {
        headers: {
          'Authorization': `Bearer ${config.llm.apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    );

    const content = data.choices?.[0]?.message?.content || '[]';
    // 提取 JSON 部分（防止模型返回 markdown 代码块）
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    const terms = JSON.parse(jsonMatch[0]);
    return terms.filter(t => t.term && t.meaning);
  } catch (err) {
    console.error('[LLM] 调用失败:', err.message);
    return fallbackExtract(text);
  }
}

/**
 * Fallback：用正则提取英文术语（无需 LLM）
 */
function fallbackExtract(text) {
  const terms = new Map();

  // 匹配全大写缩写 (如 API, SDK, LLM)
  const abbrRegex = /\b([A-Z][A-Z0-9/]{1,10})\b/g;
  let match;
  while ((match = abbrRegex.exec(text)) !== null) {
    const t = match[1];
    if (!terms.has(t) && t.length >= 2) {
      terms.set(t, { term: t, meaning: '', context: extractContext(text, match.index) });
    }
  }

  // 匹配 PascalCase 术语 (如 Kubernetes, GraphQL)
  const pascalRegex = /\b([A-Z][a-z]+(?:[A-Z][a-z]+)+)\b/g;
  while ((match = pascalRegex.exec(text)) !== null) {
    const t = match[1];
    if (!terms.has(t)) {
      terms.set(t, { term: t, meaning: '', context: extractContext(text, match.index) });
    }
  }

  // 匹配常见技术名词
  const techRegex = /\b([A-Z][a-z]{2,}(?:\.js|\.py|\.io)?)\b/g;
  while ((match = techRegex.exec(text)) !== null) {
    const t = match[1];
    const ignore = ['The', 'This', 'That', 'With', 'From', 'For', 'And', 'But', 'Not'];
    if (!terms.has(t) && !ignore.includes(t) && t.length >= 3) {
      terms.set(t, { term: t, meaning: '', context: extractContext(text, match.index) });
    }
  }

  return Array.from(terms.values());
}

function extractContext(text, pos) {
  const start = Math.max(0, text.lastIndexOf('\n', pos - 1) + 1);
  const end = text.indexOf('\n', pos);
  return text.slice(start, end === -1 ? undefined : end).trim().slice(0, 200);
}

module.exports = { extractTerms };