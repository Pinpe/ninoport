/* 删除实例：卡片上的删除按钮只负责把编号和模型名塞进确认弹窗。 */

import { $ } from './dom.js';
import { openModal } from './modal.js';

var deleteModal = $('delete-modal');

document.querySelectorAll('.js-delete').forEach(function (btn) {
    btn.addEventListener('click', function () {
        var id = btn.dataset.id || '';
        var model = btn.dataset.model || '';
        $('delete-id-input').value = id;
        $('delete-target').textContent = '#' + id + (model ? '（' + model + '）' : '');
        openModal(deleteModal, deleteModal.querySelector('.btn-danger'));
    });
});
