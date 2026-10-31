export const $ = (s, el = document) => el.querySelector(s);
export const $$ = (s, el = document) => [...el.querySelectorAll(s)];

export function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

const p2 = x => String(x).padStart(2, "0");
export function hoyISO(d = new Date()) { return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`; }
export function ahoraHM(d = new Date()) { return `${p2(d.getHours())}:${p2(d.getMinutes())}`; }
export function fmtFecha(iso) { if (!iso) return ""; const [a, m, d] = iso.split("-"); return `${d}/${m}/${a}`; }
export function sumarDias(iso, n) {
  const [a, m, d] = iso.split("-").map(Number);
  return hoyISO(new Date(a, m - 1, d + n));
}
const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
export function diaSemana(iso) { const [a, m, d] = iso.split("-").map(Number); return DIAS[new Date(a, m - 1, d).getDay()]; }

// Número desde un input (acepta coma decimal); vacío → null
export function num(v) {
  if (v === "" || v === null || v === undefined) return null;
  const x = Number(String(v).trim().replace(",", "."));
  return Number.isFinite(x) ? x : null;
}
export function txt(v) { const s = String(v ?? "").trim(); return s || null; }
export function fmtNum(v, suf = "") { return v === null || v === undefined || v === "" ? "–" : String(v).replace(".", ",") + suf; }

let tt;
export function toast(msg, ms = 2600) {
  const t = $("#toast"); t.textContent = msg; t.classList.add("on");
  clearTimeout(tt); tt = setTimeout(() => t.classList.remove("on"), ms);
}

export function confirmar(msg) { return Promise.resolve(window.confirm(msg)); }
