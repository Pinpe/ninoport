/* 管理上下文：卡片上只剩一个入口，导出 / 导入 / 清空都收在这个弹窗里。
   导入这条链多一步——先让浏览器把文件读一遍，验过再问要不要覆盖。 */

import { $ } from './dom.js';
import { openModal, closeModal } from './modal.js';

var manageModal     = $('manage-modal');
var clearModal      = $('clear-modal');
var importModal     = $('import-modal');
var manageTarget    = $('manage-target');
var manageModel     = $('manage-model');
var manageModelWrap = $('manage-model-wrap');
var exportIdInput   = $('ctx-export-id');
var importIdInput   = $('ctx-import-id');
var ctxFileInput    = $('ctx-file');
var ctxImportForm   = $('ctx-import-form');
var ctxClearBtn     = $('ctx-clear');
var manageId        = '';

document.querySelectorAll('.js-manage').forEach(function (btn) {
    btn.addEventListener('click', function () {
        manageId = btn.dataset.id || '';
        var model = btn.dataset.model || '';
        manageTarget.textContent = '#' + manageId;
        manageModel.textContent = model;
        manageModelWrap.hidden = !model;
        exportIdInput.value = manageId;
        importIdInput.value = manageId;
        ctxFileInput.value = '';
        openModal(manageModal, manageModal.querySelector('.js-close'));
    });
});

/* 清空：先收起管理弹窗，再问一遍确认 */
ctxClearBtn.addEventListener('click', function () {
    $('clear-id-input').value = manageId;
    $('clear-target').textContent =
        '#' + manageId + (manageModel.textContent ? '（' + manageModel.textContent + '）' : '');
    closeModal(manageModal);
    openModal(clearModal, clearModal.querySelector('.btn-danger'));
});

/* ── 导入 ─────────────────────────────────────────────────────────────
   校验放在前端是有道理的——后端只管存，合法与否由这扇窗口挡在门外。
   通过校验就把卡片上那个 form 原样提交，文件还在它自己的 input 里。 */
var importFileEl  = $('import-file-name');
var importTarget  = $('import-target');
var importCount   = $('import-count');
var importError   = $('import-error');
var importConfirm = $('import-confirm');
var pendingForm   = null;

var ROLE_NAME = { user: '你说', assistant: '它答', error: '报错' };

function importProblem(text) {
    var rows;
    try {
        rows = JSON.parse(text.replace(/^\uFEFF/, ''));   /* 记事本存的会带 BOM */
    } catch (err) {
        return { msg: '不是合法的 JSON：' + err.message };
    }
    if (!Array.isArray(rows)) {
        return { msg: '这文件里不是一个数组，导出的上下文才是那个样子' };
    }
    for (var i = 0; i < rows.length; i++) {
        var row = rows[i];
        if (!Array.isArray(row) || row.length !== 2
            || typeof row[0] !== 'string' || typeof row[1] !== 'string') {
            return { msg: '第 ' + (i + 1) + ' 条不是 ["user"/"assistant", "内容"] 的样子' };
        }
    }
    var roles = {};
    rows.forEach(function (row) { roles[row[0]] = (roles[row[0]] || 0) + 1; });
    var parts = [];
    Object.keys(roles).forEach(function (role) {
        parts.push((ROLE_NAME[role] || role) + ' ' + roles[role] + ' 条');
    });
    return { rows: rows, msg: '一共 ' + rows.length + ' 条' + (parts.length ? '（' + parts.join('、') + '）' : '') };
}

function showImport(id, file, text) {
    pendingForm = ctxImportForm;
    importFileEl.textContent = file.name;
    importTarget.textContent = '#' + id;
    importError.hidden = true;
    importConfirm.disabled = false;
    importConfirm.textContent = '导入';

    var res = (text === null) ? { msg: '这个文件读不出来' } : importProblem(text);
    if (res.rows) {
        importCount.textContent = res.msg;
        importCount.classList.remove('is-error');
    } else {
        importCount.textContent = '';
        importError.textContent = res.msg;
        importError.hidden = false;
        importConfirm.disabled = true;
    }

    closeModal(manageModal);   /* 两层遮罩叠着会发黑，先收起底下的 */
    openModal(importModal, importConfirm.disabled ? importModal.querySelector('.js-close')
                                                  : importConfirm);
}

$('ctx-import').addEventListener('click', function () {
    ctxFileInput.value = '';          /* 同一个文件选第二次也要能触发 change */
    ctxFileInput.click();
});

ctxFileInput.addEventListener('change', function () {
    var file = ctxFileInput.files[0];
    if (!file) { return; }
    var reader = new FileReader();
    reader.onload = function () { showImport(manageId, file, String(reader.result)); };
    reader.onerror = function () { showImport(manageId, file, null); };
    reader.readAsText(file);
});

importConfirm.addEventListener('click', function () {
    var form = pendingForm;
    pendingForm = null;
    if (!form) { return; }
    importConfirm.disabled = true;
    importConfirm.textContent = '导入中…';
    closeModal(importModal);
    form.submit();
});
