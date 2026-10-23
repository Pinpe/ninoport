'''
生成 README 用的两张图。

    python3 readme-src/make-assets.py

产出（都在 readme-src/ 下）：
    logo.png          —— 顶部的品牌图：🪐 + NinoPort + AI 端口
    architecture.png  —— 架构图

改配色改字体就改上面的常量；架构图那部分改 BOXES / 坐标即可。
配色与字体跟 static/style.css 里的 :root 保持一致，别两处对不上。
'''

import subprocess
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


HERE = Path(__file__).resolve().parent
ROOT = HERE.parent

# ── 设计变量（抄自 static/style.css 的 :root）────────────────────────────────
BG        = '#F0EEE6'
SURFACE   = '#FBFAF7'
SURFACE_2 = '#F5F3EC'
TEXT      = '#1F1E1D'
TEXT_2    = '#6B6862'
TEXT_3    = '#9C978C'
LINE      = '#E5E1D6'
LINE_2    = '#D6D1C2'
CLAY      = '#D97757'
CLAY_DEEP = '#B65636'
CLAY_SOFT = '#F7EAE3'

SERIF_TTC = '/usr/share/fonts/noto-cjk/NotoSerifCJK-Regular.ttc'   # index 2 = SC
SANS_TTC  = '/usr/share/fonts/noto-cjk/NotoSansCJK-Regular.ttc'    # index 2 = SC
MONO_TTF  = '/usr/share/fonts/noto/NotoSansMono-Regular.ttf'
EMOJI_TTF = '/usr/share/fonts/noto/NotoColorEmoji.ttf'


def serif(size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(SERIF_TTC, size, index=2)


def sans(size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(SANS_TTC, size, index=2)


def mono(size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(MONO_TTF, size)


# ── 顶部品牌图 ──────────────────────────────────────────────────────────────
# Noto Color Emoji 只有一档 109px 的位图，放大就糊，所以尺寸是围着它定的：
# 最终图上 🪐 的墨迹约 154px 宽，也就是原生 126px 的 1.22 倍，几乎看不出软。
LOGO_W, LOGO_H = 1600, 520
SS = 2                                    # 先画两倍再缩回去，边缘才干净

CHIP      = 200                           # 🪐 外面那个圆角方格的边长
CHIP_R    = 46
EMOJI_W   = 154                           # 🪐 墨迹宽度
NAME_SIZE = 130                           # NinoPort 的字号
TAIL_SIZE = 40                            # AI 端口 的字号
GAP       = 34                            # 锁标里每两块之间的距离
RULE_H    = 78                            # 竖线高度


def draw_tracked(d, xy, text, font, fill, tracking, anchor_middle=False):
    ''' PIL 没有字距，只好一个字一个字摆。anchor_middle=True 时 xy 里给的是整串的中心 '''
    widths = [d.textlength(c, font=font) for c in text]
    total = sum(widths) + tracking * (len(text) - 1)
    x, cy = xy
    if anchor_middle:
        x -= total / 2
    for c, cw in zip(text, widths):
        d.text((x, cy), c, font=font, fill=fill, anchor='lm')
        x += cw + tracking
    return total


def render_logo() -> None:
    w, h = LOGO_W * SS, LOGO_H * SS
    im = Image.new('RGB', (w, h), BG)
    d = ImageDraw.Draw(im)

    name_font = serif(NAME_SIZE * SS)
    tail_font = sans(TAIL_SIZE * SS)

    name = 'NinoPort'
    tail = 'AI 端口'
    name_w = d.textlength(name, font=name_font)
    track = 5 * SS
    tail_w = (sum(d.textlength(c, font=tail_font) for c in tail)
              + track * (len(tail) - 1))

    # 全部按「放大后的像素」算，别再乘一次 SS
    total = CHIP * SS + GAP * SS + name_w + GAP * SS + 2 * SS + GAP * SS + tail_w
    x = (w - total) / 2
    cy = h / 2

    # 🪐 的圆角方格
    chip = CHIP * SS
    d.rounded_rectangle(
        [x, cy - chip / 2, x + chip, cy + chip / 2],
        radius=CHIP_R * SS, fill=SURFACE, outline=LINE, width=2 * SS,
    )

    # 🪐 本体：先按原生尺寸画一张，裁掉空白，再缩到要的大小贴上去
    ef = ImageFont.truetype(EMOJI_TTF, 109)
    raw = Image.new('RGBA', (300, 300), (0, 0, 0, 0))
    ImageDraw.Draw(raw).text((60, 60), '🪐', font=ef, embedded_color=True)
    raw = raw.crop(raw.getbbox())
    ew = EMOJI_W * SS
    eh = round(ew * raw.height / raw.width)
    raw = raw.resize((ew, eh), Image.LANCZOS)
    im.paste(raw, (round(x + (chip - ew) / 2), round(cy - eh / 2)), raw)

    x += chip + GAP * SS

    # NinoPort（serif，跟程序顶栏同一支字体）
    d.text((x, cy), name, font=name_font, fill=TEXT, anchor='lm')
    x += name_w + GAP * SS

    # 那根竖线
    d.rectangle([x, cy - RULE_H * SS / 2, x + 2 * SS, cy + RULE_H * SS / 2], fill=LINE_2)
    x += (2 + GAP) * SS

    # AI 端口（跟顶栏的 brand-tail 一个味道，拉一点字距）
    draw_tracked(d, (x, cy), tail, tail_font, TEXT_3, track)

    im.resize((LOGO_W, LOGO_H), Image.LANCZOS).save(HERE / 'logo.png')
    print('logo.png', (LOGO_W, LOGO_H))


# ── 架构图 ──────────────────────────────────────────────────────────────────
DIAG_W, DIAG_H = 1500, 1210
DSS = 2

BOX_R = 18          # 圆角
TITLE_SIZE = 27
BODY_SIZE = 22
SUB_SIZE = 19
ARROW = 2.6


def esc(s: str) -> str:
    return s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')


def box(x, y, w, h, title, lines, accent=None, fill=SURFACE):
    ''' 一个圆角框：标题一行，下面若干行说明（`|` 开头的行画成等宽小字）'''
    out = [
        f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{BOX_R}" '
        f'fill="{fill}" stroke="{accent or LINE}" stroke-width="2"/>'
    ]
    ty = y + 48
    out.append(
        f'<text x="{x + 34}" y="{ty}" font-family="Noto Serif CJK SC" '
        f'font-size="{TITLE_SIZE}" fill="{accent or TEXT}">{esc(title)}</text>'
    )
    ly = ty + 40
    for ln in lines:
        if ln.startswith('|'):
            out.append(
                f'<text x="{x + 34}" y="{ly}" font-family="Noto Sans Mono" '
                f'font-size="{SUB_SIZE}" fill="{CLAY_DEEP}">{esc(ln[1:])}</text>'
            )
        else:
            out.append(
                f'<text x="{x + 34}" y="{ly}" font-family="Noto Sans CJK SC" '
                f'font-size="{BODY_SIZE}" fill="{TEXT_2}">{esc(ln)}</text>'
            )
        ly += 32
    return '\n'.join(out)


def arrow(x1, y1, x2, y2, label=None):
    out = [
        f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{LINE_2}" '
        f'stroke-width="{ARROW}" marker-end="url(#tip)"/>'
    ]
    if label:
        out.append(
            f'<text x="{(x1 + x2) / 2 + 16}" y="{(y1 + y2) / 2 + 8}" '
            f'font-family="Noto Sans CJK SC" font-size="{SUB_SIZE}" '
            f'fill="{TEXT_3}">{esc(label)}</text>'
        )
    return '\n'.join(out)


def render_architecture() -> None:
    body = []
    body.append(box(60, 60, 1380, 150, '浏览器', [
        'index.html 实例列表（创建 / 编辑 / 删除）　　chat.html 对话页',
    ], fill=SURFACE_2))

    body.append(arrow(750, 210, 750, 268, 'HTTP 表单'))

    body.append(box(60, 268, 1380, 200, 'main.py · Flask 路由', [
        '拿到表单就拼实例属性、存盘、跳回页面；不碰任何 API 细节',
        '|/   /create-instance   /edit-instance   /delete-instance',
        '|/chat/<id>   /chat/<id>/send   /delete-context   /reload',
    ]))

    # 数据库归 main.py 管，所以它的线从 main.py 直接下来，走右边那一栏，
    # 别从 core.py 引 —— core.py 压根不碰硬盘
    body.append(arrow(1225, 468, 1225, 526, 'load / overwrite'))
    body.append(box(1010, 526, 430, 190, 'lib/database.py', [
        '全程序唯一碰硬盘的地方',
        'instance.json 与',
        'context.json 各存一个库',
    ], accent=CLAY, fill=CLAY_SOFT))

    body.append(arrow(510, 468, 510, 526, 'get_api()'))
    body.append(box(60, 526, 900, 190, 'lib/core.py', [
        '与 AI 交互的直接接口',
        'get_api() 按 api-type 分派到对应协议，',
        'create_message() 把 system 与历史拼成 OpenAI 格式',
    ]))

    body.append(arrow(510, 716, 510, 780, '按协议分派'))
    body.append(box(60, 780, 900, 190, 'lib/base_api.py', [
        '每一种 API 协议一个函数，返回的都是 AI 输出',
        '|chat_completions()   responses_api()',
        '除了 get_api() 以外，不许直接调用这里的函数',
    ]))

    body.append(arrow(510, 970, 510, 1030, 'OpenAI 兼容 API'))
    body.append(box(60, 1030, 900, 120, '中转站 / 官方 / 本地服务', [
        '实例上写死 base_url，换一家就是换一个字符串',
    ], accent=CLAY, fill=CLAY_SOFT))

    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="{DIAG_W}" height="{DIAG_H}"
     viewBox="0 0 {DIAG_W} {DIAG_H}">
  <defs>
    <marker id="tip" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7"
            markerHeight="7" orient="auto-start-reverse">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="{LINE_2}"/>
    </marker>
  </defs>
  <rect width="{DIAG_W}" height="{DIAG_H}" fill="{BG}"/>
  <text x="60" y="40" font-family="Noto Serif CJK SC" font-size="26"
        fill="{TEXT_3}">NinoPort · 架构</text>
{chr(10).join(body)}
</svg>
'''
    src = HERE / 'architecture.svg'
    src.write_text(svg, encoding='UTF-8')
    subprocess.run(
        ['rsvg-convert', '-w', str(DIAG_W * DSS), '-h', str(DIAG_H * DSS),
         '-o', str(HERE / 'architecture.png'), str(src)],
        check=True,
    )
    print('architecture.png', (DIAG_W * DSS, DIAG_H * DSS))


if __name__ == '__main__':
    render_logo()
    render_architecture()
