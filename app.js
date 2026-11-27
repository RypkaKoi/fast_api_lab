
window.CREMA = (function () {
  'use strict';
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fmt = n => Number(n || 0).toLocaleString('ru-RU');
  const uid = p => (p || 'id') + '-' + Math.random().toString(36).slice(2, 8);
  const clone = o => JSON.parse(JSON.stringify(o));
  const plural = (n, f) => { const m = n % 10, h = n % 100; return m === 1 && h !== 11 ? f[0] : m >= 2 && m <= 4 && (h < 12 || h > 14) ? f[1] : f[2]; };

  /* ── справочники ── */
  const LTYPE = {
    espresso: { c: '#4a2a15', label: 'Эспрессо' }, milk: { c: '#f3e6cf', label: 'Молоко' },
    foam: { c: '#fbf3e2', label: 'Пена', pat: 'pat-foam' }, water: { c: '#6fa7cc', label: 'Вода' },
    ice: { c: '#cfe9f4', label: 'Лёд', pat: 'pat-ice' }, cream: { c: '#f6e7c8', label: 'Сливки' },
    chocolate: { c: '#6b3f1e', label: 'Шоколад' }, syrup: { c: '#c8a468', label: 'Сироп' }
  };
  const GRADS = ['g-arabica', 'g-robusta', 'g-liberica', 'g-excelsa', 'g-geisha', 'g-bourbon'];
  const TONES = [['tag-brass', 'Латунь'], ['tag-dark', 'Тёмный'], ['tag-brick', 'Кирпич']];
  const CATS = [['classic', 'Классика'], ['milk', 'Молочные'], ['cold', 'Холодные'], ['dessert', 'Десертные']];
  const METHODS = ['V60', 'Аэропресс', 'Кемекс', 'Эспрессо', 'Френч-пресс', 'Турка', 'Мока', 'Фильтр', 'Колд брю'];

  /* ── стартовый каталог (те же записи, что на витрине) ── */
  const DEF_V = [
    { id: 'arabica', name: 'Арабика', latin: 'Coffea arabica', kind: 'Арабика', tone: 'tag-brass', tags: ['arabica'], grad: 'g-arabica', rot: -18, origin: 'Эфиопия', region: 'Йиргачефф', alt: '1900–2200 м', process: 'Мытая', caff: 1.2, roast: 'Светлая–средняя', rating: 4.8, price: 890, pop: 98, notes: ['жасмин', 'лимон', 'чёрный чай'], profile: { acid: 85, body: 55, sweet: 70, bitter: 20 }, brew: ['V60', 'Аэропресс', 'Кемекс'], desc: 'Родина арабики — высокогорные леса Эфиопии. Именно этот вид дал миру большинство спешелти-лотов: сложная кислотность, цветочные и фруктовые ноты, деликатное тело. Мытая обработка Йиргачеффа подчёркивает жасмин и цитрус — классика для фильтра.' },
    { id: 'robusta', name: 'Робуста', latin: 'Coffea canephora', kind: 'Робуста', tone: 'tag-dark', tags: ['robusta'], grad: 'g-robusta', rot: 14, origin: 'Вьетнам', region: 'Даклак', alt: '500–800 м', process: 'Натуральная', caff: 2.4, roast: 'Тёмная', rating: 4.5, price: 590, pop: 84, notes: ['горький шоколад', 'орех', 'табак'], profile: { acid: 25, body: 90, sweet: 40, bitter: 85 }, brew: ['Эспрессо', 'Мока', 'Турка'], desc: 'Кофеина почти вдвое больше, чем у арабики, а хлорогеновые кислоты дают плотную горчинку и орехово-табачный профиль. Качественная робуста — фундамент эспрессо-блендов: она отвечает за густую крема и шоколадное послевкусие.' },
    { id: 'liberica', name: 'Либерика', latin: 'Coffea liberica', kind: 'Либерика', tone: 'tag-brick', tags: ['rare'], grad: 'g-liberica', rot: -30, origin: 'Филиппины', region: 'Батангас', alt: '300–600 м', process: 'Натуральная', caff: 1.0, roast: 'Средняя', rating: 4.3, price: 1190, pop: 55, notes: ['джекфрут', 'дым', 'цветочный мёд'], profile: { acid: 45, body: 70, sweet: 60, bitter: 45 }, brew: ['Френч-пресс', 'Турка'], desc: 'Самый редкий коммерческий вид: менее 2% мирового урожая. Крупные асимметричные зёрна дают экзотический профиль — джекфрут, цветочный мёд и лёгкая дымность. На Филиппинах этот кофе называют «капенг барако».' },
    { id: 'excelsa', name: 'Эксцельса', latin: 'Coffea excelsa', kind: 'Эксцельса', tone: 'tag-brick', tags: ['rare'], grad: 'g-excelsa', rot: 22, origin: 'Малайзия', region: 'Саравак', alt: '400–900 м', process: 'Хани', caff: 0.9, roast: 'Средняя', rating: 4.2, price: 990, pop: 48, notes: ['зелёное яблоко', 'тарт', 'сухофрукты'], profile: { acid: 75, body: 50, sweet: 55, bitter: 30 }, brew: ['Фильтр', 'Вьетнамский фин'], desc: 'Ботанически — разновидность либерики, но в чашке ведёт себя иначе: яркая фруктовая кислотность, зелёное яблоко и сухофрукты. В блендах Юго-Восточной Азии эксцельсу используют ради верхних нот и сложности аромата.' },
    { id: 'geisha', name: 'Гейша', latin: 'Coffea arabica · Geisha', kind: 'Микролот · арабика', tone: 'tag-brass', tags: ['arabica', 'rare'], grad: 'g-geisha', rot: -12, origin: 'Панама', region: 'Бокете', alt: '1600–1800 м', process: 'Мытая', caff: 1.1, roast: 'Светлая', rating: 4.9, price: 2490, pop: 92, notes: ['жасмин', 'бергамот', 'персик'], profile: { acid: 90, body: 40, sweet: 80, bitter: 10 }, brew: ['V60', 'Кемекс'], desc: 'Легендарный сорт из панамского Бокете: жасмин, бергамот и персиковая сладость. Лоты гейши устанавливают ценовые рекорды на аукционе Best of Panama. Обжарка максимально светлая, чтобы сохранить цветочную ароматику.' },
    { id: 'bourbon', name: 'Бурбон', latin: 'Coffea arabica · Bourbon', kind: 'Арабика · бурбон', tone: 'tag-brass', tags: ['arabica'], grad: 'g-bourbon', rot: 30, origin: 'Руанда', region: 'Ньямасеке', alt: '1700–2000 м', process: 'Мытая', caff: 1.3, roast: 'Средняя', rating: 4.7, price: 1090, pop: 88, notes: ['молочный шоколад', 'карамель', 'апельсин'], profile: { acid: 60, body: 65, sweet: 85, bitter: 25 }, brew: ['Эспрессо', 'Аэропресс', 'Френч-пресс'], desc: 'Одна из старейших культурных разновидностей арабики: плотная карамельная сладость, молочный шоколад и мягкая апельсиновая кислотность. Универсален — одинаково хорош в эспрессо, фильтре и молочных напитках.' }
  ];
  const DEF_D = [
    { id: 'espresso', name: 'Эспрессо', cats: ['classic'], vol: 30, caff: 63, str: 5, price: 150, time: '30 сек', temp: '67–70 °C', layers: [{ t: 'espresso', ml: 30 }], steps: ['Прогрейте чашку и группу машины.', 'Смолите 18 г кофе в тонкий помол, распределите и утрамбуйте.', 'Экстрагируйте 25–30 секунд до 36–40 г напитка.', 'Подавайте сразу — крема сохраняется меньше минуты.'], tip: 'Ориентир — соотношение 1:2 и струйка цвета тёплого мёда.' },
    { id: 'americano', name: 'Американо', cats: ['classic'], vol: 180, caff: 63, str: 3, price: 160, time: '1 мин', temp: '85 °C', layers: [{ t: 'water', ml: 150 }, { t: 'espresso', ml: 30 }], steps: ['Приготовьте эспрессо или доппио.', 'Нагрейте воду до 90–92 °C.', 'Влейте эспрессо в воду — так крема сохранится.'], tip: 'Порядок «вода → эспрессо» называется long black и даёт более плотную крема.' },
    { id: 'cappuccino', name: 'Капучино', cats: ['milk'], vol: 180, caff: 63, str: 3, price: 220, time: '3 мин', temp: '60–65 °C', layers: [{ t: 'espresso', ml: 30 }, { t: 'milk', ml: 90 }, { t: 'foam', ml: 60 }], steps: ['Приготовьте эспрессо в прогретую чашку 180 мл.', 'Взбейте молоко до 60–65 °C с плотной пеной около сантиметра.', 'Влейте молоко по центру, пену довершите свободным наливом.'], tip: 'Классическая пропорция — треть эспрессо, треть молока, треть пены.' },
    { id: 'latte', name: 'Латте', cats: ['milk'], vol: 300, caff: 63, str: 2, price: 240, time: '3 мин', temp: '60–65 °C', layers: [{ t: 'milk', ml: 250 }, { t: 'espresso', ml: 30 }, { t: 'foam', ml: 20 }], steps: ['Взбейте молоко до тонкой глянцевой пены 0,5 см.', 'Влейте молоко в бокал, оставив место для кофе.', 'Тонкой струйкой добавьте эспрессо — получатся слои латте-макиато.'], tip: 'Для латте-арта пена должна быть глянцевой, как свежая краска.' },
    { id: 'flatwhite', name: 'Флэт уайт', cats: ['milk'], vol: 160, caff: 126, str: 4, price: 260, time: '3 мин', temp: '60 °C', layers: [{ t: 'espresso', ml: 60, label: 'Доппио' }, { t: 'milk', ml: 95 }, { t: 'foam', ml: 5, label: 'Микропена' }], steps: ['Приготовьте доппио — двойной эспрессо 60 мл.', 'Взбейте 100 мл молока с микропеной не толще 5 мм.', 'Свободный налив: питчер ближе к поверхности, рисунок по желанию.'], tip: 'Флэт уайт — про кофе: молока меньше, пена тоньше, вкус ярче, чем в латте.' },
    { id: 'raf', name: 'Раф', cats: ['milk', 'dessert'], vol: 250, caff: 63, str: 2, price: 290, time: '4 мин', temp: '65 °C', layers: [{ t: 'espresso', ml: 30 }, { t: 'cream', ml: 180, label: 'Сливки 11%' }, { t: 'foam', ml: 40 }], steps: ['В питчер: эспрессо, сливки 11% и ванильный сахар.', 'Взбейте всё вместе до 65 °C — раф взбивается целиком.', 'Перелейте в прогретую чашку с плотной сливочной пеной.'], tip: 'Раф создан в Москве в 1990-х — единственный напиток, где сливки взбиваются вместе с кофе.' },
    { id: 'mocha', name: 'Мокка', cats: ['dessert'], vol: 280, caff: 75, str: 3, price: 300, time: '5 мин', temp: '65 °C', layers: [{ t: 'chocolate', ml: 30 }, { t: 'espresso', ml: 30 }, { t: 'milk', ml: 180 }, { t: 'foam', ml: 40 }], steps: ['Растопите шоколад или влейте сироп на дно чашки.', 'Добавьте эспрессо и размешайте до однородности.', 'Влейте взбитое молоко, завершите пеной и какао-крошкой.'], tip: 'Тёмный шоколад 70% делает мокку менее приторной и более глубокой.' },
    { id: 'coldbrew', name: 'Колд брю', cats: ['cold'], vol: 300, caff: 155, str: 4, price: 280, time: '16–18 ч', temp: '4–6 °C', layers: [{ t: 'water', ml: 100 }, { t: 'espresso', ml: 100, label: 'Концентрат' }, { t: 'ice', ml: 100 }], steps: ['80 г крупного помола залейте литром воды комнатной температуры.', 'Настаивайте 16–18 часов в холодильнике.', 'Отфильтруйте, разбавьте концентрат 1:1 и подавайте со льдом.'], tip: 'Холодная экстракция почти не извлекает горечь — напиток слаще и мягче горячего фильтра.' },
    { id: 'esptonic', name: 'Эспрессо-тоник', cats: ['cold'], vol: 300, caff: 126, str: 3, price: 270, time: '2 мин', temp: '4–6 °C', layers: [{ t: 'water', ml: 150, label: 'Тоник' }, { t: 'espresso', ml: 60, label: 'Доппио' }, { t: 'ice', ml: 90 }], steps: ['Наполните высокий бокал льдом.', 'Влейте 150 мл тоника.', 'Аккуратно добавьте доппио по ложке — слои разделятся.'], tip: 'Используйте нейтральный тоник без выраженного хинина — он конфликтует с кислотностью кофе.' }
  ];

  /* ── хранилище ── */
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { } }
  };

  /* ── API ── */
  async function api(path, method, body) {
    const opt = { method: method || 'GET', headers: {}, cache: 'no-store', credentials: 'same-origin' };
    if (body !== undefined) { opt.headers['Content-Type'] = 'application/json'; opt.body = JSON.stringify(body); }
    const r = await fetch(path, opt);
    let data = null;
    try { data = await r.json(); } catch (e) { }
    if (!r.ok) { const err = new Error((data && data.detail) || ('HTTP ' + r.status)); err.status = r.status; err.data = data; throw err; }
    return data;
  }

  /* ── фон: бесшовные зёрна ── */
  function texture() {
    let a = 20261126; const rnd = () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    const W = 680, pal = ['#2a190c', '#31200f', '#382412', '#402a15', '#241408', '#46301a', '#33200e', '#2e1c0e'], sc = ['.72', '.82', '.92', '1.02', '1.12'];
    const beans = [], cell = W / 9;
    for (let gy = 0; gy < 9; gy++) for (let gx = 0; gx < 9; gx++) {
      const cx = gx * cell + cell / 2 + (rnd() * 44 - 22), cy = gy * cell + cell / 2 + (rnd() * 44 - 22);
      beans.push([cx, cy, Math.floor(rnd() * 180), sc[Math.floor(rnd() * 5)], pal[Math.floor(rnd() * 8)]]);
      if (rnd() < .42) beans.push([cx + (rnd() * 60 - 30), cy + (rnd() * 60 - 30), Math.floor(rnd() * 180), sc[Math.floor(rnd() * 3)], pal[Math.floor(rnd() * 8)]]);
    }
    let u = '';
    beans.forEach(([x, y, r, s, c]) => { for (const dx of [-W, 0, W]) for (const dy of [-W, 0, W]) { const X = x + dx, Y = y + dy; if (X > -42 && X < W + 42 && Y > -42 && Y < W + 42) u += `<use href='#b' transform='translate(${Math.round(X)},${Math.round(Y)})rotate(${r})scale(${s})' color='${c}'/>`; } });
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='680' height='680'><defs><radialGradient id='s' cx='.36' cy='.32' r='.95'><stop offset='0' stop-color='#fff' stop-opacity='.13'/><stop offset='.55' stop-color='#fff' stop-opacity='0'/><stop offset='1' stop-color='#000' stop-opacity='.4'/></radialGradient><g id='b'><ellipse rx='20' ry='27' fill='currentColor'/><ellipse rx='20' ry='27' fill='url(#s)'/><path d='M0,-24C-7,-9,7,9,0,24' fill='none' stroke='#120a05' stroke-width='4' stroke-linecap='round'/><path d='M3,-21C-3,-8,9,8,3,21' fill='none' stroke='#000' opacity='.22' stroke-width='2'/><ellipse cx='-7' cy='-10' rx='7' ry='10' fill='#fff' opacity='.05'/></g></defs><rect width='680' height='680' fill='#171009'/>${u}</svg>`;
    document.documentElement.style.setProperty('--beans-tex', 'url("data:image/svg+xml,' + encodeURIComponent(svg) + '")');
  }

  /* ── оболочка ── */
  function shell() {
    texture();
    const sh = $('#sh');
    if (sh) { const f = () => sh.classList.toggle('scrolled', scrollY > 8); addEventListener('scroll', f, { passive: true }); f(); }
    const b = $('#burger'), m = $('#mmenu');
    if (b && m) {
      b.addEventListener('click', () => {
        const open = !document.documentElement.classList.contains('menu-open');
        document.documentElement.classList.toggle('menu-open', open);
        document.documentElement.classList.toggle('locked', open);
        b.setAttribute('aria-expanded', open); m.setAttribute('aria-hidden', !open);
      });
      $$('#mmenu a').forEach(a => a.addEventListener('click', () => {
        document.documentElement.classList.remove('menu-open', 'locked');
        b.setAttribute('aria-expanded', 'false'); m.setAttribute('aria-hidden', 'true');
      }));
      document.addEventListener('keydown', e => { if (e.key === 'Escape' && document.documentElement.classList.contains('menu-open')) b.click(); });
    }
  }

  /* ── тосты ── */
  function toast(msg, action, bad) {
    let box = $('#toasts');
    if (!box) { box = document.createElement('div'); box.id = 'toasts'; box.setAttribute('aria-live', 'polite'); document.body.appendChild(box); }
    while (box.children.length >= 3) box.firstChild.remove();
    const t = document.createElement('div');
    t.className = 'toast' + (bad ? ' bad' : '');
    t.innerHTML = `<svg class="ic"><use href="#i-${bad ? 'alert' : 'check'}"/></svg><p></p>` + (action ? `<button class="t-act" type="button">${esc(action.label)}</button>` : '');
    t.querySelector('p').textContent = msg;
    box.appendChild(t);
    const kill = () => { t.classList.add('out'); setTimeout(() => t.remove(), 300); };
    const timer = setTimeout(kill, action ? 6500 : 3800);
    if (action) t.querySelector('.t-act').addEventListener('click', () => { clearTimeout(timer); action.fn(); kill(); });
    return kill;
  }

  /* ── графика ── */
  const beanSVG = (grad, rot, cls) => `<svg class="bean-ic ${cls || ''}" viewBox="0 0 80 80" style="--rot:${rot || -18}deg" aria-hidden="true"><use href="#bean-fill" fill="url(#${grad || 'g-bourbon'})"/></svg>`;
  let gseq = 0;
  function glassSVG(layers, big) {
    const gid = 'gc' + (++gseq);
    const X = 22, W = 52, TOP = 16, BOT = 138, H = BOT - TOP;
    const ls = (layers && layers.length) ? layers : [{ t: 'espresso', ml: 30 }];
    const total = ls.reduce((s, l) => s + (+l.ml || 0), 0) || 1;
    let y = BOT, rects = '';
    const hasIce = ls.some(l => l.t === 'ice');
    ls.forEach(l => {
      const h = (+l.ml || 0) / total * H; y -= h; const T = LTYPE[l.t] || LTYPE.espresso;
      rects += `<rect x="${X}" y="${y.toFixed(1)}" width="${W}" height="${(h + .5).toFixed(1)}" fill="${T.c}"/>`;
      if (T.pat) rects += `<rect x="${X}" y="${y.toFixed(1)}" width="${W}" height="${(h + .5).toFixed(1)}" fill="url(#${T.pat})"/>`;
      if (l.t === 'espresso') rects += `<rect x="${X}" y="${y.toFixed(1)}" width="${W}" height="2.6" fill="#d9a05b"/>`;
    });
    const straw = hasIce ? '<path d="M66 3L55 62" stroke="#a14e2e" stroke-width="5" stroke-linecap="round"/>' : '';
    return `<svg class="glass${big ? ' glass-lg' : ''}" viewBox="0 0 96 150" aria-hidden="true"><defs><clipPath id="${gid}"><rect x="20" y="14" width="56" height="126" rx="8"/></clipPath></defs>${straw}<g clip-path="url(#${gid})">${rects}</g><rect x="20" y="14" width="56" height="126" rx="8" fill="none" stroke="rgba(239,230,212,.5)" stroke-width="2"/><path d="M30 26v100" stroke="rgba(255,255,255,.2)" stroke-width="3" stroke-linecap="round"/></svg>`;
  }
  const compList = layers => '<div class="comp">' + (layers || []).map(l => {
    const T = LTYPE[l.t] || LTYPE.espresso;
    const pat = T.pat === 'pat-foam' ? ' sw-foam' : T.pat === 'pat-ice' ? ' sw-ice' : '';
    const st = pat ? '' : ` style="background:${T.c}"`;
    return `<div><span class="sw2${pat}"${st}></span>${esc(l.label || T.label)}<b>${l.ml} мл</b></div>`;
  }).join('') + '</div>';

  const ic = n => `<svg class="ic"><use href="#i-${n}"/></svg>`;
  function cardV(v) {
    const p = v.profile || {};
    const bar = (l, x) => `<div class="vb-row"><label>${l}</label><div class="bar"><i style="width:${Math.max(0, Math.min(100, x || 0))}%"></i></div></div>`;
    return `<article class="v-card"><div class="vc-top"><span class="tag ${esc(v.tone || 'tag-brass')}">${esc(v.kind || 'Сорт')}</span><span class="rate">${ic('star')}${(v.rating || 0).toFixed(1)}</span></div>
      <div class="vc-id">${beanSVG(v.grad, v.rot)}<div><h3>${esc(v.name)}</h3><small>${esc(v.latin || '')}</small></div></div>
      <div class="vc-meta"><div>${ic('pin')}${esc(v.origin)} · ${esc(v.region)}</div><div>${ic('mtn')}${esc(v.alt)} · ${esc((v.process || '').toLowerCase())} обработка</div><div>${ic('bolt')}кофеин ${(v.caff || 0).toFixed(1)}% · ${esc((v.roast || '').toLowerCase())}</div></div>
      <div class="notes">${(v.notes || []).map(n => `<span class="note">${esc(n)}</span>`).join('')}</div>
      <div class="vc-bars">${bar('Кислинка', p.acid)}${bar('Тело', p.body)}${bar('Сладость', p.sweet)}</div>
      <div class="vc-foot"><div class="price"><b>${fmt(v.price)} ₽</b><span>/ 250 г</span></div><span class="mono" style="font-size:11px;color:var(--ink-soft)">${(v.brew || []).length} способа</span></div></article>`;
  }
  function cardD(d) {
    const dots = Array.from({ length: 5 }, (_, k) => `<span class="${k < (d.str || 0) ? 'on' : ''}"></span>`).join('');
    return `<article class="d-card"><div class="dc-head"><div><h3>${esc(d.name)}</h3><small>${d.vol} мл · ${esc(d.time)}</small></div><span class="badge">${(d.cats || []).map(c => (CATS.find(x => x[0] === c) || [, c])[1]).join(' · ')}</span></div>
      <div class="dc-mid">${glassSVG(d.layers)}${compList(d.layers)}</div>
      <div class="dc-meta"><span class="caff">${ic('bolt')}${d.caff} мг</span><span class="strength">${dots}</span></div>
      <div class="vc-foot"><div class="price"><b>${fmt(d.price)} ₽</b><span>за порцию</span></div><span class="mono" style="font-size:11px;color:var(--milk-soft)">${esc(d.temp)}</span></div></article>`;
  }

  /* ── каталог: сервер → локальный резерв ── */
  async function loadCatalog() {
    try {
      const c = await api('/api/catalog');
      if (c && Array.isArray(c.varieties) && (c.varieties.length || c.drinks.length)) {
        store.set('crema-catalog', { varieties: c.varieties, drinks: c.drinks });
        return { varieties: c.varieties, drinks: c.drinks, mode: 'server', revision: c.revision || 1, updatedAt: c.updatedAt };
      }
      if (c && Array.isArray(c.varieties)) return { varieties: [], drinks: [], mode: 'server', empty: true, revision: c.revision || 0, updatedAt: c.updatedAt };
    } catch (e) { }
    const loc = store.get('crema-catalog', null);
    return { varieties: loc ? loc.varieties : clone(DEF_V), drinks: loc ? loc.drinks : clone(DEF_D), mode: 'local', revision: 1, updatedAt: null };
  }

  function findItem(cat, key) {
    const [k, id] = String(key).split(':');
    const arr = k === 'v' ? cat.varieties : cat.drinks;
    const it = arr.find(x => x.id === id);
    return it ? { kind: k, item: it } : null;
  }

  return { $, $$, esc, fmt, uid, clone, plural, store, api, shell, toast, texture, beanSVG, glassSVG, compList, cardV, cardD, ic, LTYPE, GRADS, TONES, CATS, METHODS, DEF_V, DEF_D, loadCatalog, findItem };
})();