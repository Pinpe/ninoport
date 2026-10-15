from lib import database
from lib import core
from flask import *
import random
import time
import sys
import os


ninoport: Flask     = Flask(__name__)
database_data: dict = database.load_data()


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
        database_data = database_data['instance']
    )


@ninoport.route('/delete-instance', methods=['POST'])
def delete_instance():
    delete_id = request.form.get('delete-id')

    del database_data['instance'][delete_id]
    del database_data['context'][delete_id]
    database.overwrite_data(database_data['instance'], 'instance')
    database.overwrite_data(database_data['context'], 'context')

    return redirect('/')


@ninoport.route('/create-instance', methods=['POST'])
def create_instance():
    id_ = random.randint(10000, 99999)

    database_data['instance'][str(id_)] = get_input_instance_config()
    database_data['context'][str(id_)] = []
    database.overwrite_data(database_data['instance'], 'instance')
    database.overwrite_data(database_data['context'], 'context')

    return redirect('/')


@ninoport.route('/edit-instance', methods=['POST'])
def edit_instance():
    id_ = request.form.get('edit-id')

    database_data['instance'][str(id_)] = get_input_instance_config()
    database.overwrite_data(database_data['instance'], 'instance')

    return redirect('/')


@ninoport.route('/chat/<id_>')
def public_chat(id_: str):
    context_list = database_data['context'][id_]

    if context_list != []:
        message_type_list, message_content_list = zip(*context_list)
    else:
        message_type_list, message_content_list = [], []

    return render_template(
        'chat.html',
        message_type_list    = message_type_list,
        message_content_list = message_content_list
    )


@ninoport.route('/chat/<id_>/send', methods=['POST'])
def send(id_: str):
    to_api_message_list = []
    user_input = request.form.get('user-input')
    database_data['context'][id_].append(('user', user_input))

    if database_data['instance'][id_]['save-context'] == False:
        database_data['context'][id_] = [database_data['context'][id_][-1]]

    for i in database_data['context'][id_]:
        if i[0] != 'error':
            to_api_message_list.append(tuple(i))

    try:
        assistant_output = core.get_api(
            api_type         = database_data['instance'][id_]['api-type'],
            api_key          = database_data['instance'][id_]['api-key'],
            base_url         = database_data['instance'][id_]['base-url'],
            model            = database_data['instance'][id_]['model'],
            thinking         = database_data['instance'][id_]['thinking'],
            reasoning_effort = database_data['instance'][id_]['reasoning-effort'],
            messages         = core.create_message(
                system  = database_data['instance'][id_]['system-prompt'],
                history = to_api_message_list
        ))
    except Exception as error_content:
        database_data['context'][id_].append(('error', str(error_content)))
    else:
        database_data['context'][id_].append(('assistant', assistant_output))

    database.overwrite_data(database_data['context'], 'context')

    return redirect(f'/chat/{id_}')


@ninoport.route('/delete-context', methods=['POST'])
def delete_context():
    delete_id = request.form.get('delete-id')

    database_data['context'][delete_id] = []
    database.overwrite_data(database_data['context'], 'context')

    return redirect('/')


@ninoport.route('/reload')
def reload():
    os.execv(sys.executable, [sys.executable] + sys.argv)
    return('/')


if __name__ == '__main__':
    ninoport.run(debug=True)