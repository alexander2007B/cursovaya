import { Link } from "react-router-dom";
import { ArrowUpRight, ArrowUp, MapPin, Phone, Mail } from "lucide-react";
import Brand from "./Brand";
export default function Footer() {
  return (
    <footer className="norde-footer contact-footer">
      <div className="wrap">
        <div className="contact-footer-main">
          <div className="footer-brand-column">
            <Link className="brand" to="/" aria-label="NORDÉ — главная">
              <Brand />
            </Link>
            <p>
              Автомобили в аренду
              <br />в Вологде.
            </p>
            <a className="footer-email" href="mailto:viperr@angel.com">
              Написать нам <ArrowUpRight size={16} />
            </a>
          </div>
          <nav className="footer-navigation" aria-label="Ссылки в подвале">
            <h2>На сайте</h2>
            <Link to="/catalog">
              Все автомобили <ArrowUpRight size={15} />
            </Link>
            <Link to="/catalog?category=business">Бизнес-класс</Link>
            <Link to="/catalog?category=premium">Премиум</Link>
            <Link to="/conditions">Условия аренды</Link>
            <Link to="/account">Личный кабинет</Link>
          </nav>
          <address className="footer-contacts">
            <h2>Контакты</h2>
            <a className="footer-phone" href="tel:+79218287767">
              <Phone size={18} />
              <span>+7 (921)-828-77-67</span>
            </a>
            <a href="mailto:viperr@angel.com">
              <Mail size={17} />
              <span>viperr@angel.com</span>
            </a>
            <a
              href="https://yandex.ru/maps/?text=%D0%92%D0%BE%D0%BB%D0%BE%D0%B3%D0%B4%D0%B0%20%D0%9F%D0%B5%D1%80%D0%B2%D0%BE%D0%BC%D0%B0%D0%B9%D1%81%D0%BA%D0%B0%D1%8F%2042"
              target="_blank"
              rel="noreferrer"
            >
              <MapPin size={18} />
              <span>
                Вологда, ул. Первомайская, 42<small>Открыть на карте</small>
              </span>
            </a>
          </address>
        </div>
        <div className="footer-owner">
          <div>
            <span>Владелец проекта</span>
            <p>Баев Александр Павлович</p>
          </div>
          <button
            type="button"
            className="footer-top-button"
            onClick={() =>
              window.scrollTo({
                top: 0,
                behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
                  ? "instant"
                  : "smooth",
              })
            }
          >
            Наверх <ArrowUp size={17} />
          </button>
        </div>
        <div className="footer-legal">
          <span>© {new Date().getFullYear()} NORDÉ</span>
          <p>Учебный проект. Контактные данные демонстрационные.</p>
          <Link to="/conditions">Условия аренды</Link>
        </div>
      </div>
    </footer>
  );
}
