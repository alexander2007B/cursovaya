import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowUpRight,
  ArrowLeft,
  ArrowRight,
  Pause,
  Play,
  MapPin,
  CalendarDays,
  ShieldCheck,
  CarFront,
} from "lucide-react";
import { api, money, day, categories } from "./api";
import { CarImage } from "./CarPhoto";
export default function RentalHome({ CarCard, FavoriteButton }) {
  const [from, setFrom] = useState(day()),
    [to, setTo] = useState(day(3)),
    [cars, setCars] = useState([]),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [active, setActive] = useState(0),
    [paused, setPaused] = useState(false),
    [hover, setHover] = useState(false),
    [hidden, setHidden] = useState(document.hidden),
    [reduced, setReduced] = useState(false);
  const navigate = useNavigate();
  const valid =
    from >= day() &&
    to > from &&
    (Date.parse(to) - Date.parse(from)) / 86400000 <= 30;
  useEffect(() => {
    const m = matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(m.matches);
    sync();
    m.addEventListener("change", sync);
    const visibility = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      m.removeEventListener("change", sync);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, []);
  useEffect(() => {
    let live = true;
    const controller = new AbortController();
    setCars([]);
    setActive(0);
    setError("");
    if (!valid) {
      setLoading(false);
      return () => controller.abort();
    }
    async function load() {
      try {
        const result = await api("/cars?" + new URLSearchParams({ from, to }), {
          signal: controller.signal,
        });
        if (live) {
          const available = result.cars.filter(
            (c) =>
              c.status === "available" &&
              c.displayStatus !== "rented" &&
              !c.archived,
          );
          available.sort(
            (a, b) =>
              Number(b.image?.endsWith(".jpg")) -
                Number(a.image?.endsWith(".jpg")) || b.dailyRate - a.dailyRate,
          );
          setCars(available);
          setError("");
        }
      } catch (e) {
        if (live && e.name !== "AbortError") {
          setError(e.message);
          setCars([]);
        }
      } finally {
        if (live) setLoading(false);
      }
    }
    setLoading(true);
    const delay = setTimeout(load, 200);
    const refresh = setInterval(() => {
      if (!document.hidden) load();
    }, 30000);
    const focus = () => load();
    window.addEventListener("focus", focus);
    return () => {
      live = false;
      controller.abort();
      clearTimeout(delay);
      clearInterval(refresh);
      window.removeEventListener("focus", focus);
    };
  }, [from, to, valid]);
  // Only real cars returned as available for the selected dates enter the slideshow.
  const slides = cars.filter((c) => !c.image?.endsWith(".svg"));
  const car = slides.length ? slides[active % slides.length] : null;
  const slideImages = slides.map((c) => c.image).join("|");
  useEffect(() => {
    for (const src of slideImages.split("|").filter(Boolean)) {
      const img = new Image();
      img.src = src;
    }
  }, [slideImages]);
  useEffect(() => {
    if (slides.length < 2 || paused || hover || hidden || reduced) return;
    const timer = setInterval(
      () => setActive((i) => (i + 1) % slides.length),
      2000,
    );
    return () => clearInterval(timer);
  }, [slides.length, paused, hover, hidden, reduced]);
  const query = new URLSearchParams({ from, to }).toString();
  function search(e) {
    e.preventDefault();
    if (valid) navigate("/catalog?" + query);
  }
  return (
    <main className="rental-home">
      <section className="rental-hero wrap">
        <div className="rental-heading">
          <div>
            <span className="rental-city">
              <MapPin size={14} /> Вологда
            </span>
            <h1>
              Аренда авто
              <br />в Вологде
            </h1>
          </div>
          <p>
            На день, на выходные
            <br />
            или пока свой в ремонте.
          </p>
        </div>
        <div
          className="fleet-stage"
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
          onFocusCapture={() => setHover(true)}
          onBlurCapture={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget)) setHover(false);
          }}
          aria-label="Доступные автомобили"
        >
          {car ? (
            <>
              <div className="stage-photo" key={car._id}>
                <CarImage
                  src={car.image}
                  alt={`${car.brand} ${car.model} — автомобиль из нашего каталога`}
                  fetchPriority="high"
                />
              </div>
              <div className="stage-shade" />
              <div className="stage-top">
                <span className="stock-badge">
                  <span />
                  Свободен на выбранные даты
                </span>
                <FavoriteButton car={car} />
              </div>
              <div className="stage-information">
                <span className="stage-class">
                  {categories[car.category]} · {car.year}
                </span>
                <h2>
                  {car.brand} {car.model}
                </h2>
                <div className="stage-bottom">
                  <div>
                    <strong>{money(car.dailyRate)}</strong>
                    <span> / сутки</span>
                  </div>
                  <Link
                    to={`/cars/${car._id}?${query}`}
                    className="button stage-link"
                  >
                    Посмотреть авто <ArrowUpRight size={18} />
                  </Link>
                </div>
              </div>
              <div className="stage-controls">
                <button
                  type="button"
                  aria-label="Предыдущий автомобиль"
                  onClick={() =>
                    setActive((i) => (i - 1 + slides.length) % slides.length)
                  }
                >
                  <ArrowLeft size={18} />
                </button>
                <span>
                  {(active % slides.length) + 1} / {slides.length}
                </span>
                <button
                  type="button"
                  aria-label="Следующий автомобиль"
                  onClick={() => setActive((i) => (i + 1) % slides.length)}
                >
                  <ArrowRight size={18} />
                </button>
                <button
                  type="button"
                  aria-label={
                    paused
                      ? "Продолжить смену автомобилей"
                      : "Остановить смену автомобилей"
                  }
                  aria-pressed={paused}
                  onClick={() => setPaused(!paused)}
                >
                  {paused ? <Play size={16} /> : <Pause size={16} />}
                </button>
              </div>
            </>
          ) : (
            <div className="stage-empty">
              <CarFront size={42} />
              <h2>
                {loading
                  ? "Смотрим свободные автомобили…"
                  : !valid
                    ? "Укажите даты аренды"
                    : error
                      ? "Не удалось загрузить автопарк"
                      : cars.length
                        ? "Посмотрите доступные авто в каталоге"
                        : "На эти даты всё занято"}
              </h2>
              <p>
                {error ||
                  (!valid
                    ? "От 1 до 30 суток. Возврат — позже получения."
                    : "Выберите другие даты или откройте полный каталог.")}
              </p>
              <Link
                className="button outline"
                to={valid ? "/catalog?" + query : "/catalog"}
              >
                Открыть каталог <ArrowUpRight size={18} />
              </Link>
            </div>
          )}
        </div>
        <form
          className="rental-search"
          onSubmit={search}
          aria-label="Поиск по датам"
        >
          <div className="pickup-city">
            <MapPin size={19} />
            <div>
              <small>Получение и возврат</small>
              <b>Вологда</b>
            </div>
          </div>
          <label>
            <span>Начало аренды</span>
            <input
              aria-label="Начало аренды"
              type="date"
              value={from}
              min={day()}
              required
              onChange={(e) => {
                setFrom(e.target.value);
                if (e.target.value >= to) {
                  const date = new Date(e.target.value + "T12:00:00");
                  date.setDate(date.getDate() + 3);
                  setTo(date.toISOString().slice(0, 10));
                }
              }}
            />
          </label>
          <label>
            <span>Возврат</span>
            <input
              aria-label="Возврат"
              type="date"
              value={to}
              min={from}
              required
              onChange={(e) => setTo(e.target.value)}
            />
          </label>
          <button className="button primary" disabled={!valid}>
            Найти машину <ArrowUpRight size={20} />
          </button>
          {!valid && (
            <p className="rental-date-error" role="alert">
              Выберите срок от 1 до 30 суток.
            </p>
          )}
        </form>
      </section>
      <section
        className="wrap rental-categories"
        aria-label="Автомобили по классам"
      >
        {[
          ["economy", "На каждый день", "Эконом"],
          ["suv", "Для поездки за город", "Кроссоверы"],
          ["business", "Когда нужен комфорт", "Бизнес"],
          ["premium", "Для особого случая", "Премиум"],
        ].map(([id, hint, title]) => (
          <Link
            key={id}
            to={
              "/catalog?" +
              new URLSearchParams({
                ...Object.fromEntries(new URLSearchParams(valid ? query : "")),
                category: id,
              })
            }
          >
            <span>{hint}</span>
            <strong>
              {title}
              <ArrowUpRight size={21} />
            </strong>
          </Link>
        ))}
      </section>
      <section id="fleet" className="wrap section rental-fleet">
        <div className="section-heading">
          <div>
            <h2>Что сейчас свободно</h2>
            <p>
              {valid
                ? "Автомобили на выбранные даты"
                : "Выберите даты выше, чтобы проверить наличие"}
            </p>
          </div>
          <Link
            className="text-link"
            to={valid ? "/catalog?" + query : "/catalog"}
          >
            Весь автопарк <ArrowUpRight size={18} />
          </Link>
        </div>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="car-grid">
          {cars.slice(0, 6).map((c) => (
            <CarCard key={c._id} car={c} dateQuery={valid ? query : ""} />
          ))}
        </div>
        {!loading && !cars.length && !error && (
          <p className="muted">
            Попробуйте другие даты — свободные автомобили появятся здесь.
          </p>
        )}
      </section>
      <section className="wrap rental-facts">
        <article>
          <ShieldCheck size={22} />
          <h3>Оплата при получении</h3>
          <p>Аренда и залог указаны в карточке автомобиля.</p>
        </article>
        <article>
          <CalendarDays size={22} />
          <h3>Отмена в личном кабинете</h3>
          <p>Пока авто не выдано, заявку можно отменить.</p>
        </article>
        <article>
          <CarFront size={22} />
          <h3>Что взять с собой</h3>
          <p>Паспорт, права, возраст от 21 года и стаж от года.</p>
        </article>
      </section>
    </main>
  );
}
