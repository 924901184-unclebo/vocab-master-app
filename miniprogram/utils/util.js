/**
 * 工具函数
 */

/** 显示 toast 提示 */
function showToast(title, icon = 'none') {
  wx.showToast({ title, icon, duration: 2000 });
}

/** 显示加载提示 */
function showLoading(title = '加载中...') {
  wx.showLoading({ title, mask: true });
}

/** 隐藏加载提示 */
function hideLoading() {
  wx.hideLoading();
}

/** 按首字母分组 */
function groupByLetter(list) {
  const groups = {};
  list.forEach(item => {
    const letter = (item.term || '')[0]?.toUpperCase() || '#';
    if (!groups[letter]) groups[letter] = [];
    groups[letter].push(item);
  });
  // 排序
  const sorted = Object.keys(groups).sort().map(letter => ({
    letter,
    items: groups[letter],
  }));
  return sorted;
}

module.exports = { showToast, showLoading, hideLoading, groupByLetter };