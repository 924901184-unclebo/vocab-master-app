/**
 * 微信登录服务 —— 调用 code2session 换取 openid
 */
const axios = require('axios');
const config = require('../config');

/**
 * 用微信 login code 换取 openid + session_key
 * @param {string} code - wx.login() 返回的 code
 * @returns {Promise<{openid: string, session_key: string}>}
 */
async function code2session(code) {
  const url = 'https://api.weixin.qq.com/sns/jscode2session';
  const { data } = await axios.get(url, {
    params: {
      appid: config.wx.appid,
      secret: config.wx.secret,
      js_code: code,
      grant_type: 'authorization_code',
    },
  });

  if (data.errcode) {
    throw new Error(`微信登录失败: ${data.errmsg} (${data.errcode})`);
  }

  return {
    openid: data.openid,
    sessionKey: data.session_key,
  };
}

module.exports = { code2session };