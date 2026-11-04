/* 深色模式：首屏那一下不归这里管 —— 真正的第一次上色在 <head> 里的内联脚本，
   它必须跑在样式表之前，否则每开一页都先闪一下浅色再翻黑。

   这里只管两件事：开关按钮，以及「一次都没手动选过时跟着系统走」。
   优先级：localStorage 里记着的手动选择 > 系统的 prefers-color-scheme。
   点一下按钮就把当前这套反过来并记下来，此后不再理会系统；
   想退回跟系统，清掉 localStorage 里那个键就行。 */

var KEY = 'ninoport-theme';

function read() {
    try { return localStorage.getItem(KEY); } catch (e) { return null; }
}

function write(value) {
    try { localStorage.setItem(KEY, value); } catch (e) {}
}

function applied() {
    return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

function apply(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    document.querySelectorAll('.js-theme').forEach(function (btn) {
        btn.title = theme === 'dark' ? '切换浅色' : '切换深色';
        btn.setAttribute('aria-label', btn.title);
    });
}

document.querySelectorAll('.js-theme').forEach(function (btn) {
    btn.addEventListener('click', function () {
        var next = applied() === 'dark' ? 'light' : 'dark';
        apply(next);
        write(next);
    });
});

/* 系统那头换了日/夜：只有在他没手动选过的时候才跟 */
var mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
if (mq && mq.addEventListener) {
    mq.addEventListener('change', function (e) {
        if (read() === null) { apply(e.matches ? 'dark' : 'light'); }
    });
}

apply(applied());
