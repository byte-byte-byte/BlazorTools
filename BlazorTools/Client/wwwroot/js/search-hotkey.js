/* BlazorTools · 首页搜索全局快捷键
 * 按 "/" 或 Ctrl/Cmd+K 聚焦首页搜索框（输入框内输入时不拦截）。
 * 由 Pages/Index.razor 的 OnAfterRenderAsync 调用 window.btSearchHotkey(元素)。
 */
window.btSearchHotkey = function (el) {
    window.__btSearchEl = el;

    if (window.__btSearchHandler) {
        return; // 只注册一次
    }

    window.__btSearchHandler = function (e) {
        if (e.defaultPrevented) return;

        var k = e.key;
        var isSlash = (k === '/' && !e.ctrlKey && !e.metaKey && !e.altKey);
        var isK = ((k === 'k' || k === 'K') && (e.ctrlKey || e.metaKey));
        if (!isSlash && !isK) return;

        var t = e.target;
        var tag = t ? t.tagName : '';
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (t && t.isContentEditable)) return;

        // 元素可能因页面切换而失效，回退到按 class 查找
        var box = (window.__btSearchEl && document.body.contains(window.__btSearchEl))
            ? window.__btSearchEl
            : document.querySelector('.hero-search-input');
        if (!box || typeof box.focus !== 'function') return;

        e.preventDefault();
        box.focus();
        if (typeof box.select === 'function') {
            box.select();
        }
    };

    document.addEventListener('keydown', window.__btSearchHandler);
};
