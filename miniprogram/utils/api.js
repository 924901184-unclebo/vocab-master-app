/**
 * VocabMaster 小程序 - 网络请求封装
 */

// 后端服务地址（部署后替换为云托管地址）
const BASE_URL = 'http://localhost:80';

// 本地缓存 token
let _token = '';

function getToken() {
  if (!_token) {
    _token = wx.getStorageSync('vm_token') || '';
  }
  return _token;
}

function setToken(token) {
  _token = token;
  wx.setStorageSync('vm_token', token);
}

/**
 * 统一请求方法
 */
function request(options) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${BASE_URL}${options.url}`,
      method: options.method || 'GET',
      data: options.data || {},
      header: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getToken()}`,
        ...options.header,
      },
      success(res) {
        if (res.statusCode === 401) {
          // token 过期，重新登录
          setToken('');
          login().then(() => {
            // 重试一次
            request(options).then(resolve).catch(reject);
          }).catch(reject);
          return;
        }
        if (res.data && res.data.code === 0) {
          resolve(res.data.data);
        } else {
          reject(new Error(res.data?.message || '请求失败'));
        }
      },
      fail(err) {
        reject(err);
      },
    });
  });
}

/**
 * 微信登录
 */
function login() {
  return new Promise((resolve, reject) => {
    wx.login({
      success(loginRes) {
        if (!loginRes.code) {
          reject(new Error('wx.login 失败'));
          return;
        }
        wx.request({
          url: `${BASE_URL}/api/auth/login`,
          method: 'POST',
          data: { code: loginRes.code },
          header: { 'Content-Type': 'application/json' },
          success(res) {
            if (res.data && res.data.code === 0) {
              setToken(res.data.data.token);
              resolve(res.data.data);
            } else {
              reject(new Error(res.data?.message || '登录失败'));
            }
          },
          fail: reject,
        });
      },
      fail: reject,
    });
  });
}

// ---- API 方法 ----

/** 获取全部词汇 */
function getVocabList() {
  return request({ url: '/api/vocab/list' });
}

/** 获取随机一批词汇 */
function getVocabBatch(limit = 10) {
  return request({ url: `/api/vocab/batch?limit=${limit}` });
}

/** 搜索词汇 */
function searchVocab(q) {
  return request({ url: `/api/vocab/search?q=${encodeURIComponent(q)}` });
}

/** 添加单个词汇 */
function addVocab(word) {
  return request({ url: '/api/vocab/add', method: 'POST', data: word });
}

/** 批量添加词汇 */
function batchAddVocab(words, sourceUrl) {
  return request({ url: '/api/vocab/batch-add', method: 'POST', data: { words, sourceUrl } });
}

/** 删除词汇 */
function deleteVocab(id) {
  return request({ url: `/api/vocab/${id}`, method: 'DELETE' });
}

/** 解析文章 */
function parseArticle(url) {
  return request({ url: '/api/article/parse', method: 'POST', data: { url } });
}

module.exports = {
  login,
  getToken,
  getVocabList,
  getVocabBatch,
  searchVocab,
  addVocab,
  batchAddVocab,
  deleteVocab,
  parseArticle,
};