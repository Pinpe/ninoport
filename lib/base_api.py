'''
此库是各种API协议的实现，因为很多API仅支持特定协议，而为了统一管理多个协议，故写此库。

这里每一个函数都是一种协议，在其字符串文档中不再赘述参数和返回，因为API参数大同小异，
返回API端发送的**增量**的输出迭代器，因此省略。（若需要可查看官方API文档）

**注意：** 为了避免恶化代码质量和降低稳定性，除了有特殊情况，禁止在`get_api()`以外直接调用此库的函数。
'''

# ────────────────────────────────────────────────────────────────────────────────────────

from anthropic import NOT_GIVEN as anthropic_not_given
from anthropic import Anthropic

from openai import NOT_GIVEN as openai_not_given
from openai import OpenAI

from typing import Iterator

# ────────────────────────────────────────────────────────────────────────────────────────

def chat_completions(
        api_key: str,
        base_url: str,
        model: str,
        max_tokens: int,
        thinking: bool,
        reasoning_effort: str | None,
        stream: bool,
        messages: list[dict]
    ) -> Iterator[str]:
    ''' Chat Completions协议的实现。'''
    client = OpenAI(
        api_key  = api_key,
        base_url = base_url
    )

    response = client.chat.completions.create(
        model            = model,
        max_tokens       = max_tokens,
        stream           = stream,
        extra_body       = {
            'thinking': {'type': 'enabled'}
                if thinking is True else {'type': 'disabled'}
        },
        reasoning_effort = reasoning_effort 
            if reasoning_effort is not None else openai_not_given,
        messages         = messages
    )

    if stream == True:
        for event in response:
            if event.choices[0].delta.content is not None:
                yield event.choices[0].delta.content
    elif stream == False:
        yield response.choices[0].message.content
    else:
        raise TypeError(f'stream is bool only')

# ────────────────────────────────────────────────────────────────────────────────────────

def responses_api(
        api_key: str,
        base_url: str,
        model: str,
        max_tokens: int,
        thinking: bool,
        reasoning_effort: str | None,
        stream: bool,
        system: str | None,
        messages: list[dict]
) -> Iterator[str]:
    ''' OpenAI Responses API协议的实现。 '''
    client = OpenAI(
        api_key  = api_key, 
        base_url = base_url
    )

    response = client.responses.create(
        model             = model,
        max_output_tokens = max_tokens,
        reasoning         = {"effort": reasoning_effort} 
            if thinking is True else openai_not_given,
        instructions      = system
            if system is not None else openai_not_given,
        input             = messages,
        stream            = stream
    )

    if stream == True:
        for event in response:
            if event.type == "response.output_text.delta":
                yield event.delta
    elif stream == False:
        yield response.output_text
    else:
        raise TypeError(f'stream is bool only')

# ────────────────────────────────────────────────────────────────────────────────────────

def anthropic_messages_api(
        api_key: str,
        base_url: str,
        model: str,
        max_tokens: int,
        thinking: bool,
        reasoning_effort: str | None,
        stream: bool,
        system: str | None,
        messages: list[dict]
) -> Iterator[str]:
    ''' Anthropic Messages API 协议的实现。 '''
    client = Anthropic(
        api_key  = api_key,
        base_url = base_url
    )

    message = client.messages.create(
        model         = model,
        max_tokens    = max_tokens,
        output_config = {'effort': reasoning_effort}
            if thinking is True else anthropic_not_given,
        stream        = stream,
        system        = system
            if system is not None else anthropic_not_given,
        messages      = messages
    )

    if stream == True:
        for event in message:
            if event.type == "content_block_delta" and event.delta.type == "text_delta":
                yield event.delta.text
    elif stream == False:
        yield "".join(
            block.text for block in message.content
                if block.type == "text"
        )
    else:
        raise TypeError(f'stream is bool only')