import json
import os


def format_json_dump(content: str, file_path: str) -> None:
    '''
    用于在json**覆写**时提供格式化和设定编码，替代原来的json_dump()。

    :param content: 要**覆写**的内容
    :param file_path: 要写入的文件路径
    '''
    json.dump(
        content,
        open(file_path, mode='w', encoding='UTF-8'),
        ensure_ascii = False,
        indent       = 4
    )


def load_data() -> dict[str]:
    '''
    从数据库加载数据。

    :return: 使用`load_data()['xxx']`来选取数据库，然后会返回从JSON转换而来的字典
    '''
    return {
        'instance': json.load(open('database/instance.json', encoding='UTF-8')),
        'context':  json.load(open('database/context.json', encoding='UTF-8'))
    }


def overwrite_data(content: dict, target: str) -> None:
    '''
    **覆写**数据库，其行为与`database.format_json_dump({content}, 'database/{target}.json')`大致保持一致。

    为了避免重复代码，以及直接操作底层文件却不加处理而降低安全性和未来的扩展性。

    :param content: 要**覆写**的内容
    :param target: 要写入的数据库
    '''
    if os.path.isfile(f'database/{target}.json') == True:
        format_json_dump(content, f'database/{target}.json')
    else:
        raise FileNotFoundError(f'File is not found: {target}.json')