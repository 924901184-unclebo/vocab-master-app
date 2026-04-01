/**
 * 认证中间件 —— 从请求头提取用户 ID
 *
 * 小程序端登录后拿到 token，每次请求放在 Header: Authorization: Bearer <token>
 * token 格式：简单使用 base64(userId) ，生产环境建议换成 JWT
 */
module.exports = function auth(req, res, next) {
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');

  if (!token) {
    return res.status(401).json({ code: -1, message: '未登录' });
  }

  try {
    const userId = parseInt(Buffer.from(token, 'base64').toString('utf-8'));
    if (!userId || isNaN(userId)) {
      return res.status(401).json({ code: -1, message: 'token 无效' });
    }
    req.userId = userId;
    next();
  } catch {
    return res.status(401).json({ code: -1, message: 'token 解析失败' });
  }
};