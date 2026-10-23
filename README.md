![](readme-src/logo.png)

# NinoPort 🪐

NinoPort 是一个跑在自己电脑上的小面板，用来管那些散在各处的 AI 接口。

一个「实例」就是一套 API Key ＋ 模型 ＋ 几个开关的组合。填好之后，它会得到一个随机编号，点开就能直接对话——不用每次都去翻是哪家中转站、该填哪个模型名、那条 `curl` 又该怎么写。

所有配置和历史都只存在本机的几个 JSON 文件里，不上传、不联网（除了你让它去调的那家 API）。

> 官网在 https://pinpe.github.io/ninoport/ ，结构说明也能在这儿看到。
>
> Windows 用户：去 [Releases](https://github.com/Pinpe/ninoport/releases) 下 `NinoPort-*-windows.zip`，解压双击 `NinoPort.exe` 就能用，不用装 Python。

---

## ✨ 它做了什么

- **多协议**：一个实例可以选择走 `Chat Completions`、`OpenAI Responses API` 还是 `Anthropic Messages API`，各家的差异在 `lib/base_api.py` 里消化掉了，上层不用管
- **思考开关与思考强度**：`thinking` 与 `reasoning_effort` 分开做成了两个参数，因为不同协议的表达方式不一样
- **最大输出 token**：每套实例单独设，按服务和模型自己的上限填
- **等效代码**：创建 / 编辑实例时，右边会实时生成这个实例将来实际发出的调用代码（跟着所选协议走）。填错了能当场看出来，想抄走也随手
- **测试连接**：创建 / 编辑实例时点一下「测试连接」，它就拿当前填的这套配置真发一条消息出去。通了把回复原样显示在弹窗里，不通就把接口那边的原话贴回来，不用建完再进对话页试
- **系统提示词**：留空就完全不发 system 消息，不塞空字符串
- **保存上下文**：关掉之后每轮只带当前这一条进去，旧的上下文也不再留着，对话页上只剩这一问一答（想留底就先导出）
- **对话页**：AI 的回复按 markdown 渲染（marked 解析 + DOMPurify 消毒），报错的那条会单独标出来，原样显示不渲染；每条回复可以一键复制它的 Markdown 原文
- **导出与导入**：上下文能导出成 JSON，也能拿回来导入，导入时会先校验文件里是不是一个合格的数组
- **清空上下文**：实例留着，聊过的都清掉
- **Agent 友好接口**：一组 `/agent` 路由，用 `curl` 就能给某个实例发消息、读它的上下文，不用开浏览器。访问 <http://127.0.0.1:5000/agent> 能看到参数说明

## 🗺️ 架构

![](readme-src/architecture.png)

一共三层，边界划得比较死：

1. **`main.py`** —— 只管 Flask 那点事：收表单、拼配置、存盘、跳页面。它不碰任何 API 细节。
2. **`lib/core.py`** —— 与 AI 交互的直接接口。`get_api()` 按 `api-type` 分派到对应协议，`create_message()` 把系统提示词和历史拼成 OpenAI 标准格式。
3. **`lib/base_api.py`** —— 每种协议一个函数。外面只许通过 `get_api()` 进来，不要在别处直接调它。

另外单独一格：**`lib/database.py`**，全程序唯一碰硬盘的地方。换个程序也能原样拿走的那部分叫 `lib`，它是唯一一个破例的——但它管的是「边界」，所以单独放着。

## 💾 不想装环境（Windows 直接下载）

去 [Releases](https://github.com/Pinpe/ninoport/releases) 拿最新的 `NinoPort-*-windows.zip`，解压出来是这些：

```
NinoPort.exe      双击就开窗，不用装 Python
database/         空的，第一次打开会往里写
LICENSE
README.md
```

这个包是每次发版时 GitHub Actions 在 `windows-latest` 上现打的，模板和静态文件都塞进 exe 里了，机器上什么都不用准备。

几件事说在前面：

- 压缩包里不带任何配置和 Key，第一次打开是空的，自己建实例就行
- `database/` 要紧挨着 exe，别单独把 exe 拷走
- exe 没做代码签名，Windows 可能先弹一句「已保护你的电脑」——点「更多信息」→「仍要运行」
- 只有 Windows 包。macOS 和 Linux 走下面的源码跑法

## 🚀 跑起来

需要 **Python 3.11 或更高版本**（用到了 `typing.Unpack`）。

```bash
git clone https://github.com/Pinpe/ninoport.git
cd ninoport
pip install -r requirements.txt
python main.py
```

然后打开 <http://127.0.0.1:5000>，点「创建实例」。

要填的东西：

- **API 协议**：一般选 Chat Completions；走官方新接口的选 Responses；连 Claude 的选 Anthropic Messages
- **API Key**：只存在你本机的 `database/instance.json` 里
- **API 端点**：中转站或者本地服务都填这儿；留空则走各家官方端点
- **模型名称**：原样交给 API，拿不准就去服务商文档里抄一份
- **最大输出 token**：按服务商的模型上限填，必填

## 📁 目录

```
ninoport/
├─ main.py              Flask 路由，所有入口都在这里
├─ lib/
│  ├─ core.py           与 AI 交互的直接接口
│  ├─ base_api.py       各种 API 协议的实现
│  └─ database.py       唯一碰硬盘的地方
├─ templates/           index.html 实例列表 / chat.html 对话页，只放结构
├─ static/
│  ├─ style.css         两张页面共用的样式表
│  ├─ js/               页面的脚本，一个文件管一件事（见下）
│  └─ *.png             图标
├─ database/            运行后生成：instance.json、context.json
├─ readme-src/          README 用图的源码与生成脚本
└─ .github/workflows/   发布 Release 时自动打 Windows 包并挂到发行页
```

`static/js/` 是一堆浏览器原生的 ES module，没有打包步骤，改完刷新就生效：

```
index.js            列表页入口，只负责把下面几块装上
dom.js              $ 和 HTML 转义
modal.js            弹窗开关、Esc、点遮罩，页面里所有 .modal-mask 都归它
form-fields.js      创建弹窗那几个输入框，两个文件都要用，所以单独放
code-render.js      右边那段等效代码
instance-form.js    创建 / 编辑表单，两副面孔一个函数
ping.js             测试连接
context-manage.js   导出 / 导入 / 清空上下文
delete-instance.js  删除实例的确认
chat.js             对话页（这张不是 module，位置和原来的内联脚本一致）
```

`readme-src/` 里那两张图不是画图软件导出的，是 `make-assets.py` 生成的，改配色或改文案直接改脚本再跑一遍：

```bash
python3 readme-src/make-assets.py
```

配色和字体跟 `static/style.css` 里的 `:root` 是同一套，别两处对不上。

## 🔒 数据与隐私

`database/instance.json` 里的 API Key 是**明文**存的。这套东西是给自己本地用的，没有账号系统、没有加密、也没有权限管理——所以：

- 别把它挂到公网上
- `database/` 已经在 `.gitignore` 里了，别手滑提交上去

## 📜 许可

[GPL-3.0](LICENSE)

## 相关

- [Nino](https://github.com/Pinpe/nino-ai-chat) —— 轻量级的 AI 陪伴聊天软件
- [NinoClaw](https://github.com/Pinpe/ninoclaw) —— 住在终端里的 AI 助手
