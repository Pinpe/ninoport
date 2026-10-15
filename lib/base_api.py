'''
此库是各种API协议的实现，因为很多API仅支持特定协议，而为了统一管理多个协议，故写此库。

这里每一个函数都是一种协议，在其字符串文档中不再赘述参数和返回，因为API参数大同小异，
返回也只有从API端发送的AI输出，因此省略。（若需要可查看官方API文档）

**注意：** 为了避免恶化代码质量和降低稳定性，除了有特殊情况，禁止在`get_api()`以外直接调用此库的函数。
'''


from openai import NOT_GIVEN
from openai import OpenAI


def chat_completions(
        api_key: str,
        base_url: str,
        model: str,
        thinking: bool,
        reasoning_effort: str | None,
        messages: list[dict]
    ) -> str:
    ''' Chat Completions协议的实现。'''
    client = OpenAI(
        api_key  = api_key,
        base_url = base_url
    )

    response = client.chat.completions.create(
        model            = model,
        stream           = False,
        extra_body       = {
            'thinking': {'type': 'enabled'}
                if thinking is True else {'type': 'disabled'}
        },
        reasoning_effort = reasoning_effort 
            if reasoning_effort is not None else NOT_GIVEN,
        messages         = messages
    )

    return response.choices[0].message.content


def responses_api(
        api_key: str,
        base_url: str,
        model: str,
        thinking: bool,
        reasoning_effort: str | None,
        system: str | None,
        messages: list[dict]
) -> str:
    ''' OpenAI Responses API协议的实现。 '''
    client = OpenAI(
        api_key  = api_key, 
        base_url = base_url
    )

    response = client.responses.create(
        model        = model,
        reasoning    = {"effort": reasoning_effort} 
            if thinking is True else NOT_GIVEN,
        instructions = system
            if system is not None else NOT_GIVEN,
        input        = messages,
    )

    return response.output_text