# Воспроизводимый Red / Green

Red: TDD_PHONE_MODULE=./tests/tdd_demo/phone_red.mjs pytest tests/tdd_demo/test_phone.py. Получено 1 failed.
Green: pytest tests/tdd_demo/test_phone.py. Получено 1 passed.

Red использует отдельную намеренно неполную функцию. Green импортирует действительную shared/phone.js. Это контролируемая демонстрация, а не утверждение о первоначальной истории разработки. Основной набор из 15 функциональных случаев не изменён.

mongo-console.txt содержит фактический stdout свежего docker exec mongosh. database.png в docs/screenshots/coursework - снимок настоящего окна терминала, не перерисованный текст. Mermaid-графика экспортирована из исходников .mmd, без генератора картинок.
