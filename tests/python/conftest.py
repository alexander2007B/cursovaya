import os, shutil
from pathlib import Path
import pytest
from selenium import webdriver
from selenium.webdriver.chrome.options import Options

BASE = os.environ.get("TEST_BASE_URL", "http://127.0.0.1:3101")
from urllib.parse import urlparse

if urlparse(BASE).hostname not in {"127.0.0.1", "localhost"}:
    raise RuntimeError("Test mutations and load require the isolated local server")
REPORT = Path("docs/reports/python-final")
REPORT.mkdir(parents=True, exist_ok=True)


@pytest.fixture
def browser():
    options = Options()
    options.page_load_strategy = "eager"
    binary = (
        os.environ.get("CHROMIUM_PATH")
        or shutil.which("chromium")
        or shutil.which("google-chrome")
    )
    if binary:
        options.binary_location = binary
    for arg in [
        "--headless=new",
        "--no-sandbox",
        "--disable-dev-shm-usage",
        "--window-size=1440,1000",
    ]:
        options.add_argument(arg)
    driver = webdriver.Chrome(options=options)
    yield driver
    driver.quit()
