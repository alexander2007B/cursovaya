# Python JSON API

Сначала GET /api/auth/session: сохраните cookie и csrfToken. Для POST/PATCH/DELETE нужен X-CSRF-Token. После входа токен меняется. Ошибка имеет JSON {message, fields?}; ожидаемые коды 400/401/403/404/409/429.

| Метод / маршрут | Назначение |
|---|---|
| GET /api/health | Состояние MongoDB и runtime=python |
| GET /api/auth/session | Текущий пользователь и CSRF |
| POST /api/auth/register | Имя, email, телефон, пароль, возраст/права/стаж и два согласия |
| POST /api/auth/login | Email и пароль |
| POST /api/auth/logout | Завершение сессии |
| PATCH /api/profile | Имя, телефон, условия допуска |
| GET /api/cars | category, search, sort, from, to |
| GET /api/cars/:id | Карточка и занятые периоды |
| POST /api/quote | Расчёт и доступность |
| POST /api/rentals | Создание заявки |
| GET /api/rentals | Только свои заявки |
| PATCH /api/rentals/:id/status | Отмена / подтверждение / выдача / возврат |
| GET /api/admin/overview | Машины, аренды, события и показатели |
| POST /api/admin/photos | Изображение data URL → WebP и путь image |
| POST/PATCH/DELETE /api/admin/cars[/id] | Добавление, изменение, архивирование |
| GET/POST /api/admin/maintenance | Просмотр и запись осмотров |
| GET /api/admin/users | Список пользователей администратора |
| PATCH /api/admin/users/:id | Роль пользователя, кроме собственной |
| GET /api/admin/export | CSV аренд с защитой от формул |

Регистрация принимает только client: name, email, phone, password, ageConfirmed=true, licenseConfirmed=true, drivingExperience (целое 1–80), termsAccepted=true, personalDataConsent=true, legalVersion="2026-11-23.1". Дополнительный role запрещён. Пароль минимум 8 символов и максимум 72 байта UTF-8. Согласия фиксируются сервером с версиями и датами; публичный ответ не содержит хеш.

quote/rentals: carId, from/to в YYYY-MM-DD, extras={insurance,childSeat}, comment. Status: {status}; завершение дополнительно returnMileage. Автомобиль: image — обложка, gallery — до трёх дополнительных путей. Фото — JPG/PNG/WebP до 4 МБ и 20 мегапикселей, сервер перекодирует Pillow.

Клиент управляет только своей отменой new/confirmed. Менеджер обрабатывает аренды и осмотры, меняет технический статус. Администратор дополнительно управляет каталогом и ролями. Полномочия проверяются сервером при каждом запросе.

Коллекция Postman: docs/postman_collection.json, baseUrl=http://127.0.0.1:3101. Автоматический Python-исполнитель — tests/postman/test_collection.py; он проверяет 15 HTTP-кодов, не выполняет JavaScript-песочницу Postman.
