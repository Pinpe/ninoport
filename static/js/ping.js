/* 测试连接：拿表单当前这套配置真发一条消息出去，结果叠一个小弹窗显示。
   后端那边是 /ping-instance，回的是 ["assistant"|"error", 文本]。 */

import { $ } from './dom.js';
import { openModal } from './modal.js';
import { createForm } from './form-fields.js';

var pingBtn   = $('ping-btn');
var pingModal = $('ping-modal');
var pingSub   = $('ping-sub');
var pingBody  = $('ping-body');
var pingNote  = $('ping-note');

/* 换了一个实例、或者又点了一次，先把上一回的结果擦掉 */
export function pingReset() {
    pingSub.className    = 'modal-sub';
    pingSub.textContent  = '正在发一条测试消息出去…';
    pingBody.textContent = '';
    pingNote.textContent = '这一条不会存进上下文';
}

/* 连接成功／失败／请求没发出去，三种下场走同一个出口，省得漏改 */
function pingDone(state, subText, bodyText) {
    pingSub.className    = 'modal-sub ' + state;
    pingSub.textContent  = subText;
    pingBody.textContent = bodyText;
    pingNote.textContent = (state === 'is-err') ? '配置没存，改完再测一次'
                                                : '这一条不会存进上下文';
}

pingBtn.addEventListener('click', function () {
    /* 先用浏览器自带的校验挡一下，字段没填全就不用打网络了 */
    if (!createForm.reportValidity()) { return; }

    pingReset();
    openModal(pingModal, pingModal.querySelector('.js-close'));

    fetch('/ping-instance', { method: 'POST', body: new FormData(createForm) })
        .then(function (res) { return res.json(); })
        .then(function (data) {
            if (data[0] === 'error') {
                pingDone('is-err', '没通，接口那边是这么说的', data[1]);
            } else {
                pingDone('is-ok', '通了，它回了一句', data[1]);
            }
        })
        .catch(function (err) {
            pingDone('is-err', '请求没能发出去', err.message);
        });
});
