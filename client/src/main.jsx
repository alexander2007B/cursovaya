import Brand from "./Brand";
import ThemeToggle from "./ThemeToggle";
import EligibilityFields, { eligibilityForm } from "./EligibilityFields";
import { canRent } from "../../shared/eligibility";
import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { createRoot } from "react-dom/client";
import {
  BrowserRouter,
  Routes,
  Route,
  Link,
  NavLink,
  useNavigate,
  useParams,
  useSearchParams,
  useLocation,
} from "react-router-dom";
import {
  ArrowUpRight,
  ArrowRight,
  ArrowLeft,
  Check,
  ChevronDown,
  Search,
  SlidersHorizontal,
  CalendarDays,
  MapPin,
  Users,
  Fuel,
  Gauge,
  ShieldCheck,
  Clock3,
  CarFront,
  Menu,
  X,
  LogOut,
  LayoutDashboard,
  ClipboardList,
  Wrench,
  History,
  Plus,
  Download,
  Pencil,
  Trash2,
  CheckCircle2,
  Loader2,
  AlertCircle,
  UserRound,
  MoveUpRight,
  Mail,
  Phone,
} from "lucide-react";
import { api, money, date, day, categories, statuses, roles } from "./api";
import "./styles.css";
import "./glass.css";
import "./themes.css";
import "./norde.css";
import PhoneField from "./PhoneField";
import { CarImage, PhotoField } from "./CarPhoto";
const Context = createContext();
const useApp = () => useContext(Context);
const Icon = ({ children }) => <span className="icon-box">{children}</span>;
function Badge({ status }) {
  return (
    <span className={`badge ${status}`}>
      <i />
      {statuses[status] || status}
    </span>
  );
}
function Loading() {
  return (
    <div className="loading" role="status">
      <Loader2 className="spin" /> Загружаем данные…
    </div>
  );
}
function Empty({ title, children, icon = <CarFront /> }) {
  return (
    <div className="empty">
      <Icon>{icon}</Icon>
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}
function ErrorMessage({ error }) {
  return error ? (
    <div className="error" role="alert">
      <AlertCircle size={18} />
      <div>
        {error.message || error}
        {error.fields && (
          <small>{Object.values(error.fields).flat().join(". ")}</small>
        )}
      </div>
    </div>
  ) : null;
}
function Field({ label, children, ...props }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children || <input {...props} />}
    </label>
  );
}
function Modal({ title, children, onClose, wide = false }) {
  const ref = useRef();
  useEffect(() => {
    const dialog = ref.current;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal ${wide ? "wide" : ""}`}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="modal-head">
        <h2>{title}</h2>
        <button
          type="button"
          className="icon-button"
          aria-label="Закрыть"
          onClick={onClose}
        >
          <X />
        </button>
      </div>
      {children}
    </dialog>
  );
}
function AuthModal() {
  const { auth, setAuth, setUser, notify } = useApp();
  const [mode, setMode] = useState(auth === "register" ? "register" : "login");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const data =
        mode === "register"
          ? eligibilityForm(e.target)
          : Object.fromEntries(new FormData(e.target));
      const result = await api(`/auth/${mode}`, { method: "POST", body: data });
      setUser(result.user);
      setAuth(null);
      notify(
        mode === "login"
          ? "С возвращением!"
          : "Аккаунт создан. Продолжите бронирование",
      );
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={mode === "login" ? "С возвращением" : "Регистрация"}
      onClose={() => setAuth(null)}
    >
      <p className="muted">
        {mode === "login"
          ? "Войдите, чтобы управлять вашими поездками."
          : "Создайте аккаунт для бронирования автомобиля."}
      </p>
      <div className="segmented">
        <button
          className={mode === "login" ? "selected" : ""}
          onClick={() => {
            setMode("login");
            setError(null);
          }}
        >
          Вход
        </button>
        <button
          className={mode === "register" ? "selected" : ""}
          onClick={() => {
            setMode("register");
            setError(null);
          }}
        >
          Регистрация
        </button>
      </div>
      <form className="form-stack" onSubmit={submit}>
        <ErrorMessage error={error} />
        {mode === "register" && (
          <>
            <Field
              label="Имя и фамилия"
              name="name"
              autoComplete="name"
              required
              minLength={2}
              maxLength={80}
              placeholder="Александр Баев"
            />
            <PhoneField />
            <EligibilityFields />
          </>
        )}
        <Field
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="you@example.ru"
        />
        <Field
          label="Пароль"
          name="password"
          type="password"
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          minLength={8}
          maxLength={72}
          required
          placeholder="Не менее 8 символов"
        />
        <button className="button primary full" disabled={busy}>
          {busy ? (
            <Loader2 className="spin" />
          ) : mode === "login" ? (
            "Войти"
          ) : (
            "Создать аккаунт"
          )}
          <ArrowRight size={18} />
        </button>
      </form>
    </Modal>
  );
}
function Header() {
  const { user, setAuth, logout } = useApp();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  useEffect(() => setOpen(false), [location]);
  return (
    <header className="header">
      <div className="header-inner">
        <Link className="brand" to="/">
          <Brand />
        </Link>
        <nav
          aria-label="Основная навигация"
          className={open ? "nav open" : "nav"}
        >
          <NavLink to="/" end>
            Главная
          </NavLink>
          <NavLink to="/catalog">Автомобили</NavLink>
          <NavLink to="/conditions">Условия аренды</NavLink>
          {user && <NavLink to="/account">Мои поездки</NavLink>}
          {user?.role !== "client" && user && (
            <NavLink to="/admin">Управление</NavLink>
          )}
        </nav>
        <div className="header-actions">
          <ThemeToggle />
          <span className="location">
            <MapPin size={15} /> Вологда
          </span>
          {user ? (
            <>
              <Link className="account-link" to="/account">
                <UserRound size={17} />
                {user.name.split(" ")[0]}
              </Link>
              <button
                className="icon-button logout"
                aria-label="Выйти"
                onClick={logout}
              >
                <LogOut size={17} />
              </button>
            </>
          ) : (
            <button
              className="button small outline"
              onClick={() => setAuth("login")}
            >
              Войти <ArrowUpRight size={16} />
            </button>
          )}
          <button
            className="icon-button mobile-menu"
            aria-label="Открыть меню"
            aria-expanded={open}
            onClick={() => setOpen(!open)}
          >
            {open ? <X /> : <Menu />}
          </button>
        </div>
      </div>
    </header>
  );
}
function Footer() {
  return (
    <footer className="norde-footer">
      <div className="wrap">
        <div className="norde-footer-top">
          <Link className="brand" to="/" aria-label="NORDÉ — главная">
            <Brand />
          </Link>
          <p>Вологда. Дальше — куда захотите.</p>
        </div>
        <div className="norde-footer-bottom">
          <nav aria-label="Ссылки в подвале">
            <Link to="/catalog">Автомобили</Link>
            <Link to="/conditions">Условия аренды</Link>
            <Link to="/account">Личный кабинет</Link>
          </nav>
          <span>© NORDÉ · 2026 · Учебный проект</span>
        </div>
      </div>
    </footer>
  );
}
function CarCard({ car }) {
  const [params] = useSearchParams();
  const target =
    `/cars/${car._id}` +
    (params.get("from") && params.get("to")
      ? "?" +
        new URLSearchParams({ from: params.get("from"), to: params.get("to") })
      : "");
  return (
    <article className={`car-card ${car.category}`}>
      <Link className="car-visual" to={target}>
        <span className="car-category">{categories[car.category]}</span>
        <span className="car-year">{car.year}</span>
        <CarImage
          src={car.image}
          alt={`${car.brand} ${car.model}`}
          loading="lazy"
        />
      </Link>
      <div className="car-info">
        <div className="car-title">
          <Link to={target}>
            <h3>
              {car.brand} {car.model}
            </h3>
          </Link>
          <ArrowUpRight size={20} />
        </div>
        <div className="car-features">
          <span>
            <Gauge />
            {car.transmission}
          </span>
          <span>
            <Fuel />
            {car.fuel}
          </span>
          <span>
            <Users />
            {car.seats} мест
          </span>
        </div>
        <div className="car-bottom">
          <div>
            <strong>{money(car.dailyRate)}</strong>
            <span> / сутки</span>
          </div>
          <Link
            className="round-link"
            to={target}
            aria-label={`Выбрать ${car.brand} ${car.model}`}
          >
            <ArrowUpRight size={20} />
          </Link>
        </div>
        {(car.displayStatus || car.status) !== "available" && (
          <Badge status={car.displayStatus || car.status} />
        )}
      </div>
    </article>
  );
}
function Home() {
  const [cars, setCars] = useState([]);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  useEffect(() => {
    api("/cars")
      .then((r) =>
        setCars(r.cars.filter((c) => c.status === "available").slice(0, 3)),
      )
      .catch(setError);
  }, []);
  function search(e) {
    e.preventDefault();
    navigate(
      "/catalog?" +
        new URLSearchParams(Object.fromEntries(new FormData(e.target))),
    );
  }
  return (
    <main className="norde-home">
      <section className="norde-hero" aria-labelledby="home-title">
        <img
          className="norde-hero-image"
          src="/images/hero-road.jpg"
          alt="Чёрный автомобиль на открытой дороге"
          fetchPriority="high"
        />
        <div className="norde-hero-shade" />
        <div className="norde-hero-top">
          <span>CAR RENTAL / VOLOGDA</span>
          <span>59°13′ N · 39°53′ E</span>
        </div>
        <div className="norde-hero-copy">
          <span className="norde-kicker">ВАШ РИТМ. ВАШ МАРШРУТ.</span>
          <h1 id="home-title">
            Дорога.
            <br />
            По вашим
            <br />
            <em>правилам.</em>
          </h1>
          <p>Аренда автомобилей в Вологде.</p>
          <Link className="button norde-hero-cta" to="/catalog">
            Выбрать автомобиль <ArrowUpRight size={20} />
          </Link>
        </div>
        <div className="norde-hero-bottom">
          <span>СВОБОДА НАЧИНАЕТСЯ С ВЫБОРА</span>
          <a href="#fleet" aria-label="Перейти к автопарку">
            Листайте дальше <ArrowRight size={17} />
          </a>
        </div>
      </section>
      <section
        className="norde-booking wrap"
        aria-label="Подобрать автомобиль по датам"
      >
        <div className="norde-booking-caption">
          <span>01 / ВАША ПОЕЗДКА</span>
          <span>От 2 400 ₽ в сутки</span>
        </div>
        <form className="search-bar" onSubmit={search}>
          <div className="search-location">
            <MapPin size={20} />
            <div>
              <small>Город получения</small>
              <b>Вологда</b>
            </div>
          </div>
          <Field label="Начало аренды">
            <input
              aria-label="Начало аренды"
              name="from"
              type="date"
              min={day()}
              defaultValue={day()}
              required
            />
          </Field>
          <Field label="Возврат">
            <input
              aria-label="Возврат"
              name="to"
              type="date"
              min={day(1)}
              defaultValue={day(3)}
              required
            />
          </Field>
          <button className="button primary" type="submit">
            Найти автомобиль <ArrowUpRight size={20} />
          </button>
        </form>
      </section>
      <section id="fleet" className="wrap section norde-fleet">
        <div className="section-heading">
          <div>
            <div className="norde-kicker">02 / КОЛЛЕКЦИЯ</div>
            <h2>Под ваш характер.</h2>
          </div>
          <Link className="text-link" to="/catalog">
            Все автомобили <ArrowUpRight size={19} />
          </Link>
        </div>
        <ErrorMessage error={error} />
        <div className="car-grid">
          {cars.map((c) => (
            <CarCard key={c._id} car={c} />
          ))}
        </div>
      </section>
      <section className="wrap norde-principles" aria-label="Условия аренды">
        {[
          ["01", "Прозрачно", "Стоимость и залог видны до бронирования."],
          ["02", "Просто", "От 21 года. Права и стаж от 1 года."],
          ["03", "Под контролем", "Ваши заявки — в личном кабинете."],
        ].map(([n, t, p]) => (
          <article key={n}>
            <span>{n}</span>
            <h3>{t}</h3>
            <p>{p}</p>
          </article>
        ))}
      </section>
      <section className="wrap norde-invitation">
        <div>
          <div className="norde-kicker">
            МЕНЬШЕ ФОРМАЛЬНОСТЕЙ. БОЛЬШЕ ДОРОГ.
          </div>
          <h2>
            Ваш следующий
            <br />
            <em>маршрут — здесь.</em>
          </h2>
        </div>
        <Link className="button outline" to="/conditions">
          Условия аренды <ArrowUpRight size={20} />
        </Link>
      </section>
    </main>
  );
}
function Catalog() {
  const [params, setParams] = useSearchParams();
  const [cars, setCars] = useState([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(null);
  const key = params.toString();
  useEffect(() => {
    let live = true;
    setLoading(true);
    setError(null);
    api("/cars?" + key)
      .then((r) => {
        if (live) setCars(r.cars);
      })
      .catch((e) => live && setError(e))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [key]);
  function change(name, value) {
    const next = new URLSearchParams(params);
    value ? next.set(name, value) : next.delete(name);
    setParams(next);
  }
  function filter(e) {
    e.preventDefault();
    const next = new URLSearchParams(params);
    for (const [k, v] of new FormData(e.target))
      v ? next.set(k, v) : next.delete(k);
    setParams(next);
  }
  return (
    <main className="wrap page">
      <div className="eyebrow">ВАШ СЛЕДУЮЩИЙ АВТОМОБИЛЬ</div>
      <div className="page-heading">
        <h1>Автомобили.</h1>
        <p>Выберите свой маршрут — и автомобиль к нему.</p>
      </div>
      <form key={key} className="catalog-filters" onSubmit={filter}>
        <label className="search-input">
          <Search size={18} />
          <input
            name="search"
            aria-label="Поиск автомобиля"
            placeholder="Марка или модель"
            defaultValue={params.get("search") || ""}
          />
        </label>
        <Field label="С">
          <input
            name="from"
            type="date"
            min={day()}
            defaultValue={params.get("from") || ""}
          />
        </Field>
        <Field label="По">
          <input
            name="to"
            type="date"
            min={day(1)}
            defaultValue={params.get("to") || ""}
          />
        </Field>
        <button className="button primary">
          <SlidersHorizontal size={17} /> Подобрать
        </button>
      </form>
      <div className="catalog-toolbar">
        <div className="chips">
          {[["all", "Все автомобили"], ...Object.entries(categories)].map(
            ([key, label]) => (
              <button
                key={key}
                className={
                  (params.get("category") || "all") === key
                    ? "chip selected"
                    : "chip"
                }
                onClick={() => change("category", key)}
              >
                {label}
              </button>
            ),
          )}
        </div>
        <select
          aria-label="Сортировка"
          value={params.get("sort") || "price"}
          onChange={(e) => change("sort", e.target.value)}
        >
          <option value="price">Сначала дешевле</option>
          <option value="price-desc">Сначала дороже</option>
          <option value="year">Сначала новее</option>
        </select>
      </div>
      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorMessage error={error} />
      ) : (
        <>
          <div className="results-caption">
            Найдено автомобилей: {cars.length}
            {(params.get("from") || params.get("search")) && (
              <button className="text-link" onClick={() => setParams({})}>
                Сбросить фильтры <X size={14} />
              </button>
            )}
          </div>
          {cars.length ? (
            <div className="car-grid">
              {cars.map((c) => (
                <CarCard key={c._id} car={c} />
              ))}
            </div>
          ) : (
            <Empty title="Пока без совпадений">
              Попробуйте другие даты или сбросьте фильтры.
            </Empty>
          )}
        </>
      )}
    </main>
  );
}
function CarDetail() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const { user, setAuth, notify } = useApp();
  const navigate = useNavigate();
  const [data, setData] = useState(null),
    [error, setError] = useState(null),
    [quote, setQuote] = useState(null),
    [busy, setBusy] = useState(false),
    [done, setDone] = useState(null);
  const [form, setForm] = useState({
    from: params.get("from") || day(),
    to: params.get("to") || day(3),
    insurance: false,
    childSeat: false,
    comment: "",
  });
  useEffect(() => {
    api("/cars/" + id)
      .then(setData)
      .catch(setError);
  }, [id]);
  useEffect(() => {
    let live = true;
    setQuote(null);
    if (!data) return;
    api("/quote", {
      method: "POST",
      body: {
        carId: id,
        from: form.from,
        to: form.to,
        extras: { insurance: form.insurance, childSeat: form.childSeat },
      },
    })
      .then((r) => {
        if (live) {
          setQuote(r);
          setError(null);
        }
      })
      .catch((e) => live && setError(e));
    return () => {
      live = false;
    };
  }, [id, data, form.from, form.to, form.insurance, form.childSeat]);
  async function book(e) {
    e.preventDefault();
    if (!user) return setAuth("register");
    if (!canRent(user)) {
      setError(new Error("Подтвердите условия аренды в личном кабинете"));
      return;
    }
    setBusy(true);
    try {
      const result = await api("/rentals", {
        method: "POST",
        body: {
          carId: id,
          from: form.from,
          to: form.to,
          extras: { insurance: form.insurance, childSeat: form.childSeat },
          comment: form.comment,
        },
      });
      setDone(result.rental);
      notify("Заявка сохранена");
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  if (!data)
    return (
      <main className="wrap page">
        {error ? <ErrorMessage error={error} /> : <Loading />}
      </main>
    );
  const car = data.car;
  return (
    <main className="wrap page">
      <Link className="back-link" to="/catalog">
        <ArrowLeft size={16} /> Все автомобили
      </Link>
      <div className="detail-grid">
        <div>
          <div className={`detail-visual ${car.category}`}>
            <span className="car-category">{categories[car.category]}</span>
            <CarImage src={car.image} alt={`${car.brand} ${car.model}`} />
            <span className="illustration-note">
              {car.image?.endsWith(".svg")
                ? "Иллюстрация класса автомобиля"
                : "Фотография автомобиля"}
            </span>
          </div>
          <div className="detail-title">
            <div>
              <div className="eyebrow">
                {categories[car.category]} · {car.year}
              </div>
              <h1>
                {car.brand} {car.model}
              </h1>
            </div>
            <Badge status={car.status} />
          </div>
          <p className="detail-description">{car.description}</p>
          <div className="spec-grid">
            {[
              [Gauge, "Коробка передач", car.transmission],
              [Fuel, "Топливо", car.fuel],
              [Users, "Вместимость", `${car.seats} мест`],
              [
                CarFront,
                "Пробег",
                `${car.mileage.toLocaleString("ru-RU", { timeZone: "Europe/Moscow" })} км`,
              ],
            ].map(([I, label, val]) => (
              <div key={label}>
                <I />
                <small>{label}</small>
                <strong>{val}</strong>
              </div>
            ))}
          </div>
          <div className="info-panel">
            <ShieldCheck />
            <div>
              <h3>Всё готово к вашей поездке</h3>
              <p>
                Базовое ОСАГО включено. Оплата аренды и возвратный залог — при
                получении автомобиля. Заявку подтвердит менеджер.
              </p>
              <Link className="text-link" to="/conditions">
                Все условия <ArrowUpRight size={15} />
              </Link>
            </div>
          </div>
          {data.reservations.length > 0 && (
            <div className="reserved">
              <h3>Занятые периоды</h3>
              {data.reservations.map((r, i) => (
                <span className="chip" key={i}>
                  {date(r.from)} — {date(r.to)}
                </span>
              ))}
            </div>
          )}
        </div>
        <aside className="booking-panel">
          <div className="booking-price">
            <strong>{money(car.dailyRate)}</strong>
            <span> / сутки</span>
          </div>
          <p className="muted">Неделя и дольше — скидка 10% на аренду</p>
          {done ? (
            <div className="booking-success">
              <CheckCircle2 size={48} />
              <h2>Вы почти в пути!</h2>
              <p>
                Заявка {done.number} принята. Следите за подтверждением в личном
                кабинете.
              </p>
              <button
                className="button primary full"
                onClick={() => navigate("/account")}
              >
                Мои поездки <ArrowRight size={18} />
              </button>
            </div>
          ) : (
            <form className="form-stack" onSubmit={book}>
              {user && !canRent(user) && (
                <Link className="info-panel" to="/account">
                  Подтвердите возраст, права и стаж в профиле →
                </Link>
              )}
              <div className="form-row">
                <Field label="Начало">
                  <input
                    type="date"
                    value={form.from}
                    min={day()}
                    required
                    onChange={(e) => setForm({ ...form, from: e.target.value })}
                  />
                </Field>
                <Field label="Возврат">
                  <input
                    type="date"
                    value={form.to}
                    min={form.from}
                    required
                    onChange={(e) => setForm({ ...form, to: e.target.value })}
                  />
                </Field>
              </div>
              <h4>Чуть больше комфорта</h4>
              <label className="checkbox-line">
                <input
                  type="checkbox"
                  checked={form.insurance}
                  onChange={(e) =>
                    setForm({ ...form, insurance: e.target.checked })
                  }
                />
                <span>
                  Расширенная защита<small>600 ₽ / сутки</small>
                </span>
                <ShieldCheck size={18} />
              </label>
              <label className="checkbox-line">
                <input
                  type="checkbox"
                  checked={form.childSeat}
                  onChange={(e) =>
                    setForm({ ...form, childSeat: e.target.checked })
                  }
                />
                <span>
                  Детское кресло<small>300 ₽ / сутки</small>
                </span>
                <Users size={18} />
              </label>
              <Field label="Комментарий к заявке">
                <textarea
                  maxLength={500}
                  placeholder="Например, удобное время получения"
                  value={form.comment}
                  onChange={(e) =>
                    setForm({ ...form, comment: e.target.value })
                  }
                />
              </Field>
              <ErrorMessage error={error} />
              {quote && (
                <div className="quote">
                  <div>
                    <span>Аренда · {quote.quote.days} сут.</span>
                    <b>{money(quote.quote.base)}</b>
                  </div>
                  {quote.quote.insurance > 0 && (
                    <div>
                      <span>Расширенная защита</span>
                      <b>{money(quote.quote.insurance)}</b>
                    </div>
                  )}
                  {quote.quote.childSeat > 0 && (
                    <div>
                      <span>Детское кресло</span>
                      <b>{money(quote.quote.childSeat)}</b>
                    </div>
                  )}
                  <div className="quote-total">
                    <span>Итого</span>
                    <b>{money(quote.quote.total)}</b>
                  </div>
                  <div className="muted">
                    <span>Возвратный залог отдельно</span>
                    <b>{money(quote.quote.deposit)}</b>
                  </div>
                </div>
              )}
              {quote && !quote.available && (
                <p className="error">Автомобиль недоступен на эти даты.</p>
              )}
              <button
                className="button primary full"
                disabled={busy || !quote?.available}
              >
                {busy ? <Loader2 className="spin" /> : "Забронировать"}
                <ArrowUpRight size={18} />
              </button>
              <p className="fine-print">
                Без предоплаты. Подтверждает менеджер.
              </p>
            </form>
          )}
        </aside>
      </div>
    </main>
  );
}
function Account() {
  const { user, setUser, setAuth, notify } = useApp();
  const [rentals, setRentals] = useState(null),
    [error, setError] = useState(null),
    [cancel, setCancel] = useState(null),
    [busy, setBusy] = useState(false);
  function load() {
    api("/rentals")
      .then((r) => setRentals(r.rentals))
      .catch(setError);
  }
  useEffect(() => {
    if (user) load();
  }, [user]);
  async function profile(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await api("/profile", {
        method: "PATCH",
        body: eligibilityForm(e.target),
      });
      setUser(r.user);
      notify("Профиль обновлён");
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  async function cancelRental() {
    setBusy(true);
    try {
      await api(`/rentals/${cancel._id}/status`, {
        method: "PATCH",
        body: { status: "cancelled" },
      });
      setCancel(null);
      load();
      notify("Бронирование отменено");
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  if (!user)
    return (
      <main className="wrap page">
        <Empty title="Ваши поездки — здесь" icon={<UserRound />}>
          Войдите, чтобы видеть бронирования и управлять профилем.
        </Empty>
        <button
          className="button primary centered"
          onClick={() => setAuth("login")}
        >
          Войти в аккаунт <ArrowRight size={18} />
        </button>
      </main>
    );
  return (
    <main className="wrap page">
      <div className="eyebrow">ЛИЧНЫЙ КАБИНЕТ</div>
      <div className="page-heading">
        <div>
          <h1>
            Здравствуйте, {user.name.split(" ")[0]}
            <span className="accent">.</span>
          </h1>
          <p>Все ваши маршруты в одном месте.</p>
        </div>
        <Link to="/catalog" className="button primary">
          Новая поездка <Plus size={18} />
        </Link>
      </div>
      <ErrorMessage error={error} />
      <div className="account-grid">
        <section>
          <h2 className="small-heading">
            Мои бронирования <span>{rentals?.length || 0}</span>
          </h2>
          {!rentals ? (
            <Loading />
          ) : rentals.length ? (
            rentals.map((r) => (
              <article className="rental-card" key={r._id}>
                <div className="rental-car">
                  <CarImage src={r.car?.image} alt="" />
                  <div>
                    <small>{r.number}</small>
                    <h3>{r.carName}</h3>
                    <Badge status={r.status} />
                  </div>
                </div>
                <div className="rental-meta">
                  <span>
                    <CalendarDays size={16} />
                    {date(r.from)} — {date(r.to)}
                  </span>
                  <b>{money(r.quote.total)}</b>
                </div>
                <div className="rental-status-note">
                  {
                    {
                      new: "Заявка принята. Ожидайте подтверждения менеджера.",
                      confirmed:
                        "Бронирование подтверждено. Возьмите паспорт и водительское удостоверение.",
                      active:
                        "Приятной поездки! Возврат оформляется через менеджера.",
                      completed:
                        "Спасибо за поездку. Будем рады видеть вас снова.",
                      cancelled:
                        "Заявка отменена. Вы можете выбрать другие даты.",
                    }[r.status]
                  }
                </div>
                <div className="rental-footer">
                  <small>
                    Залог: {money(r.quote.deposit)} · {r.quote.days} сут.
                  </small>
                  {["new", "confirmed"].includes(r.status) && (
                    <button
                      className="text-link danger"
                      onClick={() => setCancel(r)}
                    >
                      Отменить бронирование
                    </button>
                  )}
                </div>
                <details>
                  <summary>История заявки</summary>
                  {r.history.map((h, i) => (
                    <div className="history-line" key={i}>
                      <span>{statuses[h.status]}</span>
                      <small>
                        {new Date(h.at).toLocaleString("ru-RU", {
                          timeZone: "Europe/Moscow",
                        })}
                      </small>
                    </div>
                  ))}
                </details>
              </article>
            ))
          ) : (
            <Empty title="Первые километры впереди">
              Выберите автомобиль в каталоге — здесь появится ваша заявка.
            </Empty>
          )}
        </section>
        <aside className="profile-card">
          <div className="profile-avatar">{user.name.slice(0, 1)}</div>
          <h3>Мой профиль</h3>
          <p className="muted">{roles[user.role]}</p>
          <form className="form-stack" onSubmit={profile}>
            <Field
              label="Имя и фамилия"
              name="name"
              defaultValue={user.name}
              minLength={2}
              maxLength={80}
              required
            />
            <PhoneField defaultValue={user.phone} />
            <EligibilityFields user={user} />
            <Field label="Email" value={user.email} disabled />
            <button className="button outline full" disabled={busy}>
              Сохранить изменения
            </button>
          </form>
        </aside>
      </div>
      {cancel && (
        <Modal title="Отменить бронирование?" onClose={() => setCancel(null)}>
          <p>
            Автомобиль {cancel.carName} на {date(cancel.from)} больше не будет
            закреплён за вами.
          </p>
          <div className="modal-actions">
            <button className="button outline" onClick={() => setCancel(null)}>
              Оставить заявку
            </button>
            <button
              className="button danger-button"
              disabled={busy}
              onClick={cancelRental}
            >
              Да, отменить
            </button>
          </div>
        </Modal>
      )}
    </main>
  );
}
function Conditions() {
  return (
    <main className="wrap page conditions">
      <div className="eyebrow">ПРОСТО И ПРОЗРАЧНО</div>
      <h1>
        Условия аренды<span className="accent">.</span>
      </h1>
      <p className="lead">Что нужно знать перед бронированием.</p>
      <div className="conditions-grid">
        {[
          [
            "01",
            "Кто может арендовать",
            "От 21 года, стаж от 1 года. При получении — паспорт и действующие права.",
          ],
          [
            "02",
            "Срок и стоимость",
            "От 1 до 30 суток. Дата возврата не включается в количество суток. За 7 суток и более скидка 10% на базовую аренду. Расширенная защита — 600 ₽/сутки, детское кресло — 300 ₽/сутки.",
          ],
          [
            "03",
            "Оплата и залог",
            "Оплата при получении. Возвратный залог указан отдельно в карточке.",
          ],
          [
            "04",
            "Получение и возврат",
            "Вологда. Место и время согласуйте с менеджером.",
          ],
          [
            "05",
            "Изменение планов",
            "Отмена — в личном кабинете до выдачи авто. Для смены дат создайте новую заявку.",
          ],
          [
            "06",
            "Состояние автомобиля",
            "Авто на обслуживании недоступны. Состояние фиксируется при выдаче и возврате.",
          ],
        ].map(([n, t, p]) => (
          <article key={n}>
            <span className="step-number">{n}</span>
            <h2>{t}</h2>
            <p>{p}</p>
          </article>
        ))}
      </div>
      <div className="info-panel">
        <ShieldCheck />
        <p>
          Это учебная информационная система. Условия приведены для демонстрации
          процесса аренды; реальные договоры и онлайн-платежи не оформляются.
        </p>
      </div>
      <Link className="button primary" to="/catalog">
        Перейти к автомобилям <ArrowUpRight size={18} />
      </Link>
    </main>
  );
}
function Admin() {
  const { user, setAuth, notify } = useApp();
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") || "overview";
  const [data, setData] = useState(null),
    [records, setRecords] = useState([]),
    [users, setUsers] = useState([]),
    [error, setError] = useState(null),
    [modal, setModal] = useState(null),
    [busy, setBusy] = useState(false),
    [filter, setFilter] = useState("all");
  const staff = user && ["admin", "manager"].includes(user.role);
  async function load() {
    try {
      const [overview, maintenance] = await Promise.all([
        api("/admin/overview"),
        api("/admin/maintenance"),
      ]);
      setData(overview);
      setRecords(maintenance.records);
      if (user.role === "admin") setUsers((await api("/admin/users")).users);
    } catch (e) {
      setError(e);
    }
  }
  useEffect(() => {
    if (staff) load();
  }, [user]);
  async function action(path, method, body, message) {
    setBusy(true);
    setError(null);
    try {
      await api(path, { method, body });
      setModal(null);
      await load();
      notify(message);
      return true;
    } catch (e) {
      setError(e);
      return false;
    } finally {
      setBusy(false);
    }
  }
  const nav = [
    ["overview", "Обзор", LayoutDashboard],
    ["rentals", "Бронирования", ClipboardList],
    ["fleet", "Автопарк", CarFront],
    ["maintenance", "Техобслуживание", Wrench],
    ...(user?.role === "admin" ? [["users", "Пользователи", Users]] : []),
    ["events", "Журнал событий", History],
  ];
  async function saveCar(e) {
    e.preventDefault();
    const values = Object.fromEntries(new FormData(e.target));
    if (user.role === "admin")
      for (const k of ["year", "dailyRate", "deposit", "mileage", "seats"])
        values[k] = Number(values[k]);
    await action(
      "/admin/cars" + (modal.car ? "/" + modal.car._id : ""),
      modal.car ? "PATCH" : "POST",
      values,
      "Автомобиль сохранён",
    );
  }
  async function saveMaintenance(e) {
    e.preventDefault();
    const values = Object.fromEntries(new FormData(e.target));
    values.wear = Number(values.wear);
    values.mileage = Number(values.mileage);
    await action("/admin/maintenance", "POST", values, "Осмотр записан");
  }
  function openModal(value) {
    setError(null);
    setModal(value);
  }
  if (!user)
    return (
      <main className="wrap page">
        <Empty title="Вход для сотрудников" icon={<ShieldCheck />}>
          Для доступа к управлению войдите в аккаунт менеджера или
          администратора.
        </Empty>
        <button
          className="button primary centered"
          onClick={() => setAuth("login")}
        >
          Войти
        </button>
      </main>
    );
  if (!staff)
    return (
      <main className="wrap page">
        <Empty title="Доступ ограничен" icon={<ShieldCheck />}>
          Эта часть сайта доступна сотрудникам автопарка.
        </Empty>
        <Link className="button primary centered" to="/account">
          Мои поездки
        </Link>
      </main>
    );
  const rentals =
    data?.rentals.filter((r) => filter === "all" || r.status === filter) || [];
  const renderRentals = (items) =>
    items.length ? (
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Заявка / клиент</th>
              <th>Автомобиль</th>
              <th>Период</th>
              <th>Стоимость</th>
              <th>Статус</th>
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            {items.map((r) => (
              <tr key={r._id}>
                <td>
                  <b>{r.number}</b>
                  <span>{r.user?.name}</span>
                  <small>{r.user?.phone}</small>
                  {r.comment && <small className="comment">{r.comment}</small>}
                </td>
                <td>
                  <b>{r.carName}</b>
                  <small>{r.car?.plate}</small>
                </td>
                <td>
                  {date(r.from)}
                  <span>{date(r.to)}</span>
                </td>
                <td>
                  <b>{money(r.quote.total)}</b>
                  <small>{r.quote.days} сут.</small>
                </td>
                <td>
                  <Badge status={r.status} />
                </td>
                <td>
                  <div className="table-actions">
                    {r.status === "new" && (
                      <button
                        className="button tiny primary"
                        disabled={busy}
                        onClick={() =>
                          action(
                            `/rentals/${r._id}/status`,
                            "PATCH",
                            { status: "confirmed" },
                            "Заявка подтверждена",
                          )
                        }
                      >
                        Подтвердить
                      </button>
                    )}
                    {r.status === "confirmed" && (
                      <button
                        className="button tiny primary"
                        disabled={busy}
                        onClick={() =>
                          action(
                            `/rentals/${r._id}/status`,
                            "PATCH",
                            { status: "active" },
                            "Выдача оформлена",
                          )
                        }
                      >
                        Выдать авто
                      </button>
                    )}
                    {r.status === "active" && (
                      <button
                        className="button tiny primary"
                        onClick={() => openModal({ type: "return", rental: r })}
                      >
                        Принять авто
                      </button>
                    )}
                    {["new", "confirmed"].includes(r.status) && (
                      <button
                        className="icon-button danger"
                        aria-label={`Отменить ${r.number}`}
                        onClick={() => openModal({ type: "cancel", rental: r })}
                      >
                        <X size={17} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ) : (
      <Empty title="Заявок пока нет">
        Новые бронирования клиентов появятся здесь.
      </Empty>
    );
  return (
    <main className="admin-layout">
      <aside className="admin-sidebar">
        <div className="workspace-label">РАБОЧЕЕ ПРОСТРАНСТВО</div>
        <h2>
          Управление
          <br />
          автопарком<span className="accent">.</span>
        </h2>
        <div className="admin-nav">
          {nav.map(([key, label, I]) => (
            <button
              key={key}
              className={tab === key ? "active" : ""}
              onClick={() => {
                setParams({ tab: key });
                setError(null);
              }}
            >
              <I size={19} />
              {label}
              {key === "rentals" && data?.stats.pending > 0 && (
                <b>{data.stats.pending}</b>
              )}
            </button>
          ))}
        </div>
        <div className="sidebar-profile">
          <div className="profile-avatar small">{user.name[0]}</div>
          <div>
            <b>{user.name}</b>
            <small>{roles[user.role]}</small>
          </div>
        </div>
        <Link to="/" className="back-link">
          <ArrowLeft size={15} /> Вернуться на сайт
        </Link>
      </aside>
      <section className="admin-content">
        <div className="admin-heading">
          <div>
            <div className="eyebrow">
              NORDÉ / {roles[user.role].toUpperCase()}
            </div>
            <h1>{nav.find((n) => n[0] === tab)?.[1] || "Обзор"}</h1>
            <p>
              {
                {
                  overview: "Все важные показатели — перед глазами.",
                  rentals: "От первой заявки до возвращения ключей.",
                  fleet: "Автомобили, тарифы и текущий статус.",
                  maintenance: "История осмотров и состояние каждого узла.",
                  users: "Команда и клиенты вашей автобазы.",
                  events: "Все изменения в хронологическом порядке.",
                }[tab]
              }
            </p>
          </div>
          <span className="admin-date">
            <CalendarDays size={16} />
            {date(day())}
          </span>
        </div>
        <ErrorMessage error={!modal && error} />
        {!data ? (
          <Loading />
        ) : (
          <>
            {tab === "overview" && (
              <>
                <div className="stats-grid">
                  {[
                    [
                      CarFront,
                      "Автомобилей в парке",
                      data.stats.cars,
                      "Все категории",
                    ],
                    [
                      ArrowUpRight,
                      "Сейчас в аренде",
                      data.stats.active,
                      "Активные поездки",
                    ],
                    [
                      Clock3,
                      "Ожидают решения",
                      data.stats.pending,
                      "Новые заявки",
                    ],
                    [
                      Gauge,
                      "Завершённые аренды",
                      money(data.stats.revenue),
                      "Сумма по закрытым заявкам",
                    ],
                  ].map(([I, t, n, s]) => (
                    <article key={t}>
                      <div>
                        <span>{t}</span>
                        <I size={18} />
                      </div>
                      <strong>{n}</strong>
                      <small>{s}</small>
                    </article>
                  ))}
                </div>
                <div className="panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Последние бронирования</h2>
                      <p>
                        Проверьте новые заявки и подготовьте автомобили к
                        выдаче.
                      </p>
                    </div>
                    <button
                      className="text-link"
                      onClick={() => setParams({ tab: "rentals" })}
                    >
                      Все заявки <ArrowUpRight size={17} />
                    </button>
                  </div>
                  {renderRentals(data.rentals.slice(0, 5))}
                </div>
                <div className="admin-bottom-grid">
                  <div className="panel">
                    <div className="panel-heading">
                      <h2>Состояние автопарка</h2>
                      <CarFront size={19} />
                    </div>
                    {[
                      ["available", "Готовы к бронированию"],
                      ["maintenance", "На обслуживании"],
                      ["broken", "Неисправны"],
                    ].map(([s, t]) => (
                      <div className="fleet-stat" key={s}>
                        <div>
                          <span className={`status-dot ${s}`} />
                          {t}
                        </div>
                        <b>{data.cars.filter((c) => c.status === s).length}</b>
                      </div>
                    ))}
                    <p className="fine-print">
                      Готовность к бронированию учитывает технический статус.
                      Доступность на даты проверяется отдельно.
                    </p>
                  </div>
                  <div className="panel">
                    <div className="panel-heading">
                      <h2>Последние события</h2>
                      <History size={19} />
                    </div>
                    {data.events.slice(0, 4).map((e) => (
                      <div className="event-line" key={e._id}>
                        <span className="event-dot" />
                        <div>
                          <b>{e.action}</b>
                          <p>{e.details}</p>
                          <small>
                            {new Date(e.createdAt).toLocaleString("ru-RU", {
                              timeZone: "Europe/Moscow",
                            })}
                          </small>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
            {tab === "rentals" && (
              <div className="panel">
                <div className="panel-heading">
                  <div className="chips">
                    {[
                      ["all", "Все"],
                      ["new", "Новые"],
                      ["confirmed", "Подтверждённые"],
                      ["active", "Активные"],
                      ["completed", "Завершённые"],
                      ["cancelled", "Отменённые"],
                    ].map(([s, t]) => (
                      <button
                        key={s}
                        className={filter === s ? "chip selected" : "chip"}
                        onClick={() => setFilter(s)}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                  <a
                    className="button outline small"
                    href="/api/admin/export"
                    onClick={async (e) => {
                      if (import.meta.env.MODE === "demo") {
                        e.preventDefault();
                        await (await import("./demo-api")).exportDemo();
                      }
                    }}
                    download
                  >
                    <Download size={16} /> CSV
                  </a>
                </div>
                {renderRentals(rentals)}
              </div>
            )}
            {tab === "fleet" && (
              <div className="panel">
                <div className="panel-heading">
                  <h2>{data.cars.length} автомобилей</h2>
                  {user.role === "admin" && (
                    <button
                      className="button primary small"
                      onClick={() => openModal({ type: "car" })}
                    >
                      <Plus size={17} /> Добавить автомобиль
                    </button>
                  )}
                </div>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Автомобиль</th>
                        <th>Госномер</th>
                        <th>Тариф / сутки</th>
                        <th>Пробег</th>
                        <th>Статус</th>
                        <th>Действия</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.cars.map((c) => (
                        <tr key={c._id}>
                          <td>
                            <div className="table-car">
                              <CarImage src={c.image} alt="" />
                              <div>
                                <b>
                                  {c.brand} {c.model}
                                </b>
                                <small>
                                  {c.year} · {categories[c.category]}
                                </small>
                              </div>
                            </div>
                          </td>
                          <td>{c.plate}</td>
                          <td>
                            <b>{money(c.dailyRate)}</b>
                          </td>
                          <td>
                            {c.mileage.toLocaleString("ru-RU", {
                              timeZone: "Europe/Moscow",
                            })}{" "}
                            км
                          </td>
                          <td>
                            <Badge
                              status={
                                data.rentals.some(
                                  (r) =>
                                    r.car?._id === c._id &&
                                    r.status === "active",
                                )
                                  ? "rented"
                                  : c.status
                              }
                            />
                          </td>
                          <td>
                            <div className="table-actions">
                              <button
                                className="icon-button"
                                aria-label={`Изменить ${c.brand} ${c.model}`}
                                onClick={() =>
                                  openModal({ type: "car", car: c })
                                }
                              >
                                <Pencil size={16} />
                              </button>
                              {user.role === "admin" && (
                                <button
                                  className="icon-button danger"
                                  aria-label={`Архивировать ${c.brand} ${c.model}`}
                                  onClick={() =>
                                    openModal({ type: "archive", car: c })
                                  }
                                >
                                  <Trash2 size={16} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            {tab === "maintenance" && (
              <>
                <div className="panel">
                  <div className="panel-heading">
                    <div>
                      <h2>История технических осмотров</h2>
                      <p>
                        Износ 70% и выше — повод проверить узел перед выдачей.
                      </p>
                    </div>
                    <button
                      className="button primary small"
                      onClick={() => openModal({ type: "maintenance" })}
                    >
                      <Plus size={17} /> Новый осмотр
                    </button>
                  </div>
                  {records.length ? (
                    <div className="table-scroll">
                      <table>
                        <thead>
                          <tr>
                            <th>Автомобиль</th>
                            <th>Узел</th>
                            <th>Износ</th>
                            <th>Пробег</th>
                            <th>Результат осмотра</th>
                            <th>Дата / сотрудник</th>
                          </tr>
                        </thead>
                        <tbody>
                          {records.map((r) => (
                            <tr key={r._id}>
                              <td>
                                <b>
                                  {r.car?.brand} {r.car?.model}
                                </b>
                                <small>{r.car?.plate}</small>
                              </td>
                              <td>{r.node}</td>
                              <td>
                                <div className="wear">
                                  <span>{r.wear}%</span>
                                  <i>
                                    <b
                                      style={{
                                        width: r.wear + "%",
                                        background:
                                          r.wear >= 70 ? "#bc614c" : "#3d7d67",
                                      }}
                                    />
                                  </i>
                                </div>
                              </td>
                              <td>
                                {r.mileage.toLocaleString("ru-RU", {
                                  timeZone: "Europe/Moscow",
                                })}
                              </td>
                              <td className="note-cell">{r.note}</td>
                              <td>
                                {date(r.createdAt)}
                                <small>{r.author?.name}</small>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <Empty title="Осмотры ещё не записаны">
                      Добавьте результат первого осмотра.
                    </Empty>
                  )}
                </div>
                <div className="info-panel">
                  <Wrench />
                  <p>
                    Осмотр сохраняет историю и пробег. Чтобы снять автомобиль с
                    выдачи, измените его статус в разделе «Автопарк» после
                    закрытия действующих заявок.
                  </p>
                </div>
              </>
            )}
            {tab === "users" && user.role === "admin" && (
              <div className="panel">
                <div className="panel-heading">
                  <h2>Пользователи · {users.length}</h2>
                </div>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Имя</th>
                        <th>Email</th>
                        <th>Телефон</th>
                        <th>Роль</th>
                        <th>Управление</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((u) => (
                        <tr key={u.id}>
                          <td>
                            <b>{u.name}</b>
                          </td>
                          <td>{u.email}</td>
                          <td>{u.phone}</td>
                          <td>{roles[u.role]}</td>
                          <td>
                            {u.id === user.id ? (
                              <small>Ваш аккаунт</small>
                            ) : (
                              <select
                                aria-label={`Роль ${u.email}`}
                                value={u.role}
                                disabled={busy}
                                onChange={(e) =>
                                  openModal({
                                    type: "role",
                                    user: u,
                                    role: e.target.value,
                                  })
                                }
                              >
                                {Object.entries(roles).map(([v, t]) => (
                                  <option key={v} value={v}>
                                    {t}
                                  </option>
                                ))}
                              </select>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            {tab === "events" && (
              <div className="panel">
                <div className="panel-heading">
                  <h2>Последние 50 событий</h2>
                </div>
                {data.events.map((e) => (
                  <div className="event-line" key={e._id}>
                    <span className="event-dot" />
                    <div>
                      <b>{e.action}</b>
                      <p>{e.details}</p>
                      <small>
                        {new Date(e.createdAt).toLocaleString("ru-RU", {
                          timeZone: "Europe/Moscow",
                        })}{" "}
                        · {e.actor?.name || "Система"}
                      </small>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
        {modal && (
          <Modal
            title={
              modal.type === "car"
                ? modal.car
                  ? "Редактировать автомобиль"
                  : "Новый автомобиль"
                : {
                    maintenance: "Записать осмотр",
                    return: "Приём автомобиля",
                    cancel: "Отменить заявку?",
                    archive: "Убрать автомобиль в архив?",
                    role: "Изменить права пользователя?",
                  }[modal.type]
            }
            wide={modal.type === "car"}
            onClose={() => {
              setModal(null);
              setError(null);
            }}
          >
            <ErrorMessage error={error} />
            {modal.type === "car" && (
              <form className="form-stack" onSubmit={saveCar}>
                {user.role === "admin" && (
                  <>
                    <div className="form-row">
                      <Field
                        label="Марка"
                        name="brand"
                        required
                        defaultValue={modal.car?.brand || ""}
                      />
                      <Field
                        label="Модель"
                        name="model"
                        required
                        defaultValue={modal.car?.model || ""}
                      />
                    </div>
                    <div className="form-row">
                      <Field
                        label="Год выпуска"
                        name="year"
                        type="number"
                        min={2000}
                        max={new Date().getFullYear() + 1}
                        required
                        defaultValue={modal.car?.year || 2024}
                      />
                      <Field
                        label="Госномер"
                        name="plate"
                        required
                        defaultValue={modal.car?.plate || ""}
                      />
                    </div>
                    <div className="form-row">
                      <Field label="Класс">
                        <select
                          name="category"
                          defaultValue={modal.car?.category || "comfort"}
                        >
                          {Object.entries(categories).map(([v, t]) => (
                            <option key={v} value={v}>
                              {t}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <PhotoField defaultValue={modal.car?.image} />
                    </div>
                    <div className="form-row">
                      <Field
                        label="Стоимость в сутки, ₽"
                        name="dailyRate"
                        type="number"
                        min={500}
                        max={100000}
                        required
                        defaultValue={modal.car?.dailyRate || 3900}
                      />
                      <Field
                        label="Залог, ₽"
                        name="deposit"
                        type="number"
                        min={0}
                        max={500000}
                        required
                        defaultValue={modal.car?.deposit ?? 15000}
                      />
                    </div>
                    <div className="form-row">
                      <Field
                        label="Пробег, км"
                        name="mileage"
                        type="number"
                        min={modal.car?.mileage || 0}
                        max={2000000}
                        required
                        defaultValue={modal.car?.mileage || 0}
                      />
                      <Field
                        label="Мест"
                        name="seats"
                        type="number"
                        min={2}
                        max={9}
                        required
                        defaultValue={modal.car?.seats || 5}
                      />
                    </div>
                    <div className="form-row">
                      <Field label="Коробка передач">
                        <select
                          name="transmission"
                          defaultValue={modal.car?.transmission || "Автомат"}
                        >
                          <option>Автомат</option>
                          <option>Механика</option>
                        </select>
                      </Field>
                      <Field label="Топливо">
                        <select
                          name="fuel"
                          defaultValue={modal.car?.fuel || "Бензин"}
                        >
                          <option>Бензин</option>
                          <option>Дизель</option>
                          <option>Гибрид</option>
                          <option>Электро</option>
                        </select>
                      </Field>
                    </div>
                    <Field label="Описание">
                      <textarea
                        name="description"
                        minLength={10}
                        maxLength={1500}
                        required
                        defaultValue={modal.car?.description || ""}
                      />
                    </Field>
                  </>
                )}
                <Field label="Технический статус">
                  <select
                    name="status"
                    defaultValue={modal.car?.status || "available"}
                  >
                    <option value="available">Доступен</option>
                    <option value="maintenance">На обслуживании</option>
                    <option value="broken">Неисправен</option>
                  </select>
                </Field>
                <button className="button primary full" disabled={busy}>
                  Сохранить автомобиль
                </button>
              </form>
            )}
            {modal.type === "maintenance" && (
              <form className="form-stack" onSubmit={saveMaintenance}>
                <Field label="Автомобиль">
                  <select name="carId" required>
                    {data.cars.map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.brand} {c.model} · {c.plate} · {c.mileage} км
                      </option>
                    ))}
                  </select>
                </Field>
                <div className="form-row">
                  <Field label="Узел">
                    <select name="node">
                      {[
                        "Двигатель",
                        "Тормоза",
                        "Подвеска",
                        "Шины",
                        "Кузов",
                        "Плановое ТО",
                      ].map((v) => (
                        <option key={v}>{v}</option>
                      ))}
                    </select>
                  </Field>
                  <Field
                    label="Износ, %"
                    name="wear"
                    type="number"
                    min={0}
                    max={100}
                    required
                  />
                </div>
                <Field
                  label="Текущий пробег, км"
                  name="mileage"
                  type="number"
                  min={0}
                  max={2000000}
                  required
                />
                <Field label="Результат осмотра">
                  <textarea
                    name="note"
                    minLength={3}
                    maxLength={1000}
                    required
                    placeholder="Что проверили, какие работы нужны"
                  />
                </Field>
                <button className="button primary full" disabled={busy}>
                  Сохранить осмотр
                </button>
              </form>
            )}
            {modal.type === "return" && (
              <form
                className="form-stack"
                onSubmit={(e) => {
                  e.preventDefault();
                  action(
                    `/rentals/${modal.rental._id}/status`,
                    "PATCH",
                    {
                      status: "completed",
                      returnMileage: Number(
                        new FormData(e.target).get("returnMileage"),
                      ),
                    },
                    "Возврат оформлен",
                  );
                }}
              >
                <p>
                  {modal.rental.carName} · {modal.rental.number}
                </p>
                <Field
                  label="Пробег при возврате, км"
                  name="returnMileage"
                  type="number"
                  min={modal.rental.car?.mileage || 0}
                  defaultValue={modal.rental.car?.mileage || 0}
                  max={2000000}
                  required
                />
                <button className="button primary full" disabled={busy}>
                  Завершить аренду
                </button>
              </form>
            )}
            {["cancel", "archive", "role"].includes(modal.type) && (
              <>
                <p>
                  {modal.type === "cancel"
                    ? `Заявка ${modal.rental.number} будет отменена, автомобиль освободится на выбранные даты.`
                    : modal.type === "archive"
                      ? `${modal.car.brand} ${modal.car.model} исчезнет из каталога. История аренд и обслуживания сохранится.`
                      : `Пользователь ${modal.user.name} получит роль «${roles[modal.role]}». Права изменятся сразу.`}
                </p>
                <div className="modal-actions">
                  <button
                    className="button outline"
                    onClick={() => setModal(null)}
                  >
                    Назад
                  </button>
                  <button
                    className="button primary"
                    disabled={busy}
                    onClick={() =>
                      modal.type === "cancel"
                        ? action(
                            `/rentals/${modal.rental._id}/status`,
                            "PATCH",
                            { status: "cancelled" },
                            "Заявка отменена",
                          )
                        : modal.type === "archive"
                          ? action(
                              `/admin/cars/${modal.car._id}`,
                              "DELETE",
                              undefined,
                              "Автомобиль перемещён в архив",
                            )
                          : action(
                              `/admin/users/${modal.user.id}`,
                              "PATCH",
                              { role: modal.role },
                              "Роль изменена",
                            )
                    }
                  >
                    Подтвердить
                  </button>
                </div>
              </>
            )}
          </Modal>
        )}
      </section>
    </main>
  );
}
function App() {
  const [user, setUser] = useState(null),
    [ready, setReady] = useState(false),
    [auth, setAuth] = useState(null),
    [toast, setToast] = useState(null),
    [connectionError, setConnectionError] = useState(null);
  const location = useLocation();
  useEffect(() => {
    api("/auth/session")
      .then((r) => setUser(r.user))
      .catch(setConnectionError)
      .finally(() => setReady(true));
  }, []);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 4500);
      return () => clearTimeout(t);
    }
  }, [toast]);
  async function logout() {
    try {
      await api("/auth/logout", { method: "POST" });
      setUser(null);
      await api("/auth/session");
      setToast("Вы вышли из аккаунта");
    } catch (e) {
      setToast(e.message);
    }
  }
  return (
    <Context.Provider
      value={{ user, setUser, auth, setAuth, notify: setToast, logout }}
    >
      <div
        className={
          location.pathname.startsWith("/admin") ? "staff-site" : "client-site"
        }
      >
        {import.meta.env.MODE === "demo" && (
          <div className="demo-banner">
            <span>Деморежим · данные сохраняются в этом браузере</span>
            <button
              onClick={async () => {
                if (confirm("Сбросить все учебные изменения?"))
                  (await import("./demo-api")).resetDemo();
              }}
            >
              Сбросить демо
            </button>
          </div>
        )}
        <Header />
        {connectionError ? (
          <main className="wrap page">
            <ErrorMessage error={connectionError} />
            <button
              className="button primary"
              onClick={() => window.location.reload()}
            >
              Повторить подключение
            </button>
          </main>
        ) : !ready ? (
          <Loading />
        ) : (
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/catalog" element={<Catalog />} />
            <Route path="/cars/:id" element={<CarDetail />} />
            <Route path="/account" element={<Account />} />
            <Route path="/conditions" element={<Conditions />} />
            <Route path="/admin" element={<Admin />} />
            <Route
              path="*"
              element={
                <main className="wrap page">
                  <Empty title="Эта дорога пока не проложена">
                    Страница не найдена.
                  </Empty>
                  <Link className="button primary centered" to="/">
                    На главную
                  </Link>
                </main>
              }
            />
          </Routes>
        )}
        {!location.pathname.startsWith("/admin") && <Footer />}
        {auth && <AuthModal key={auth} />}{" "}
        {toast && (
          <div className="toast" role="status">
            <CheckCircle2 size={20} />
            {toast}
            <button
              className="icon-button"
              aria-label="Закрыть уведомление"
              onClick={() => setToast(null)}
            >
              <X size={16} />
            </button>
          </div>
        )}
      </div>
    </Context.Provider>
  );
}
createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>,
);
