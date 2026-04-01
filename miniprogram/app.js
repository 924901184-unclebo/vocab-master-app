const api = require('./utils/api');

App({
  globalData: {
    userId: null,
  },

  onLaunch() {
    this.doLogin();
  },

  async doLogin() {
    try {
      const res = await api.login();
      this.globalData.userId = res.userId;
      console.log('[App] 登录成功, userId:', res.userId);
    } catch (err) {
      console.error('[App] 登录失败:', err);
    }
  },
});