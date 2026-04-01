/**
 * 词库页 —— A-Z 列表 + 搜索 + 删除
 */
const api = require('../../utils/api');
const { showToast, groupByLetter } = require('../../utils/util');

Page({
  data: {
    list: [],
    groups: [],       // [{letter, items}]
    total: 0,
    searchQuery: '',
    searching: false,
    expandedId: null,
    loading: true,
  },

  onShow() {
    this.loadList();
  },

  /** 加载全部词汇 */
  async loadList() {
    this.setData({ loading: true });
    try {
      const res = await api.getVocabList();
      const list = res.list || [];
      this.setData({
        list,
        groups: groupByLetter(list),
        total: list.length,
        loading: false,
      });
    } catch (err) {
      console.error('loadList error:', err);
      this.setData({ loading: false });
    }
  },

  /** 搜索输入 */
  async onSearchInput(e) {
    const q = e.detail.value;
    this.setData({ searchQuery: q });

    if (!q.trim()) {
      this.setData({
        groups: groupByLetter(this.data.list),
        searching: false,
      });
      return;
    }

    this.setData({ searching: true });
    try {
      const res = await api.searchVocab(q);
      this.setData({
        groups: groupByLetter(res.list || []),
      });
    } catch (err) {
      console.error('search error:', err);
    }
  },

  /** 清除搜索 */
  onClearSearch() {
    this.setData({
      searchQuery: '',
      searching: false,
      groups: groupByLetter(this.data.list),
    });
  },

  /** 展开/折叠详情 */
  onToggleExpand(e) {
    const id = e.currentTarget.dataset.id;
    this.setData({
      expandedId: this.data.expandedId === id ? null : id,
    });
  },

  /** 发音 */
  onSpeak(e) {
    const term = e.currentTarget.dataset.term;
    const innerAudioContext = wx.createInnerAudioContext();
    innerAudioContext.src = `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(term)}&type=2`;
    innerAudioContext.play();
  },

  /** 删除 */
  onDelete(e) {
    const { id, term } = e.currentTarget.dataset;
    wx.showModal({
      title: '确认删除',
      content: `确定要删除「${term}」吗？`,
      confirmColor: '#ef4444',
      success: async (res) => {
        if (!res.confirm) return;
        try {
          await api.deleteVocab(id);
          showToast(`已删除 "${term}"`);
          this.loadList();
        } catch (err) {
          showToast('删除失败');
        }
      },
    });
  },

  /** 跳转到词卡页查看 */
  onViewCard(e) {
    wx.switchTab({ url: '/pages/cards/cards' });
  },
});