from lib import database
from lib import core
from flask import *
import random


ninoport: Flask     = Flask(__name__)
database_data: dict = database.load_data()


@ninoport.route('/')
def public_main():
    id_list = []
    model_list = []

    for index, data in database_data['instance'].items():
        id_list.append(index)
        model_list.append(data['model'])

    return render_template(
        'index.html',
        id_list    = id_list,
        model_list = model_list
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
    api_key = request.form.get('api-key')
    base_url = request.form.get('base-url')
    model = request.form.get('model')
    thinking = True if request.form.get('thinking') == 'on' else False
    reasoning_effort = None if request.form.get('reasoning-effort') == '' \
        else request.form.get('reasoning-effort')
    system_prompt = None if request.form.get('system-prompt') == '' \
        else request.form.get('system-prompt')

    id_ = random.randint(10000, 99999)

    database_data['instance'][str(id_)] = {
        'api-key':          api_key,
        'base-url':         base_url,
        'model':            model,
        'thinking':         thinking,
        'reasoning-effort': reasoning_effort,
        'system-prompt':    system_prompt
    }
    database_data['context'][str(id_)] = []
    database.overwrite_data(database_data['instance'], 'instance')
    database.overwrite_data(database_data['context'], 'context')

    return redirect('/')


@ninoport.route('/chat/<id_>')
def public_chat(id_):
    messages_list = []

    for i in database_data['context'][id_]:
        messages_list.append(i)

    if messages_list != []:
        message_type_list, message_context_list = zip(*messages_list)
    else:
        message_type_list, message_context_list = [], []

    return render_template(
        'chat.html',
        message_type_list    = message_type_list,
        message_context_list = message_context_list
    )


@ninoport.route('/chat/<id_>/send', methods=['POST'])
def send(id_):
    message_list = []
    user_input = request.form.get('user-input')
    for i in database_data['context'][id_]:
        message_list.append(tuple(i))

    try:
        assistant_output = core.get_api(
            api_key          = database_data['instance'][id_]['api-key'],
            base_url         = database_data['instance'][id_]['base-url'],
            model            = database_data['instance'][id_]['model'],
            thinking         = database_data['instance'][id_]['thinking'],
            reasoning_effort = database_data['instance'][id_]['reasoning-effort'],
            messages         = core.create_message(
                system  = database_data['instance'][id_]['system-prompt'],
                history = message_list + [('user', user_input)]
        ))
    except Exception as err:
        assistant_output =  'AI错误：' + str(err)

    database_data['context'][id_].append(['user', user_input])
    database_data['context'][id_].append(['assistant', assistant_output])
    database.overwrite_data(database_data['context'], 'context')

    return redirect(f'/chat/{id_}')


if __name__ == '__main__':
    ninoport.run(debug=True)