/**
 * 词卡复习页
 * - 左右滑动切换词卡
 * - 所有内容一次性展示
 * - "换一批"获取新的 10 个单词
 */
const api = require('../../utils/api');
const { showToast } = require('../../utils/util');

Page({
  data: {
    list: [],         // 当前批次词汇
    current: 0,       // 当前索引
    total: 0,
    loading: true,
    isEmpty: false,
  },

  onLoad() {
    this.loadBatch();
  },

  onShow() {
    // 从其他页面返回时刷新
    if (this.data.needRefresh) {
      this.loadBatch();
      this.setData({ needRefresh: false });
    }
  },

  /** 加载一批随机词汇 */
  async loadBatch() {
    this.setData({ loading: true });
    try {
      const res = await api.getVocabBatch(10);
      this.setData({
        list: res.list || [],
        current: 0,
        total: (res.list || []).length,
        isEmpty: (res.list || []).length === 0,
        loading: false,
      });
    } catch (err) {
      console.error('loadBatch error:', err);
      this.setData({ loading: false, isEmpty: true });
    }
  },

  /** swiper 切换 */
  onSwiperChange(e) {
    this.setData({ current: e.detail.current });
  },

  /** 发音 */
  onSpeak() {
    const word = this.data.list[this.data.current];
    if (!word) return;
    // 使用微信同声传译插件或内置 TTS
    const innerAudioContext = wx.createInnerAudioContext();
    // 使用有道发音 API（免费）
    innerAudioContext.src = `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(word.term)}&type=2`;
    innerAudioContext.play();
  },

  /** 换一批 */
  async onRefresh() {
    wx.vibrateShort({ type: 'light' });
    await this.loadBatch();
    showToast('已换一批');
  },
});