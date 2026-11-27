# NORDÉ — Python

Веб-приложение аренды автомобилей: **Python 3.12 + Flask + Jinja + PyMongo**. Интерфейс — HTML, CSS и браузерный JavaScript. Node.js, npm, Express, React и сборка интерфейса не требуются.

## Быстрый показ без базы

```sh
python -m venv .venv
# Linux/macOS: source .venv/bin/activate
# Windows PowerShell: .venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python app.py
```

Если .env ещё не создан и MONGODB_URI не задан, запускается деморежим: http://localhost:3000. Явный выбор: APP_MODE=demo. Демо сохраняет заявки в браузере, отдельно на каждом устройстве; оно не обеспечивает серверную защиту или общую базу.

## Полная версия с MongoDB

```sh
python scripts/setup.py
docker compose up -d --wait mongo
python -m norde.seed --allow-demo
python app.py
```

setup.py создаёт .env со случайным SESSION_SECRET только при отсутствии файла. MongoDB работает как replica set. Seed добавляет недостающие учебные записи, сохраняет заявки и обновляет только стандартное прежнее имя менеджера. В production seed запрещён.

| Роль | Email | Учебный пароль |
|---|---|---|
| Администратор | admin@avtobaza.test | Avtobaza2026! |
| Менеджер Дмитрий | manager@avtobaza.test | Avtobaza2026! |
| Клиент | client@avtobaza.test | Avtobaza2026! |

Эти аккаунты предназначены для локальной демонстрации. Для реального сервиса нужны собственные пользователи и защищённая инфраструктура. В новой рабочей базе первую административную запись создают вручную: `python -m norde.admin --email EMAIL --name "Имя Фамилия" --phone "+79001234567"`; пароль вводится скрыто. Команда не изменяет существующие записи и отказывается работать, если администратор уже есть.

## Что сохранено

Общая крупная шапка и подвал, шесть выбранных моделей на главной, каталог с фильтрами, избранное браузера, галереи, четыре загружаемых фото, регистрация с двумя согласиями, профиль, заявки и отмена. Менеджер подтверждает, выдаёт, принимает машину и сохраняет осмотры. Администратор ведёт каталог и роли; CSV и журнал операций доступны сотрудникам. MongoDB-транзакции защищают от двойной брони.

При переносе существующей MongoDB укажите прежний MONGODB_URI. Коллекции и ObjectId совместимы; существующие bcrypt-хеши поддерживаются. Сессии Python хранятся в отдельной коллекции python_sessions, поэтому пользователям потребуется повторный вход. Старую базу и uploads сохраняют перед переключением. Подробно: [миграция](docs/PYTHON_MIGRATION.md).

## Проверки и документация

```sh
python -m pip install -r requirements-test.txt
python -m scripts.quality
```

Новый прогон: 15 функциональных случаев pytest, включая 4 Selenium; 15 HTTP-сценариев коллекции Postman, выполненных Python/Requests; 4 нагрузочных режима по 3 повтора. Runner пересоздаёт **только norde_python_test** и использует порт 3101. [Карта тестов](docs/TESTING.md), [протоколы](docs/reports/python-final/README.md).

[Курсовая Word/PDF и руководства](docs/coursework-30/README.md). [API](docs/API.md). [Размещение на Render](docs/RENDER_PYTHON.md).

## Render

Нужен **Web Service с Python**, не Static Site. Build: `pip install -r requirements.txt`. Start: `gunicorn --bind 0.0.0.0:$PORT --workers 1 --threads 8 app:app`. В render.yaml подготовлен деморежим без MongoDB. Полная версия требует APP_MODE=full, MONGODB_URI, SESSION_SECRET и постоянного хранилища uploads. Перенос в эту ветку сам по себе не превращает прежний Static Site в Python-сервис.
