from openai import OpenAI
from openai import NOT_GIVEN


def get_api(
        api_key: str,
        base_url: str,
        model: str,
        thinking: bool,
        reasoning_effort: str | None,
        messages: list[dict]
    ) -> str:
    '''
    直接将**原始**的提示词和上下文发送给AI，是与AI交互的直接接口。

    :param api_key: 由服务商提供的API Key，一般需要保密
    :param base_url: 由服务商提供的API端点
    :param model: 请求的模型名称
    :param thinking: 是否启用思考
    :param reasoning_effort: 模型的思考强度，当设置为None时忽略，其他字符串则原样提供给API
    :param messages: 向AI提供的所有提示词和上下文

    **注意：** 因为要适配不同API，给thinking和reasoning_effort做成了两个功能差不多但是独立的两个参数。

    :return: 从API端发送的AI输出
    '''
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


def create_message(
        system: str | None,
        history: list[tuple[str]]
    ) -> list[dict]:
    '''
    将零散的提示词和上下文参数转换成OpenAI标准格式。

    :param system: 附加的系统提示词，优先级最高，但是中转站的API可能无法使用
    :param history: 用户和模型的历史上下文的列表，从旧往新排序，
        每条的格式为：`('user' | 'assistant', 'content')`

    :return: OpenAI标准格式的messages列表
    '''
    messages = []
    if system is not None:
        messages.append({ 'role': 'system', 'content': system })
    for i in history:
        messages.append({ 'role': i[0], 'content': i[1] })
    return messages