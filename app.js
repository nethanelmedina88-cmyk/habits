/* Habit tracker PWA: local-first, synced to a private GitHub Gist. No build step, no dependencies. */
'use strict';

const APP_VERSION = '1.3.0';
const LS_STATE = 'hp.state.v1';
const LS_TOKEN = 'hp.token';
const LS_GIST = 'hp.gist';
const LS_LOGIN = 'hp.login';
const LS_LAST = 'hp.lastSync';
const LS_COACH = 'hp.coach';
const GIST_FILE = 'habit-tracker-data.json';
const GH = 'https://api.github.com';
const TOKEN_URL = 'https://github.com/settings/tokens/new?scopes=gist&description=Habit%20Tracker';

// Colours from the spreadsheet: week band colours + task-tracker day colours
const WEEK_COLORS = ['#5B45F0', '#3E8EF7', '#35C6C0', '#F2508E', '#2FD49A'];
const DAY_COLORS = ['#6C4EF5', '#3E8EF7', '#35C6C0', '#2FD49A', '#A3D12F', '#F4C430', '#F59A3C'];
const PALETTE = ['#5B45F0', '#3E8EF7', '#35C6C0', '#F2508E', '#2FD49A', '#A3D12F', '#F4C430', '#F59A3C'];
const STATUS = { bad: '#F2545B', mid: '#F4C430', good: '#3DD6B0' };
const SERIES = { mood: '#7B7BFF', motivation: '#22A39E', progress: '#3DD6B0' }; // validated for the dark surface

const DAY_LETTERS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];
const DAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];

const LIBRARY = [
  { group: 'בוקר', items: [['השכמה ב-05:00', '⏰'], ['סידור המיטה', '🛏️'], ['תכנון היום', '📅'], ['כוס מים על הבוקר', '🥛']] },
  { group: 'גוף', items: [['אימון כוח', '💪'], ['ריצה', '🏃'], ['10,000 צעדים', '👟'], ['מתיחות', '🤸'], ['מקלחת קרה', '🚿'], ['שינה לפני 23:00', '😴']] },
  { group: 'תזונה', items: [['3 ליטר מים', '💧'], ['בלי סוכר', '🍬'], ['אוכל ביתי', '🥗'], ['בלי אלכוהול', '🍷'], ['חלבון בכל ארוחה', '🍗']] },
  { group: 'נפש ורוח', items: [['תפילה', '🙏'], ['מדיטציה', '🧘'], ['כתיבת יומן', '📒'], ['הכרת תודה', '🙌'], ['פרשת שבוע', '📜']] },
  { group: 'למידה ועבודה', items: [['קריאה 20 דקות', '📖'], ['עבודה על פרויקט צד', '💸'], ['עבודה עמוקה 90 דקות', '🎯'], ['מעקב תקציב', '💰'], ['למידת מיומנות חדשה', '🧠']] },
  { group: 'דיגיטל', items: [['ניתוק מרשתות', '📵'], ['בלי מסך לפני שינה', '🌙'], ['תיבת מייל ריקה', '📥']] },
];
const EMOJIS = ['⏰', '💪', '🏃', '👟', '🤸', '🚿', '😴', '💧', '🥗', '🍬', '🍷', '🍗', '🙏', '🧘', '📒', '🙌', '📜', '📖', '💸', '🎯',
  '💰', '🧠', '📵', '🌙', '📥', '📅', '🛏️', '🥛', '🦁', '🔥', '⚡', '🏋️', '🚴', '🏊', '🧬', '🎓', '✍️', '🎸', '🌿', '☀️',
  '🧹', '👨‍👩‍👧', '❤️', '🦷', '💊', '🚭', '🧊', '✅'];

/* ------------------------------------------------------------------ dates */
const pad = (n) => String(n).padStart(2, '0');
const keyOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseKey = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (k, n) => { const d = parseKey(k); d.setDate(d.getDate() + n); return keyOf(d); };
const dow = (k) => parseKey(k).getDay();
const todayKey = () => keyOf(new Date());
const weekStart = (k) => addDays(k, -dow(k));
const daysIn = (y, m) => new Date(y, m + 1, 0).getDate();
const dayNum = (k) => Number(k.slice(8));

/* ------------------------------------------------------------------ helpers */
const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const now = () => Date.now();
const uid = () => 'h' + now().toString(36) + Math.random().toString(36).slice(2, 7);
const pctText = (p) => (p == null ? '–' : Math.round(p * 100) + '%');
const statusColor = (p) => (p == null ? 'var(--s3)' : p < 0.4 ? STATUS.bad : p < 0.7 ? STATUS.mid : STATUS.good);
const statusClass = (p) => (p == null ? '' : p < 0.4 ? 'pct-lo' : p < 0.7 ? 'pct-mid' : 'pct-hi');
const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const lsGet = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const lsSet = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) { /* ignore */ } };
/* ------------------------------------------------------------------ feedback: haptics + sound */
const prefs = { haptics: lsGet('hp.haptics') !== '0', sound: lsGet('hp.sound') !== '0' };
const vibrate = (p) => { if (!prefs.haptics || (navigator.userActivation && !navigator.userActivation.hasBeenActive)) return; try { navigator.vibrate && navigator.vibrate(p); } catch (e) { /* ignore */ } };
const HAPTIC = { tap: 8, tick: 4, edge: 12, done: [10, 28, 18], undo: 6, perfect: [18, 40, 18, 40, 45] };
let actx = null;
function audioCtx() {
  try {
    if (!actx) { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null; actx = new AC(); }
    if (actx.state === 'suspended') actx.resume();
    return actx;
  } catch (e) { return null; }
}
/** Soft bell: sine + quiet octave overtone, fast attack, smooth decay. 'done' = two rising notes, 'perfect' = short arpeggio. */
function chime(kind = 'done') {
  if (!prefs.sound) return;
  const ctx = audioCtx(); if (!ctx) return;
  const t0 = ctx.currentTime + 0.01;
  const notes = kind === 'perfect' ? [[1046.5, 0], [1318.5, 0.09], [1568, 0.18], [2093, 0.3]] : [[1318.5, 0], [1975.5, 0.08]];
  const master = ctx.createGain(); master.gain.value = kind === 'perfect' ? 0.16 : 0.13; master.connect(ctx.destination);
  notes.forEach(([f, dt], i) => {
    const g = ctx.createGain(), len = i === notes.length - 1 ? 0.55 : 0.3;
    g.gain.setValueAtTime(0.0001, t0 + dt);
    g.gain.exponentialRampToValueAtTime(1, t0 + dt + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dt + len);
    g.connect(master);
    [[f, 1], [f * 2.005, 0.12]].forEach(([freq, amp]) => {
      const o = ctx.createOscillator(), og = ctx.createGain();
      o.type = 'sine'; o.frequency.value = freq; og.gain.value = amp;
      o.connect(og); og.connect(g); o.start(t0 + dt); o.stop(t0 + dt + len + 0.05);
    });
  });
}

function stableStringify(v) {
  if (Array.isArray(v)) return '[' + v.map(stableStringify).join(',') + ']';
  if (v && typeof v === 'object') return '{' + Object.keys(v).sort().map((k) => JSON.stringify(k) + ':' + stableStringify(v[k])).join(',') + '}';
  return JSON.stringify(v);
}

/* ------------------------------------------------------------------ state */
const blank = () => ({ v: 1, habits: {}, log: {}, mind: {}, profile: { name: '', t: 0 } });

function normalize(o) {
  const s = blank();
  if (!o || typeof o !== 'object') return s;
  if (o.habits && typeof o.habits === 'object') {
    for (const [id, h] of Object.entries(o.habits)) {
      if (!h || typeof h !== 'object') continue;
      s.habits[id] = {
        id, name: String(h.name || '').slice(0, 60), emoji: h.emoji || '✅', color: h.color || PALETTE[0],
        days: Array.isArray(h.days) && h.days.length ? h.days.filter((d) => d >= 0 && d <= 6) : [0, 1, 2, 3, 4, 5, 6],
        order: Number(h.order) || 0, start: h.start || todayKey(), deleted: !!h.deleted, t: Number(h.t) || 0,
      };
    }
  }
  if (o.log && typeof o.log === 'object') s.log = o.log;
  if (o.mind && typeof o.mind === 'object') s.mind = o.mind;
  if (o.profile && typeof o.profile === 'object') s.profile = { name: String(o.profile.name || ''), t: Number(o.profile.t) || 0 };
  return s;
}

function pickNewer(a, b) {
  if (!a) return b;
  if (!b) return a;
  return (Number(b.t) || 0) > (Number(a.t) || 0) ? b : a;
}

/** Last-writer-wins per record, so two devices never overwrite each other's separate changes. */
function mergeStates(a, b) {
  a = normalize(a); b = normalize(b);
  const out = blank();
  for (const id of new Set([...Object.keys(a.habits), ...Object.keys(b.habits)])) out.habits[id] = pickNewer(a.habits[id], b.habits[id]);
  for (const dk of new Set([...Object.keys(a.log), ...Object.keys(b.log)])) {
    const la = a.log[dk] || {}, lb = b.log[dk] || {};
    out.log[dk] = {};
    for (const hid of new Set([...Object.keys(la), ...Object.keys(lb)])) out.log[dk][hid] = pickNewer(la[hid], lb[hid]);
  }
  for (const dk of new Set([...Object.keys(a.mind), ...Object.keys(b.mind)])) {
    const ma = a.mind[dk] || {}, mb = b.mind[dk] || {};
    out.mind[dk] = {};
    for (const f of new Set([...Object.keys(ma), ...Object.keys(mb)])) out.mind[dk][f] = pickNewer(ma[f], mb[f]);
  }
  out.profile = pickNewer(a.profile, b.profile);
  return out;
}

let S = (() => { try { return normalize(JSON.parse(lsGet(LS_STATE) || 'null')); } catch (e) { return blank(); } })();

function persistLocal() { lsSet(LS_STATE, JSON.stringify(S)); }
function save() { persistLocal(); scheduleSync(); }

const habitsList = () => Object.values(S.habits).filter((h) => !h.deleted).sort((a, b) => a.order - b.order || a.t - b.t);
const scheduled = (h, dk) => !h.deleted && dk >= h.start && h.days.includes(dow(dk));
const isDone = (hid, dk) => !!(S.log[dk] && S.log[dk][hid] && S.log[dk][hid].v);
const mindVal = (dk, f) => (S.mind[dk] && S.mind[dk][f] && S.mind[dk][f].v) || null;

function setDone(hid, dk, v) {
  S.log[dk] = S.log[dk] || {};
  S.log[dk][hid] = { v: v ? 1 : 0, t: now() };
  save();
}
function setMind(dk, f, v) {
  S.mind[dk] = S.mind[dk] || {};
  S.mind[dk][f] = { v, t: now() };
  save();
}
function addHabit({ name, emoji, color, days }) {
  const list = habitsList();
  const id = uid();
  S.habits[id] = {
    id, name: name.trim().slice(0, 60), emoji: emoji || '✅', color: color || PALETTE[list.length % PALETTE.length],
    days: days && days.length ? days : [0, 1, 2, 3, 4, 5, 6], order: list.length ? Math.max(...list.map((h) => h.order)) + 1 : 0,
    start: todayKey(), deleted: false, t: now(),
  };
  return id;
}
function updateHabit(id, patch) { S.habits[id] = { ...S.habits[id], ...patch, t: now() }; save(); }

/* ------------------------------------------------------------------ stats */
function dayStat(dk) {
  let total = 0, done = 0;
  for (const h of habitsList()) if (scheduled(h, dk)) { total++; if (isDone(h.id, dk)) done++; }
  return { total, done, pct: total ? done / total : null };
}
function mindScore(dk) {
  const vals = ['mood', 'motivation'].map((f) => mindVal(dk, f)).filter((v) => v != null);
  return vals.length ? vals.reduce((a, b) => a + b, 0) / (vals.length * 10) : null;
}
function streak(h, upTo = todayKey()) {
  let n = 0, dk = upTo;
  for (let i = 0; i < 1500 && dk >= h.start; i++, dk = addDays(dk, -1)) {
    if (!h.days.includes(dow(dk))) continue;
    if (isDone(h.id, dk)) n++;
    else if (dk === todayKey()) continue;
    else break;
  }
  return n;
}
function monthStats(y, m) {
  const dim = daysIn(y, m), tk = todayKey(), habits = habitsList();
  const days = [];
  for (let d = 1; d <= dim; d++) {
    const dk = keyOf(new Date(y, m, d));
    const st = dk > tk ? { total: 0, done: 0, pct: null } : dayStat(dk);
    days.push({ d, dk, future: dk > tk, ...st, mood: mindVal(dk, 'mood'), motivation: mindVal(dk, 'motivation'), mind: mindScore(dk) });
  }
  const per = habits.map((h) => {
    let sched = 0, done = 0;
    for (const x of days) if (!x.future && scheduled(h, x.dk)) { sched++; if (isDone(h.id, x.dk)) done++; }
    return { h, sched, done, pct: sched ? done / sched : null };
  });
  const sched = per.reduce((a, p) => a + p.sched, 0), done = per.reduce((a, p) => a + p.done, 0);
  const perfect = days.filter((x) => x.total > 0 && x.done === x.total).length;
  const weeks = [0, 1, 2, 3, 4].map((w) => {
    const ds = days.slice(w * 7, w * 7 + 7);
    if (!ds.length) return null;
    const sc = ds.map((x) => x.mind).filter((v) => v != null);
    return { w, from: ds[0].d, to: ds[ds.length - 1].d, score: sc.length ? sc.reduce((a, b) => a + b, 0) / sc.length : null };
  }).filter(Boolean);
  const byDow = [0, 1, 2, 3, 4, 5, 6].map((wd) => {
    const ds = days.filter((x) => !x.future && x.total && dow(x.dk) === wd);
    return ds.length ? ds.reduce((a, x) => a + x.pct, 0) / ds.length : null;
  });
  return { y, m, dim, days, per, sched, done, pct: sched ? done / sched : null, perfect, weeks, byDow, habits };
}

/* ------------------------------------------------------------------ UI state */
const ui = {
  tab: 'today',
  day: todayKey(),
  month: (() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() }; })(),
  mweek: null, // selected week (0-4) in the month tab
  showOff: false,
  heroPct: 0,
  pick: new Set(), // onboarding selection
  libQ: '', // library search text
  added: [], // habits added from the library sheet in this session
  anim: true,
  swipeFrom: null,
  lastToday: todayKey(),
};
const view = $('#view');
const root = document.documentElement;
const appEl = $('#app');
const charts = new Map();

/* ------------------------------------------------------------------ icons */
const ICON = {
  prev: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>', // RTL: "back" points right
  next: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>',
  up: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 15l6-6 6 6"/></svg>',
  down: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>',
  edit: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/></svg>',
  plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
  check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  cloud: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 18h10a4 4 0 0 0 .6-7.95A6 6 0 0 0 6.1 9.2 4.5 4.5 0 0 0 7 18z"/></svg>',
  down2: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>',
  up2: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20V9M7 14l5-5 5 5M5 4h14"/></svg>',
  sync: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 12a8 8 0 0 1-14 5.3M4 12a8 8 0 0 1 14-5.3"/><path d="M18 3v4h-4M6 21v-4h4"/></svg>',
  xls: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="3" width="16" height="18" rx="2.5"/><path d="M9 8l6 8M15 8l-6 8"/></svg>',
  undo: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 14l5-5-5-5"/><path d="M20 9H10a6 6 0 0 0 0 12h3"/></svg>',
  stats: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
  chev: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>',
  close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  search: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>',
  alert: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5M12 16.5h.01"/></svg>',
  warn: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5l9.5 16.5h-19z"/><path d="M12 10v4M12 17h.01"/></svg>',
  plusSm: '<svg class="plus" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 6v12M6 12h12"/></svg>',
  checkSm: '<svg class="plus" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
};

function miniRing(pct, color, size = 30, fill = true) {
  const r = size / 2 - 3, c = 2 * Math.PI * r, p = pct == null ? 0 : pct;
  return `<svg viewBox="0 0 ${size} ${size}" aria-hidden="true"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--s3)" stroke-width="3.5"/>
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${color}" stroke-width="3.5" stroke-linecap="round"
      stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - p)}" transform="rotate(-90 ${size / 2} ${size / 2})" ${p === 0 ? 'stroke-opacity="0"' : ''}/>
    ${fill && p >= 1 ? `<circle cx="${size / 2}" cy="${size / 2}" r="${r - 5}" fill="${color}"/>` : ''}</svg>`;
}

function daysSummary(days) {
  const s = [...days].sort();
  if (s.length === 7) return 'כל יום';
  if (s.join() === '0,1,2,3,4') return 'ימים א–ה';
  if (s.join() === '0,1,2,3,4,5') return 'ימים א–ו';
  return 'ימים ' + s.map((d) => DAY_LETTERS[d]).join(' ');
}
const shortDate = (dk) => `${dayNum(dk)} ב${MONTHS[parseKey(dk).getMonth()]}`;
function weekLabel(ws) {
  const a = parseKey(ws), b = parseKey(addDays(ws, 6));
  return a.getMonth() === b.getMonth() ? `${a.getDate()}–${b.getDate()} ב${MONTHS[a.getMonth()]}` : `${shortDate(ws)} – ${shortDate(addDays(ws, 6))}`;
}

/** Busy = loading state with a spinner inside the button. */
function busy(el, on) { if (el) el.setAttribute('aria-busy', on ? 'true' : 'false'); }

/** Input states: default, error (red + message), warning (yellow + message). */
function setField(input, msgEl, kind, text, en = '') {
  if (input) {
    input.classList.toggle('is-error', kind === 'error');
    input.classList.toggle('is-warning', kind === 'warning');
    input.setAttribute('aria-invalid', kind === 'error' ? 'true' : 'false');
  }
  if (!msgEl) return;
  msgEl.className = 'field-msg' + (kind ? ' ' + kind : '');
  msgEl.innerHTML = text ? `${kind === 'error' ? ICON.alert : kind === 'warning' ? ICON.warn : ''}<span>${esc(text)}${en ? `<span class="en" dir="ltr">${esc(en)}</span>` : ''}</span>` : '';
}

/* ------------------------------------------------------------------ header */
function renderHeader() {
  const h = new Date().getHours();
  const hi = h >= 5 && h < 12 ? 'בוקר טוב' : h >= 12 && h < 17 ? 'צהריים טובים' : h >= 17 && h < 21 ? 'ערב טוב' : 'לילה טוב';
  const name = (S.profile.name || '').trim();
  $('#hello').textContent = name ? `${hi}, ${name}` : hi;
  const d = new Date();
  $('#todayLabel').textContent = `יום ${DAY_NAMES[d.getDay()]} · ${d.getDate()} ב${MONTHS[d.getMonth()]}`;
}
/* when the hero ring scrolls away, the day's progress moves into the sticky top bar */
const heroObs = 'IntersectionObserver' in window ? new IntersectionObserver((es) => {
  for (const e of es) $('#topbar').classList.toggle('compact', !e.isIntersecting && ui.tab === 'today');
}, { rootMargin: '-88px 0px 0px 0px' }) : null;

/* ------------------------------------------------------------------ TODAY */
function heroMessage(st) {
  if (!st.total) return ['אין הרגלים ליום הזה', 'יום חופשי מהרשימה. אפשר לנוח.'];
  if (st.done === 0) return ['יום חדש. צעד ראשון.', 'בחר הרגל אחד וסמן אותו עכשיו.'];
  if (st.pct < 0.5) return ['התחלה טובה. ממשיכים.', `נשארו ${st.total - st.done} הרגלים להיום.`];
  if (st.pct < 1) return ['כמעט שם.', `עוד ${st.total - st.done} ${st.total - st.done === 1 ? 'הרגל' : 'הרגלים'} ליום מושלם.`];
  return ['יום מושלם 🔥', 'כל ההרגלים של היום בוצעו.'];
}

function habitCard(h, dk, disabled) {
  const done = isDone(h.id, dk), sk = streak(h, dk);
  const dots = [6, 5, 4, 3, 2, 1, 0].map((i) => {
    const k = addDays(dk, -i);
    const cls = !scheduled(h, k) ? 'off-day' : isDone(h.id, k) ? 'on' : '';
    return `<i class="${cls}"></i>`;
  }).join('');
  return `<button class="habit" style="--c:${h.color}" data-action="toggle" data-id="${h.id}" aria-pressed="${done}" ${disabled ? 'disabled' : ''}>
    <span class="emoji" aria-hidden="true">${esc(h.emoji)}</span>
    <span class="body"><span class="name">${esc(h.name)}</span>
      <span class="meta">${sk ? `<span class="streak">🔥 <span class="num">${sk}</span> ${sk === 1 ? 'יום' : 'ימים'}</span>` : '<span>עוד אין רצף</span>'}
      <span class="dots" aria-label="7 הימים האחרונים">${dots}</span></span></span>
    <span class="check" aria-hidden="true">${ICON.check}</span></button>`;
}

function renderToday() {
  const habits = habitsList();
  if (!habits.length) { root.classList.add('onboarding'); return renderOnboarding(); }
  root.classList.remove('onboarding');
  const tk = todayKey(), dk = ui.day;
  const ws = weekStart(dk);
  const pills = [0, 1, 2, 3, 4, 5, 6].map((i) => {
    const k = addDays(ws, i), st = k > tk ? { pct: null } : dayStat(k);
    return `<button class="day-pill ${k === tk ? 'is-today' : ''}" data-action="pick-day" data-day="${k}" ${k > tk ? 'disabled' : ''}
      ${k === dk ? 'aria-current="date"' : ''} aria-label="יום ${DAY_NAMES[i]} ${dayNum(k)}, ${pctText(st.pct)}">
      <span class="dname">${DAY_LETTERS[i]}</span>${miniRing(st.pct, DAY_COLORS[i], 28)}<span class="dnum num">${dayNum(k)}</span></button>`;
  }).join('');
  const st = dayStat(dk);
  const [title, sub] = heroMessage(st);
  const R = 52, C = 2 * Math.PI * R;
  const from = ui.heroPct, to = st.pct || 0;
  const isToday = dk === tk;
  const dayTitle = isToday ? 'ההרגלים של היום' : `יום ${DAY_NAMES[dow(dk)]}, ${shortDate(dk)}`;
  const on = habits.filter((h) => scheduled(h, dk));
  const off = habits.filter((h) => !scheduled(h, dk));

  const mood = mindVal(dk, 'mood'), mot = mindVal(dk, 'motivation'), ms = mindScore(dk);
  const slider = (f, label, v, color) => `<div class="mind-row" style="--c:${color}">
      <label for="mind-${f}">${label}</label>
      <input type="range" id="mind-${f}" min="1" max="10" step="1" value="${v || 5}" class="${v ? '' : 'unset'}" data-mind="${f}"
        style="--p:${v ? ((v - 1) / 9) * 100 : 0}%" aria-valuetext="${v ? v + ' מתוך 10' : 'לא נבחר'}">
      <span class="mind-val ${v ? '' : 'is-empty'}" id="mv-${f}">${v ? `<span class="num">${v}</span>` : '–'}</span></div>`;

  view.innerHTML = `<section class="swipe-area" id="daySwipe">
    <div class="week-head"><span class="w-label">${weekLabel(ws)}</span>
      <div class="w-arrows"><button class="icon-btn" data-action="week" data-dir="-1" aria-label="השבוע הקודם">${ICON.prev}</button>
      <button class="icon-btn" data-action="week" data-dir="1" aria-label="השבוע הבא" ${addDays(ws, 7) > tk ? 'disabled' : ''}>${ICON.next}</button></div></div>
    <div class="week-strip" id="weekStrip">${pills}</div>
    <div class="hero">
      <div class="hero-ring" role="img" aria-label="בוצעו ${st.done} מתוך ${st.total}">
        <svg viewBox="0 0 128 128"><defs><linearGradient id="hg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#5B45F0"/><stop offset=".5" stop-color="#3E8EF7"/><stop offset="1" stop-color="#2FD49A"/></linearGradient></defs>
          <circle class="ring-bg" cx="64" cy="64" r="${R}" fill="none" stroke-width="12"/>
          <circle class="ring-fg" id="heroFg" cx="64" cy="64" r="${R}" fill="none" stroke="url(#hg)" stroke-width="12" stroke-linecap="round"
            stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - from)}" ${from === 0 && to === 0 ? 'stroke-opacity="0"' : ''}/></svg>
        <div class="hero-center"><div class="hero-pct num">${pctText(st.pct)}</div><div class="hero-sub"><span class="num">${st.done}/${st.total}</span> בוצעו</div></div>
      </div>
      <div class="hero-text"><h1>${title}</h1><p>${sub}</p>${isToday ? '' : `<button class="btn ghost sm" data-action="go-today">חזרה להיום</button>`}</div>
    </div>
    <div class="section-title"><h2>${dayTitle}</h2></div>
    <div class="habit-list">${on.map((h) => habitCard(h, dk, false)).join('') || '<div class="card small">אין הרגלים מתוכננים ליום הזה.</div>'}</div>
    ${off.length ? `<button class="btn ghost sm block" style="margin-top:12px" data-action="toggle-off" aria-expanded="${ui.showOff}">${ui.showOff ? 'הסתר' : 'הצג'} ${off.length} ${off.length === 1 ? 'הרגל שלא מתוכנן' : 'הרגלים שלא מתוכננים'} ליום הזה</button>
      ${ui.showOff ? `<div class="habit-list offday-list">${off.map((h) => habitCard(h, dk, true)).join('')}</div>` : ''}` : ''}
    <div class="section-title"><h2>מצב מנטלי</h2><span class="hint">1 עד 10</span></div>
    <div class="card mind-card">
      ${slider('mood', 'מצב רוח', mood, SERIES.mood)}
      ${slider('motivation', 'מוטיבציה', mot, SERIES.motivation)}
      <div class="mind-score"><span>ציון מיינדסט ליום</span><b id="mindScore" class="num">${pctText(ms)}</b></div>
    </div>
  </section>`;
  ui.heroPct = to;
  $('#topProgress').innerHTML = `${miniRing(st.pct, 'var(--success)', 20)}<span><span class="num">${st.done}/${st.total}</span> ${isToday ? 'היום' : 'ב-' + shortDate(dk)} · <span class="num">${pctText(st.pct)}</span></span>`;
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const fg = $('#heroFg');
    if (fg) { fg.setAttribute('stroke-dashoffset', C * (1 - to)); if (to > 0) fg.removeAttribute('stroke-opacity'); }
  }));
  if (heroObs) { heroObs.disconnect(); heroObs.observe($('.hero-ring')); }
  attachSwipe($('#daySwipe'), (dir) => moveDay(dir), { follow: true, ignore: 'input[type=range], #weekStrip, .week-head' });
  attachSwipe($('#weekStrip'), (dir) => moveDay(dir * 7));
  maybeCoach();
}

/** dir > 0 = later (finger moved right in RTL), dir < 0 = earlier */
function moveDay(n) {
  const tk = todayKey();
  let nd = addDays(ui.day, n);
  if (nd > tk) { if (ui.day === tk) { vibrate(HAPTIC.edge); return false; } nd = tk; }
  ui.day = nd; ui.swipeFrom = n > 0 ? '-35%' : '35%';
  vibrate(HAPTIC.tap); render();
  return true;
}
function changeMonth(dir) {
  let { y, m } = ui.month; m += dir;
  if (m < 0) { m = 11; y--; } if (m > 11) { m = 0; y++; }
  const d = new Date();
  if (y > d.getFullYear() || (y === d.getFullYear() && m > d.getMonth())) { vibrate(HAPTIC.edge); return false; }
  ui.month = { y, m }; ui.mweek = null; ui.swipeFrom = dir > 0 ? '-35%' : '35%';
  vibrate(HAPTIC.tap); render();
  return true;
}

/* ------------------------------------------------------------------ gestures */
/** Horizontal swipe on an element. RTL: finger moving right = later (dir +1). */
function attachSwipe(el, onSwipe, { follow = false, ignore = '' } = {}) {
  if (!el) return;
  let s = null;
  el.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1 || (ignore && e.target.closest(ignore))) { s = null; return; }
    s = { x: e.touches[0].clientX, y: e.touches[0].clientY, dx: 0, lock: null, t: performance.now() };
  }, { passive: true });
  el.addEventListener('touchmove', (e) => {
    if (!s) return;
    const dx = e.touches[0].clientX - s.x, dy = e.touches[0].clientY - s.y;
    if (!s.lock) {
      if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.3) s.lock = 'x';
      else if (Math.abs(dy) > 10) s.lock = 'y';
    }
    if (s.lock !== 'x') return;
    s.dx = dx;
    if (follow) { el.classList.add('swiping'); el.style.transform = `translateX(${dx * 0.5}px)`; el.style.opacity = String(1 - Math.min(0.4, Math.abs(dx) / 600)); }
  }, { passive: true });
  const end = () => {
    if (!s) return;
    const st = s; s = null;
    if (st.lock !== 'x') return;
    el.classList.remove('swiping');
    const fast = Math.abs(st.dx) / Math.max(1, performance.now() - st.t) > 0.5;
    const ok = Math.abs(st.dx) > 72 || (Math.abs(st.dx) > 32 && fast);
    const moved = ok && onSwipe(st.dx > 0 ? 1 : -1);
    if (!moved && follow) { el.style.transition = 'transform .2s var(--ease), opacity .2s'; el.style.transform = ''; el.style.opacity = ''; }
  };
  el.addEventListener('touchend', end);
  el.addEventListener('touchcancel', end);
}

/* ------------------------------------------------------------------ onboarding + habit library */
function renderOnboarding() {
  view.innerHTML = `<section>
    <div class="intro"><div class="empty-ico" aria-hidden="true">🎯</div><h1>בוא נבנה את השגרה שלך</h1>
      <p>בחר הרגלים מהספרייה. תמיד אפשר לשנות אחר כך.</p>
      <button class="btn ghost sm" data-action="open-settings">${ICON.cloud} כבר יש לי נתונים בענן</button></div>
    ${libraryHTML('pick')}
    <div class="sticky-cta"><button class="btn block" id="startBtn" data-action="start" ${ui.pick.size ? '' : 'disabled'}>${startLabel()}</button></div>
  </section>`;
}

const startLabel = () => (!ui.pick.size ? 'בחר לפחות הרגל אחד' : ui.pick.size === 1 ? 'התחל · הרגל אחד' : `<span>התחל · <span class="num">${ui.pick.size}</span> הרגלים</span>`);
const normQ = (s) => String(s || '').replace(/[\s\-–_.,'"׳״]/g, '').toLowerCase();
function lev(a, b) {
  const m = a.length, n = b.length, d = Array.from({ length: m + 1 }, (_, i) => [i]);
  for (let j = 1; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[m][n];
}
/** "did you mean" words from the library, closest first */
function suggestions(q) {
  const nq = normQ(q), words = new Map();
  LIBRARY.forEach((g) => g.items.forEach(([n]) => n.split(/\s+/).forEach((w) => { if (w.length > 1 && !/\d/.test(w)) words.set(normQ(w), w); })));
  const scored = [...words].map(([nw, w]) => [w, Math.min(lev(nq, nw), ...(nw.length > nq.length ? [lev(nq, nw.slice(0, nq.length)) + 1] : []))])
    .filter(([, s]) => s <= Math.max(1, Math.ceil(nq.length / 2))).sort((a, b) => a[1] - b[1]).map(([w]) => w);
  return [...new Set(scored)].slice(0, 3).concat(scored.length ? [] : ['מים', 'אימון', 'קריאה']).slice(0, 3);
}
function libraryBody(mode) {
  const q = normQ(ui.libQ);
  const existing = new Set(habitsList().map((h) => h.name + '|' + h.emoji));
  const groups = LIBRARY.map((g) => ({ g: g.group, items: g.items.filter(([n]) => !q || normQ(n).includes(q) || normQ(g.group).includes(q)) })).filter((g) => g.items.length);
  if (!groups.length) {
    const raw = ui.libQ.trim();
    return `<div class="zero"><div class="empty-ico" aria-hidden="true">🔍</div><h3>לא נמצא הרגל בשם "${esc(raw)}"</h3>
      <p>אולי התכוונת ל:</p><div class="chips">${suggestions(raw).map((s) => `<button class="chip" data-action="lib-suggest" data-q="${esc(s)}">${esc(s)}</button>`).join('')}</div>
      <div class="btn-row"><button class="btn ghost sm" data-action="lib-clear">נקה חיפוש</button><button class="btn sm" data-action="new-habit" data-name="${esc(raw)}">${ICON.plus} צור "${esc(raw.slice(0, 16))}"</button></div></div>`;
  }
  return groups.map((g) => `<div class="lib-group"><h3>${g.g}</h3><div class="chips">${g.items.map(([n, e]) => {
    const key = n + '|' + e, on = mode === 'pick' ? ui.pick.has(key) : existing.has(key);
    return `<button class="chip" data-action="${mode === 'pick' ? 'pick' : 'lib-add'}" data-key="${esc(key)}" aria-pressed="${on}"><span aria-hidden="true">${e}</span>${esc(n)}${on ? ICON.checkSm : ICON.plusSm}</button>`;
  }).join('')}</div></div>`).join('');
}
function libraryHTML(mode) {
  return `<div class="search" role="search">${ICON.search}
      <input class="input" id="libSearch" type="search" enterkeyhint="search" placeholder="חיפוש הרגל" value="${esc(ui.libQ)}" autocomplete="off" aria-label="חיפוש הרגל" data-mode="${mode}">
      <button class="icon-btn clear" data-action="lib-clear" aria-label="נקה חיפוש" ${ui.libQ ? '' : 'hidden'}>${ICON.close}</button></div>
    <div id="libBody" data-mode="${mode}">${libraryBody(mode)}</div>`;
}
function refreshLibrary() {
  const body = $('#libBody'); if (!body) return;
  body.innerHTML = libraryBody(body.dataset.mode);
  const clr = $('.search .clear'); if (clr) clr.hidden = !ui.libQ;
}

function addSheet() {
  ui.libQ = ''; ui.added = [];
  openSheet(`<h2 id="sheetTitle">הוספת הרגל</h2><p class="lead">בחר מהספרייה או צור הרגל משלך.</p>
    <button class="btn ghost block" data-action="new-habit">${ICON.edit} צור הרגל משלך</button>
    <div style="margin-top:16px">${libraryHTML('add')}</div>
    <div class="sheet-foot"><button class="btn block" data-action="close-sheet" id="addDone">סיום</button></div>`, { kind: 'add' });
}

/* ------------------------------------------------------------------ MONTH */
function monthNav() {
  const { y, m } = ui.month, d = new Date();
  const atNow = y === d.getFullYear() && m === d.getMonth();
  return `<div class="month-head">
    <button class="icon-btn" data-action="month" data-dir="-1" aria-label="החודש הקודם">${ICON.prev}</button>
    <div class="month-title">${MONTHS[m]} <span class="num">${y}</span></div>
    <button class="icon-btn" data-action="month" data-dir="1" aria-label="החודש הבא" ${atNow ? 'disabled' : ''}>${ICON.next}</button></div>`;
}
const wkOf = (d) => Math.min(4, Math.floor((d - 1) / 7));

function renderMonth() {
  const ms = monthStats(ui.month.y, ui.month.m);
  const tk = todayKey();
  if (!ms.habits.length) {
    view.innerHTML = `<section>${monthNav()}<div class="card empty" style="margin-top:16px"><div class="empty-ico" aria-hidden="true">📅</div><h2>עוד אין הרגלים</h2><p>הוסף הרגלים כדי לראות את החודש.</p><button class="btn" data-action="add-habit">${ICON.plus} הוסף הרגל</button></div></section>`;
    return;
  }
  const kpi = `<div class="kpis">
    <div class="kpi"><div class="k-label">הרגלים פעילים</div><div class="k-val num">${ms.habits.length}</div></div>
    <div class="kpi"><div class="k-label">סימונים החודש</div><div class="k-val num">${ms.done}</div></div>
    <div class="kpi"><div class="k-label">התקדמות עד היום</div><div class="k-val num">${pctText(ms.pct)}</div>
      <div class="track"><i style="width:${(ms.pct || 0) * 100}%;background:${statusColor(ms.pct)}"></i></div></div>
    <div class="kpi"><div class="k-label">ימים מושלמים</div><div class="k-val num">${ms.perfect}</div></div></div>`;

  // month overview: one row per week band of the tracker (days 1-7, 8-14 ...), ring = share done that day
  const heat = [0, 1, 2, 3, 4].map((w) => {
    const ds = ms.days.filter((x) => wkOf(x.d) === w);
    if (!ds.length) return '';
    return `<div class="heat-row">${ds.map((x) => `<button class="heat-cell ${x.dk === tk ? 'is-today' : ''}" data-action="open-day" data-day="${x.dk}" ${x.future ? 'disabled' : ''}
        aria-label="${x.d} ב${MONTHS[ui.month.m]}, ${x.future ? 'עוד לא הגיע' : pctText(x.pct)}">
        <span class="hl">${DAY_LETTERS[dow(x.dk)]}</span><span class="hr">${x.future ? '' : miniRing(x.pct, WEEK_COLORS[w], 36, false)}<span class="hn num">${x.d}</span></span></button>`).join('')}
      ${'<span class="heat-cell pad"></span>'.repeat(7 - ds.length)}</div>`;
  }).join('');

  // week by week: habits as rows, 7 day cells each (fits the phone width, one scroll direction)
  const nW = Math.max(...ms.days.map((x) => wkOf(x.d))) + 1;
  let sel = ui.mweek;
  if (sel == null || sel >= nW) {
    const cur = ms.days.find((x) => x.dk === tk);
    sel = cur ? wkOf(cur.d) : 0;
  }
  ui.mweek = sel;
  const wc = WEEK_COLORS[sel];
  const wds = ms.days.filter((x) => wkOf(x.d) === sel);
  const pad = (html) => html.repeat(7 - wds.length);
  const seg = `<div class="seg" role="group" aria-label="בחירת שבוע">${Array.from({ length: nW }, (_, w) =>
    `<button data-action="mweek" data-w="${w}" aria-pressed="${w === sel}" style="--wc:${WEEK_COLORS[w]}"><i aria-hidden="true"></i>שבוע ${w + 1}</button>`).join('')}</div>`;
  const head = `<div class="wk-cols wk-days">${wds.map((x) => `<div class="wd ${x.dk === tk ? 'today' : ''}"><b>${DAY_LETTERS[dow(x.dk)]}</b><span class="num">${x.d}</span></div>`).join('')}${pad('<div></div>')}</div>`;
  const rows = ms.habits.map((h) => {
    let sch = 0, done = 0;
    wds.forEach((x) => { if (!x.future && scheduled(h, x.dk)) { sch++; if (isDone(h.id, x.dk)) done++; } });
    const p = sch ? done / sch : null;
    const cells = wds.map((x) => {
      const s = scheduled(h, x.dk), dn = isDone(h.id, x.dk);
      const dis = x.future || x.dk < h.start || !s;
      const lbl = `${h.name}, ${x.d} ב${MONTHS[ui.month.m]}: ${!s ? 'לא מתוכנן' : dn ? 'בוצע' : 'לא בוצע'}`;
      return `<button class="cellbtn ${!s && x.dk >= h.start ? 'offday' : ''}" data-action="cell" data-id="${h.id}" data-day="${x.dk}" aria-pressed="${dn}" ${dis ? 'disabled' : ''} aria-label="${esc(lbl)}"><i></i></button>`;
    }).join('');
    return `<div class="wk-row"><div class="wk-name"><span><span aria-hidden="true">${esc(h.emoji)}</span> ${esc(h.name)}</span><span class="num ${statusClass(p)}">${p == null ? '' : pctText(p)}</span></div>
      <div class="wk-cols">${cells}${pad('<div class="cell-empty"></div>')}</div></div>`;
  }).join('');
  const sum = (label, fn) => `<div class="wk-sum"><div class="wk-name"><span>${label}</span></div><div class="wk-cols">${wds.map(fn).join('')}${pad('<div></div>')}</div></div>`;
  const sums = sum('התקדמות', (x) => `<div class="num ${statusClass(x.pct)}">${x.future || x.pct == null ? '' : Math.round(x.pct * 100) + '%'}</div>`)
    + sum('מצב רוח', (x) => `<div class="num">${x.mood || ''}</div>`)
    + sum('מוטיבציה', (x) => `<div class="num">${x.motivation || ''}</div>`);

  view.innerHTML = `<section class="swipe-area" id="monthSwipe">${monthNav()}${kpi}
    <div class="section-title"><h2>מבט חודשי</h2></div>
    <div class="card heat">${heat}</div>
    <div class="section-title"><h2>שבוע אחר שבוע</h2></div>
    ${seg}
    <div class="card wk-card" id="wkCard" style="--wc:${wc}">${head}${rows}${sums}</div>
  </section>`;
  attachSwipe($('#monthSwipe'), (dir) => changeMonth(dir), { follow: true, ignore: '#wkCard, .seg' });
  attachSwipe($('#wkCard'), (dir) => {
    const nw = ui.mweek + (dir > 0 ? 1 : -1);
    if (nw < 0 || nw >= nW) { vibrate(HAPTIC.edge); return false; }
    ui.mweek = nw; vibrate(HAPTIC.tap); render(); return true;
  });
}

/* ------------------------------------------------------------------ charts (hand-built SVG) */
function chartWidth() {
  const g = parseFloat(getComputedStyle(view).paddingLeft) || 16;
  return Math.max(240, Math.min(560, view.clientWidth) - 2 * g - 24);
}

function xTicks(points, x, H) {
  const n = points.length;
  return points.map((p, i) => (p.d % 7 === 1 || (i === n - 1 && p.d % 7 >= 4)) ? `<text class="axis-label" x="${x(i)}" y="${H - 6}" text-anchor="middle">${p.d}</text>` : '').join('');
}

function areaChart(id, points) {
  // points: [{d, dk, v (0..1) | null}]
  const W = chartWidth(), H = 170, L = 34, Rr = 10, T = 10, B = 24, pw = W - L - Rr, ph = H - T - B;
  const n = points.length, x = (i) => L + (n <= 1 ? pw / 2 : (i / (n - 1)) * pw), y = (v) => T + ph * (1 - v);
  const valid = points.map((p, i) => ({ ...p, i })).filter((p) => p.v != null);
  let line = '', area = '';
  if (valid.length) {
    line = valid.map((p, k) => `${k ? 'L' : 'M'}${x(p.i).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ');
    area = `${line} L${x(valid[valid.length - 1].i).toFixed(1)},${y(0)} L${x(valid[0].i).toFixed(1)},${y(0)} Z`;
  }
  const grid = [0, 0.25, 0.5, 0.75, 1].map((g) => `<line class="gridline" x1="${L}" x2="${W - Rr}" y1="${y(g)}" y2="${y(g)}"/>
    <text class="axis-label" x="${L - 6}" y="${y(g) + 4}" text-anchor="end">${g * 100}%</text>`).join('');
  const ticks = xTicks(points, x, H);
  charts.set(id, { W, H, L, T, pw, ph, n, x, y, series: [{ key: 'v', name: 'התקדמות', color: SERIES.progress, fmt: pctText }], points });
  return `<div class="chart" data-chart="${id}">
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="גרף התקדמות יומית באחוזים" style="touch-action:pan-y">
      <defs><linearGradient id="ag-${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${SERIES.progress}" stop-opacity=".45"/>
        <stop offset="1" stop-color="${SERIES.progress}" stop-opacity=".02"/></linearGradient></defs>
      ${grid}${ticks}
      ${valid.length ? `<path d="${area}" fill="url(#ag-${id})"/><path d="${line}" fill="none" stroke="${SERIES.progress}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>` : ''}
      ${valid.length === 1 ? `<circle cx="${x(valid[0].i)}" cy="${y(valid[0].v)}" r="4" fill="${SERIES.progress}"/>` : ''}
      <g class="hover" style="display:none"><line class="crosshair" y1="${T}" y2="${T + ph}"/></g>
      <rect x="${L}" y="${T}" width="${pw}" height="${ph}" fill="transparent" class="hit"/>
    </svg><div class="tooltip" role="presentation"></div></div>`;
}

function lineChart(id, points, series, maxV) {
  // series: [{key, name, color}] values in points[i][key] (null = gap)
  const W = chartWidth(), H = 180, L = 26, Rr = 66, T = 12, B = 24, pw = W - L - Rr, ph = H - T - B;
  const n = points.length, x = (i) => L + (n <= 1 ? pw / 2 : (i / (n - 1)) * pw), y = (v) => T + ph * (1 - v / maxV);
  const grid = [0, 2, 4, 6, 8, 10].map((g) => `<line class="gridline" x1="${L}" x2="${L + pw}" y1="${y(g)}" y2="${y(g)}"/>
    <text class="axis-label" x="${L - 6}" y="${y(g) + 4}" text-anchor="end">${g}</text>`).join('');
  const ticks = xTicks(points, x, H);
  const ends = [];
  const paths = series.map((s) => {
    let d = '', pen = false, last = null, singles = [];
    points.forEach((p, i) => {
      const v = p[s.key];
      if (v == null) { pen = false; return; }
      const prevNull = i === 0 || points[i - 1][s.key] == null, nextNull = i === n - 1 || points[i + 1][s.key] == null;
      if (prevNull && nextNull) singles.push(i);
      d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)} `; pen = true; last = i;
    });
    if (last != null) ends.push({ s, yy: y(points[last][s.key]), xx: x(last) });
    return `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>` +
      singles.map((i) => `<circle cx="${x(i)}" cy="${y(points[i][s.key])}" r="4" fill="${s.color}" stroke="var(--s1)" stroke-width="2"/>`).join('');
  }).join('');
  ends.sort((a, b) => a.yy - b.yy);
  for (let i = 1; i < ends.length; i++) if (ends[i].yy - ends[i - 1].yy < 15) ends[i].yy = ends[i - 1].yy + 15;
  const labels = ends.map((e) => `<text class="end-label" x="${L + pw + 8}" y="${e.yy + 4}" fill="var(--text-strong)">${e.s.name}</text>
    <line x1="${e.xx}" x2="${L + pw + 4}" y1="${e.yy}" y2="${e.yy}" stroke="${e.s.color}" stroke-width="1" stroke-dasharray="2 3" opacity=".6"/>`).join('');
  charts.set(id, { W, H, L, T, pw, ph, n, x, y, series: series.map((s) => ({ ...s, fmt: (v) => (v == null ? '–' : v + '/10') })), points });
  return `<div class="chart" data-chart="${id}">
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="גרף מצב רוח ומוטיבציה" style="touch-action:pan-y">
      ${grid}${ticks}${paths}${labels}
      <g class="hover" style="display:none"><line class="crosshair" y1="${T}" y2="${T + ph}"/></g>
      <rect x="${L}" y="${T}" width="${pw}" height="${ph}" fill="transparent" class="hit"/>
    </svg><div class="tooltip" role="presentation"></div></div>`;
}

function wireCharts() {
  document.querySelectorAll('.chart[data-chart]').forEach((el) => {
    const c = charts.get(el.dataset.chart); if (!c) return;
    const svg = $('svg', el), hover = $('.hover', el), tip = $('.tooltip', el), cross = $('.crosshair', el);
    const show = (ev) => {
      const r = svg.getBoundingClientRect(), sx = ((ev.clientX - r.left) / r.width) * c.W;
      const i = Math.max(0, Math.min(c.n - 1, Math.round(((sx - c.L) / c.pw) * (c.n - 1))));
      const p = c.points[i];
      if (!p || p.future) { hide(); return; }
      const xx = c.x(i);
      cross.setAttribute('x1', xx); cross.setAttribute('x2', xx);
      hover.querySelectorAll('circle').forEach((n) => n.remove());
      c.series.forEach((s) => {
        const v = p[s.key]; if (v == null) return;
        const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        dot.setAttribute('cx', xx); dot.setAttribute('cy', c.y(v)); dot.setAttribute('r', 5);
        dot.setAttribute('fill', s.color); dot.setAttribute('stroke', 'var(--s1)'); dot.setAttribute('stroke-width', 2);
        hover.appendChild(dot);
      });
      hover.style.display = '';
      tip.innerHTML = `<div class="t-date">${p.d} ב${MONTHS[parseKey(p.dk).getMonth()]}, יום ${DAY_NAMES[dow(p.dk)]}</div>` +
        c.series.map((s) => `<div class="t-row"><span><i class="sw" style="background:${s.color}"></i>${s.name}</span><b class="num">${s.fmt(p[s.key])}</b></div>`).join('');
      const px = (xx / c.W) * r.width, tw = tip.offsetWidth || 130;
      let left = px - tw / 2; left = Math.max(0, Math.min(r.width - tw, left));
      tip.style.left = left + 'px'; tip.style.transform = 'none'; tip.style.top = '-8px';
      tip.classList.add('show');
    };
    const hide = () => { hover.style.display = 'none'; tip.classList.remove('show'); };
    svg.addEventListener('pointerdown', show);
    svg.addEventListener('pointermove', show);
    svg.addEventListener('pointerleave', hide);
    svg.addEventListener('pointercancel', hide);
  });
}

/* ------------------------------------------------------------------ STATS */
function renderStats() {
  const ms = monthStats(ui.month.y, ui.month.m);
  if (!ms.habits.length) {
    view.innerHTML = `<section>${monthNav()}<div class="card empty" style="margin-top:16px"><div class="empty-ico" aria-hidden="true">📊</div><h2>עוד אין מה לנתח</h2><p>הוסף הרגלים וסמן כמה ימים כדי לראות גרפים.</p><button class="btn" data-action="add-habit">${ICON.plus} הוסף הרגל</button></div></section>`;
    return;
  }
  charts.clear();
  const past = ms.days.filter((x) => !x.future);
  const ranked = ms.per.filter((p) => p.pct != null).sort((a, b) => b.pct - a.pct);
  const best = ranked[0], worst = ranked.length > 1 ? ranked[ranked.length - 1] : null;
  const bdi = ms.byDow.reduce((bi, v, i, arr) => (v != null && (bi < 0 || v > arr[bi]) ? i : bi), -1);
  const insight = (ico, title, val) => `<div class="card insight"><div class="ico" aria-hidden="true">${ico}</div><div><div class="i-title">${title}</div><div class="i-val">${val}</div></div></div>`;
  const insights = [
    best ? insight('🏆', 'ההרגל החזק החודש', `${esc(best.h.emoji)} ${esc(best.h.name)} · <span class="num">${pctText(best.pct)}</span>`) : '',
    worst && worst.pct < best.pct ? insight('🎯', 'כדאי לשים עליו פוקוס', `${esc(worst.h.emoji)} ${esc(worst.h.name)} · <span class="num">${pctText(worst.pct)}</span>`) : '',
    bdi >= 0 ? insight('📅', 'היום החזק בשבוע', `יום ${DAY_NAMES[bdi]} · <span class="num">${pctText(ms.byDow[bdi])}</span>`) : '',
    insight('✨', 'ימים מושלמים החודש', `<span class="num">${ms.perfect}</span> מתוך <span class="num">${past.filter((x) => x.total).length}</span>`),
  ].join('');

  const bars = ms.per.map((p) => `<div class="bar-row"><div class="b-name">${esc(p.h.emoji)} ${esc(p.h.name)}</div>
      <div class="b-val num">${pctText(p.pct)}</div>
      <div class="track"><i style="width:${(p.pct || 0) * 100}%;background:${statusColor(p.pct)}"></i></div>
      <div class="b-note" style="grid-column:1"><span class="num">${p.done}</span> מתוך <span class="num">${p.sched}</span> · רצף נוכחי <span class="num">${streak(p.h)}</span></div></div>`).join('');
  const weeks = ms.weeks.map((w) => `<div class="bar-row"><div class="b-name"><span class="wk-dot" style="background:${WEEK_COLORS[w.w]}"></span>שבוע ${w.w + 1} <span class="small">(${w.from}–${w.to})</span></div>
      <div class="b-val num">${pctText(w.score)}</div>
      <div class="track"><i style="width:${(w.score || 0) * 100}%;background:${statusColor(w.score)}"></i></div></div>`).join('');
  const statusLegend = `<div class="legend-status"><span><i style="background:${STATUS.bad}"></i>מתחת ל-40%</span><span><i style="background:${STATUS.mid}"></i>40%–69%</span><span><i style="background:${STATUS.good}"></i>70% ומעלה</span></div>`;
  const hasMind = ms.days.some((x) => x.mood || x.motivation);
  const table = (head, rows) => `<details class="table-toggle"><summary>הצג כטבלה</summary>
      <table><tr>${head.map((h) => `<th>${h}</th>`).join('')}</tr>
      ${rows.map((r) => `<tr>${r.map((c) => `<td class="num">${c}</td>`).join('')}</tr>`).join('')}</table></details>`;

  view.innerHTML = `<section class="swipe-area" id="statsSwipe">${monthNav()}
    <div class="insights">${insights}</div>
    <div class="section-title"><h2>התקדמות יומית</h2><span class="hint">באחוזים</span></div>
    <div class="card chart-card">${areaChart('prog', ms.days.map((x) => ({ d: x.d, dk: x.dk, future: x.future, v: x.future ? null : x.pct })))}
      ${table(['יום', 'בוצעו', 'אחוז'], past.map((x) => [x.d, `${x.done}/${x.total}`, pctText(x.pct)]))}</div>
    <div class="section-title"><h2>ניתוח לפי הרגל</h2><span class="hint">עד היום</span></div>
    <div class="card"><div class="bars">${bars}</div>${statusLegend}</div>
    <div class="section-title"><h2>מצב רוח ומוטיבציה</h2><span class="hint">1 עד 10</span></div>
    <div class="card chart-card">${hasMind ? `${lineChart('mind', ms.days.map((x) => ({ d: x.d, dk: x.dk, future: x.future, mood: x.mood, motivation: x.motivation })), [{ key: 'mood', name: 'מצב רוח', color: SERIES.mood }, { key: 'motivation', name: 'מוטיבציה', color: SERIES.motivation }], 10)}
      ${table(['יום', 'מצב רוח', 'מוטיבציה'], past.filter((x) => x.mood || x.motivation).map((x) => [x.d, x.mood || '–', x.motivation || '–']))}`
      : '<p class="small" style="margin:4px">עוד אין נתונים. דרג מצב רוח ומוטיבציה במסך היום.</p>'}</div>
    <div class="section-title"><h2>ציון מיינדסט שבועי</h2><span class="hint">ממוצע מצב רוח ומוטיבציה</span></div>
    <div class="card"><div class="bars">${weeks}</div>${statusLegend}</div>
    <button class="btn ghost block" style="margin-top:24px" data-action="export-xlsx">${ICON.xls} ייצוא לאקסל</button>
  </section>`;
  wireCharts();
  attachSwipe($('#statsSwipe'), (dir) => changeMonth(dir), { follow: true, ignore: '.chart, details' });
}

/* ------------------------------------------------------------------ HABITS */
function renderHabits() {
  const list = habitsList();
  const items = list.map((h, i) => `<div class="mgr-item">
      <button class="mgr-open" data-action="edit" data-id="${h.id}" aria-label="עריכת ${esc(h.name)}">
        <span class="emoji" style="background:color-mix(in srgb, ${h.color} 20%, var(--s2))" aria-hidden="true">${esc(h.emoji)}</span>
        <span class="body"><span class="name">${esc(h.name)}</span><span class="days">${daysSummary(h.days)}</span></span>${ICON.chev}</button>
      <button class="icon-btn" data-action="move" data-id="${h.id}" data-dir="-1" aria-label="הזז למעלה" ${i === 0 ? 'disabled' : ''}>${ICON.up}</button>
      <button class="icon-btn" data-action="move" data-id="${h.id}" data-dir="1" aria-label="הזז למטה" ${i === list.length - 1 ? 'disabled' : ''}>${ICON.down}</button></div>`).join('');
  view.innerHTML = `<section>
    <div class="section-title" style="margin-top:8px"><h2>ההרגלים שלי</h2><span class="hint"><span class="num">${list.length}</span> פעילים</span></div>
    ${list.length ? `<div class="card list-card">${items}</div>`
      : `<div class="card empty"><div class="empty-ico" aria-hidden="true">📝</div><h2>עוד אין הרגלים</h2><p>הוסף הרגל ראשון מהספרייה, או צור אחד משלך.</p></div>`}
    <div class="sticky-cta"><button class="btn block" data-action="add-habit">${ICON.plus} הוסף הרגל</button></div>
  </section>`;
}

/* ------------------------------------------------------------------ sheets */
const sheet = $('#sheet'), sheetBody = $('#sheetBody'), backdrop = $('#backdrop');
let sheetOpen = false, sheetCtx = null, sheetTimer = null;

function openSheet(html, ctx = null, focus = false) {
  sheetBody.innerHTML = html; sheetCtx = ctx;
  clearTimeout(sheetTimer);
  if (!sheetOpen) {
    if (history.state && history.state.ctx) history.replaceState({ sheet: 1 }, ''); else history.pushState({ sheet: 1 }, '');
    appEl.style.setProperty('--origin-y', (scrollY + innerHeight / 2) + 'px');
    sheet.hidden = false; backdrop.hidden = false;
    sheet.getBoundingClientRect(); // commit the start position so the sheet slides up
    root.classList.add('sheet-open'); sheet.classList.add('show'); backdrop.classList.add('show');
  }
  sheetOpen = true;
  sheet.scrollTop = 0;
  if (focus) { const f = sheet.querySelector('input'); if (f) setTimeout(() => f.focus({ preventScroll: true }), 120); }
}
function closeSheet(fromPop = false) {
  if (!sheetOpen) return;
  sheetOpen = false; sheetCtx = null;
  if (document.activeElement && sheet.contains(document.activeElement)) document.activeElement.blur();
  sheet.classList.remove('show', 'dragging'); backdrop.classList.remove('show', 'dragging');
  sheet.style.transform = ''; backdrop.style.opacity = ''; appEl.style.transform = ''; appEl.style.transition = '';
  root.classList.remove('sheet-open');
  sheetTimer = setTimeout(() => { if (!sheetOpen) { sheet.hidden = true; backdrop.hidden = true; } }, reduceMotion() ? 0 : 340);
  if (!fromPop && history.state && history.state.sheet) history.back();
}
backdrop.addEventListener('click', () => closeSheet());

/* drag the sheet down to close it; the page behind grows back as it goes */
(function sheetDrag() {
  let d = null;
  sheet.addEventListener('touchstart', (e) => {
    if (!sheetOpen || e.touches.length !== 1) return;
    const head = !!e.target.closest('.sheet-head');
    if (!head && sheet.scrollTop > 0) { d = null; return; }
    d = { y0: e.touches[0].clientY, x0: e.touches[0].clientX, t0: performance.now(), dy: 0, on: false, head };
  }, { passive: true });
  sheet.addEventListener('touchmove', (e) => {
    if (!d) return;
    const dy = e.touches[0].clientY - d.y0, dx = e.touches[0].clientX - d.x0;
    if (!d.on) {
      if (dy > 6 && dy > Math.abs(dx) && (d.head || sheet.scrollTop <= 0)) {
        d.on = true; sheet.classList.add('dragging'); backdrop.classList.add('dragging'); appEl.style.transition = 'none';
      } else if (dy < -6 || Math.abs(dx) > 10) { d = null; return; } else return;
    }
    if (e.cancelable) e.preventDefault();
    d.dy = Math.max(0, dy);
    const p = Math.min(1, d.dy / Math.max(1, sheet.offsetHeight));
    sheet.style.transform = `translateY(${d.dy}px)`;
    backdrop.style.opacity = String(1 - p);
    if (!reduceMotion()) appEl.style.transform = `scale(${0.94 + 0.06 * p})`;
  }, { passive: false });
  const end = () => {
    if (!d) return;
    const g = d; d = null;
    if (!g.on) return;
    sheet.classList.remove('dragging'); backdrop.classList.remove('dragging'); appEl.style.transition = '';
    const v = g.dy / Math.max(1, performance.now() - g.t0);
    if (g.dy > 120 || (g.dy > 40 && v > 0.5)) { vibrate(HAPTIC.tap); closeSheet(); }
    else { sheet.style.transform = ''; backdrop.style.opacity = ''; appEl.style.transform = ''; }
  };
  sheet.addEventListener('touchend', end);
  sheet.addEventListener('touchcancel', end);
})();

const DOW_PRESETS = [['0,1,2,3,4,5,6', 'כל יום'], ['0,1,2,3,4,5', 'בלי שבת'], ['0,1,2,3,4', 'א–ה']];
function syncPresets() {
  const cur = [...sheetCtx.days].sort().join();
  sheet.querySelectorAll('[data-action=dow-preset]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.set === cur)));
  sheet.querySelectorAll('[data-action=pick-dow]').forEach((b) => b.setAttribute('aria-pressed', String(sheetCtx.days.has(Number(b.dataset.dow)))));
  if (sheetCtx.days.size) { $('#hDays').classList.remove('is-error'); setField(null, $('#hDaysMsg'), '', ''); }
}
function habitEditor(id, preset = {}) {
  const h = id ? S.habits[id] : { name: preset.name || '', emoji: '✅', color: PALETTE[habitsList().length % PALETTE.length], days: [0, 1, 2, 3, 4, 5, 6] };
  const ctx = { id, emoji: h.emoji, color: h.color, days: new Set(h.days), confirmDelete: false, tried: false };
  const cur = [...h.days].sort().join();
  openSheet(`<h2 id="sheetTitle">${id ? 'עריכת הרגל' : 'הרגל חדש'}</h2>
    <p class="lead">${id ? 'שינויים נשמרים לכל הימים. ההיסטוריה נשארת.' : 'שם קצר וברור עובד הכי טוב.'}</p>
    <div class="field"><label for="hName">שם ההרגל</label><input class="input" id="hName" maxlength="40" value="${esc(h.name)}" placeholder="לדוגמה: אימון כוח" autocomplete="off" aria-describedby="hNameMsg">
      <div class="field-msg" id="hNameMsg" aria-live="polite"></div></div>
    <div class="field"><div class="label">אייקון</div><div class="emoji-grid" role="group" aria-label="בחירת אייקון">${EMOJIS.map((e) => `<button type="button" data-action="pick-emoji" data-emoji="${e}" aria-pressed="${e === h.emoji}">${e}</button>`).join('')}</div></div>
    <div class="field"><div class="label">צבע</div><div class="color-row" role="group" aria-label="בחירת צבע">${PALETTE.map((c, i) => `<button type="button" class="swatch" style="background:${c}" data-action="pick-color" data-color="${c}" aria-pressed="${c === h.color}" aria-label="צבע ${i + 1}"></button>`).join('')}</div></div>
    <div class="field group" id="hDays"><div class="label">באילו ימים?</div>
      <div class="daychips" role="group" aria-label="ימים בשבוע">${DAY_LETTERS.map((l, i) => `<button type="button" data-action="pick-dow" data-dow="${i}" aria-pressed="${h.days.includes(i)}" aria-label="יום ${DAY_NAMES[i]}">${l}</button>`).join('')}</div>
      <div class="chips presets">${DOW_PRESETS.map(([set, label]) => `<button type="button" class="chip" data-action="dow-preset" data-set="${set}" aria-pressed="${set === cur}">${label}</button>`).join('')}</div>
      <div class="field-msg" id="hDaysMsg" aria-live="polite"></div></div>
    ${id ? '<button class="btn danger block" data-action="delete-habit">מחק הרגל</button>' : ''}
    <div class="sheet-foot"><div class="btn-row"><button class="btn ghost" data-action="close-sheet">ביטול</button><button class="btn" data-action="save-habit">${id ? 'שמור' : 'הוסף הרגל'}</button></div></div>`, ctx, !id && !preset.name);
}
function validateName(final = false) {
  const inp = $('#hName'), msg = $('#hNameMsg'); if (!inp || !sheetCtx) return true;
  const name = inp.value.trim();
  if (!name) {
    if (final || sheetCtx.tried) { setField(inp, msg, 'error', 'צריך לתת שם להרגל.'); return false; }
    setField(inp, msg, '', ''); return false;
  }
  const dup = habitsList().some((x) => x.id !== sheetCtx.id && x.name.trim() === name);
  setField(inp, msg, dup ? 'warning' : '', dup ? 'כבר יש לך הרגל בשם הזה. אפשר לשמור בכל זאת.' : '');
  return true;
}

function syncStateText() {
  const st = sync.state, last = Number(lsGet(LS_LAST)) || 0;
  const ago = last ? relTime(last) : '';
  return {
    local: ['הנתונים שמורים רק במכשיר הזה', 'חבר את GitHub כדי לשמור בענן'],
    syncing: ['מסנכרן…', ''],
    ok: ['שמור בענן', ago ? `סונכרן ${ago}` : ''],
    offline: ['אין חיבור לאינטרנט', 'השינויים נשמרים במכשיר ויעלו לענן כשהחיבור יחזור'],
    error: ['הסנכרון נכשל', 'ננסה שוב אוטומטית. אפשר גם ללחוץ "סנכרן עכשיו"'],
    auth: ['הטוקן לא תקין או שפג תוקפו', 'צור טוקן חדש וחבר מחדש'],
  }[st] || ['', ''];
}
function relTime(t) {
  const s = Math.round((now() - t) / 1000);
  if (s < 45) return 'עכשיו';
  const m = Math.round(s / 60); if (m < 60) return `לפני ${m} דק׳`;
  const h = Math.round(m / 60); if (h < 24) return `לפני ${h} שע׳`;
  return `לפני ${Math.round(h / 24)} ימים`;
}
const statusRow = (state, title, sub) => `<div class="status-row" data-state="${state}"><span class="sync-dot"></span><div><div class="st-title">${title}</div>${sub ? `<div class="small">${sub}</div>` : ''}</div></div>`;

function settingsSheet(msg = '') {
  const token = lsGet(LS_TOKEN), login = lsGet(LS_LOGIN);
  const [t1, t2] = syncStateText();
  const connected = !!token;
  const opt = (k, ico, label) => `<button class="option" data-action="pref" data-pref="${k}" aria-pressed="${prefs[k]}"><span class="o-ico" aria-hidden="true">${ico}</span><span class="o-label">${label}</span><span class="switch" aria-hidden="true"></span></button>`;
  openSheet(`<h2 id="sheetTitle">ענן, גיבוי והגדרות</h2>
    ${statusRow(sync.state, t1, t2)}
    ${connected ? `<p class="small" style="margin:0 0 16px">מחובר ל-GitHub${login ? ' כ-<span class="num">@' + esc(login) + '</span>' : ''}. הנתונים נשמרים בקובץ סודי בחשבון GitHub שלך. הוא לא מופיע בחיפוש ולא בפרופיל.</p>
      <div class="btn-row"><button class="btn" data-action="sync-now">${ICON.sync} סנכרן עכשיו</button><button class="btn ghost" data-action="disconnect">התנתק</button></div>`
    : `<p class="lead">שמירה בענן חינמית דרך GitHub. אחרי החיבור, כל סימון נשמר גם בענן, ואפשר לפתוח את האפליקציה מכל מכשיר.</p>
      <ol class="steps">
        <li>לחץ על הכפתור למטה. הוא פותח את GitHub בעמוד יצירת מפתח גישה. אם צריך, התחבר לחשבון.</li>
        <li>בשדה התוקף בחר:<span class="en">Expiration: No expiration</span>ההרשאה היחידה שצריך כבר מסומנת:<span class="en">gist</span></li>
        <li>גלול למטה ולחץ:<span class="en">Generate token</span>העתק את הקוד שמתחיל ב:<span class="en">ghp_</span></li>
        <li>חזור לכאן, הדבק את הקוד בשדה ולחץ "חבר וסנכרן".</li>
      </ol>
      <a class="btn ghost block" href="${TOKEN_URL}" target="_blank" rel="noopener">פתח את GitHub ליצירת מפתח</a>
      <div class="field" style="margin-top:16px"><label for="tokenIn">מפתח הגישה</label><input class="input ltr" id="tokenIn" placeholder="ghp_..." autocomplete="off" autocapitalize="off" spellcheck="false" aria-describedby="tokErr">
        <div class="field-msg" id="tokErr" aria-live="polite"></div></div>
      <button class="btn block" data-action="connect">${ICON.cloud} חבר וסנכרן</button>`}
    <div class="divider"></div>
    <div class="label">משוב</div>
    <div class="options">${opt('haptics', '📳', 'רטט')}${opt('sound', '🔔', 'צליל הצלחה')}</div>
    <p class="small" style="margin:8px 0 0">הצליל נשמע לפי עוצמת המדיה של הטלפון.</p>
    <div class="divider"></div>
    <div class="field"><label for="nameIn">איך לקרוא לך?</label><input class="input" id="nameIn" maxlength="24" value="${esc(S.profile.name)}" placeholder="השם שלך (לא חובה)"></div>
    <div class="divider"></div>
    <div class="label">סיכום באקסל</div>
    <button class="btn block" data-action="export-xlsx">${ICON.xls} ייצוא לאקסל</button>
    <p class="small" style="margin:8px 0 0">קובץ עם גיליון סיכום, גיליון לכל חודש עם גרפים, ויומן מלא. לפני הייצוא האפליקציה מסתנכרנת עם הענן, כך שהקובץ כולל את כל המכשירים.</p>
    <div class="divider"></div>
    <div class="label">גיבוי לקובץ</div>
    <div class="btn-row"><button class="btn ghost" data-action="export">${ICON.down2} ייצוא</button><button class="btn ghost" data-action="import">${ICON.up2} ייבוא</button></div>
    <input type="file" id="importIn" accept="application/json,.json" hidden>
    <p class="small" style="margin-top:16px">המפתח נשמר רק במכשיר הזה ונותן גישה רק ל-Gists. גרסה <span class="num">${APP_VERSION}</span></p>`);
  if (msg) setField($('#tokenIn'), $('#tokErr'), 'error', msg);
}

/* ------------------------------------------------------------------ long-press menu */
const ctxEl = $('#ctx'), ctxCard = $('#ctxCard'), ctxMenu = $('#ctxMenu');
let ctxOpen = false, suppressClick = 0;
function openCtx(card) {
  const id = card.dataset.id, h = S.habits[id];
  if (!h || sheetOpen) return;
  const r = card.getBoundingClientRect(), done = isDone(id, ui.day);
  card.classList.remove('pressing');
  ctxCard.innerHTML = card.outerHTML;
  const clone = ctxCard.firstElementChild;
  clone.removeAttribute('data-action'); clone.tabIndex = -1; clone.classList.remove('pop');
  Object.assign(ctxCard.style, { top: r.top + 'px', left: r.left + 'px', width: r.width + 'px' });
  ctxMenu.innerHTML = `<button role="menuitem" data-action="ctx-toggle" data-id="${id}">${done ? ICON.undo : ICON.check}${done ? 'בטל סימון' : 'סמן כבוצע'}</button>
    <button role="menuitem" data-action="ctx-edit" data-id="${id}">${ICON.edit}עריכת ההרגל</button>
    <button role="menuitem" data-action="ctx-stats">${ICON.stats}ניתוח החודש</button>`;
  ctxEl.hidden = false; root.classList.add('ctx-open'); ctxOpen = true;
  const mh = ctxMenu.offsetHeight, below = r.bottom + 16 + mh < innerHeight - 16;
  ctxMenu.style.top = (below ? r.bottom + 16 : Math.max(16, r.top - 16 - mh)) + 'px';
  history.pushState({ ctx: 1 }, '');
  ctxMenu.querySelector('button').focus({ preventScroll: true });
}
function closeCtx(fromPop = false) {
  if (!ctxOpen) return;
  ctxOpen = false; ctxEl.hidden = true; root.classList.remove('ctx-open');
  if (!fromPop && history.state && history.state.ctx) history.back();
}
(function longPress() {
  let t = null, t2 = null, sx = 0, sy = 0, el = null;
  const cancel = () => { clearTimeout(t); clearTimeout(t2); t = null; if (el) el.classList.remove('pressing'); el = null; };
  document.addEventListener('pointerdown', (e) => {
    const c = e.target.closest('.habit[data-action="toggle"]');
    if (!c || c.disabled || e.button > 0) return;
    cancel(); el = c; sx = e.clientX; sy = e.clientY;
    t2 = setTimeout(() => { if (el === c) c.classList.add('pressing'); }, 140);
    t = setTimeout(() => { const card = el; cancel(); if (!card) return; suppressClick = performance.now() + 800; vibrate(HAPTIC.edge); openCtx(card); }, 480);
  }, { passive: true });
  document.addEventListener('pointermove', (e) => { if (t && Math.hypot(e.clientX - sx, e.clientY - sy) > 10) cancel(); }, { passive: true });
  document.addEventListener('pointerup', () => { if (t) cancel(); }, { passive: true });
  document.addEventListener('pointercancel', () => { if (t) cancel(); }, { passive: true });
  document.addEventListener('scroll', () => { if (t) cancel(); }, { passive: true, capture: true });
  document.addEventListener('contextmenu', (e) => { if (e.target.closest('.habit')) e.preventDefault(); });
})();

/* ------------------------------------------------------------------ first-use coach mark */
function maybeCoach() {
  if (lsGet(LS_COACH) || sheetOpen || ui.tab !== 'today') return;
  const card = view.querySelector('.habit[data-action="toggle"]:not([disabled])');
  if (!card) return;
  lsSet(LS_COACH, '1');
  setTimeout(() => { if (!sheetOpen && ui.tab === 'today' && document.contains(card)) showCoach(card); }, 500);
}
function showCoach(card) {
  let r = card.getBoundingClientRect();
  if (r.bottom > innerHeight - 260) { window.scrollBy({ top: r.bottom - innerHeight + 280 }); r = card.getBoundingClientRect(); }
  const spot = $('#coachSpot'), pop = $('#coachPop'), co = $('#coach');
  $('#toast').classList.remove('show');
  Object.assign(spot.style, { top: r.top - 4 + 'px', left: r.left - 4 + 'px', width: r.width + 8 + 'px', height: r.height + 8 + 'px' });
  pop.innerHTML = `<h3 id="coachTitle">איך זה עובד</h3><ul>
      <li><span aria-hidden="true">👆</span><span>הקשה על הרגל מסמנת שעשית אותו.</span></li>
      <li><span aria-hidden="true">✋</span><span>לחיצה ארוכה פותחת עריכה ועוד אפשרויות.</span></li>
      <li><span aria-hidden="true">↔️</span><span>החלקה ימינה או שמאלה עוברת בין ימים.</span></li></ul>
    <button class="btn block" data-action="coach-done">הבנתי</button>`;
  co.hidden = false;
  const ph = pop.offsetHeight, below = r.bottom + 16 + ph < innerHeight - 16;
  pop.classList.toggle('above', !below);
  pop.style.top = (below ? r.bottom + 16 : Math.max(16, r.top - 16 - ph)) + 'px';
  pop.querySelector('button').focus({ preventScroll: true });
}
const hideCoach = () => { $('#coach').hidden = true; };
$('#coach').addEventListener('click', (e) => { if (!e.target.closest('.coach-pop')) hideCoach(); });

/* ------------------------------------------------------------------ toast & confetti */
let toastTimer = null;
const TOAST_ICO = {
  success: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  error: '<circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5M12 16.5h.01"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.5h.01"/>',
};
/** toast(message, [action], [kind]) – kind: success | error | info */
function toast(msg, action, kind = 'success') {
  if (typeof action === 'string') { kind = action; action = null; }
  const t = $('#toast');
  t.className = 'toast ' + kind;
  t.innerHTML = `<svg class="t-ico" viewBox="0 0 24 24" aria-hidden="true">${TOAST_ICO[kind] || TOAST_ICO.info}</svg><span>${esc(msg)}</span>` + (action ? `<button type="button">${esc(action.label)}</button>` : '');
  if (action) t.querySelector('button').onclick = () => { action.fn(); t.classList.remove('show'); };
  t.getBoundingClientRect();
  t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), action ? 5000 : 2400);
}

function confetti() {
  if (reduceMotion()) return;
  const cv = $('#confetti'), ctx = cv.getContext('2d'), dpr = window.devicePixelRatio || 1;
  cv.width = innerWidth * dpr; cv.height = innerHeight * dpr; ctx.scale(dpr, dpr);
  const parts = Array.from({ length: 90 }, () => ({
    x: innerWidth / 2, y: innerHeight * 0.35, vx: (Math.random() - 0.5) * 11, vy: -Math.random() * 11 - 3,
    r: 3 + Math.random() * 4, c: PALETTE[(Math.random() * PALETTE.length) | 0], a: Math.random() * 6, va: (Math.random() - 0.5) * 0.3,
  }));
  const t0 = performance.now();
  (function frame(t) {
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    for (const p of parts) {
      p.vy += 0.32; p.x += p.vx; p.y += p.vy; p.a += p.va;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a); ctx.fillStyle = p.c; ctx.fillRect(-p.r, -p.r / 2, p.r * 2, p.r); ctx.restore();
    }
    if (t - t0 < 1600) requestAnimationFrame(frame); else ctx.clearRect(0, 0, innerWidth, innerHeight);
  })(t0);
}

/* ------------------------------------------------------------------ routing */
function render() {
  renderHeader();
  view.classList.toggle('animate', ui.anim); ui.anim = false;
  document.querySelectorAll('.tab').forEach((b) => b.setAttribute('aria-current', b.dataset.tab === ui.tab ? 'page' : 'false'));
  if (ui.tab !== 'today') { if (heroObs) heroObs.disconnect(); $('#topbar').classList.remove('compact'); root.classList.remove('onboarding'); }
  ({ today: renderToday, month: renderMonth, stats: renderStats, habits: renderHabits }[ui.tab] || renderToday)();
  if (ui.swipeFrom) {
    const sec = view.firstElementChild;
    if (sec && !reduceMotion()) { sec.style.setProperty('--from', ui.swipeFrom); sec.classList.add('slide-in'); }
    ui.swipeFrom = null;
  }
}
function go(tab, push = false) {
  ui.tab = tab; ui.anim = true; ui.quietScroll = performance.now() + 400;
  if (push) history.pushState({ drill: 1 }, '', '#' + tab);
  else history.replaceState(history.state && history.state.drill ? history.state : null, '', '#' + tab);
  window.scrollTo({ top: 0 });
  render();
}

/* ------------------------------------------------------------------ events */
function toggleHabit(id) {
  const dk = ui.day, before = dayStat(dk);
  const v = !isDone(id, dk);
  setDone(id, dk, v);
  render();
  const card = view.querySelector(`.habit[data-id="${id}"]`); if (card && v) card.classList.add('pop');
  const after = dayStat(dk);
  const perfect = v && after.total && after.done === after.total && before.done < before.total;
  if (perfect) { confetti(); vibrate(HAPTIC.perfect); chime('perfect'); toast('יום מושלם! כל ההרגלים בוצעו'); }
  else if (v) { vibrate(HAPTIC.done); chime('done'); }
  else vibrate(HAPTIC.undo);
}
function libToggle(el) {
  const key = el.dataset.key, [name, emoji] = key.split('|');
  const mine = ui.added.find((a) => a.key === key && S.habits[a.id] && !S.habits[a.id].deleted);
  if (mine) {
    S.habits[mine.id] = { ...S.habits[mine.id], deleted: true, t: now() }; save();
    ui.added = ui.added.filter((a) => a !== mine);
    el.setAttribute('aria-pressed', 'false'); el.lastElementChild.outerHTML = ICON.plusSm; vibrate(HAPTIC.undo);
  } else if (el.getAttribute('aria-pressed') === 'true') {
    toast('כבר ברשימה שלך', 'info'); return;
  } else {
    const id = addHabit({ name, emoji }); save();
    ui.added.push({ key, id });
    el.setAttribute('aria-pressed', 'true'); el.lastElementChild.outerHTML = ICON.checkSm; vibrate(HAPTIC.done); chime('done');
  }
  const n = ui.added.length, done = $('#addDone');
  if (done) done.innerHTML = n ? `<span>סיום · נוספו <span class="num">${n}</span></span>` : 'סיום';
  render();
}

document.addEventListener('click', (e) => {
  if (performance.now() < suppressClick && !e.target.closest('#ctxMenu')) { suppressClick = 0; e.preventDefault(); return; }
  const tabBtn = e.target.closest('.tab');
  if (tabBtn) { go(tabBtn.dataset.tab); return; }
  const el = e.target.closest('[data-action]');
  if (!el || el.disabled) return;
  const a = el.dataset.action;
  switch (a) {
    case 'toggle': toggleHabit(el.dataset.id); break;
    case 'pick-day': {
      const nd = el.dataset.day; if (nd === ui.day) break;
      ui.swipeFrom = nd > ui.day ? '-35%' : '35%'; ui.day = nd; render(); break;
    }
    case 'go-today': ui.swipeFrom = '-35%'; ui.day = todayKey(); render(); break;
    case 'week': moveDay(Number(el.dataset.dir) * 7); break;
    case 'toggle-off': ui.showOff = !ui.showOff; render(); break;
    case 'pick': {
      const k = el.dataset.key, was = ui.pick.size;
      ui.pick.has(k) ? ui.pick.delete(k) : ui.pick.add(k);
      el.setAttribute('aria-pressed', String(ui.pick.has(k)));
      el.lastElementChild.outerHTML = ui.pick.has(k) ? ICON.checkSm : ICON.plusSm;
      const sb = $('#startBtn');
      sb.disabled = !ui.pick.size;
      sb.innerHTML = startLabel();
      if (!was && ui.pick.size) { sb.classList.remove('cta-pulse'); sb.getBoundingClientRect(); sb.classList.add('cta-pulse'); }
      break;
    }
    case 'start': {
      [...ui.pick].forEach((k) => { const [n, em] = k.split('|'); addHabit({ name: n, emoji: em }); });
      ui.pick.clear(); ui.libQ = ''; save(); vibrate(HAPTIC.done); chime('done'); toast('יאללה, מתחילים 💪'); window.scrollTo({ top: 0 }); render(); break;
    }
    case 'month': changeMonth(Number(el.dataset.dir)); break;
    case 'mweek': ui.mweek = Number(el.dataset.w); render(); break;
    case 'cell': {
      const v = !isDone(el.dataset.id, el.dataset.day);
      setDone(el.dataset.id, el.dataset.day, v);
      if (v) { vibrate(HAPTIC.done); chime('done'); } else vibrate(HAPTIC.undo);
      render();
      break;
    }
    case 'open-day': ui.day = el.dataset.day; go('today', true); break;
    case 'tab': go(el.dataset.tab); break;
    case 'add-habit': addSheet(); break;
    case 'new-habit': habitEditor(null, { name: el.dataset.name || '' }); break;
    case 'edit': habitEditor(el.dataset.id); break;
    case 'close-sheet': closeSheet(); break;
    case 'move': {
      const list = habitsList(), i = list.findIndex((h) => h.id === el.dataset.id), j = i + Number(el.dataset.dir);
      if (j < 0 || j >= list.length) break;
      [list[i], list[j]] = [list[j], list[i]];
      const t = now(); list.forEach((h, k) => { S.habits[h.id] = { ...S.habits[h.id], order: k, t }; });
      save(); render(); break;
    }
    case 'lib-add': libToggle(el); break;
    case 'lib-clear': { ui.libQ = ''; const s = $('#libSearch'); if (s) { s.value = ''; } refreshLibrary(); break; }
    case 'lib-suggest': { ui.libQ = el.dataset.q; const s = $('#libSearch'); if (s) s.value = ui.libQ; refreshLibrary(); break; }
    case 'pick-emoji': sheetCtx.emoji = el.dataset.emoji; sheet.querySelectorAll('[data-action=pick-emoji]').forEach((b) => b.setAttribute('aria-pressed', String(b === el))); break;
    case 'pick-color': sheetCtx.color = el.dataset.color; sheet.querySelectorAll('[data-action=pick-color]').forEach((b) => b.setAttribute('aria-pressed', String(b === el))); break;
    case 'pick-dow': {
      const d = Number(el.dataset.dow); sheetCtx.days.has(d) ? sheetCtx.days.delete(d) : sheetCtx.days.add(d);
      syncPresets(); break;
    }
    case 'dow-preset': sheetCtx.days = new Set(el.dataset.set.split(',').map(Number)); syncPresets(); break;
    case 'save-habit': {
      sheetCtx.tried = true;
      const okName = validateName(true);
      if (!sheetCtx.days.size) { $('#hDays').classList.add('is-error'); setField(null, $('#hDaysMsg'), 'error', 'בחר לפחות יום אחד.'); }
      if (!okName) { $('#hName').focus(); break; }
      if (!sheetCtx.days.size) break;
      const name = $('#hName').value.trim();
      const data = { name, emoji: sheetCtx.emoji, color: sheetCtx.color, days: [...sheetCtx.days].sort() };
      if (sheetCtx.id) { updateHabit(sheetCtx.id, data); toast('נשמר'); } else { addHabit(data); save(); toast(`נוסף: ${name}`); }
      closeSheet(); render(); break;
    }
    case 'delete-habit': {
      if (!sheetCtx.confirmDelete) { sheetCtx.confirmDelete = true; el.classList.add('armed'); el.textContent = 'לחץ שוב כדי למחוק'; vibrate(HAPTIC.edge); break; }
      const id = sheetCtx.id, name = S.habits[id].name;
      updateHabit(id, { deleted: true }); closeSheet(); render();
      toast(`נמחק: ${name}`, { label: 'בטל', fn: () => { updateHabit(id, { deleted: false }); render(); } }, 'info');
      break;
    }
    case 'ctx-close': closeCtx(); break;
    case 'ctx-toggle': closeCtx(); toggleHabit(el.dataset.id); break;
    case 'ctx-edit': closeCtx(true); habitEditor(el.dataset.id); break;
    case 'ctx-stats': closeCtx(true); ui.month = { y: parseKey(ui.day).getFullYear(), m: parseKey(ui.day).getMonth() }; go('stats', true); break;
    case 'coach-done': hideCoach(); break;
    case 'open-settings': settingsSheet(); break;
    case 'connect': connect(); break;
    case 'sync-now': busy(el, true); sync.run(true).then(() => { if (sheetOpen) settingsSheet(); }); break;
    case 'disconnect': {
      lsSet(LS_TOKEN, null); lsSet(LS_GIST, null); lsSet(LS_LOGIN, null); lsSet(LS_LAST, null);
      sync.set('local'); settingsSheet(); toast('נותקת. הנתונים נשארו במכשיר.', 'info'); break;
    }
    case 'export': {
      const blob = new Blob([JSON.stringify(S, null, 1)], { type: 'application/json' });
      const a2 = document.createElement('a'); a2.href = URL.createObjectURL(blob); a2.download = `habits-backup-${todayKey()}.json`;
      document.body.appendChild(a2); a2.click(); a2.remove(); setTimeout(() => URL.revokeObjectURL(a2.href), 2000);
      toast('קובץ הגיבוי ירד'); break;
    }
    case 'import': $('#importIn').click(); break;
    case 'export-xlsx': exportXlsx(); break;
    case 'xlsx-download': downloadBlob(ui.xlsx.blob, ui.xlsx.name); toast('הקובץ ירד'); break;
    case 'xlsx-share': busy(el, true); shareXlsx().finally(() => busy(el, false)); break;
    case 'pref': {
      const k = el.dataset.pref; prefs[k] = !prefs[k]; lsSet('hp.' + k, prefs[k] ? '1' : '0');
      el.setAttribute('aria-pressed', String(prefs[k]));
      if (prefs[k]) { if (k === 'sound') chime('done'); else vibrate(HAPTIC.done); }
      break;
    }
    default: break;
  }
});
window.addEventListener('popstate', () => {
  if (ctxOpen) { closeCtx(true); return; }
  if (sheetOpen) { closeSheet(true); return; }
  const h = (location.hash || '').slice(1);
  if (['today', 'month', 'stats', 'habits'].includes(h) && h !== ui.tab) { ui.tab = h; ui.anim = true; render(); }
});
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (!$('#coach').hidden) hideCoach();
  else if (ctxOpen) closeCtx();
  else closeSheet();
});

document.addEventListener('input', (e) => {
  if (e.target.id === 'libSearch') { ui.libQ = e.target.value; refreshLibrary(); return; }
  if (e.target.id === 'hName') { validateName(); return; }
  if (e.target.id === 'tokenIn') {
    const v = e.target.value.trim();
    const odd = v && !/^(ghp_|github_pat_)/.test(v);
    setField(e.target, $('#tokErr'), odd ? 'warning' : '', odd ? 'בדוק שהעתקת את כל המפתח. הוא מתחיל באחד מאלה:' : '', odd ? 'ghp_   github_pat_' : '');
    return;
  }
  const r = e.target.closest('input[data-mind]');
  if (!r) return;
  const f = r.dataset.mind, v = Number(r.value);
  if (mindVal(ui.day, f) !== v) vibrate(HAPTIC.tick);
  r.classList.remove('unset'); r.style.setProperty('--p', ((v - 1) / 9) * 100 + '%'); r.setAttribute('aria-valuetext', v + ' מתוך 10');
  const out = $('#mv-' + f); out.classList.remove('is-empty'); out.innerHTML = `<span class="num">${v}</span>`;
  setMind(ui.day, f, v);
  $('#mindScore').textContent = pctText(mindScore(ui.day));
});
document.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.id === 'libSearch') e.target.blur(); });
/* light tap on every control; toggles get their own richer pattern */
const TAP_SEL = 'button, a.btn, [data-action], .tab, input[type=range], summary';
document.addEventListener('pointerdown', (e) => {
  audioCtx(); // unlock audio inside a user gesture
  const el = e.target.closest(TAP_SEL);
  if (el && !el.disabled && !['toggle', 'cell', 'lib-add', 'pref'].includes(el.dataset.action)) vibrate(HAPTIC.tap);
}, { passive: true });
/* a soft tick every ~one card of vertical scrolling, a firmer bump at the top and bottom */
(function scrollHaptics() {
  const last = new WeakMap(); let lastBuzz = 0, touching = false, lastTouch = 0;
  addEventListener('touchstart', () => { touching = true; }, { passive: true });
  addEventListener('touchend', () => { touching = false; lastTouch = performance.now(); }, { passive: true });
  document.addEventListener('scroll', (e) => {
    const t = performance.now();
    if (!touching && t - lastTouch > 700) return; // only movement the finger started
    if (t < (ui.quietScroll || 0)) return; // ignore our own jumps (tab change)
    const el = e.target === document ? document.scrollingElement : e.target;
    if (!el) return;
    const y = el.scrollTop, st = last.get(el) || { y, acc: 0, edge: false };
    st.acc += Math.abs(y - st.y); st.y = y;
    const max = el.scrollHeight - el.clientHeight;
    const atEdge = max > 0 && (y <= 0 || y >= max - 1);
    if (atEdge && !st.edge) { vibrate(HAPTIC.edge); lastBuzz = t; st.acc = 0; }
    else if (st.acc >= 88 && t - lastBuzz > 80) { vibrate(HAPTIC.tick); lastBuzz = t; st.acc = 0; }
    st.edge = atEdge; last.set(el, st);
  }, { capture: true, passive: true });
})();
document.addEventListener('pointerdown', (e) => {
  // first touch on an unset slider records the default value too
  const r = e.target.closest('input[data-mind].unset');
  if (r) setTimeout(() => r.dispatchEvent(new Event('input', { bubbles: true })), 0);
});
document.addEventListener('change', (e) => {
  if (e.target.id === 'nameIn') { S.profile = { name: e.target.value.trim().slice(0, 24), t: now() }; save(); renderHeader(); toast('נשמר'); }
  if (e.target.id === 'importIn' && e.target.files[0]) {
    e.target.files[0].text().then((txt) => {
      const data = JSON.parse(txt);
      if (!data || typeof data !== 'object' || !data.habits) throw new Error('bad');
      S = mergeStates(S, data); save(); closeSheet(); render(); toast('הגיבוי נטען ומוזג');
    }).catch(() => toast('הקובץ לא תקין', 'error'));
  }
});

/* ------------------------------------------------------------------ Excel export */
function loadScript(src) {
  return new Promise((res, rej) => {
    if (window.HabitsExport) return res();
    const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('load ' + src));
    document.head.appendChild(s);
  });
}
function downloadBlob(blob, name) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
async function exportXlsx() {
  if (!habitsList().length) { toast('אין עדיין הרגלים לייצוא', 'info'); return; }
  openSheet(`<h2 id="sheetTitle">ייצוא לאקסל</h2>${statusRow('syncing', 'מכין את הקובץ…', lsGet(LS_TOKEN) ? 'מסנכרן קודם עם הענן' : 'מהנתונים שבמכשיר')}`);
  try {
    if (lsGet(LS_TOKEN)) await sync.run();
    await loadScript('export.js');
    const blob = window.HabitsExport.build();
    const name = `habits-summary-${todayKey()}.xlsx`;
    ui.xlsx = { blob, name };
    const file = new File([blob], name, { type: blob.type });
    const canShare = !!(navigator.canShare && navigator.canShare({ files: [file] }));
    const months = new Set(Object.keys(S.log).map((k) => k.slice(0, 7))).size || 1;
    openSheet(`<h2 id="sheetTitle">הקובץ מוכן</h2>
      ${statusRow('ok', esc(name), `גיליון סיכום · ${months} ${months === 1 ? 'חודש' : 'חודשים'} עם גרפים · יומן מלא`)}
      <div class="btn-row"><button class="btn" data-action="xlsx-download">${ICON.down2} הורדה</button>
      ${canShare ? `<button class="btn ghost" data-action="xlsx-share">שיתוף</button>` : ''}</div>
      <p class="small" style="margin-top:16px">הקובץ הוא צילום מצב של רגע הייצוא. לגרסה מעודכנת, מייצאים שוב.</p>`);
  } catch (e) {
    console.warn(e);
    openSheet(`<h2 id="sheetTitle">הייצוא נכשל</h2><p class="lead">בדוק חיבור לאינטרנט ונסה שוב.</p><button class="btn block" data-action="export-xlsx">נסה שוב</button>`);
  }
}
async function shareXlsx() {
  const { blob, name } = ui.xlsx;
  try { await navigator.share({ files: [new File([blob], name, { type: blob.type })], title: 'סיכום הרגלים' }); }
  catch (e) { if (e.name !== 'AbortError') { downloadBlob(blob, name); toast('הקובץ ירד'); } }
}

/* ------------------------------------------------------------------ cloud sync (GitHub Gist) */
const sync = {
  state: 'local', busy: false, again: false, timer: null,
  set(st) {
    this.state = st;
    const chip = $('#syncChip');
    chip.dataset.state = st;
    $('.sync-text', chip).textContent = { local: 'במכשיר בלבד', syncing: 'מסנכרן…', ok: 'שמור בענן', offline: 'לא מקוון', error: 'שגיאת סנכרון', auth: 'צריך להתחבר' }[st];
  },
  async run(manual = false) {
    const token = lsGet(LS_TOKEN);
    if (!token) { this.set('local'); return; }
    if (!navigator.onLine) { this.set('offline'); return; }
    if (this.busy) { this.again = true; return; }
    this.busy = true; this.set('syncing');
    try {
      let id = lsGet(LS_GIST);
      if (!id) { id = await findOrCreateGist(); lsSet(LS_GIST, id); }
      let remote;
      try { remote = await fetchRemote(id); } catch (e) {
        if (e.status === 404) { lsSet(LS_GIST, null); id = await findOrCreateGist(); lsSet(LS_GIST, id); remote = await fetchRemote(id); } else throw e;
      }
      const merged = remote ? mergeStates(S, remote) : S;
      const ms = stableStringify(merged);
      if (stableStringify(S) !== ms) { S = merged; persistLocal(); render(); }
      if (!remote || stableStringify(normalize(remote)) !== ms) await pushRemote(id, merged);
      lsSet(LS_LAST, String(now()));
      this.set('ok');
      if (manual) toast('סונכרן ✓');
    } catch (e) {
      console.warn('sync failed', e);
      this.set(e.status === 401 || e.status === 403 ? 'auth' : navigator.onLine ? 'error' : 'offline');
      if (manual) toast('הסנכרון נכשל', 'error');
    } finally {
      this.busy = false;
      if (this.again) { this.again = false; this.run(); }
    }
  },
};
function scheduleSync() {
  if (!lsGet(LS_TOKEN)) return;
  clearTimeout(sync.timer); sync.timer = setTimeout(() => sync.run(), 1200);
}

async function gh(path, opts = {}, token = lsGet(LS_TOKEN)) {
  const r = await fetch(GH + path, {
    method: opts.method || 'GET', cache: 'no-store',
    headers: { Accept: 'application/vnd.github+json', Authorization: 'Bearer ' + token, 'X-GitHub-Api-Version': '2022-11-28', ...(opts.body ? { 'Content-Type': 'application/json' } : {}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (!r.ok) { const e = new Error('GitHub ' + r.status); e.status = r.status; throw e; }
  return r;
}
async function findOrCreateGist() {
  for (let page = 1; page <= 5; page++) {
    const list = await (await gh(`/gists?per_page=100&page=${page}`)).json();
    const g = list.find((x) => x.files && x.files[GIST_FILE]);
    if (g) return g.id;
    if (list.length < 100) break;
  }
  const g = await (await gh('/gists', { method: 'POST', body: { description: 'Habit Tracker data (private)', public: false, files: { [GIST_FILE]: { content: JSON.stringify(S) } } } })).json();
  return g.id;
}
async function fetchRemote(id) {
  const g = await (await gh('/gists/' + id)).json();
  const f = g.files && g.files[GIST_FILE];
  if (!f) return null;
  let txt = f.content;
  if (f.truncated && f.raw_url) txt = await (await fetch(f.raw_url, { cache: 'no-store' })).text();
  try { return normalize(JSON.parse(txt)); } catch (e) { return null; }
}
async function pushRemote(id, data) {
  await gh('/gists/' + id, { method: 'PATCH', body: { files: { [GIST_FILE]: { content: JSON.stringify(data) } } } });
}
async function connect() {
  const inp = $('#tokenIn'), err = $('#tokErr'), btn = sheet.querySelector('[data-action=connect]');
  const token = (inp.value || '').trim();
  if (!token) { setField(inp, err, 'error', 'הדבק את המפתח מ-GitHub.'); inp.focus(); return; }
  busy(btn, true); setField(inp, err, '', '');
  try {
    const r = await gh('/user', {}, token);
    const user = await r.json();
    const scopes = r.headers.get('x-oauth-scopes');
    if (scopes != null && scopes !== '' && !scopes.split(',').map((s) => s.trim()).includes('gist')) {
      throw Object.assign(new Error('scope'), { scope: true });
    }
    lsSet(LS_TOKEN, token); lsSet(LS_LOGIN, user.login || ''); lsSet(LS_GIST, null);
    await sync.run();
    if (sync.state === 'ok') { closeSheet(); render(); toast('מחובר. הנתונים שמורים בענן ☁️'); }
    else settingsSheet('החיבור הצליח, אבל הסנכרון נכשל. נסה "סנכרן עכשיו".');
  } catch (e) {
    busy(btn, false);
    setField(inp, err, 'error', e.scope ? 'למפתח חסרה ההרשאה gist. צור מפתח חדש מהכפתור למעלה.'
      : e.status === 401 ? 'המפתח לא תקין. בדוק שהעתקת את כולו.' : 'אין חיבור ל-GitHub כרגע. נסה שוב.');
  }
}

/* ------------------------------------------------------------------ lifecycle */
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  const tk = todayKey();
  if (tk !== ui.lastToday) { if (ui.day === ui.lastToday) ui.day = tk; ui.lastToday = tk; render(); }
  sync.run();
});
window.addEventListener('online', () => sync.run());
window.addEventListener('offline', () => { if (lsGet(LS_TOKEN)) sync.set('offline'); });

(function init() {
  const h = (location.hash || '').slice(1);
  if (['today', 'month', 'stats', 'habits'].includes(h)) ui.tab = h;
  history.replaceState(null, '', '#' + ui.tab);
  sync.set(lsGet(LS_TOKEN) ? (navigator.onLine ? 'syncing' : 'offline') : 'local');
  render();
  sync.run();
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    const hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.register('sw.js').then((reg) => reg.update()).catch(() => {});
    // a new version took over: reload right away if the app just opened, otherwise offer it
    let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadController || reloaded) return;
      if (performance.now() < 15000 && !sheetOpen) { reloaded = true; location.reload(); }
      else toast('גרסה חדשה מוכנה', { label: 'רענן', fn: () => location.reload() });
    });
  }
})();
