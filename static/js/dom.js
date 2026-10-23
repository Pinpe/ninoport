/* 两个小工具，别的脚本都从这里拿。 */

export function $(id) {
    return document.getElementById(id);
}

var ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) { return ESC[c]; });
}
