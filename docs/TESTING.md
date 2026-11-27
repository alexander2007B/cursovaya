# Проверки Python-версии

| Набор | Файлы | Итог нового запуска |
|---|---|---|
| Правила аренды и телефон | tests/python/test_domain.py → norde/domain.py | 6 случаев |
| HTTP и настоящая MongoDB | tests/python/test_api.py | 5 сценариев |
| Selenium / Chromium | tests/python/test_browser.py | 4 сценария |
| Коллекция Postman, исполнитель Python/Requests | docs/postman_collection.json; tests/postman/test_collection.py | 15 HTTP-кодов |
| Локальная нагрузка | tests/python/test_load.py | 4 режима, 12 повторов |

Итого основной pytest: 15 функциональных случаев. Коллекция проверяется отдельным запуском; Python не исполняет её Postman JavaScript-песочницу. Встроенные проверки самой коллекции можно выполнить в приложении Postman. Newman и Node.js не используются.

## Полный прогон

Установите Python 3.12, Chromium/Chrome, requirements.txt и requirements-test.txt, запустите MongoDB replica set:

```sh
python -m pip install -r requirements.txt -r requirements-test.txt
docker compose up -d --wait mongo
python -m scripts.quality
```

Порт 3101 должен быть свободен. Runner сбрасывает только norde_python_test, запускает сервер Python, последовательно выполняет три этапа и останавливает сервер. Не храните нужные данные в этой учебной базе. Для отдельных проверок запустите `python -m scripts.test_server`, затем в другом терминале `python -m pytest -m "not load"`, `python -m pytest tests/postman/test_collection.py` или `python -m pytest -m load`.

Нагрузка: GET /api/cars, 10/50 потоков, identity/gzip, по три повтора по 5 с. Успех: 0 ошибок и p99 < 2000 мс в каждом повторе. Клиент проверяет HTTP 200 и содержимое каталога; байты измерены до декодирования gzip, без заголовков. Сервер и генератор делят один компьютер; это не тест предельной мощности и не нагрузка на опубликованный Render.

## Дополнительные доказательства

Red/Green: `TDD_PHONE_RED=1 python -m pytest tests/tdd_demo/test_phone.py` ожидаемо падает на изолированной неполной функции; без переменной тот же тест проходит на norde/domain.py. В PowerShell задайте `$env:TDD_PHONE_RED="1"`, затем удалите переменную для Green. Это демонстрация, не история первоначальной разработки.

`python scripts/check_demo.py` проверяет отдельный Python-сервер APP_MODE=demo на порту 3102: каталог, создание заявки клиентом, подтверждение менеджером и сохранение после обновления. `no-node-runtime.json` фиксирует запуск страниц и API с PATH, где доступны только Python-команды виртуального окружения.

## Протоколы

docs/reports/python-final: pytest.xml/txt, postman.xml/txt, load.xml/txt и load-*.json, environment.json, exit-codes.json, screenshots.json, demo-smoke.json, no-node-runtime.json. Изображения находятся в docs/screenshots/coursework. Перед новой серией используйте новый процесс сервера: вход ограничен 40 попытками за 15 минут, защита не отключается.
