from lib import database
from lib import core
from flask import *
import random
import time
import json
import sys
import os
import io


ninoport: Flask     = Flask(__name__)
database_data: dict = database.load_data()
latest_version: str = '1.3.0'


def get_input_instance_config() -> dict:
    '''
    获取POST发送而来的表单里的实例属性，可以用于对创建和修改实例提供信息。

    :return: 用户在表单输入的实例属性，可以使用`get_input_instance_metadata()['xxx']`访问
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


@ninoport.route('/')
def public_main():
    return render_template(
        'index.html',
        database_data  = database_data['instance'],
        latest_version = latest_version
    )


@ninoport.route('/delete-instance', methods=['POST'])
def delete_instance():
    instance_id = request.form.get('delete-id')

    del database_data['instance'][instance_id]
    del database_data['context'][instance_id]
    database.overwrite_data(database_data['instance'], 'instance')
    database.overwrite_data(database_data['context'], 'context')

    return redirect('/')


@ninoport.route('/create-instance', methods=['POST'])
def create_instance():
    instance_id = random.randint(10000, 99999)

    database_data['instance'][str(instance_id)] = get_input_instance_config()
    database_data['context'][str(instance_id)] = []
    database.overwrite_data(database_data['instance'], 'instance')
    database.overwrite_data(database_data['context'], 'context')

    return redirect('/')


@ninoport.route('/edit-instance', methods=['POST'])
def edit_instance():
    instance_id = request.form.get('edit-id')

    database_data['instance'][str(instance_id)] = get_input_instance_config()
    database.overwrite_data(database_data['instance'], 'instance')

    return redirect('/')


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


@ninoport.route('/delete-context', methods=['POST'])
def delete_context():
    instance_id = request.form.get('delete-id')

    database_data['context'][instance_id] = []
    database.overwrite_data(database_data['context'], 'context')

    return redirect('/')


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


@ninoport.route('/import-context', methods=['POST'])
def import_context():
    instance_id = request.form.get('import-id')

    file = json.loads(request.files['context_file'].read().decode('UTF-8-SIG'))

    database_data['context'][instance_id] = file
    database.overwrite_data(database_data['context'], 'context')

    return redirect('/')


@ninoport.route('/reload')
def reload():
    os.execv(sys.executable, [sys.executable] + sys.argv)
    return('/')


if __name__ == '__main__':
    ninoport.run(debug=True)