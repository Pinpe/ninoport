/* 创建弹窗里那几个输入框。
   表单那边要拿它们摆值，等效代码那边要拿它们读值——各抓一遍迟早抓漏一个，统一从这里出。 */

import { $ } from './dom.js';

export var createForm = $('create-form');

export var apiTypeInput    = $('api-type');
export var keyInput        = $('api-key');
export var baseInput       = $('base-url');
export var modelInput      = $('model');
export var maxTokensInput  = $('max-tokens');
export var thinkInput      = $('thinking');
export var effortInput     = $('reasoning-effort');
export var systemInput     = $('system-prompt');
export var saveCtxInput    = $('save-context');
