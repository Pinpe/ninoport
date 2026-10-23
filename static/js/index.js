/* 实例列表页的入口：只干装配。
   真正的逻辑按「管哪一块界面」分在隔壁几个文件里，这里把它们的副作用挂上去，
   再把等效代码画第一遍。顺序不用挑——各模块只往上依赖 dom / modal。 */

import { $ } from './dom.js';
import { openModal } from './modal.js';
import { renderCode } from './code-render.js';

import './instance-form.js';      /* 创建 / 编辑弹窗 */
import './delete-instance.js';    /* 删除确认 */
import './context-manage.js';     /* 管理上下文：导出 / 导入 / 清空 */
import './ping.js';               /* 测试连接 */

/* ── 关于 ─────────────────────────────────────────────────────────── */
var aboutModal = $('about-modal');

document.querySelectorAll('.js-open-about').forEach(function (btn) {
    btn.addEventListener('click', function () {
        openModal(aboutModal, aboutModal.querySelector('.js-close'));
    });
});

renderCode();
