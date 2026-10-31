// Métricas clínicas (consenso internacional TIR 2019 / ADA 2026). Funciones puras.
import { MOMENTOS, PRE, POST, insulinaTotal, tieneGlucemia } from "./modelo.js";

export const BANDAS = [
  ["muyBaja", "Muy baja (<54)"], ["baja", "Baja (54–69)"], ["rango", "En rango (70–180)"],
  ["alta", "Alta (181–250)"], ["muyAlta", "Muy alta (>250)"],
];

export function etiquetasBandas(r) {
  return {
    muyBaja: `Muy baja (<${r.muyBajo})`, baja: `Baja (${r.muyBajo}–${r.bajo - 1})`,
    rango: `En rango (${r.bajo}–${r.alto})`, alta: `Alta (${r.alto + 1}–${r.muyAlto})`, muyAlta: `Muy alta (>${r.muyAlto})`,
  };
}

export function banda(v, r) {
  if (v < r.muyBajo) return "muyBaja";
  if (v < r.bajo) return "baja";
  if (v <= r.alto) return "rango";
  if (v <= r.muyAlto) return "alta";
  return "muyAlta";
}

// Clase de color según el momento: preprandial usa 80–130, posprandial <180, resto 70–180
export function claseValor(v, momento, r) {
  if (v < r.muyBajo) return "muyBajo";
  if (v < r.bajo) return "bajo";
  if (v > r.muyAlto) return "muyAlto";
  if (PRE.has(momento)) return v > r.preMax ? "alto" : "ok";
  if (POST.has(momento)) return v > r.postMax ? "alto" : "ok";
  return v > r.alto ? "alto" : "ok";
}

export function filtrarPeriodo(regs, desde, hasta) {
  return regs.filter(x => !x.deleted_at && (!desde || x.fecha >= desde) && (!hasta || x.fecha <= hasta));
}

const r1 = x => Math.round(x * 10) / 10;

function percentil(ordenados, p) {
  if (!ordenados.length) return null;
  const i = (ordenados.length - 1) * p, lo = Math.floor(i), hi = Math.ceil(i);
  return ordenados[lo] + (ordenados[hi] - ordenados[lo]) * (i - lo);
}

export function ordenar(regs) {
  return regs.slice().sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora));
}

export function resumen(regs, r) {
  const vivos = ordenar(regs.filter(x => !x.deleted_at));
  const g = vivos.filter(tieneGlucemia);
  const vals = g.map(x => +x.glucemia);
  const n = vals.length;
  const out = { n, prom: null, de: null, cv: null, gmi: null, min: null, max: null, mediana: null,
    dias: 0, medPorDia: null, bandas: {}, conteoBandas: {}, hipos: [], hipos54: 0, porMomento: [], porHora: [],
    serieDiaria: [], insulinaDiaria: null, basalDiaria: null, rapidaDiaria: null, carbsDiarios: null,
    desde: vivos[0]?.fecha || null, hasta: vivos[vivos.length - 1]?.fecha || null };
  for (const [k] of BANDAS) { out.bandas[k] = n ? 0 : null; out.conteoBandas[k] = 0; }

  if (n) {
    const prom = vals.reduce((a, b) => a + b, 0) / n;
    const de = Math.sqrt(vals.reduce((a, b) => a + (b - prom) ** 2, 0) / n);
    const ord = vals.slice().sort((a, b) => a - b);
    Object.assign(out, { prom: Math.round(prom), de: r1(de), cv: r1(de / prom * 100),
      gmi: r1(3.31 + 0.02392 * prom), min: ord[0], max: ord[n - 1], mediana: Math.round(percentil(ord, 0.5)) });
    for (const v of vals) out.conteoBandas[banda(v, r)]++;
    for (const [k] of BANDAS) out.bandas[k] = r1(out.conteoBandas[k] / n * 100);
    out.hipos = g.filter(x => +x.glucemia < r.bajo);
    out.hipos54 = g.filter(x => +x.glucemia < r.muyBajo).length;

    const diasG = new Map();
    for (const x of g) (diasG.get(x.fecha) || diasG.set(x.fecha, []).get(x.fecha)).push(+x.glucemia);
    out.dias = diasG.size;
    out.medPorDia = r1(n / diasG.size);
    out.serieDiaria = [...diasG].map(([fecha, v]) => ({ fecha, n: v.length,
      prom: Math.round(v.reduce((a, b) => a + b, 0) / v.length), min: Math.min(...v), max: Math.max(...v) }));

    const momentos = [...MOMENTOS, ""];
    for (const m of momentos) {
      const sel = g.filter(x => (x.momento || "") === m);
      if (!sel.length) continue;
      const v = sel.map(x => +x.glucemia);
      const meta = sel.filter(x => { const c = claseValor(+x.glucemia, m, r); return c === "ok"; }).length;
      out.porMomento.push({ momento: m || "Sin especificar", n: v.length,
        prom: Math.round(v.reduce((a, b) => a + b, 0) / v.length), min: Math.min(...v), max: Math.max(...v),
        enMeta: r1(meta / v.length * 100) });
    }

    for (let h = 0; h < 24; h++) {
      const v = g.filter(x => +x.hora.slice(0, 2) === h).map(x => +x.glucemia).sort((a, b) => a - b);
      if (v.length) out.porHora.push({ hora: h, n: v.length, mediana: Math.round(percentil(v, 0.5)),
        p25: Math.round(percentil(v, 0.25)), p75: Math.round(percentil(v, 0.75)), min: v[0], max: v[v.length - 1] });
    }
  }

  const promPorDia = (sel, f) => {
    const m = new Map();
    for (const x of sel) { const v = f(x); if (v) m.set(x.fecha, (m.get(x.fecha) || 0) + v); }
    return m.size ? r1([...m.values()].reduce((a, b) => a + b, 0) / m.size) : null;
  };
  out.insulinaDiaria = promPorDia(vivos, insulinaTotal);
  out.basalDiaria = promPorDia(vivos, x => +x.insulina_basal_u || 0);
  out.rapidaDiaria = promPorDia(vivos, x => (+x.insulina_rapida_u || 0) + (+x.insulina_correccion_u || 0));
  out.carbsDiarios = promPorDia(vivos, x => +x.carbohidratos_g || 0);
  return out;
}

// Estado contra la meta: "ok" | "mal" | null
export function evaluar(res, r) {
  if (!res.n) return {};
  const bajo = res.bandas.muyBaja + res.bandas.baja, alto = res.bandas.alta + res.bandas.muyAlta;
  return {
    tir: res.bandas.rango > r.tirMeta ? "ok" : "mal",
    bajo: bajo < 4 ? "ok" : "mal",
    muyBajo: res.bandas.muyBaja < 1 ? "ok" : "mal",
    alto: alto < 25 ? "ok" : "mal",
    muyAlto: res.bandas.muyAlta < 5 ? "ok" : "mal",
    cv: res.cv <= r.cvMeta ? "ok" : "mal",
    gmi: res.gmi < r.hba1cMeta ? "ok" : "mal",
  };
}
