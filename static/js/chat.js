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

    /* ── 撤回这一问一答 ────────────────────────────────────────────────
       按钮挂在「你说的那条」上，index 由模板写进 data-index，正好是它在
       context 里的位置，后端顺手把紧跟着的回复一起删掉

       原文先塞进 draft 那个格子，页面回来以后会自动填回输入框，
       改两个字就能重发 */
    list.addEventListener('click', function (e) {
        var btn = e.target.closest ? e.target.closest('.msg-recall') : null;
        if (!btn) { return; }
        if (locked) { return; }   /* 上一轮还在跑，别跟它抢上下文 */

        var row = btn.closest('.msg-row');
        var idx = row ? row.getAttribute('data-index') : null;
        if (idx === null) { return; }

        var textEl = row.querySelector('.bubble-text');
        if (textEl) {
            try { sessionStorage.setItem('ninoport-draft', textEl.textContent); } catch (err) {}
        }

        var f = document.createElement('form');
        f.method = 'post';
        f.action = form.action.replace('/send', '/delete-one-context');

        var hidden = document.createElement('input');
        hidden.type = 'hidden';
        hidden.name = 'context-index';
        hidden.value = idx;

        f.appendChild(hidden);
        document.body.appendChild(f);
        f.submit();
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

    /* ── 发送：先把两条气泡摆上屏幕，再在背后把请求递出去 ─────────────────
       ⚠️ 别再用 form.submit()：整页会重载，刚画的两条气泡立刻被冲掉，屏幕上
       闪一下，而且回复得等刷新完才有。改走 fetch，页面不动，剩下的交给轮询

       ⚠️ 两处老坑：FormData 必须在禁用控件**之前**抓，禁用的控件浏览器根本
       不算进表单；输入框只清值不禁用，靠 readOnly 锁住 */
    function lockComposer() {
        locked           = true;
        input.readOnly   = true;
        sendBtn.disabled = true;
    }

    function unlockComposer() {
        locked           = false;
        input.readOnly   = false;
        sendBtn.disabled = false;
        input.focus();
    }

    /* 每发一条就重新开一轮轮询：上一轮说完时定时器已经停了

       justSent 是「服务端还收不到刚发这条」的意思。页面刚打开时接着上一轮
       等回复，那个请求早发出去了，就不能挂这个标记，不然服务端那边少掉的
       行永远删不掉 */
    function startPolling(justSent) {
        pollStop   = false;
        sawText    = false;
        failCount  = 0;
        sending    = !!justSent;
        list.classList.add('is-live');   /* 有东西在长的时候，复制按钮一律收起 */
        lastText   = '';
        startedAt  = Date.now();
        lastChange = startedAt;
        if (pollTimer !== null) {
            clearTimeout(pollTimer);
            pollTimer = null;
        }
        pollTick();
    }

    form.addEventListener('submit', function (e) {
        e.preventDefault();
        if (locked) { return; }

        var text = input.value.trim();
        if (!text) { return; }

        var data = new FormData(form);

        var empty = document.getElementById('chat-empty');
        if (empty) { empty.remove(); }

        list.appendChild(bubble('msg-user', text));
        list.appendChild(waitingBubble());
        scrollToBottom();

        input.value = '';
        autoGrow();
        lockComposer();
        startPolling(true);

        /* ⚠️ 在 POST 回来之前，服务端的上下文里还没有刚发这条。这段时间
           要是照着服务端删多出来的行，用户刚看见的那条消息会被抹掉，
           过一会儿又长回来，闪一下 */
        fetch(form.action, { method: 'POST', body: data })
            .then(function (r) {
                sending = false;
                if (!r.ok) { throw new Error('bad status'); }
            })
            .catch(function () {
                sending = false;
                var waiting = document.getElementById('waiting-row');
                if (waiting) { waiting.remove(); }
                list.appendChild(bubble('msg-ai', '发送失败：服务端没接住这条消息', 'is-error'));
                scrollToBottom();
                unlockComposer();
            });
    });

    /* ── 后台刷新：每 0.1 秒把消息区跟服务端对一次 ────────────────────────
       后端流式的时候是直接往 database_data 里写的，没有缓冲区，也没有别的
       接口可以问。那就把这一页整个重新拉一遍，只把消息区里变了的行换掉

       ⚠️ 不能整段 innerHTML 一起换：服务端吐出来的是 markdown 原文，换完
       之后上面每一条都得重新渲染，一百条消息每 0.1 秒重解析一遍准卡死。
       所以逐行比，只有变了的那一行才重建、才补 markdown

       说没说完仍然没有标志：见到字以后，隔 IDLE_MS 毫秒拿到的还一样，
       就当它说完了；一次都没见到字就干等，撑满 EMPTY_MS 才放弃
       （思考型模型开头可能一分钟一个字都不吐） */
    var POLL_MS    = 100;              /* 多久对一次 */
    var IDLE_MS    = 2000;             /* 见到字以后，这么久都没变就算说完 */
    var MAX_WAIT   = 15 * 60 * 1000;   /* 一个字都没见到，最多干等这么久 */
    var FAIL_LIMIT = 30;               /* 连续这么多次拉不到页面，就当断线了 */

    var pollTimer   = null;
    var pollStop    = false;
    var startedAt   = 0;
    var lastChange  = 0;     /* 上一次拿到新字的时刻 */
    var lastText    = '';    /* 上一回看到的最后一条 */
    var sawText     = false; /* 这一轮见到过字没有 */
    var failCount   = 0;     /* 连续拉取失败的次数 */
    var sending     = false; /* POST 还没回来，服务端这时还看不见刚发的那条 */

    /* 一行气泡的身份：谁说的 + 里面那段原文。差一个字就算新的一行

       ⚠️ 比的是 dataset.raw，不是 textContent。markdown 渲染过之后
       textContent 已经被啃掉了星号和井号，跟服务端吐回来的原文永远不会
       相等——照着 textContent 比，每一行每一轮都被判成「变了」，结果就是
       整片重建、所有复制按钮的浮出动画一遍遍重播 */
    function rowKey(row) {
        var t = row.querySelector('.bubble-text');
        var who = row.classList.contains('msg-user') ? 'u' : 'a';
        var text = '';
        if (t) { text = t.dataset.raw != null ? t.dataset.raw : t.textContent; }
        return who + '\u0000' + text;
    }

    function atBottom() {
        return scroll.scrollHeight - scroll.scrollTop - scroll.clientHeight < 80;
    }

    /* 把服务端那一版消息区对到屏幕上，返回最后一条的原文 */
    function syncMessages(doc) {
        var fresh = doc.getElementById('message-list');
        if (!fresh) { return lastText; }

        /* 「正在回复」那条不是服务端画的，先摘走，不然它把对齐顶歪一格。
           摘完再查旧行，不然它自己占一格 */
        var waiting = document.getElementById('waiting-row');
        if (waiting && waiting.parentNode) { waiting.parentNode.removeChild(waiting); }

        var newRows = [].slice.call(fresh.querySelectorAll('.msg-row'));
        var oldRows = [].slice.call(list.querySelectorAll('.msg-row'));

        var tail = newRows[newRows.length - 1];
        var tailText = '';
        if (tail) {
            var tailEl = tail.querySelector('.bubble-text');
            tailText = tailEl ? tailEl.textContent : '';
        }

        /* 后端发完消息会先摆一条空的 AI 行占位，模板那边已经把这种空行
           滤掉了。所以服务端最后一条还是「我说的」，就等于它还没开口 */
        var pending = !!tail && tail.classList.contains('msg-user');
        var count   = newRows.length;

        var i;
        for (i = 0; i < count; i = i + 1) {
            if (i < oldRows.length && rowKey(oldRows[i]) === rowKey(newRows[i])) { continue; }

            var node = document.importNode(newRows[i], true);
            if (i < oldRows.length) {
                list.replaceChild(node, oldRows[i]);
                oldRows[i] = node;
            } else {
                list.appendChild(node);
                oldRows.push(node);
            }
            renderAllMd(node);
        }
        /* 服务端那边变短了（清空了上下文），多出来的旧行一并删掉。
           但 POST 还在路上的时候不许删，那时候服务端只是还没收到 */
        if (!sending) {
            for (i = count; i < oldRows.length; i = i + 1) {
                if (oldRows[i].parentNode) { oldRows[i].parentNode.removeChild(oldRows[i]); }
            }
        }

        var empty = document.getElementById('chat-empty');
        if (count > 0 && empty) { empty.remove(); }

        /* 最后一条还是空的，或者 POST 还没到服务端：把「正在回复」挂回去，
           别让人以为卡住了。挂原来那个，别重造，不然那三个点每 0.1 秒
           从头动一次 */
        if (pending || sending) {
            list.appendChild(waiting || waitingBubble());
        }
        return pending ? '' : tailText;
    }

    function stopPolling() {
        pollStop = true;
        if (pollTimer !== null) {
            clearTimeout(pollTimer);
            pollTimer = null;
        }
    }

    /* 说完了：整页重载一次，让服务端把这一轮正式画出来
       —— 带 markdown、带复制按钮，跟 context 里存的一模一样。
       前端不用自己补这些，也不怕屏幕上那句跟数据库里差一口气

       ⚠️ 重载会把输入框里已经打了一半的字冲掉，先存 sessionStorage，
       新页面起来再填回去 */
    function pollFinish() {
        stopPolling();
        if (input.value !== '') {
            try { sessionStorage.setItem('ninoport-draft', input.value); } catch (e) {}
        }
        /* 不带参数就是普通重载，跟手点一下刷新键一模一样 */
        location.reload();
    }

    /* 等太久了：不再重载（重载完还得接着等，屏幕上只会一闪一闪），
       就把锁解开，说一声还没等到，让主人自己决定要不要再发一次 */
    function giveUp(message) {
        stopPolling();
        list.classList.remove('is-live');

        var waiting = document.getElementById('waiting-row');
        if (waiting) { waiting.remove(); }

        list.appendChild(bubble('msg-ai', message, 'is-error'));
        scrollToBottom();
        unlockComposer();
    }

    function pollTick() {
        pollTimer = null;
        if (pollStop) { return; }

        var stick = atBottom();   /* 你往上翻着看的时候，别把你拽回来 */

        fetch(location.pathname, { cache: 'no-store' })
            .then(function (r) {
                if (!r.ok) { throw new Error('bad status'); }
                return r.text();
            })
            .then(function (html) {
                var tailText = syncMessages(new DOMParser().parseFromString(html, 'text/html'));
                var now = Date.now();

                if (tailText !== lastText) {
                    lastText = tailText;
                    if (tailText !== '') { lastChange = now; }
                }
                if (tailText !== '') { sawText = true; }
                if (stick) { scrollToBottom(); }

                failCount = 0;

                if (sawText && now - lastChange >= IDLE_MS) { pollFinish(); return; }
                /* ⚠️ 这里不能像以前那样等一分钟就重载。非流式的思考模型
                   （reasoning high 那种）想上几分钟很正常，重载完新页面又
                   不接着问，回复写进数据库了屏幕上也不长出来 —— 看着就像
                   「消息发出去了没有回复」 */
                if (!sawText && now - startedAt >= MAX_WAIT) {
                    giveUp('等了十五分钟还没等到回复，再看看？');
                    return;
                }
            })
            .catch(function () {
                /* 网络抖一下不算完，但一直拉不到就是断线了 */
                failCount = failCount + 1;
            })
            .then(function () {
                if (pollStop) { return; }
                if (failCount >= FAIL_LIMIT) {
                    giveUp('连不上服务端了，刷新一下页面再试');
                    return;
                }
                pollTimer = setTimeout(pollTick, POLL_MS);
            });
    }

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

    /* 上一条说完时整页重载过：把那时候没发出去的字填回来 */
    try {
        var draft = sessionStorage.getItem('ninoport-draft');
        if (draft !== null) {
            input.value = draft;
            sessionStorage.removeItem('ninoport-draft');
        }
    } catch (e) {}

    input.focus();
    autoGrow();

    /* 页面刚打开时接着等：服务端最后一句还是「我说的」，就说明有一轮回复
       还在路上。上一页等不及重载了、或者主人自己按了刷新，都会留下这种现场。
       这时候不接着问，回复写进数据库了屏幕上也不会自己长出来 */
    (function resumeWaiting() {
        var rows = list.querySelectorAll('.msg-row');
        if (rows.length === 0) { return; }
        if (!rows[rows.length - 1].classList.contains('msg-user')) { return; }

        list.appendChild(waitingBubble());
        lockComposer();
        scrollToBottom();
        startPolling(false);
    })();
})();
