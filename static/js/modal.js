/* 弹窗的开关。页面里每一个 .modal-mask 都归这里管：
   点遮罩、点 .js-close、按 Esc 三种关法只在这挂一次，别的脚本只管调 openModal/closeModal。 */

var lastFocus = null;

export function openModal(mask, focusEl) {
    lastFocus = document.activeElement;
    mask.classList.add('is-open');
    document.body.classList.add('no-scroll');
    if (focusEl) { setTimeout(function () { focusEl.focus(); }, 40); }
}

export function closeModal(mask) {
    mask.classList.remove('is-open');
    if (!document.querySelector('.modal-mask.is-open')) {
        document.body.classList.remove('no-scroll');
    }
    if (lastFocus && lastFocus.focus) { lastFocus.focus(); }
    lastFocus = null;
}

export function closeAll() {
    /* 有可能两层叠着（测试连接压在创建弹窗上），要关的是最上面那层 */
    var open = document.querySelectorAll('.modal-mask.is-open');
    if (open.length) { closeModal(open[open.length - 1]); }
}

/* 页面一加载就把这几种通用关法挂上，省得每个弹窗各写一遍 */
document.querySelectorAll('.modal-mask').forEach(function (mask) {
    mask.addEventListener('mousedown', function (e) {
        if (e.target === mask) { closeModal(mask); }
    });
    mask.querySelectorAll('.js-close').forEach(function (btn) {
        btn.addEventListener('click', function () { closeModal(mask); });
    });
});

document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { closeAll(); }
});
