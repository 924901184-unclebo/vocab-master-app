/**
 * 认证路由 —— /api/auth
 */
const { Router } = require('express');
const db = require('../db');
const wechatService = require('../services/wechat');

const router = Router();

/**
 * POST /api/auth/login
 * Body: { code: "wx.login() 返回的 code" }
 *
 * 返回自定义登录态 token
 */
router.post('/login', async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) {
      return res.json({ code: -1, message: 'code 不能为空' });
    }

    // 调用微信接口换取 openid
    let openid, sessionKey;
    try {
      const result = await wechatService.code2session(code);
      openid = result.openid;
      sessionKey = result.sessionKey;
    } catch (err) {
      // 本地开发 mock：如果微信接口调不通，用 code 当 openid
      console.warn('[Auth] 微信接口调用失败，使用 mock 模式:', err.message);
      openid = `dev_${code}`;
      sessionKey = 'mock_session';
    }

    // 查找或创建用户
    let user = await db.findUserByOpenid(openid);
    if (user) {
      await db.updateUserSession(user.id, sessionKey);
    } else {
      user = await db.createUser(openid, sessionKey);
    }

    // 生成简单 token（base64 编码的 userId）
    const token = Buffer.from(String(user.id)).toString('base64');

    res.json({
      code: 0,
      message: 'success',
      data: {
        token,
        userId: user.id,
      },
    });
  } catch (err) {
    console.error('[Auth] login error:', err);
    res.json({ code: -1, message: '登录失败: ' + err.message });
  }
});

module.exports = router;