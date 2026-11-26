# Проверки NORDÉ: Selenium, pytest и Postman

Актуальный набор от 26.11.2026. Используются настоящий Chromium, Express и MongoDB replica set. Статическая демоверсия Render не поддерживает серверные API: для этих проверок поднимается полная локальная версия.

| Инструмент | Что проверяет | Файл | Итог нового прогона |
|---|---|---|---|
| pytest + Node.js адаптер | Цена, даты, статусы, телефон | [test_domain.py](../tests/python/test_domain.py) | 6 случаев |
| pytest + Requests + MongoDB | Согласия, пароль, аренда, гонка, фото, доступ | [test_api.py](../tests/python/test_api.py) | 5 сценариев |
| Selenium WebDriver + pytest | Страницы, регистрация, профиль, админка, модальные окна, 4 фото, адаптивность | [test_browser.py](../tests/python/test_browser.py) | 4 сценария |
| Postman / Newman | HTTP-последовательности и ожидаемые отказы | [postman_collection.json](postman_collection.json) | 15 запросов, 15 утверждений |
| pytest + Requests + ThreadPoolExecutor | GET /api/cars, identity/gzip, 10/50 соединений | [test_load.py](../tests/python/test_load.py) | 4 режима по 3 повтора |

Это разные единицы: число HTTP-запросов нельзя складывать с числом функций и называть общим числом тестов. Итоговые протоколы находятся в [reports/selenium-pytest-postman](reports/selenium-pytest-postman/).

## Полный повтор

Нужны Node.js 22+, Python 3.12+, установленный Chromium или Google Chrome и MongoDB replica set на 127.0.0.1:27017. Для используемых версий Python-пакетов см. requirements-test.txt. В этом запуске использован Linux; другие ОС отдельно не проверялись.

```sh
npm ci
python3 -m venv .venv
. .venv/bin/activate
python3 -m pip install -r requirements-test.txt
npm run db:up
npm run test:all
```

В Windows используйте `python` вместо `python3`, активацию `.venv\Scripts\Activate.ps1` в PowerShell. Команды npm в этой редакции запускают python3; если такого имени нет, выполните `python scripts/run-quality.py` непосредственно. Путь к установленному Chrome можно задать переменной CHROMIUM_PATH. Selenium Manager подбирает драйвер, при первом запуске может потребоваться интернет.

Общий runner собирает приложение, запускает scripts/test-server.js на порту 3001, ждёт готовности, последовательно выполняет Newman, функциональные проверки pytest и нагрузку. Затем останавливает сервер. Порт 3001 должен быть свободен. Пересоздаётся только учебная база avtobaza_e2e; рабочую базу runner не использует. Нельзя хранить в avtobaza_e2e нужные данные.

## Отдельный сценарий

В одном терминале после сборки запустите `npm run test:server`, в другом с активным Python-окружением:

```sh
npm run test:api
npm test
npm run test:e2e
npm run test:load
```

Не запускайте нагрузку одновременно с функциональными тестами. Повторные входы на одном процессе учитываются лимитом 40 попыток за 15 минут; для полного повторного опыта используйте test:all с новым сервером. Защита не отключается.

Для Postman: импортируйте docs/postman_collection.json и запустите Collection Runner по порядку, baseUrl = http://127.0.0.1:3001. Коллекция сама получает cookie/CSRF и создаёт тестовые сущности. Newman - командный исполнитель той же коллекции; приложение Postman вручную в зафиксированном прогоне не запускалось.

## Протоколы и изображения

- pytest.txt / pytest.xml - 15 функциональных случаев, включая Selenium.
- newman.txt / newman.xml / newman-summary.json - запросы и утверждения Postman.
- load.txt / load.xml / load-*.json - четыре режима, все 12 измерений.
- environment.json / exit-codes.json - версии и коды завершения.
- screenshots.json - время, URL, размер окна и SHA-256 новых снимков.

Снимки обновляет Selenium. `scripts/refresh-coursework-evidence.py` строит диаграмму нагрузки из JSON и иллюстрацию из реального вывода mongosh; нужен контейнер MongoDB (MONGO_CONTAINER задаёт его имя при отличии). Продуктовая схема обновляется scripts/diagrams.py. Все актуальные изображения показаны в отдельном атласе интерфейса в комплекте курсовой.

Исторические node:test / Supertest / Playwright / Autocannon и docs/reports/norde-final сохранены как архив разработки. Их команды имеют префикс test:legacy; текущие результаты курсовой принадлежат новому набору. Новый набор не измеряет процент покрытия JavaScript. Нагрузка локальная, короткая, на одном хосте с генератором: это не проверка доступности Render и не оценка предельного числа клиентов.
