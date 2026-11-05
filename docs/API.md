# HTTP API

Сначала `GET /api/auth/session`. Сохраните cookie и `csrfToken`. Для POST/PATCH/DELETE отправляйте заголовок `X-CSRF-Token`. После входа используйте новый токен. Все тела — JSON. Формат ошибки: `{message, fields?}`; типичные коды 400/401/403/404/409.

| Метод и адрес | Доступ | Назначение |
|---|---|---|
| GET /api/health | Все | Проверка MongoDB |
| GET /api/auth/session | Все | Сессия и CSRF |
| POST /api/auth/register | Все | name, email, phone, password |
| POST /api/auth/login | Все | email, password |
| POST /api/auth/logout | Все | Завершить сессию |
| PATCH /api/profile | Пользователь | name, phone |
| GET /api/cars | Все | category, search, sort, from, to |
| GET /api/cars/:id | Все | Характеристики и занятые периоды без личных данных |
| POST /api/quote | Все | Расчёт и доступность |
| POST /api/rentals | Пользователь | Создать заявку |
| GET /api/rentals | Пользователь | Только свои заявки |
| PATCH /api/rentals/:id/status | Владелец/сотрудник | Владелец — только отмена new/confirmed |
| GET /api/admin/overview | Сотрудник | Машины, заявки, агрегаты, события |
| POST /api/admin/cars | Администратор | Добавление автомобиля |
| PATCH /api/admin/cars/:id | Сотрудник | Менеджер меняет только технический статус |
| DELETE /api/admin/cars/:id | Администратор | Архивирование без удаления истории |
| GET/POST /api/admin/maintenance | Сотрудник | Осмотры |
| GET /api/admin/users | Администратор | Пользователи |
| PATCH /api/admin/users/:id | Администратор | Назначение роли, кроме собственной |
| GET /api/admin/export | Сотрудник | CSV заявок, защита от формул |

Тело quote/rentals: `{"carId":"<ObjectId>","from":"2026-11-10","to":"2026-11-13","extras":{"insurance":true,"childSeat":false},"comment":"Получение утром"}`. Даты нужно заменить актуальными. Общая стоимость рассчитывается на сервере, клиентская сумма не принимается.

Тело изменения статуса: `{"status":"confirmed"}`. Для завершения: `{"status":"completed","returnMileage":45000}`.

Тело осмотра: `{"carId":"<ObjectId>","node":"Тормоза","wear":40,"mileage":45000,"note":"Осмотр без замечаний"}`.

Для ручной работы можно импортировать `docs/postman_collection.json`. Вначале получите сессию; коллекция сохраняет CSRF-токен. Примеры изменяющих запросов действительно меняют данные, поэтому используйте учебные аккаунты. Коллекция подготовлена для ручного запуска; автоматические API-проверки выполнены Supertest.
