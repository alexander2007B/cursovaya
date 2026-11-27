"""The same pytest case demonstrates Red and Green with native Python imports."""

import os, pytest
from norde.domain import AppError

if os.getenv("TDD_PHONE_RED") == "1":
    from tests.tdd_demo.phone_red import normalize_phone
else:
    from norde.domain import normalize_phone


def test_phone_rejects_brackets_without_digits():
    with pytest.raises(AppError):
        normalize_phone("()()()()()")
