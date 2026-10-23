from lib import database
from lib import core
from flask import *
import threading
import requests
import textwrap
import webview
import random
import time
import json
import sys
import os
import io

# ────────────────────────────────────────────────────────────────────────────────────────

ninoport: Flask     = Flask(__name__)
server_port: int    = 5000
database_data: dict = database.load_data()
latest_version: str = '1.4.0'

# ────────────────────────────────────────────────────────────────────────────────────────

@ninoport.route('/')
def public_main():
    return render_template(
        'index.html',
        database_data  = database_data['instance'],
        latest_version = latest_version
    )

# ────────────────────────────────────────────────────────────────────────────────────────

@ninoport.route('/delete-instance', methods=['POST'])
def delete_instance():
    instance_id = request.form.get('delete-id')

    del database_data['instance'][instance_id]
    del database_data['context'][instance_id]
    database.overwrite_data(database_data['instance'], 'instance')
    database.overwrite_data(database_data['context'], 'context')

    return redirect('/')

# ────────────────────────────────────────────────────────────────────────────────────────

def get_input_instance_config() -> dict:
    '''
    获取POST发送而来的表单里的实例属性，可以用于对创建和修改实例提供信息。

    :return: 用户在表单输入的实例属性，可以使用`get_input_instance_config()['xxx']`访问
    '''
    return {
        'api-type': request.form.get('api-type'),
        'api-key':  request.form.get('api-key'),
        'base-url':  request.form.get('base-url'),
        'model':  request.form.get('model'),
        'max-tokens': int(request.form.get('max-tokens')),
        'thinking':  True if request.form.get('thinking') == 'on' else False,
        'reasoning-effort':  None if request.form.get('reasoning-effort') == ''
            else request.form.get('reasoning-effort'),
        'save-context':  True if request.form.get('save-context') == 'on' else False,
        'system-prompt': None if request.form.get('system-prompt') == ''
            else request.form.get('system-prompt')
    }

# ────────────────────────────────────────────────────────────────────────────────────────

@ninoport.route('/create-instance', methods=['POST'])
def create_instance():
    instance_id = random.randint(10000, 99999)

    database_data['instance'][str(instance_id)] = get_input_instance_config()
    database_data['context'][str(instance_id)] = []
    database.overwrite_data(database_data['instance'], 'instance')
    database.overwrite_data(database_data['context'], 'context')

    return redirect('/')

# ────────────────────────────────────────────────────────────────────────────────────────

@ninoport.route('/edit-instance', methods=['POST'])
def edit_instance():
    instance_id = request.form.get('edit-id')

    database_data['instance'][str(instance_id)] = get_input_instance_config()
    database.overwrite_data(database_data['instance'], 'instance')

    return redirect('/')

# ────────────────────────────────────────────────────────────────────────────────────────

@ninoport.route('/ping-instance', methods=['POST'])
def ping_instance():
    instance_config = get_input_instance_config()

    try:
        assistant_output = core.get_api(
            api_type         = instance_config['api-type'],
            api_key          = instance_config['api-key'],
            base_url         = instance_config['base-url'],
            model            = instance_config['model'],
            max_tokens       = 256,
            thinking         = False,
            reasoning_effort = None,
            messages         = core.create_message(
                system  = None,
                history = [('user', '你好，这是一条测试消息')],
        ))
    except Exception as error_content:
        return ['error', str(error_content)]
    else:
        return ['assistant', assistant_output]

# ────────────────────────────────────────────────────────────────────────────────────────

@ninoport.route('/chat/<instance_id>')
def public_chat(instance_id: str):
    context_list = database_data['context'][instance_id]

    if context_list != []:
        message_type_list, message_content_list = zip(*context_list)
    else:
        message_type_list, message_content_list = [], []

    return render_template(
        'chat.html',
        message_type_list    = message_type_list,
        message_content_list = message_content_list
    )

# ────────────────────────────────────────────────────────────────────────────────────────

@ninoport.route('/chat/<instance_id>/send', methods=['POST'])
def send(instance_id: str):
    to_api_message_list = []
    user_input = request.form.get('user-input')
    database_data['context'][instance_id].append(('user', user_input))

    if database_data['instance'][instance_id]['save-context'] == False:
        database_data['context'][instance_id] = [database_data['context'][instance_id][-1]]

    for i in database_data['context'][instance_id]:
        if i[0] != 'error':
            to_api_message_list.append(tuple(i))

    try:
        assistant_output = core.get_api(
            api_type         = database_data['instance'][instance_id]['api-type'],
            api_key          = database_data['instance'][instance_id]['api-key'],
            base_url         = database_data['instance'][instance_id]['base-url'],
            model            = database_data['instance'][instance_id]['model'],
            max_tokens       = database_data['instance'][instance_id]['max-tokens'],
            thinking         = database_data['instance'][instance_id]['thinking'],
            reasoning_effort = database_data['instance'][instance_id]['reasoning-effort'],
            messages         = core.create_message(
                system  = database_data['instance'][instance_id]['system-prompt'],
                history = to_api_message_list
        ))
    except Exception as error_content:
        database_data['context'][instance_id].append(('error', str(error_content)))
    else:
        database_data['context'][instance_id].append(('assistant', assistant_output))

    database.overwrite_data(database_data['context'], 'context')

    return redirect(f'/chat/{instance_id}')

# ────────────────────────────────────────────────────────────────────────────────────────

@ninoport.route('/delete-context', methods=['POST'])
def delete_context():
    instance_id = request.form.get('delete-id')

    database_data['context'][instance_id] = []
    database.overwrite_data(database_data['context'], 'context')

    return redirect('/')

# ────────────────────────────────────────────────────────────────────────────────────────

@ninoport.route('/export-context', methods=['POST'])
def export_context():
    instance_id = request.form.get('export-id')

    return send_file(
            io.BytesIO(json.dumps(  # io.BytesIO()是用来将bytes转为虚拟文件的函数
                database_data['context'][instance_id],
                ensure_ascii = False,
                indent       = 4
            ).encode('UTF-8')),
            mimetype      = 'application/json',
            download_name = f'{time.ctime()}_{instance_id}_context.json',
            as_attachment = True
    )

# ────────────────────────────────────────────────────────────────────────────────────────

@ninoport.route('/import-context', methods=['POST'])
def import_context():
    instance_id = request.form.get('import-id')

    file = json.loads(request.files['context_file'].read().decode('UTF-8-SIG'))

    database_data['context'][instance_id] = file
    database.overwrite_data(database_data['context'], 'context')

    return redirect('/')

# ────────────────────────────────────────────────────────────────────────────────────────

@ninoport.route('/agent')
def public_agent_main():
    return textwrap.dedent('''
        # NinoPort的Agent友好接口

        这里是专为Agent设计的简单接口，可以使用curl访问（POST用表单），这样无需进入人类易读的前端界面，即可给实例发送消息。
        
        需要注意的是，此接口不支持实例属性的列出、编辑和修改等操作，若有需求，请直接查看或修改明文的数据库。

        ## 目录：
        - GET `/agent`：当前页面，返回此接口的帮助信息，没有参数。
        - POST `/agent/list`：列出某个实例的全部上下文，需要提供参数：
            - str `instance-id`：列出哪个实例的上下文。
        - POST `/agent/send`：给特定实例发送一条消息，不支持流式，将会返回此实例的回复原文，需要提供的参数列表：
            - str `instance-id`：给哪个实例输入消息。
            - str `user-input`：输入给实例的消息内容。
    ''')

# ────────────────────────────────────────────────────────────────────────────────────────

@ninoport.route('/agent/list', methods=['POST'])
def public_agent_list():
    instance_id = request.form.get('instance-id')

    if instance_id not in database_data['instance']:
        return '找不到此实例编号'

    return database.format_json_dumps(database_data['context'][instance_id])

# ────────────────────────────────────────────────────────────────────────────────────────

@ninoport.route('/agent/send', methods=['POST'])
def agent_send():
    instance_id = request.form.get('instance-id')
    user_input = request.form.get('user-input')

    if instance_id not in database_data['instance']:
        return '找不到此实例编号'

    requests.post(
        f'http://127.0.0.1:{server_port}/chat/{instance_id}/send',
        data = {'user-input': user_input}
    )

    return database.format_json_dumps(database_data['context'][instance_id][-1][1])

# ────────────────────────────────────────────────────────────────────────────────────────

@ninoport.route('/reload')
def reload():
    os.execv(sys.executable, [sys.executable] + sys.argv)
    return('/')

# ────────────────────────────────────────────────────────────────────────────────────────

def ninoport_run() -> None:
    ''' 启动NinoPort的Flask服务器 '''
    ninoport.run(port=server_port)

# ────────────────────────────────────────────────────────────────────────────────────────

if __name__ == '__main__':
    if os.name == 'nt':
        threading.Thread(target=ninoport_run, daemon=True).start()
        time.sleep(1)
        webview.create_window('NinoPort', url=f'http://127.0.0.1:{server_port}')
        webview.start()
    else:
        ninoport_run()