# Руководство по установке и сопровождению NORDÉ

Редакция Python от 27 ноября 2026 года. Приложение использует Flask, HTML-шаблоны Jinja и PyMongo. Интерфейс обслуживается Python без этапа сборки.

## 1. Требования

Python 3.12, Git и, для полной версии, Docker Compose либо доступная MongoDB replica set. Основной порт 3000, MongoDB - 27017; тестовый сервер использует 3101. Для Selenium нужен Chromium или Google Chrome. Команды выполняются из корня репозитория.

```sh
python -m venv .venv
```

Активация: Linux/macOS - source .venv/bin/activate; Windows PowerShell - .venv\Scripts\Activate.ps1. Установите зависимости:

```sh
python -m pip install -r requirements.txt
```

## 2. Демо без базы

Если MONGODB_URI и .env не заданы, python app.py запускает деморежим. Явно задайте APP_MODE=demo, если .env уже существует. Откройте http://localhost:3000. Python обслуживает страницы и статические файлы; заявки и аккаунты сохраняются в localStorage. Вход хранится отдельно в каждой вкладке. При смене домена набор данных другой.

```sh
python app.py
```

Учебные аккаунты: admin@avtobaza.test, manager@avtobaza.test, client@avtobaza.test; пароль Avtobaza2026!. Менеджер - Дмитрий. Демо предназначено для показа интерфейса, а не для серверной защиты реальных данных.

## 3. Полная версия

```sh
python scripts/setup.py
docker compose up -d --wait mongo
python -m norde.seed --allow-demo
python app.py
```

setup.py создаёт .env только при отсутствии. Он задаёт APP_MODE=full, локальный MONGODB_URI и случайный SESSION_SECRET. Файл не публикуется. Docker запускает одноузловой replica set rs0. Seed добавляет недостающие учебные записи и сохраняет существующие заявки. При APP_ENV=production seed запрещён.

Для сервиса с настоящими клиентами нужны собственные учётные записи, HTTPS и защищённая MongoDB. В production приложение запускается Gunicorn, а cookie получает Secure. Серверные сессии находятся в python_sessions; после переноса с прежней версии необходим повторный вход.

В новой рабочей базе без администратора используется python -m norde.admin с обязательными параметрами --email, --name и --phone. Пароль вводится скрыто дважды. Команда не назначает согласия задним числом, не меняет существующих пользователей и отказывается создавать запись при наличии администратора. Учебный seed для этого не используется.

## 4. Перенос существующей базы

Сохраните резервную копию MongoDB и uploads. Задайте прежний MONGODB_URI. Существующие ObjectId, ссылки, bcrypt-хеши, вложенные расчёты и история поддерживаются Python-версией. Не очищайте коллекции ради установки. Сначала проверьте перенос на копии базы. Seed не требуется для рабочей базы и не запускается в production.

Автоматический пример scripts/check_migration.py проверяет сохранение ID, хеша, тарифа, пробега, технического статуса и исторической цены в отдельной одноразовой базе. Он не доказывает перенос любой внешней базы без предварительной проверки.

## 5. Проверки

```sh
python -m pip install -r requirements-test.txt
python -m scripts.quality
```

MongoDB должна работать, порт 3101 быть свободен. Runner пересоздаёт только norde_python_test и последовательно выполняет 15 функциональных случаев, 15 HTTP-сценариев коллекции Postman и 12 нагрузочных повторов. Затем сервер останавливается. Полные XML/JSON/TXT находятся в docs/reports/python-final.

Для отдельных проверок: python -m scripts.test_server, затем в другом терминале python -m pytest -m "not load", python -m pytest tests/postman/test_collection.py либо python -m pytest -m load. Повторные входы на одном процессе ограничены; HTTP 429 не обходится отключением защиты.

Коллекция docs/postman_collection.json импортируется в Postman с baseUrl=http://127.0.0.1:3101. Автоматический Python-исполнитель проверяет её HTTP-сценарии, но не запускает JavaScript-песочницу приложения Postman. Нагрузка локальная: каталог, 10/50 потоков, identity/gzip, по три повтора по пять секунд.

## 6. Размещение на Render

Для Python создаётся Web Service, прежний Static Site не исполняет Flask. Runtime - Python; Build Command - pip install -r requirements.txt; Start Command - gunicorn --bind 0.0.0.0:$PORT --workers 1 --threads 8 app:app. Для показа без базы задайте APP_MODE=demo, APP_ENV=production и SESSION_SECRET. Шаблон render.yaml содержит эти настройки.

Для полной версии задаются APP_MODE=full и MONGODB_URI удалённого replica set. Фотографии uploads требуют постоянного диска либо дополнительного файлового сервиса. Локальный Docker не создаёт базу на Render. Сначала проверьте новый адрес, затем переключайте домен. Сам файл конфигурации не подтверждает публикацию.

## 7. Данные и диагностика

docker compose down сохраняет том MongoDB. Параметр -v удаляет его, поэтому не используется для обычной остановки. Резервная копия включает MongoDB, uploads и отдельно защищённый .env. Восстановление проверяется на отдельном экземпляре.

Ошибка подключения требует проверки адреса, replica set, доступности MongoDB и аутентификации. Неверный CSRF устраняется обновлением страницы и повторным входом. Для full необходим SESSION_SECRET от 32 символов; шаблон replace- не принимается. При проблемах с HTTP на production проверьте HTTPS и Secure-cookie. В демонстрационном режиме /api, кроме health, не обслуживает данные: это ожидаемо, операции выполняет браузер.
