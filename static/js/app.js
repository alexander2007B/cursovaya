import {
  demoApi,
  exportDemo
} from './demo-api.js';
import {
  canRent,
  LEGAL_VERSION
} from './demo-validation.js';
const $ = (s, root = document) => root.querySelector(s),
  $$ = (s, root = document) => [...root.querySelectorAll(s)];
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
} [c]));
const money = n => new Intl.NumberFormat('ru-RU', {
  style: 'currency',
  currency: 'RUB',
  maximumFractionDigits: 0
}).format(n || 0);
const date = s => s ? new Intl.DateTimeFormat('ru-RU', {
  timeZone: 'Europe/Moscow'
}).format(new Date(s.length === 10 ? s + 'T12:00:00Z' : s)) : '';
const day = (add = 0) => {
  const s = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Moscow'
  }).format(new Date());
  const d = new Date(s + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + add);
  return d.toISOString().slice(0, 10);
};
const categories = {
  economy: 'Эконом',
  comfort: 'Комфорт',
  business: 'Бизнес',
  premium: 'Премиум',
  suv: 'Кроссоверы'
};
const statuses = {
  new: 'Новая',
  confirmed: 'Подтверждена',
  active: 'В аренде',
  completed: 'Завершена',
  cancelled: 'Отменена',
  available: 'Доступен',
  maintenance: 'На обслуживании',
  broken: 'Неисправен',
  rented: 'В аренде'
};
const roles = {
  admin: 'Администратор',
  manager: 'Менеджер',
  client: 'Клиент'
};
const mode = document.body.dataset.mode,
  page = document.body.dataset.page;
let user = null,
  csrf = '',
  adminData = null,
  carData = null,
  photos = [],
  photoBusy = false,
  authMode = 'login',
  slideIndex = 0,
  slides = [],
  paused = false,
  hover = false,
  lastQuote = null,
  quoteGeneration = 0,
  pendingBooking = null;
const dialog = $('#dialog');
let backdropPressed = false,
  toastTimer;
async function api(path, {
  method = 'GET',
  body
} = {}) {
  if (mode === 'demo') return demoApi(path, {
    method,
    body
  });
  if (method !== 'GET' && !csrf) {
    const r = await fetch('/api/auth/session', {
      credentials: 'same-origin'
    });
    const data = await r.json();
    csrf = data.csrfToken;
  }
  const response = await fetch('/api' + path, {
    method,
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrf
    },
    ...(body === undefined ? {} : {
      body: JSON.stringify(body)
    })
  });
  const data = await response.json();
  if (!response.ok) throw Object.assign(new Error(data.message || 'Не удалось выполнить запрос'), {
    status: response.status,
    fields: data.fields
  });
  if (data.csrfToken) csrf = data.csrfToken;
  return data;
}

function notify(message) {
  clearTimeout(toastTimer);
  $('#toast').textContent = message;
  $('#toast').hidden = false;
  toastTimer = setTimeout(() => $('#toast').hidden = true, 4000);
}

function error(e, root = document) {
  const box = $('.error', root) || $('#page-error');
  box.textContent = [e.message, ...Object.values(e.fields || {}).flat()].join(' · ');
  box.hidden = false;
}

function clearError() {
  const e = $('#page-error');
  e.textContent = '';
  e.hidden = true;
}

function header() {
  $('#auth-header').innerHTML = user ? `<a class="account-link" href="/account">♙ ${esc(user.name.split(' ')[0])}</a><button class="icon-button logout" data-action="logout" aria-label="Выйти">↪</button>` : '<button class="button small outline" data-action="login">Войти</button>';
  $('#private-nav').innerHTML = user ? `<a href="/account">Мои поездки</a>${user.role!=='client'?'<a href="/admin">Управление</a>':''}` : '';
}

function openModal(title, html, wide = false) {
  dialog.className = 'modal' + (wide ? ' wide' : '');
  dialog.innerHTML = `<div class="modal-head"><h2 id="dialog-title">${esc(title)}</h2><button type="button" class="icon-button" aria-label="Закрыть" data-action="close">×</button></div>${html}`;
  if (!dialog.open) dialog.showModal();
  backdropPressed = false;
}

function closeModal() {
  dialog.close();
  dialog.innerHTML = '';
  backdropPressed = false;
}

function isBackdrop(e) {
  if (e.target !== dialog) return false;
  const r = dialog.getBoundingClientRect();
  return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
}
dialog.addEventListener('pointerdown', e => {
  backdropPressed = e.button === 0 && isBackdrop(e);
});
dialog.addEventListener('pointercancel', () => backdropPressed = false);
dialog.addEventListener('click', e => {
  if (backdropPressed && isBackdrop(e)) closeModal();
  backdropPressed = false;
});
dialog.addEventListener('cancel', e => {
  e.preventDefault();
  closeModal();
});

function field(label, name, value = '', type = 'text', extra = '') {
  return `<label class="field"><span>${label}</span><input name="${name}" type="${type}" value="${esc(value)}" ${extra}></label>`;
}

function eligibility(u = {}) {
  return `<fieldset><legend>Условия аренды</legend>${field('Стаж вождения, лет','drivingExperience',u.drivingExperience||'','number','min="1" max="80" required')}<label class="check"><input type="checkbox" name="ageConfirmed" ${u.ageConfirmed?'checked':''} required>Мне исполнился 21 год</label><label class="check"><input type="checkbox" name="licenseConfirmed" ${u.licenseConfirmed?'checked':''} required>У меня есть действующие водительские права</label></fieldset>`;
}

function consentFields() {
  return `<div class="registration-consent"><label class="check"><input type="checkbox" name="termsAccepted" required><span>Принимаю <a href="/terms.html" target="_blank" rel="noopener">пользовательское соглашение</a></span></label><label class="check"><input type="checkbox" name="personalDataConsent" required><span>Даю <a href="/consent.html" target="_blank" rel="noopener">согласие на обработку персональных данных</a> и ознакомлен с <a href="/privacy.html" target="_blank" rel="noopener">политикой конфиденциальности</a></span></label></div>`;
}

function showAuth(register = false) {
  authMode = register ? 'register' : 'login';
  openModal(register ? 'Регистрация' : 'С возвращением', `<p>Войдите, чтобы управлять вашими поездками.</p><div class="segmented"><button type="button" class="${register?'':'selected'}" data-action="auth-login">Вход</button><button type="button" class="${register?'selected':''}" data-action="auth-register">Регистрация</button></div><form id="auth-form" class="form-stack"><div class="error" role="alert" hidden></div>${register?field('Имя и фамилия','name','','text','minlength="2" maxlength="80" autocomplete="name" required placeholder="Александр Баев"')+field('Телефон','phone','','tel','required placeholder="+7 (900) 123-45-67"')+eligibility():''}${field('Email','email','','email','required autocomplete="email" placeholder="you@example.ru"')}${field('Пароль','password','','password','required minlength="8" maxlength="72" autocomplete="current-password"')}${register?consentFields():''}<button class="button primary full" type="submit" ${register?'disabled':''}>${register?'Создать аккаунт':'Войти'}</button></form>`);
}

function values(form) {
  return Object.fromEntries(new FormData(form));
}

function bools(form, d) {
  for (const k of ['ageConfirmed', 'licenseConfirmed', 'termsAccepted', 'personalDataConsent'])
    if (form.elements[k]) d[k] = form.elements[k].checked;
  if (d.drivingExperience !== undefined) d.drivingExperience = Number(d.drivingExperience);
  return d;
}

function favorites() {
  try {
    return JSON.parse(localStorage.getItem('norde-favorites') || '[]');
  } catch {
    return [];
  }
}

function favorite(id) {
  const a = favorites(),
    next = a.includes(id) ? a.filter(x => x !== id) : [...a, id];
  localStorage.setItem('norde-favorites', JSON.stringify(next));
  $$(`[data-favorite="${id}"]`).forEach(b => {
    b.textContent = next.includes(id) ? '♥' : '♡';
    b.setAttribute('aria-pressed', String(next.includes(id)));
  });
}

function card(c, query = '') {
  const target = '/cars/' + encodeURIComponent(c._id) + (query ? '?' + query : '');
  return `<article class="car-card ${esc(c.category)}" data-car-id="${esc(c._id)}"><button class="favorite" data-action="favorite" data-favorite="${esc(c._id)}" aria-label="В избранное ${esc(c.brand+' '+c.model)}" aria-pressed="${favorites().includes(c._id)}">${favorites().includes(c._id)?'♥':'♡'}</button><a class="car-visual" href="${esc(target)}" aria-label="Выбрать ${esc(c.brand+' '+c.model)}"><span class="car-category">${categories[c.category]||''}</span><span class="car-year">${c.year}</span><img src="${esc(c.image)}" alt="${esc(c.brand+' '+c.model)}" loading="lazy"></a><div class="car-info"><div class="car-title"><a href="${esc(target)}"><h3>${esc(c.brand+' '+c.model)}</h3></a><span>↗</span></div><div class="car-features"><span>${esc(c.transmission)}</span><span>${esc(c.fuel)}</span><span>${c.seats} мест</span></div><div class="car-bottom"><div><strong>${money(c.dailyRate)}</strong><span> / сутки</span></div><a class="round-link" href="${esc(target)}" aria-label="Открыть ${esc(c.brand+' '+c.model)}">↗</a></div></div></article>`;
}

function badge(status) {
  return `<span class="badge ${esc(status)}"><i></i>${statuses[status]||esc(status)}</span>`;
}
const empty = message => `<div class="empty"><h3>${message}</h3><p>Измените параметры или выберите автомобиль в каталоге.</p></div>`;
const featured = [
  ['Mercedes-Benz', 'GLB 200'],
  ['Geely', 'Cityray'],
  ['Audi', 'A5'],
  ['BMW', '520d xDrive'],
  ['BMW', 'M4 Competition'],
  ['Mercedes-Benz', 'CLS 250 d']
];

function stage() {
  const c = slides[slideIndex % slides.length];
  if (!c) {
    $('.fleet-stage').innerHTML = empty('На выбранные даты нет автомобилей');
    return;
  }
  const q = new URLSearchParams(new FormData($('#home-search'))).toString();
  $('.fleet-stage').innerHTML = `<div class="stage-photo"><img src="${esc(c.image)}" alt="${esc(c.brand+' '+c.model)}" fetchpriority="high"></div><div class="stage-shade"></div><div class="stage-top"><button class="icon-button" data-action="favorite" data-favorite="${c._id}" aria-label="В избранное">♡</button></div><div class="stage-information"><span class="stage-class">${categories[c.category]} · ${c.year}</span><h2>${esc(c.brand+' '+c.model)}</h2><div class="stage-bottom"><div><strong>${money(c.dailyRate)}</strong><span> / сутки</span></div><a class="button stage-link" href="/cars/${c._id}?${esc(q)}">Посмотреть авто ↗</a></div></div><div class="stage-controls"><button data-action="prev-slide" aria-label="Предыдущий автомобиль">←</button><span>${slideIndex%slides.length+1} / ${slides.length}</span><button data-action="next-slide" aria-label="Следующий автомобиль">→</button><button data-action="pause-slide" aria-label="${paused?'Продолжить':'Остановить'} смену автомобилей" aria-pressed="${paused}">${paused?'▶':'Ⅱ'}</button></div>`;
}
async function loadHome() {
  const form = $('#home-search');
  const data = values(form),
    q = new URLSearchParams(data).toString();
  const {
    cars
  } = await api('/cars?' + q);
  slides = featured.map(([b, m]) => cars.find(c => c.brand === b && c.model === m && c.status === 'available' && c.displayStatus !== 'rented')).filter(Boolean);
  slideIndex = 0;
  stage();
  $('#home-cars').innerHTML = slides.map(c => card(c, q)).join('') || empty('Попробуйте другие даты');
}
async function loadCatalog() {
  const q = new URLSearchParams(location.search);
  for (const key of ['search', 'from', 'to']) $('#catalog-filter').elements[key].value = q.get(key) || '';
  $('#sort').value = q.get('sort') || 'price';
  $$('[data-category]').forEach(b => b.classList.toggle('active', b.dataset.category === (q.get('category') || 'all')));
  let {
    cars
  } = await api('/cars?' + q);
  if (q.get('favorites') === '1') cars = cars.filter(c => favorites().includes(c._id));
  $('#car-count').textContent = 'Найдено автомобилей: ' + cars.length;
  $('#catalog-cars').innerHTML = cars.map(c => card(c, q)).join('') || empty(q.get('favorites') ? 'Добавьте автомобили в избранное' : 'Нет подходящих автомобилей');
}

function catalogQuery(update) {
  const q = new URLSearchParams(location.search);
  for (const [k, v] of Object.entries(update)) v ? q.set(k, v) : q.delete(k);
  history.replaceState(null, '', '/catalog' + (q.size ? '?' + q : ''));
  return loadCatalog();
}
async function loadCar() {
  carData = await api('/cars/' + document.body.dataset.carId);
  const c = carData.car,
    q = new URLSearchParams(location.search),
    images = [c.image, ...(c.gallery || [])].filter((x, i, a) => x && a.indexOf(x) === i);
  $('#car-detail').innerHTML = `<a class="back-link" href="/catalog">← Все автомобили</a><div class="detail-layout"><section><div class="detail-photo"><img id="main-photo" src="${esc(images[0])}" alt="${esc(c.brand+' '+c.model)}"></div><div class="car-gallery" aria-label="Фотографии автомобиля">${images.map((src,i)=>`<button type="button" data-action="gallery" data-src="${esc(src)}" aria-label="Показать фото ${i+1}" aria-pressed="${i===0}"><img src="${esc(src)}" alt=""></button>`).join('')}</div><div class="detail-title"><div class="eyebrow">${categories[c.category]} · ${c.year}</div><h1>${esc(c.brand+' '+c.model)}</h1><p>${esc(c.description)}</p></div><div class="spec-grid">${[['Коробка',c.transmission],['Топливо',c.fuel],['Мест',c.seats],['Пробег',c.mileage+' км']].map(([name,val])=>`<div><small>${name}</small><strong>${esc(val)}</strong></div>`).join('')}</div><div class="info-panel"><div><h3>Всё готово к вашей поездке</h3><p>ОСАГО включено. Оплата аренды и возвратный залог — при получении. Заявку подтвердит менеджер.</p><a class="text-link" href="/conditions">Все условия ↗</a></div></div><div class="reserved"><h3>Занятые периоды</h3>${carData.reservations.map(r=>`<span class="chip">${date(r.from)} — ${date(r.to)}</span>`).join('')||'<p>Нет забронированных периодов</p>'}</div></section><aside class="booking-panel"><h2>${money(c.dailyRate)} <small>/ сутки</small></h2><form id="booking-form" class="form-stack"><div class="error" role="alert" hidden></div><div class="form-row">${field('Получение','from',q.get('from')||day(),'date',`required min="${day()}"`)}${field('Возврат','to',q.get('to')||day(3),'date',`required min="${day(1)}"`)}</div><label class="check"><input type="checkbox" name="insurance">Расширенная защита: 600 ₽/сутки</label><label class="check"><input type="checkbox" name="childSeat">Детское кресло: 300 ₽/сутки</label><label class="field"><span>Комментарий</span><textarea name="comment" maxlength="500"></textarea></label><div id="quote-view" role="status">Рассчитываем стоимость…</div><p class="muted">Возвратный залог: ${money(c.deposit)}</p><button class="button primary full" disabled>Забронировать</button></form></aside></div>`;
  if (pendingBooking) {
    const form = $('#booking-form');
    for (const k of ['from', 'to', 'comment']) form.elements[k].value = pendingBooking[k] || '';
    for (const k of ['insurance', 'childSeat']) form.elements[k].checked = !!pendingBooking.extras[k];
    pendingBooking = null;
  }
  await updateQuote();
}

function bookingBody() {
  const f = $('#booking-form'),
    d = values(f);
  return {
    carId: document.body.dataset.carId,
    from: d.from,
    to: d.to,
    extras: {
      insurance: f.elements.insurance.checked,
      childSeat: f.elements.childSeat.checked
    },
    comment: d.comment || ''
  };
}
async function updateQuote() {
  const generation = ++quoteGeneration,
    form = $('#booking-form');
  if (!form) return;
  form.querySelector('button.primary').disabled = true;
  try {
    const q = await api('/quote', {
      method: 'POST',
      body: bookingBody()
    });
    if (generation !== quoteGeneration) return;
    lastQuote = q;
    $('#quote-view').innerHTML = `<p>${q.quote.days} сут. · ${money(q.quote.total)}</p>${q.available?'':'<p class="error">Автомобиль недоступен на эти даты</p>'}`;
    form.querySelector('button.primary').disabled = !q.available;
    $('div.error', form).hidden = true;
  } catch (e) {
    if (generation === quoteGeneration) {
      lastQuote = null;
      error(e, form);
      $('#quote-view').textContent = 'Проверьте даты аренды';
    }
  }
}
async function loadAccount() {
  if (!user) {
    $('#account-content').innerHTML = '<div class="empty"><h2>Войдите в аккаунт</h2><button class="button primary" data-action="login">Войти</button></div>';
    return;
  }
  const {
    rentals
  } = await api('/rentals');
  $('#account-content').innerHTML = `<div class="account-layout"><section>${rentals.map(r=>`<article class="rental-row"><h3>${esc(r.carName)}</h3><p>${esc(r.number)} · ${date(r.from)} — ${date(r.to)}</p>${badge(r.status)}<p>${money(r.quote.total)} · залог ${money(r.quote.deposit)}</p>${['new','confirmed'].includes(r.status)?`<button class="button outline" data-action="cancel-rental" data-id="${r._id}">Отменить заявку</button>`:''}<details><summary>История</summary>${r.history.map(h=>`<p>${statuses[h.status]} · ${date(h.at)}</p>`).join('')}</details></article>`).join('')||empty('Первые километры впереди')}</section><aside class="profile-card"><h3>Мой профиль</h3><p class="muted">${roles[user.role]}</p><form id="profile-form" class="form-stack"><div class="error" role="alert" hidden></div>${field('Имя и фамилия','name',user.name,'text','required minlength="2" maxlength="80"')}${field('Телефон','phone',user.phone,'tel','required')}${eligibility(user)}${field('Email','email',user.email,'email','disabled')}<button class="button outline full">Сохранить изменения</button></form></aside></div>`;
}

function table(headers, rows) {
  return `<div class="table-scroll"><table class="data-table"><thead><tr>${headers.map(x=>`<th>${x}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`;
}

function rentalActions(r) {
  return `<div class="actions">${r.status==='new'?`<button data-action="rental-status" data-status="confirmed" data-id="${r._id}">Подтвердить</button>`:''}${r.status==='confirmed'?`<button data-action="rental-status" data-status="active" data-id="${r._id}">Выдать авто</button>`:''}${r.status==='active'?`<button data-action="return-car" data-id="${r._id}" data-mileage="${r.car?.mileage||0}">Принять авто</button>`:''}${['new','confirmed'].includes(r.status)?`<button data-action="staff-cancel" data-id="${r._id}">Отменить</button>`:''}</div>`;
}
async function loadAdmin() {
  if (!user || user.role === 'client') {
    $('#admin-body').innerHTML = '<div class="empty"><h2>Доступ только для сотрудников</h2><button class="button primary" data-action="login">Войти</button></div>';
    return;
  }
  const tab = new URLSearchParams(location.search).get('tab') || 'overview';
  adminData = await api('/admin/overview');
  const {
    cars,
    rentals,
    stats,
    events
  } = adminData;
  const titles = {
    overview: 'Обзор',
    rentals: 'Бронирования',
    fleet: 'Автопарк',
    maintenance: 'Техобслуживание',
    users: 'Пользователи',
    events: 'Журнал событий'
  };
  $('#admin-title').textContent = titles[tab] || 'Обзор';
  $$('[data-tab]').forEach(a => {
    a.classList.toggle('active', a.dataset.tab === tab);
    a.hidden = a.dataset.tab === 'users' && user.role !== 'admin';
  });
  let html = '';
  if (tab === 'overview') {
    html = `<div class="stats-grid">${[['Автомобилей',stats.cars],['В аренде',stats.active],['Новых заявок',stats.pending],['Завершённые аренды',money(stats.revenue)]].map(([k,v])=>`<div class="stat-card"><span>${k}</span><strong>${v}</strong></div>`).join('')}</div><div class="panel-heading"><h2>Последние заявки</h2><a class="button outline" href="/admin?tab=rentals">Все бронирования</a></div>`;
  }
  if (tab === 'rentals' || tab === 'overview') html += table(['Заявка / клиент', 'Автомобиль', 'Период', 'Стоимость', 'Статус', 'Действия'], rentals.slice(0, tab === 'overview' ? 5 : rentals.length).map(r => `<tr><td><b>${esc(r.number)}</b><br>${esc(r.user?.name)}<br>${esc(r.user?.phone)}</td><td>${esc(r.carName)}</td><td>${date(r.from)} — ${date(r.to)}</td><td>${money(r.quote.total)}</td><td>${badge(r.status)}</td><td>${rentalActions(r)}</td></tr>`));
  if (tab === 'fleet') html = `<div class="panel"><div class="panel-heading"><h2>Управление автопарком</h2>${user.role==='admin'?'<button class="button primary" data-action="add-car">Добавить автомобиль</button>':''}</div>${table(['Автомобиль','Номер','Тариф','Пробег','Статус','Действия'],cars.map(c=>`<tr><td>${esc(c.brand+' '+c.model)}</td><td>${esc(c.plate)}</td><td>${money(c.dailyRate)}</td><td>${c.mileage} км</td><td>${badge(c.status)}</td><td><div class="actions"><button data-action="edit-car" data-id="${c._id}" aria-label="Изменить ${esc(c.brand+' '+c.model)}">Изменить</button>${user.role==='admin'?`<button data-action="archive-car" data-id="${c._id}">В архив</button>`:''}</div></td></tr>`))}</div>`;
  if (tab === 'maintenance') {
    const {
      records
    } = await api('/admin/maintenance');
    html = `<div class="panel"><div class="panel-heading"><h2>История осмотров</h2><button class="button primary" data-action="add-inspection">Добавить осмотр</button></div>${table(['Автомобиль','Узел','Износ','Пробег','Заключение','Дата'],records.map(r=>`<tr><td>${esc(r.car?.brand+' '+r.car?.model)}</td><td>${esc(r.node)}</td><td>${r.wear}%</td><td>${r.mileage} км</td><td>${esc(r.note)}</td><td>${date(r.createdAt)}</td></tr>`))}</div>`;
  }
  if (tab === 'users') {
    const {
      users
    } = await api('/admin/users');
    html = table(['Имя', 'Email', 'Телефон', 'Роль', 'Действие'], users.map(u => `<tr><td>${esc(u.name)}</td><td>${esc(u.email)}</td><td>${esc(u.phone)}</td><td>${roles[u.role]}</td><td>${u.id!==user.id?`<button class="button outline small" data-action="role" data-id="${u.id}" data-role="${u.role}">Изменить роль</button>`:'Это вы'}</td></tr>`));
  }
  if (tab === 'events') html = table(['Операция', 'Описание', 'Сотрудник', 'Дата'], events.map(e => `<tr><td>${esc(e.action)}</td><td>${esc(e.details)}</td><td>${esc(e.actor?.name)}</td><td>${date(e.createdAt)}</td></tr>`));
  $('#admin-body').innerHTML = html;
}

function options(values, current) {
  return values.map(([v, t]) => `<option value="${esc(v)}" ${v===current?'selected':''}>${esc(t)}</option>`).join('');
}

function select(label, name, opts) {
  return `<label class="field"><span>${label}</span><select name="${name}">${opts}</select></label>`;
}

function photoPreviews() {
  const target = $('#photo-previews');
  if (!target) return;
  target.innerHTML = photos.map((src, i) => `<div class="photo-preview"><img src="${esc(src)}" alt="Фото ${i+1} автомобиля"><span>${i?'Фото '+(i+1):'Главная'}</span><div class="photo-preview-actions">${i?`<button type="button" data-action="main-photo" data-index="${i}" ${photoBusy?'disabled':''}>Сделать главной</button>`:''}<button type="button" data-action="remove-photo" data-index="${i}" aria-label="Удалить фото ${i+1}" ${photoBusy?'disabled':''}>Удалить</button></div></div>`).join('');
  const input = $('dialog input[type=file]');
  input.disabled = photoBusy || photos.length >= 4;
  $('#photo-label').textContent = photoBusy ? 'Обрабатываем фотографии…' : `Добавить фотографии (${photos.length}/4)`;
  $('#car-save').disabled = photoBusy;
}

function showCar(id = '') {
  const c = adminData.cars.find(c => c._id === id) || {},
    admin = user.role === 'admin';
  photos = [c.image, ...(c.gallery || [])].filter(x => x && x !== '/images/sedan.svg');
  photoBusy = false;
  openModal(id ? 'Изменить автомобиль' : 'Добавить автомобиль', `<form id="car-form" data-id="${id}" class="form-stack"><div class="error" role="alert" hidden></div>${admin?`<div class="form-row">${field('Марка','brand',c.brand||'','text','required maxlength="40"')}${field('Модель','model',c.model||'','text','required maxlength="60"')}</div><div class="form-row">${field('Год выпуска','year',c.year||2024,'number',`required min="2000" max="${new Date().getFullYear()+1}"`)}${field('Госномер','plate',c.plate||'','text','required minlength="5" maxlength="15"')}</div><div class="form-row">${select('Класс','category',options(Object.entries(categories),c.category||'comfort'))}<div class="photo-field"><div class="photo-previews" id="photo-previews"></div><label class="photo-upload"><span id="photo-label"></span><input aria-label="Фотографии автомобиля" type="file" multiple accept="image/jpeg,image/png,image/webp"></label><small>До 4 фото: JPG, PNG, WebP до 4 МБ каждое. Первое фото будет обложкой.</small></div></div><div class="form-row">${field('Стоимость в сутки, ₽','dailyRate',c.dailyRate||3900,'number','required min="500" max="100000"')}${field('Залог, ₽','deposit',c.deposit??15000,'number','required min="0" max="500000"')}</div><div class="form-row">${field('Пробег, км','mileage',c.mileage||0,'number',`required min="${c.mileage||0}" max="2000000"`)}${field('Мест','seats',c.seats||5,'number','required min="2" max="9"')}</div><div class="form-row">${select('Коробка передач','transmission',options([['Автомат','Автомат'],['Механика','Механика']],c.transmission||'Автомат'))}${select('Топливо','fuel',options(['Бензин','Дизель','Гибрид','Электро'].map(x=>[x,x]),c.fuel||'Бензин'))}</div><label class="field"><span>Описание</span><textarea name="description" required minlength="10" maxlength="1500">${esc(c.description||'')}</textarea></label>`:''}${select('Технический статус','status',options([['available','Доступен'],['maintenance','На обслуживании'],['broken','Неисправен']],c.status||'available'))}<button id="car-save" class="button primary full">Сохранить автомобиль</button></form>`, true);
  if (admin) photoPreviews();
}
async function uploadPhotos(input) {
  const files = [...input.files];
  if (!files.length) return;
  photoBusy = true;
  photoPreviews();
  try {
    if (photos.length + files.length > 4) throw new Error('Можно добавить до 4 фотографий. Удалите лишнюю или выберите меньше файлов.');
    for (const f of files)
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(f.type) || f.size > 4 * 1024 * 1024) throw new Error('Выберите JPG, PNG или WebP до 4 МБ каждый');
    for (const f of files) {
      const bitmap = await createImageBitmap(f);
      if (bitmap.width * bitmap.height > 20000000) {
        bitmap.close();
        throw new Error('Максимум 20 мегапикселей на фотографию');
      }
      const canvas = document.createElement('canvas'),
        scale = Math.min(1, 1400 / bitmap.width, 1000 / bitmap.height);
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      bitmap.close();
      const result = await api('/admin/photos', {
        method: 'POST',
        body: {
          data: canvas.toDataURL('image/webp', .82)
        }
      });
      photos.push(result.image);
    }
    $('.error', dialog).hidden = true;
  } catch (e) {
    error(e, dialog);
  } finally {
    photoBusy = false;
    input.value = '';
    photoPreviews();
  }
}

function showInspection() {
  openModal('Добавить осмотр', `<form id="inspection-form" class="form-stack"><div class="error" role="alert" hidden></div>${select('Автомобиль','carId',adminData.cars.map(c=>`<option value="${c._id}">${esc(c.brand+' '+c.model+' · '+c.plate+' · '+c.mileage+' км')}</option>`).join(''))}${select('Узел','node',options(['Двигатель','Тормоза','Подвеска','Шины','Кузов','Плановое ТО'].map(x=>[x,x]),'Тормоза'))}<div class="form-row">${field('Износ, %','wear',0,'number','required min="0" max="100"')}${field('Пробег, км','mileage',adminData.cars[0]?.mileage||0,'number','required min="0" max="2000000"')}</div><label class="field"><span>Заключение</span><textarea name="note" required minlength="3" maxlength="1000"></textarea></label><button class="button primary full">Сохранить осмотр</button></form>`);
}

function confirmAction(title, text, action, id) {
  openModal(title, `<p>${esc(text)}</p><div class="error" role="alert" hidden></div><div class="modal-actions"><button class="button outline" data-action="close">Назад</button><button class="button primary" data-action="${action}" data-id="${id}">Подтвердить</button></div>`);
}
async function mutate(path, method, body, message) {
  await api(path, {
    method,
    body
  });
  closeModal();
  notify(message);
  await loadPage();
}
async function loadPage() {
  clearError();
  if (page === 'home') await loadHome();
  if (page === 'catalog') await loadCatalog();
  if (page === 'car') await loadCar();
  if (page === 'account') await loadAccount();
  if (page === 'admin') await loadAdmin();
}
// All dialogs require a pointer press AND release on the backdrop to close.
// Dragging text out of a field cannot dismiss the dialog.
document.addEventListener('click', async e => {
  const b = e.target.closest('[data-action]');
  if (!b) return;
  const a = b.dataset.action;
  try {
    if (a === 'login') showAuth();
    if (a === 'auth-login') showAuth();
    if (a === 'auth-register') showAuth(true);
    if (a === 'close') closeModal();
    if (a === 'menu') {
      const n = $('.header .nav');
      n.classList.toggle('open');
      b.setAttribute('aria-expanded', String(n.classList.contains('open')));
    }
    if (a === 'top') window.scrollTo({
      top: 0,
      behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'
    });
    if (a === 'city') openModal('Получение и возврат', '<p>Вологда, ул. Первомайская, 42. Перед приездом согласуйте выдачу с менеджером.</p><a class="button primary" href="/conditions">Условия аренды</a>');
    if (a === 'search') openModal('Найти автомобиль', '<form id="quick-search" class="form-stack">' + field('Марка или модель', 'search', '', 'search', 'placeholder="Например, BMW"') + '<button class="button primary">Найти машину</button></form>');
    if (a === 'logout') {
      await api('/auth/logout', {
        method: 'POST',
        body: {}
      });
      user = null;
      csrf = '';
      header();
      await loadPage();
    }
    if (a === 'favorite') favorite(b.dataset.favorite);
    if (a === 'category') await catalogQuery({
      category: b.dataset.category === 'all' ? '' : b.dataset.category
    });
    if (a === 'prev-slide' || a === 'next-slide') {
      slideIndex = (slideIndex + (a === 'prev-slide' ? -1 : 1) + slides.length) % slides.length;
      stage();
    }
    if (a === 'pause-slide') {
      paused = !paused;
      stage();
    }
    if (a === 'gallery') {
      $('#main-photo').src = b.dataset.src;
      $$('.car-gallery button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    }
    if (a === 'add-car') showCar();
    if (a === 'edit-car') showCar(b.dataset.id);
    if (a === 'add-inspection') showInspection();
    if (a === 'remove-photo') {
      photos.splice(Number(b.dataset.index), 1);
      photoPreviews();
    }
    if (a === 'main-photo') {
      const i = Number(b.dataset.index);
      photos.unshift(...photos.splice(i, 1));
      photoPreviews();
    }
    if (a === 'cancel-rental' || a === 'staff-cancel') confirmAction('Отменить бронирование?', 'Автомобиль больше не будет закреплён за клиентом.', 'confirm-cancel', b.dataset.id);
    if (a === 'confirm-cancel') await mutate('/rentals/' + b.dataset.id + '/status', 'PATCH', {
      status: 'cancelled'
    }, 'Бронирование отменено');
    if (a === 'archive-car') confirmAction('Убрать автомобиль в архив?', 'Автомобиль исчезнет из каталога, история сохранится.', 'confirm-archive', b.dataset.id);
    if (a === 'confirm-archive') await mutate('/admin/cars/' + b.dataset.id, 'DELETE', undefined, 'Автомобиль в архиве');
    if (a === 'rental-status') await mutate('/rentals/' + b.dataset.id + '/status', 'PATCH', {
      status: b.dataset.status
    }, 'Статус обновлён');
    if (a === 'return-car') openModal('Принять автомобиль', `<form id="return-form" data-id="${b.dataset.id}" class="form-stack"><div class="error" role="alert" hidden></div>${field('Пробег при возврате, км','returnMileage',b.dataset.mileage,'number',`required min="${b.dataset.mileage}" max="2000000"`)}<button class="button primary">Завершить аренду</button></form>`);
    if (a === 'role') openModal('Изменить права пользователя', `<form id="role-form" data-id="${b.dataset.id}" class="form-stack"><div class="error" role="alert" hidden></div>${select('Роль','role',options(Object.entries(roles),b.dataset.role))}<button class="button primary">Сохранить роль</button></form>`);
  } catch (err) {
    error(err, dialog.open ? dialog : document);
  }
});
document.addEventListener('submit', async e => {
  const form = e.target;
  if (!form.id) return;
  e.preventDefault();
  const submit = $('button[type=submit],button.primary,button.full', form);
  if (submit?.disabled) return;
  let d = values(form);
  try {
    if (form.id === 'home-search') {
      location.assign('/catalog?' + new URLSearchParams(d));
      return;
    }
    if (form.id === 'catalog-filter') {
      await catalogQuery(d);
      return;
    }
    if (form.id === 'quick-search') {
      location.assign('/catalog?' + new URLSearchParams(d));
      return;
    }
    if (submit) submit.disabled = true;
    if (form.id === 'auth-form') {
      if (authMode === 'register') {
        bools(form, d);
        d.legalVersion = LEGAL_VERSION;
      }
      const r = await api('/auth/' + authMode, {
        method: 'POST',
        body: d
      });
      user = r.user;
      closeModal();
      header();
      notify('Вы вошли в аккаунт');
      await loadPage();
    }
    if (form.id === 'profile-form') {
      bools(form, d);
      user = (await api('/profile', {
        method: 'PATCH',
        body: d
      })).user;
      header();
      notify('Профиль сохранён');
    }
    if (form.id === 'booking-form') {
      if (!user) {
        pendingBooking = bookingBody();
        showAuth(true);
        return;
      }
      if (!canRent(user)) throw new Error('Подтвердите возраст, права и стаж в профиле');
      const r = await api('/rentals', {
        method: 'POST',
        body: bookingBody()
      });
      openModal('Заявка сохранена', `<p>Бронирование ${esc(r.rental.number)} принято. Менеджер подтвердит заявку.</p><a class="button primary full" href="/account">Мои поездки</a>`);
    }
    if (form.id === 'car-form') {
      if (photoBusy) return;
      if (user.role === 'admin') {
        for (const k of ['year', 'dailyRate', 'deposit', 'mileage', 'seats']) d[k] = Number(d[k]);
        d.image = photos[0] || '/images/sedan.svg';
        d.gallery = photos.slice(1);
      }
      await mutate('/admin/cars' + (form.dataset.id ? '/' + form.dataset.id : ''), form.dataset.id ? 'PATCH' : 'POST', d, 'Автомобиль сохранён');
    }
    if (form.id === 'inspection-form') {
      d.wear = Number(d.wear);
      d.mileage = Number(d.mileage);
      await mutate('/admin/maintenance', 'POST', d, 'Осмотр сохранён');
    }
    if (form.id === 'return-form') await mutate('/rentals/' + form.dataset.id + '/status', 'PATCH', {
      status: 'completed',
      returnMileage: Number(d.returnMileage)
    }, 'Аренда завершена');
    if (form.id === 'role-form') await mutate('/admin/users/' + form.dataset.id, 'PATCH', d, 'Роль обновлена');
  } catch (err) {
    error(err, form);
  } finally {
    if (submit) submit.disabled = form.id === 'auth-form' && authMode === 'register' && form.isConnected ? !(form.elements.termsAccepted.checked && form.elements.personalDataConsent.checked) : false;
  }
});
document.addEventListener('change', async e => {
  const el = e.target;
  try {
    if (el.closest('#auth-form') && authMode === 'register') {
      $('#auth-form button.primary').disabled = !($('#auth-form [name=termsAccepted]').checked && $('#auth-form [name=personalDataConsent]').checked);
    }
    if (el.closest('#booking-form') && el.name !== 'comment') await updateQuote();
    if (el.matches('dialog input[type=file]')) await uploadPhotos(el);
    if (el.id === 'sort') await catalogQuery({
      sort: el.value
    });
    if (el.closest('#home-search') && el.type === 'date') await loadHome();
    if (el.closest('#inspection-form') && el.name === 'carId') {
      $('#inspection-form [name=mileage]').value = adminData.cars.find(c => c._id === el.value)?.mileage || 0;
    }
  } catch (err) {
    error(err, dialog.open ? dialog : document);
  }
});
if ($('#export-link')) $('#export-link').addEventListener('click', async e => {
  if (mode === 'demo') {
    e.preventDefault();
    try {
      await exportDemo();
    } catch (err) {
      error(err);
    }
  }
});
addEventListener('scroll', () => $('.header').classList.toggle('is-scrolled', scrollY > 40), {
  passive: true
});
if (page === 'home') {
  $('#home-search [name=from]').value = day();
  $('#home-search [name=to]').value = day(3);
  $$('#home-search input').forEach(i => i.min = day());
  $('.fleet-stage').addEventListener('mouseenter', () => hover = true);
  $('.fleet-stage').addEventListener('mouseleave', () => hover = false);
  setInterval(() => {
    if (slides.length > 1 && !paused && !hover && !document.hidden && !dialog.open && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      slideIndex = (slideIndex + 1) % slides.length;
      stage();
    }
  }, 4000);
}
try {
  const r = await api('/auth/session');
  user = r.user;
  header();
  await loadPage();
} catch (err) {
  error(err);
}
