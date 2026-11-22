import { Link } from "react-router-dom";
import { Headphones, MapPin, Phone, Mail } from "lucide-react";
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
              Аренда автомобилей в Вологде.
              <br />
              Для ваших планов и новых маршрутов.
            </p>
            <a
              className="footer-map"
              href="https://yandex.ru/maps/?text=%D0%92%D0%BE%D0%BB%D0%BE%D0%B3%D0%B4%D0%B0%20%D0%9F%D0%B5%D1%80%D0%B2%D0%BE%D0%BC%D0%B0%D0%B9%D1%81%D0%BA%D0%B0%D1%8F%2042"
              target="_blank"
              rel="noreferrer"
            >
              <MapPin size={18} />
              <span>Вологда, ул. Первомайская, 42</span>
            </a>
          </div>
          <nav className="footer-navigation" aria-label="Ссылки в подвале">
            <h2>Всё об аренде</h2>
            <Link to="/catalog">Все автомобили</Link>
            <Link to="/conditions">Условия аренды</Link>
            <Link to="/account">Личный кабинет</Link>
          </nav>
          <nav className="footer-categories" aria-label="Классы автомобилей">
            <h2>Автомобиль под ваши планы</h2>
            <div className="footer-category-links">
              <Link to="/catalog?category=economy">На каждый день</Link>
              <Link to="/catalog?category=business">Бизнес-класс</Link>
              <Link to="/catalog?category=premium">Премиум</Link>
              <Link to="/catalog?category=suv">За город</Link>
            </div>
          </nav>
          <address className="footer-contacts">
            <h2>Мы на связи</h2>
            <a className="footer-support" href="mailto:viperr@angel.com">
              <Headphones size={20} /> Связаться с нами
            </a>
            <a className="footer-phone" href="tel:+79218287767">
              <Phone size={18} />
              <span>+7 (921)-828-77-67</span>
            </a>
            <a className="footer-email" href="mailto:viperr@angel.com">
              <Mail size={18} />
              <span>viperr@angel.com</span>
            </a>
          </address>
        </div>
        <div className="footer-owner">
          <p>
            <span>Владелец проекта</span> Баев Александр Павлович
          </p>
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
            Наверх
          </button>
        </div>
        <div className="footer-legal">
          <span>© {new Date().getFullYear()} NORDÉ</span>
          <p>
            Учебный проект. Контактные данные демонстрационные. Стоимость аренды
            и залог указаны в карточке автомобиля.
          </p>
        </div>
        <div className="footer-signature" aria-hidden="true">
          NORDÉ
        </div>
      </div>
    </footer>
  );
}
