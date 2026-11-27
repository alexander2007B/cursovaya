"""Smoke the browser-storage demo served by Python. Does not require MongoDB."""

from pathlib import Path
import json, sys, time

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tests/python"))
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from test_browser import find, click, fill

opts = Options()
opts.binary_location = "/usr/bin/chromium"
for arg in [
    "--headless=new",
    "--no-sandbox",
    "--disable-dev-shm-usage",
    "--window-size=1440,1000",
]:
    opts.add_argument(arg)
BASE = "http://127.0.0.1:3102"
checks = []
with webdriver.Chrome(options=opts) as d:

    def login(role):
        d.get(BASE)
        click(d, ".header .button.small")
        fill(d, "email", role + "@avtobaza.test")
        fill(d, "password", "Avtobaza2026!")
        click(d, "dialog button.primary")
        WebDriverWait(d, 15).until(
            EC.invisibility_of_element_located((By.CSS_SELECTOR, "dialog"))
        )

    d.get(BASE + "/catalog")
    WebDriverWait(d, 15).until(
        lambda d: len(d.find_elements(By.CSS_SELECTOR, ".car-card")) == 12
    )
    checks.append("12 demo cars from browser storage")
    login("client")
    d.get(BASE + "/catalog")
    click(d, '[aria-label="Выбрать Audi A5"]')
    find(d, "#quote-view")
    WebDriverWait(d, 15).until(
        lambda d: find(d, "#booking-form button.primary").is_enabled()
    )
    click(d, "#booking-form button.primary")
    assert "Заявка сохранена" in find(d, "dialog").text
    checks.append("client booking in localStorage")
    click(d, 'dialog [aria-label="Закрыть"]')
    click(d, "[data-action=logout]")
    login("manager")
    d.get(BASE + "/admin?tab=rentals")
    find(d, "#admin-body table")
    click(d, "[data-action=rental-status][data-status=confirmed]")
    WebDriverWait(d, 15).until(
        lambda d: d.find_elements(By.CSS_SELECTOR, "[data-status=active]")
    )
    checks.append("manager sees and confirms demo booking")
    d.refresh()
    assert "Подтверждена" in find(d, "#admin-body table").text
    checks.append("demo booking survives refresh")
Path("docs/reports/python-final/demo-smoke.json").write_text(
    json.dumps(
        {"checks": checks, "passed": True, "baseUrl": BASE},
        ensure_ascii=False,
        indent=2,
    )
)
print(checks)
