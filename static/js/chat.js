/* 对话页：气泡、markdown 渲染、发送时先画再提交。 */
(function () {
    'use strict';

    var form    = document.getElementById('chat-form');
    var input   = document.getElementById('chat-input');
    var list    = document.getElementById('message-list');
    var scroll  = document.getElementById('chat-scroll');
    var sendBtn = document.getElementById('send-btn');
    var locked  = false;

    try { history.scrollRestoration = 'manual'; } catch (e) {}

    function scrollToBottom() {
        scroll.scrollTop = scroll.scrollHeight;
    }

    /* ── AI 的回复：markdown → HTML ───────────────────────────────────
       两条都不能省：marked 管解析，DOMPurify 管消毒。
       模型是可以吐 <script> 和 onerror= 的，不消毒等于把它请进家里。

       ⚠️ 这里必须「用的时候再问库在不在」，不能在这个 IIFE 里提前拍板：
       这段脚本是 body 末尾的普通内联脚本，跑在解析期；带 defer 的
       CDN 脚本要等解析完才执行 —— 提前判一次必然全是 undefined，
       然后就永远渲染不出来了（踩过：页面上 `**Pinpe**` 原样躺着） */
    var mdConfigured = false;

    function mdOk() {
        if (!window.marked || !window.DOMPurify || !marked.parse) { return false; }
        if (!mdConfigured) {
            marked.use({ gfm: true, breaks: true });   /* 表格/删除线 + 单个换行也断行 */
            mdConfigured = true;
        }
        return true;
    }

    function renderMd(el) {
        if (el.dataset.mdDone === '1') { return; }
        el.dataset.mdDone = '1';
        el.dataset.raw = el.textContent;   /* 先留一份原文：渲染完 textContent 就变样了 */
        if (!mdOk()) { return; }                   /* CDN 没拉到：保持纯文本，不折腾 */
        el.innerHTML = DOMPurify.sanitize(marked.parse(el.textContent));
        el.classList.add('md');
    }

    function renderAllMd(root) {
        var list = (root || document).querySelectorAll('.bubble-text.js-md');
        for (var i = 0; i < list.length; i++) { renderMd(list[i]); }
    }

    /* ── 复制这一条：要的是渲染前的 markdown 原文 ────────────────────── */
    function copyRaw(text, btn) {
        var label = btn.querySelector('.msg-copy-text');
        var done = function () {
            btn.classList.add('is-done');
            if (label) { label.textContent = '已复制'; }
            setTimeout(function () {
                btn.classList.remove('is-done');
                if (label) { label.textContent = '复制'; }
            }, 1600);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(done, function () {});
            return;
        }
        var ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); done(); } catch (err) {}
        document.body.removeChild(ta);
    }

    list.addEventListener('click', function (e) {
        var btn = e.target.closest ? e.target.closest('.msg-copy') : null;
        if (!btn) { return; }
        var textEl = btn.parentNode.querySelector('.bubble-text');
        if (!textEl) { return; }
        copyRaw(textEl.dataset.raw != null ? textEl.dataset.raw : textEl.textContent, btn);
    });

    /* ── 你来我往的气泡 ──────────────────────────────────────────────── */
    function bubble(role, text, extraClass) {
        var row = document.createElement('div');
        row.className = 'msg-row ' + role;

        var b = document.createElement('div');
        b.className = 'bubble' + (extraClass ? ' ' + extraClass : '');

        var t = document.createElement('div');
        t.className = 'bubble-text';
        t.textContent = text;   /* 用 textContent，不解析 HTML */

        b.appendChild(t);
        row.appendChild(b);
        return row;
    }

    function waitingBubble() {
        var row = document.createElement('div');
        row.className = 'msg-row msg-ai';
        row.id = 'waiting-row';

        var b = document.createElement('div');
        b.className = 'bubble is-waiting';

        var wrap = document.createElement('div');
        wrap.className = 'bubble-text waiting-line';   /* 间距在 CSS 里管 */

        var label = document.createElement('span');
        label.textContent = '正在回复';

        var dots = document.createElement('span');
        dots.className = 'dots';
        dots.innerHTML = '<i></i><i></i><i></i>';

        wrap.appendChild(label);
        wrap.appendChild(dots);
        b.appendChild(wrap);
        row.appendChild(b);
        return row;
    }

    /* ── 发送：先把消息摆上屏幕，再真的提交 ───────────────────────────── */
    form.addEventListener('submit', function (e) {
        if (locked) { e.preventDefault(); return; }

        var text = input.value.trim();
        if (!text) { e.preventDefault(); return; }

        /* 拦下这次提交，自己先画出来 */
        e.preventDefault();

        var empty = document.getElementById('chat-empty');
        if (empty) { empty.remove(); }

        list.appendChild(bubble('msg-user', text));
        list.appendChild(waitingBubble());
        scrollToBottom();

        locked = true;
        /* ⚠️ 这里绝不能清空、也不能 disable：禁用的控件浏览器根本不提交，
           把 value 清成 '' 等于发个空串 —— 原来这两行把消息整个吃掉，
           服务端 request.form.get('user-input') 拿到 None，上下文里存下一排
           「你 None」。要锁住输入用 readOnly：只读控件照常提交 */
        input.readOnly = true;
        sendBtn.disabled = true;

        /* 用原生 submit 走真正的 POST —— 服务端要等 AI 答完才返回，
           这段时间屏幕上已经有你刚发的那条了 */
        requestAnimationFrame(function () { form.submit(); });
    });

    /* ── 输入框：Enter 发送、自动长高 ─────────────────────────────────── */
    function autoGrow() {
        input.style.height = 'auto';
        input.style.height = Math.min(input.scrollHeight, 168) + 'px';
    }

    input.addEventListener('input', autoGrow);

    input.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter' || e.shiftKey) { return; }
        if (e.isComposing || e.keyCode === 229) { return; }  /* 中文输入法选词中 */
        e.preventDefault();
        if (form.requestSubmit) { form.requestSubmit(); }
        else { form.submit(); }
    });

    /* 历史消息里的 AI 回复：等 CDN 那两个脚本落位（defer 保证在
       DOMContentLoaded 之前执行完）再渲染，渲染完内容会变高，再滚一次底 */
    window.addEventListener('DOMContentLoaded', function () {
        renderAllMd(document);
        scrollToBottom();
    });

    window.addEventListener('load', scrollToBottom);
    scrollToBottom();
    input.focus();
    autoGrow();
})();
