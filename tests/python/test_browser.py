import time, json, hashlib
from datetime import datetime, timezone
from pathlib import Path
from selenium.webdriver.common.by import By
from selenium.webdriver.common.action_chains import ActionChains
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from conftest import BASE, REPORT

WAIT = 12


def find(d, css):
    return WebDriverWait(d, WAIT).until(
        EC.visibility_of_element_located((By.CSS_SELECTOR, css))
    )


def click(d, css):
    e = find(d, css)
    d.execute_script('arguments[0].scrollIntoView({block:"center"})', e)
    e.click()


def fill(d, name, value):
    scope = "dialog[open] " if d.find_elements(By.CSS_SELECTOR, "dialog[open]") else ""
    e = find(d, scope + f'[name="{name}"]')
    e.clear()
    e.send_keys(value)


def login(d, role="admin"):
    d.get(BASE)
    click(d, ".header .button.small")
    fill(d, "email", role + "@avtobaza.test")
    fill(d, "password", "Avtobaza2026!")
    click(d, 'dialog button[type="submit"], dialog form button.primary')
    WebDriverWait(d, WAIT).until(
        EC.invisibility_of_element_located((By.CSS_SELECTOR, "dialog"))
    )


def shot(d, name):
    d.execute_script('document.querySelectorAll("img").forEach(i=>i.loading="eager")')
    time.sleep(0.4)
    path = Path("docs/screenshots/coursework") / (name + ".png")
    d.save_screenshot(str(path))
    manifest = REPORT / "screenshots.json"
    data = json.loads(manifest.read_text()) if manifest.exists() else {}
    data[name] = {
        "at": datetime.now(timezone.utc).isoformat(),
        "url": d.current_url,
        "viewport": d.execute_script("return {width:innerWidth,height:innerHeight}"),
        "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
    }
    manifest.write_text(json.dumps(data, ensure_ascii=False, indent=2))


def test_public_pages_and_screenshots(browser):
    d = browser
    d.get(BASE)
    find(d, ".stage-photo img")
    shot(d, "home")
    d.get(BASE + "/catalog")
    WebDriverWait(d, WAIT).until(
        lambda d: len(d.find_elements(By.CSS_SELECTOR, ".car-card")) == 12
    )
    shot(d, "catalog")
    click(d, '[aria-label="Выбрать BMW 520d xDrive"]')
    find(d, ".car-gallery")
    shot(d, "car")
    assert len(d.find_elements(By.CSS_SELECTOR, ".car-gallery button")) >= 2
    click(d, ".car-gallery button:last-child")
    assert (
        find(d, ".car-gallery button:last-child").get_attribute("aria-pressed")
        == "true"
    )
    for page in ["privacy", "terms", "consent"]:
        d.get(BASE + "/" + page + ".html")
        assert find(d, "h1").text
        shot(d, page)
    d.get(BASE)
    d.execute_script("window.scrollTo(0,document.body.scrollHeight)")
    shot(d, "footer")
    for width in [320, 390, 1440]:
        d.set_window_size(width, 1000)
        d.get(BASE + "/catalog")
        find(d, ".car-card")
        assert d.execute_script(
            "return document.documentElement.scrollWidth<=innerWidth"
        )
    d.set_window_size(390, 900)
    d.get(BASE)
    find(d, ".stage-photo")
    shot(d, "mobile")


def test_registration_consents_and_profile(browser):
    d = browser
    d.get(BASE)
    click(d, ".header .button.small")
    click(d, "dialog .segmented button:last-child")
    shot(d, "registration")
    d.execute_script(
        'arguments[0].scrollIntoView({block:"center"})',
        find(d, "[name=personalDataConsent]"),
    )
    shot(d, "consents")
    submit = find(d, "dialog form button.primary")
    assert not submit.is_enabled()
    for name, value in [
        ("name", "Selenium Клиент"),
        ("phone", "+7 900 222-33-44"),
        ("email", f"selenium{time.time_ns()}@example.test"),
        ("password", "Selenium2026!"),
        ("drivingExperience", "3"),
    ]:
        fill(d, name, value)
    for name in ["ageConfirmed", "licenseConfirmed", "termsAccepted"]:
        click(d, f"[name={name}]")
    assert not submit.is_enabled()
    click(d, "[name=personalDataConsent]")
    assert submit.is_enabled()
    submit.click()
    WebDriverWait(d, WAIT).until(
        EC.invisibility_of_element_located((By.CSS_SELECTOR, "dialog"))
    )
    d.get(BASE + "/account")
    find(d, ".profile-card")
    shot(d, "account")
    fill(d, "name", "Обновлённый Клиент")
    click(d, ".profile-card button")
    WebDriverWait(d, WAIT).until(
        lambda d: not find(d, ".profile-card button").get_attribute("disabled")
    )
    time.sleep(0.3)
    d.refresh()
    assert find(d, "[name=name]").get_attribute("value") == "Обновлённый Клиент"


def test_staff_and_modal(browser):
    d = browser
    login(d)
    for tab, name in [
        ("overview", "admin"),
        ("fleet", "fleet"),
        ("maintenance", "maintenance"),
    ]:
        d.get(BASE + "/admin?tab=" + tab)
        find(d, "#admin-body table")
        shot(d, name)
    d.get(BASE + "/admin?tab=fleet")
    click(d, ".panel-heading button.primary")
    fill(d, "brand", "Выделение")
    field = find(d, "[name=brand]")
    dialog = find(d, "dialog")
    ActionChains(d).move_to_element(field).click_and_hold().move_by_offset(
        -500, 0
    ).release().perform()
    assert find(d, "dialog").is_displayed()
    assert field.get_attribute("value") == "Выделение"
    click(d, 'dialog [aria-label="Закрыть"]')
    assert not d.find_elements(By.CSS_SELECTOR, "dialog[open]")


def test_upload_four_photos(browser):
    from test_api import session, call

    d = browser
    login(d)
    d.get(BASE + "/admin?tab=fleet")
    click(d, ".panel-heading button.primary")
    paths = [
        str((Path("static/images") / n).resolve())
        for n in ["bmw520.jpg", "bmw520-0.jpg", "bmw520-2.jpg", "cls-0.jpg"]
    ]
    upload = d.find_element(By.CSS_SELECTOR, "dialog input[type=file]")
    upload.send_keys("\n".join(paths + [paths[0]]))
    assert "до 4 фотографий" in find(d, "dialog [role=alert]").text
    upload.send_keys("\n".join(paths))
    WebDriverWait(d, WAIT).until(
        lambda d: len(d.find_elements(By.CSS_SELECTOR, "dialog .photo-preview img"))
        == 4
    )
    assert not upload.is_enabled()
    plate = "СЛ" + str(time.time_ns())[-7:]
    for name, value in [
        ("brand", "Selenium"),
        ("model", "Gallery"),
        ("plate", plate),
        ("description", "Четыре фотографии автомобиля"),
    ]:
        fill(d, name, value)
    d.execute_script(
        'arguments[0].scrollIntoView({block:"center"})',
        find(d, "dialog .photo-previews"),
    )
    shot(d, "photos")
    click(d, "dialog form button.primary")
    WebDriverWait(d, WAIT).until(
        EC.invisibility_of_element_located((By.CSS_SELECTOR, "dialog"))
    )
    with session("admin") as admin:
        car = next(
            c for c in call(admin, "GET", "/api/cars")["cars"] if c["plate"] == plate
        )
        try:
            assert len(set([car["image"], *car["gallery"]])) == 4
            d.get(BASE + "/cars/" + car["_id"])
            find(d, ".car-gallery")
            assert len(d.find_elements(By.CSS_SELECTOR, ".car-gallery button")) == 4
            click(d, ".car-gallery button:last-child")
            assert (
                find(d, ".car-gallery button:last-child").get_attribute("aria-pressed")
                == "true"
            )
        finally:
            call(admin, "DELETE", "/api/admin/cars/" + car["_id"])
