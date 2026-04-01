/**
 * 添加页 —— URL 解析 + 术语提取 + 确认入库
 */
const api = require('../../utils/api');
const { showToast, showLoading, hideLoading } = require('../../utils/util');

Page({
  data: {
    url: '',
    loading: false,
    progress: 0,
    loadingStage: '',
    terms: [],        // [{term, meaning, context, existsInLibrary, selected}]
    showResult: false,
    selectedCount: 0,
  },

  /** URL 输入 */
  onUrlInput(e) {
    this.setData({ url: e.detail.value });
  },

  /** 解析文章 */
  async onParse() {
    const url = this.data.url.trim();
    if (!url) {
      showToast('请输入文章链接');
      return;
    }

    this.setData({
      loading: true,
      showResult: false,
      terms: [],
      progress: 0,
    });

    // 模拟进度阶段
    this.setData({ loadingStage: '正在获取网页内容...', progress: 15 });
    await this._delay(300);
    this.setData({ loadingStage: '正在解析文章正文...', progress: 35 });
    await this._delay(200);
    this.setData({ loadingStage: 'AI 正在识别专业术语...', progress: 55 });

    try {
      const res = await api.parseArticle(url);
      this.setData({ loadingStage: '正在整理结果...', progress: 85 });
      await this._delay(200);

      const terms = (res.terms || []).map(t => ({
        ...t,
        selected: !t.existsInLibrary,
      }));

      const selectedCount = terms.filter(t => t.selected && !t.existsInLibrary).length;

      this.setData({
        terms,
        showResult: true,
        progress: 100,
        loadingStage: '提取完成！',
        loading: false,
        selectedCount,
      });
    } catch (err) {
      showToast(err.message || '解析失败');
      this.setData({ loading: false, progress: 0 });
    }
  },

  /** 切换选中 */
  onToggle(e) {
    const idx = e.currentTarget.dataset.index;
    const term = this.data.terms[idx];
    if (term.existsInLibrary) return;

    const key = `terms[${idx}].selected`;
    this.setData({ [key]: !term.selected });
    this._updateCount();
  },

  /** 全选/取消全选 */
  onToggleAll() {
    const selectable = this.data.terms.filter(t => !t.existsInLibrary);
    const allSelected = selectable.every(t => t.selected);

    const terms = this.data.terms.map(t =>
      t.existsInLibrary ? t : { ...t, selected: !allSelected }
    );
    this.setData({ terms });
    this._updateCount();
  },

  /** 确认入库 */
  async onConfirm() {
    const words = this.data.terms
      .filter(t => t.selected && !t.existsInLibrary)
      .map(t => ({ term: t.term, meaning: t.meaning, context: t.context }));

    if (words.length === 0) {
      showToast('请至少选择一个术语');
      return;
    }

    showLoading('正在入库...');
    try {
      const res = await api.batchAddVocab(words, this.data.url);
      hideLoading();
      showToast(`成功添加 ${res.added} 个术语`);
      this.setData({ url: '', terms: [], showResult: false, progress: 0 });

      // 通知词卡页刷新
      const pages = getCurrentPages();
      const cardPage = pages.find(p => p.route === 'pages/cards/cards');
      if (cardPage) cardPage.setData({ needRefresh: true });
    } catch (err) {
      hideLoading();
      showToast(err.message || '入库失败');
    }
  },

  _updateCount() {
    const selectedCount = this.data.terms.filter(t => t.selected && !t.existsInLibrary).length;
    this.setData({ selectedCount });
  },

  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  },
});