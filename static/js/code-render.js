/* 创建弹窗右半边那一段「等效代码」：跟着左边的表单实时变。
   三种协议各一个渲染函数，上面那套染色工具是它们共用的。 */

import { $, esc } from './dom.js';
import {
    createForm, apiTypeInput, keyInput, baseInput, modelInput, maxTokensInput,
    thinkInput, effortInput, systemInput, saveCtxInput
} from './form-fields.js';

var codeOut       = $('code-out');
var codeNote      = $('code-note');
var codeHeadLabel = $('code-head-label');
var baseHintEl    = $('base-url-hint');
var effortNoneOption = $('effort-none-label');

function tok(cls, text) { return '<span class="' + cls + '">' + esc(text) + '</span>'; }
var str = function (s) { return tok('tok-str', s); };
var kw  = function (s) { return tok('tok-kw', s); };
var ky  = function (s) { return tok('tok-key', s); };
var com = function (s) { return tok('tok-com', s); };
var num = function (s) { return tok('tok-num', s); };

/* 一行关键字参数：`key = value,`，key 按 width 对齐 */
function arg(width, indent, key, valueHtml) {
    return indent + ky(key.padEnd(width)) + ' = ' + valueHtml + ',';
}

/* Python 字符串字面量（借用 JSON 的转义规则，够用） */
function pyStr(s) { return str(JSON.stringify(s)); }

var PLACEHOLDER = {
    key:        'sk-...',
    base:       'https://api.openai.com/v1',
    model:      'gpt-4o-mini',
    maxTokens:  4096,
    user:       '你好'
};

function truncate(s, n) {
    return s.length > n ? s.slice(0, n) + '…' : s;
}

/* ── Chat Completions 版 ──────────────────────────────────────────── */
function renderChatLines(lines, model, maxTokens, think, effort, system, saveCtx) {
    /* messages */
    var msgs = [];
    if (!saveCtx) {
        /* 关掉保存上下文：每条只发自己，历史不进 messages */
        msgs.push('        ' + com('# 没开「保存上下文」：历史不带，每条都是新的'));
    }
    if (system) {
        msgs.push('        {' + ky('"role"') + ': ' + str('"system"') + ', '
                  + ky('"content"') + ': ' + pyStr(truncate(system, 60)) + '},');
    }
    msgs.push('        {' + ky('"role"') + ': ' + str('"user"') + ', '
              + ky('"content"') + ': ' + pyStr(PLACEHOLDER.user) + '},');

    var createArgs = [
        ['model',            str('"' + (model || PLACEHOLDER.model) + '"')],
        ['max_tokens',       num(maxTokens || PLACEHOLDER.maxTokens)],
        ['stream',           kw('False')],
        ['extra_body',       '{' + ky('"thinking"') + ': {'
                             + ky('"type"') + ': '
                             + str('"' + (think ? 'enabled' : 'disabled') + '"') + '}}'],
        ['reasoning_effort', effort ? str('"' + effort + '"') : null],
        ['messages',         '__MESSAGES__']
    ];
    var w = 16; /* len('reasoning_effort') */

    lines.push('response = client.chat.completions.create(');
    createArgs.forEach(function (pair) {
        if (pair[0] === 'reasoning_effort' && !pair[1]) {
            /* 留空＝整行不发，那就写成一行正经注释，别留个光秃秃的键名 */
            lines.push('    ' + com('# reasoning_effort 留空：这一行不发送，用服务商的默认'));
            return;
        }
        if (pair[0] === 'messages') {
            lines.push('    ' + ky('messages'.padEnd(w)) + ' = [');
            msgs.forEach(function (m) { lines.push(m); });
            lines.push('    ],');
            return;
        }
        lines.push(arg(w, '    ', pair[0], pair[1]));
    });
    lines.push(')');
    lines.push('');
    lines.push(kw('print') + '(response.choices[0].message.content)');
}

/* ── OpenAI Responses API 版 ──────────────────────────────────────── */
function renderResponsesLines(lines, model, maxTokens, think, effort, system, saveCtx) {
    var w = 17; /* len('max_output_tokens') */

    lines.push('response = client.responses.create(');
    lines.push(arg(w, '    ', 'model', str('"' + (model || PLACEHOLDER.model) + '"')));
    /* 它不认 max_tokens，写它会被当成未知参数；这里叫 max_output_tokens */
    lines.push(arg(w, '    ', 'max_output_tokens', num(maxTokens || PLACEHOLDER.maxTokens)));

    if (think) {
        lines.push(arg(w, '    ', 'reasoning',
            '{' + ky('"effort"') + ': '
            + (effort ? str('"' + effort + '"') : kw('None')) + '}'));
    } else {
        lines.push('    ' + com('# 没开「启用思考模式」：reasoning 这一行不发送'));
    }

    if (system) {
        lines.push(arg(w, '    ', 'instructions', pyStr(truncate(system, 60))));
    } else {
        lines.push('    ' + com('# 系统提示词留空：instructions 这一行不发送'));
    }

    lines.push('    ' + ky('input'.padEnd(w)) + ' = [');
    if (!saveCtx) {
        lines.push('        ' + com('# 没开「保存上下文」：历史不带，每条都是新的'));
    }
    lines.push('        {' + ky('"role"') + ': ' + str('"user"') + ', '
              + ky('"content"') + ': ' + pyStr(PLACEHOLDER.user) + '},');
    lines.push('    ],');
    lines.push(')');
    lines.push('');
    lines.push(kw('print') + '(response.output_text)');
}

/* ── Anthropic Messages API 版 ────────────────────────────────────── */
function renderAnthropicLines(lines, model, maxTokens, think, effort, system, saveCtx) {
    var w = 13; /* len('output_config') */

    lines.push('message = client.messages.create(');
    lines.push(arg(w, '    ', 'model', str('"' + (model || PLACEHOLDER.model) + '"')));
    /* Anthropic 这边 max_tokens 是必填的，少写直接 400 */
    lines.push(arg(w, '    ', 'max_tokens', num(maxTokens || PLACEHOLDER.maxTokens)));

    if (think) {
        lines.push(arg(w, '    ', 'output_config',
            '{' + ky('"effort"') + ': '
            + (effort ? str('"' + effort + '"') : kw('None')) + '}'));
    } else {
        lines.push('    ' + com('# 没开「启用思考模式」：output_config 这一行不发送'));
    }

    if (system) {
        lines.push(arg(w, '    ', 'system', pyStr(truncate(system, 60))));
    } else {
        lines.push('    ' + com('# 系统提示词留空：system 这一行不发送'));
    }

    lines.push('    ' + ky('messages'.padEnd(w)) + ' = [');
    if (!saveCtx) {
        lines.push('        ' + com('# 没开「保存上下文」：历史不带，每条都是新的'));
    }
    lines.push('        {' + ky('"role"') + ': ' + str('"user"') + ', '
              + ky('"content"') + ': ' + pyStr(PLACEHOLDER.user) + '},');
    lines.push('    ],');
    lines.push(')');
    lines.push('');
    lines.push(kw('print') + '(' + str('""') + '.' + ky('join') + '('
              + 'b.text ' + kw('for') + ' b ' + kw('in') + ' message.content '
              + kw('if') + ' b.type == ' + str('"text"') + '))');
}

/* 留空那一档，两种协议其实不一样：chat 整行都不发，responses 会发个 None，
   所以选项的字得跟着协议换，别让文案替程序许诺一件它没做的事 */
var EFFORT_NONE_TEXT = {
    chat:      '不传（用服务商默认）',
    responses: 'None（用服务商默认）',
    anthropic: 'None（用服务商默认）'
};

var CODE_NOTE = {
    chat: '这就是这个实例将来实际发出的请求。每次对话时，'
        + '历史消息会一起塞进 <code>messages</code> 再发出去'
        + '（关了「保存上下文」就只发当前这一条）；'
        + '上面 Key 的位置为了安全没有显示真实值。',
    responses: '这就是这个实例将来实际发出的请求。系统提示词单独走 '
        + '<code>instructions</code>，剩下的话历史一起塞进 '
        + '<code>input</code>（关了「保存上下文」就只发当前这一条）；'
        + '上面 Key 的位置为了安全没有显示真实值。',
    anthropic: '这就是这个实例将来实际发出的请求。系统提示词是顶层那个 '
        + '<code>system</code>（不是 messages 里的一条），历史消息进 '
        + '<code>messages</code>（关了「保存上下文」就只发当前这一条）；'
        + '回复是一串内容块，只取 <code>type == "text"</code> 的那些拼起来。'
        + '上面 Key 的位置为了安全没有显示真实值。'
};

var CODE_HEAD_LABEL = {
    chat:      '等效 OpenAI API 调用',
    responses: '等效 OpenAI API 调用',
    anthropic: '等效 Anthropic API 调用'
};

var CLIENT_IMPORT = {
    chat:      { pkg: 'openai',    cls: 'OpenAI' },
    responses: { pkg: 'openai',    cls: 'OpenAI' },
    anthropic: { pkg: 'anthropic', cls: 'Anthropic' }
};

/* 占位符和提示语跟着协议走：Anthropic 的默认端点是另一家，别拿 OpenAI 的糊弄 */
var PROTOCOL_HINT = {
    chat: {
        base:     'https://api.openai.com/v1',
        baseHint: '中转站或本地服务都填这里；留空则用 OpenAI 官方端点。',
        model:    'gpt-4o-mini'
    },
    responses: {
        base:     'https://api.openai.com/v1',
        baseHint: '中转站或本地服务都填这里；留空则用 OpenAI 官方端点。',
        model:    'gpt-4o-mini'
    },
    anthropic: {
        base:     'https://api.anthropic.com',
        baseHint: '中转站或本地服务都填这里；留空则用 Anthropic 官方端点。',
        model:    'claude-opus-5'
    }
};

export function renderCode() {
    var key    = keyInput.value.trim();
    var base   = baseInput.value.trim();
    var model  = modelInput.value.trim();
    var maxTokens = parseInt(maxTokensInput.value, 10);
    if (!maxTokens || maxTokens < 1) { maxTokens = PLACEHOLDER.maxTokens; }
    var think  = thinkInput.checked;
    var effort = effortInput.value;
    var system = systemInput.value.trim();
    var saveCtx = saveCtxInput.checked;

    var apiType = apiTypeInput.value;
    if (apiType !== 'responses' && apiType !== 'anthropic') { apiType = 'chat'; }

    var ph = PROTOCOL_HINT[apiType];
    baseInput.placeholder  = ph.base;
    modelInput.placeholder = ph.model;
    if (baseHintEl) { baseHintEl.textContent = ph.baseHint; }
    if (!model) { model = ph.model; }

    var lines = [];
    var client = CLIENT_IMPORT[apiType];

    lines.push(kw('from') + ' ' + client.pkg + ' ' + kw('import') + ' ' + client.cls);
    lines.push('');

    /* client = ...(...)：注释一律独占一行，别吊在代码尾巴上 */
    var cw = 8; /* len('base_url') */
    lines.push('client = ' + client.cls + '(');
    lines.push('    ' + com(key ? '# 表单里填的 Key（这里不显示真实值）'
                                  : '# 换成你自己的 Key'));
    lines.push(arg(cw, '    ', 'api_key', str('"' + PLACEHOLDER.key + '"')));
    if (base) {
        lines.push(arg(cw, '    ', 'base_url', str('"' + base + '"')));
    } else {
        lines.push('    ' + com('# base_url 留空：走 SDK 默认端点'));
    }
    lines.push(')');
    lines.push('');

    if (apiType === 'responses') {
        renderResponsesLines(lines, model, maxTokens, think, effort, system, saveCtx);
    } else if (apiType === 'anthropic') {
        renderAnthropicLines(lines, model, maxTokens, think, effort, system, saveCtx);
    } else {
        renderChatLines(lines, model, maxTokens, think, effort, system, saveCtx);
    }

    codeOut.innerHTML = lines.join('\n');
    if (codeNote) { codeNote.innerHTML = CODE_NOTE[apiType]; }
    if (effortNoneOption) { effortNoneOption.textContent = EFFORT_NONE_TEXT[apiType]; }
    if (codeHeadLabel) { codeHeadLabel.textContent = CODE_HEAD_LABEL[apiType]; }
}

createForm.addEventListener('input', renderCode);
createForm.addEventListener('change', renderCode);
