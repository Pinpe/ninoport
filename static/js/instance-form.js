/* 创建 / 编辑实例：同一个弹窗两副面孔，外加复制等效代码那枚按钮。 */

import { $ } from './dom.js';
import { openModal } from './modal.js';
import { renderCode } from './code-render.js';
import { pingReset } from './ping.js';
import {
    createForm, apiTypeInput, keyInput, baseInput, modelInput, maxTokensInput,
    thinkInput, effortInput, systemInput, saveCtxInput
} from './form-fields.js';

var createModal = $('create-modal');
var formTitle   = $('create-title');
var formSub     = $('modal-sub');
var formNote    = $('modal-foot-note');
var submitBtn   = $('submit-btn');
var editIdInput = $('edit-id-input');

/* 新建时先摆一份空配置：协议默认 Chat Completions，「保存上下文」默认开着 */
var NEW_DEFAULTS = { 'api-type': 'chat', 'save-context': true };

var MODE_TEXT = {
    create: {
        title:  '创建实例',
        sub:    '左边怎么填，右边就是它将来实际发出去的请求',
        note:   '创建后会得到一个随机编号，用编号进入对话。',
        btn:    '创建实例',
        action: '/create-instance'
    },
    edit: {
        title:  '编辑实例',
        sub:    '改完就是它下次对话用的配置，编号不会变',
        note:   '编号和历史消息都留着，只换这套配置。',
        btn:    '保存修改',
        action: '/edit-instance'
    }
};

/* 按一份配置把表单摆好；两副面孔都走这里，省得字段对不上 */
function openForm(mode, meta, id, focusEl) {
    var t = MODE_TEXT[mode];
    formTitle.textContent = t.title;
    formSub.textContent   = t.sub;
    formNote.textContent  = t.note;
    submitBtn.textContent = t.btn;
    createForm.action     = t.action;
    editIdInput.value     = id || '';

    apiTypeInput.value   = meta['api-type'] || 'chat';
    keyInput.value       = meta['api-key'] || '';
    baseInput.value      = meta['base-url'] || '';
    modelInput.value     = meta['model'] || '';
    /* 老实例是这版之前建的，数据库里没有 max-tokens 这一格，给个跟占位符一致的数 */
    maxTokensInput.value = meta['max-tokens'] || 4096;
    thinkInput.checked   = meta['thinking'] === true;
    effortInput.value    = meta['reasoning-effort'] || '';
    systemInput.value    = meta['system-prompt'] || '';
    saveCtxInput.checked = meta['save-context'] === true;

    pingReset();   /* 换了一个实例，上一次的测试结果就别留着了 */

    openModal(createModal, focusEl);
    renderCode();
    growSystemBox();
}

document.querySelectorAll('.js-open-create').forEach(function (btn) {
    btn.addEventListener('click', function () {
        openForm('create', NEW_DEFAULTS, '', keyInput);
    });
});

document.querySelectorAll('.js-edit').forEach(function (btn) {
    btn.addEventListener('click', function () {
        var meta = {};
        try { meta = JSON.parse(btn.dataset.meta || '{}'); } catch (err) { meta = {}; }
        openForm('edit', meta, btn.dataset.id, modelInput);
    });
});

/* 系统提示词框：不给拖角，改成跟着内容自己长（CSS: resize:none, 84~240px）。
   先复位成 auto 再量，才能量到真实内容高度；+2 是上下两条边框 */
function growSystemBox() {
    systemInput.style.height = 'auto';
    if (!systemInput.offsetParent) {   /* 弹窗还没开：量出来是 0，交回 CSS */
        systemInput.style.height = '';
        return;
    }
    systemInput.style.height = (systemInput.scrollHeight + 2) + 'px';
}
systemInput.addEventListener('input', growSystemBox);

/* ── 复制 ─────────────────────────────────────────────────────────── */
var copyBtn  = $('copy-code');
var copyText = $('copy-code-text');
var codeOut  = $('code-out');

copyBtn.addEventListener('click', function () {
    var text = codeOut.textContent;
    var done = function () {
        copyText.textContent = '已复制';
        copyBtn.classList.add('is-done');
        setTimeout(function () {
            copyText.textContent = '复制';
            copyBtn.classList.remove('is-done');
        }, 1600);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done, function () {});
    } else {
        var ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); done(); } catch (err) {}
        document.body.removeChild(ta);
    }
});
