/**
 * Business dates in America/New_York. Never emit raw ISO to the UI.
 */
const TZ = "America/New_York";
const WEEKDAYS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const WEEKDAYS_LONG = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function partsInTz(date, timeZone = TZ) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const bag = {};
  for (const p of fmt.formatToParts(date)) if (p.type !== "literal") bag[p.type] = p.value;
  return {
    year: Number(bag.year),
    month: Number(bag.month),
    day: Number(bag.day),
    hour: Number(bag.hour),
    minute: Number(bag.minute),
    weekday: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(bag.weekday),
  };
}

export function todayEt(now = new Date()) {
  const p = partsInTz(now);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

export function parseDay(day) {
  if (!day || day === "sin-fecha") return null;
  const m = String(day).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) };
}

function dayDiff(a, b) {
  const ua = Date.UTC(a.year, a.month - 1, a.day);
  const ub = Date.UTC(b.year, b.month - 1, b.day);
  return Math.round((ua - ub) / 86400000);
}

function weekdayOf(d) {
  return new Date(Date.UTC(d.year, d.month - 1, d.day)).getUTCDay();
}

function shortDate(d, { withYear = false, header = false } = {}) {
  const wd = weekdayOf(d);
  if (header && !withYear) {
    const today = parseDay(todayEt());
    const diff = today ? dayDiff(d, today) : 99;
    if (diff >= 0 && diff <= 6) return WEEKDAYS_LONG[wd];
  }
  const base = `${WEEKDAYS[wd]} ${d.day} ${MONTHS[d.month - 1]}`;
  return withYear ? `${base} ${d.year}` : base;
}

export function dayLabel(day, { now = new Date(), header = false } = {}) {
  const d = parseDay(day);
  if (!d) return header ? "Sin fecha" : "Sin fecha";
  const today = parseDay(todayEt(now));
  const diff = dayDiff(d, today);
  if (diff === 0) return header ? "Hoy" : "hoy";
  if (diff === 1) return header ? "Mañana" : "mañana";
  if (diff === -1) return header ? "Ayer" : "ayer";
  const withYear = d.year !== today.year;
  if (header) return shortDate(d, { withYear, header: true });
  if (diff > 1 && diff <= 6) return WEEKDAYS[weekdayOf(d)];
  return shortDate(d, { withYear });
}

export function overdueLabel(day, now = new Date()) {
  const d = parseDay(day);
  if (!d) return "";
  const today = parseDay(todayEt(now));
  if (dayDiff(d, today) >= 0) return "";
  return `Atrasado · ${shortDate(d, { withYear: d.year !== today.year })}`;
}

export function isOverdue(day, now = new Date()) {
  const d = parseDay(day);
  if (!d) return false;
  return dayDiff(d, parseDay(todayEt(now))) < 0;
}

export function isToday(day, now = new Date()) {
  return day && day === todayEt(now);
}

export function relativePast(iso, now = new Date()) {
  if (!iso) return "";
  const then = new Date(iso);
  if (Number.isNaN(+then)) return "";
  const sec = Math.max(0, Math.round((now - then) / 1000));
  if (sec < 45) return "hace un momento";
  if (sec < 90) return "hace 1 min";
  if (sec < 3600) return `hace ${Math.round(sec / 60)} min`;
  if (sec < 5400) return "hace 1 h";
  if (sec < 86400) return `hace ${Math.round(sec / 3600)} h`;
  const thenDay = partsInTz(then);
  const today = partsInTz(now);
  const dThen = { year: thenDay.year, month: thenDay.month, day: thenDay.day };
  const dToday = { year: today.year, month: today.month, day: today.day };
  const diff = dayDiff(dToday, dThen);
  const time = formatTime(thenDay.hour, thenDay.minute);
  if (diff === 1) return `ayer ${time}`;
  if (diff === 0) return `hoy ${time}`;
  return `${shortDate(dThen, { withYear: dThen.year !== dToday.year })} ${time}`;
}

export function formatTime(hour, minute) {
  const h24 = Number(hour);
  const m = String(minute).padStart(2, "0");
  const suffix = h24 < 12 ? "a. m." : "p. m.";
  const h12 = h24 % 12 || 12;
  return `${h12}:${m} ${suffix}`;
}

export function clockTimeEt(iso, now = new Date()) {
  const d = iso ? new Date(iso) : now;
  if (Number.isNaN(+d)) return "";
  const p = partsInTz(d);
  return formatTime(p.hour, p.minute);
}

export function expiryLabel(expiresAt, now = new Date()) {
  if (!expiresAt) return "";
  const exp = new Date(expiresAt);
  if (Number.isNaN(+exp)) return "";
  if (exp <= now) return "Vencida";
  const dExp = partsInTz(exp);
  const dNow = partsInTz(now);
  const diff = dayDiff(
    { year: dExp.year, month: dExp.month, day: dExp.day },
    { year: dNow.year, month: dNow.month, day: dNow.day }
  );
  if (diff === 0) return "Vence hoy";
  if (diff === 1) return "Vence mañana";
  if (diff === 2) return "Vence en 2 días";
  return `Vence ${shortDate({ year: dExp.year, month: dExp.month, day: dExp.day }, { withYear: dExp.year !== dNow.year })}`;
}

export function daysUntil(iso, now = new Date()) {
  if (!iso) return Infinity;
  const exp = new Date(iso);
  if (Number.isNaN(+exp)) return Infinity;
  const dExp = partsInTz(exp);
  const dNow = partsInTz(now);
  return dayDiff(
    { year: dExp.year, month: dExp.month, day: dExp.day },
    { year: dNow.year, month: dNow.month, day: dNow.day }
  );
}

export function formatNumber(n) {
  return new Intl.NumberFormat("es-US", { maximumFractionDigits: 1 }).format(n);
}

export function compactCount(n) {
  const v = Number(n) || 0;
  if (v < 1000) return String(v);
  if (v < 10000) return new Intl.NumberFormat("es-US", { maximumFractionDigits: 1 }).format(v / 1000) + " mil";
  if (v < 1000000) return Math.round(v / 1000) + " mil";
  return new Intl.NumberFormat("es-US", { maximumFractionDigits: 1 }).format(v / 1000000) + " M";
}

export { TZ as TIMEZONE };
