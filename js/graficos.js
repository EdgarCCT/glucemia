// Gráficos (Chart.js). Sirven para la pantalla y, con impresion:true, para PDF/HTML.
import { banda, resumen } from "./stats.js";
import { tieneGlucemia } from "./modelo.js";
import { fmtFecha } from "./util.js";

const COL_BANDA = { muyBaja: "#8e0000", baja: "#e53935", rango: "#43a047", alta: "#fb8c00", muyAlta: "#bf360c" };
export { COL_BANDA };

function paleta(impresion) {
  const cs = getComputedStyle(document.documentElement);
  return impresion ? { texto: "#333", grilla: "#e0e0e0", fondo: "#fff" }
    : { texto: cs.getPropertyValue("--suave").trim(), grilla: cs.getPropertyValue("--borde").trim(), fondo: null };
}

const bandaObjetivo = r => ({
  id: "bandaObjetivo",
  beforeDatasetsDraw(ch) {
    const { ctx, chartArea: a, scales: { y } } = ch;
    const y1 = y.getPixelForValue(r.alto), y2 = y.getPixelForValue(r.bajo);
    ctx.save(); ctx.fillStyle = "rgba(67,160,71,.12)"; ctx.fillRect(a.left, y1, a.right - a.left, y2 - y1);
    ctx.strokeStyle = "rgba(67,160,71,.6)"; ctx.setLineDash([4, 4]);
    for (const yy of [y1, y2]) { ctx.beginPath(); ctx.moveTo(a.left, yy); ctx.lineTo(a.right, yy); ctx.stroke(); }
    ctx.restore();
  },
});
const fondo = color => ({ id: "fondo", beforeDraw(ch) {
  if (!color) return; const c = ch.ctx; c.save(); c.fillStyle = color; c.fillRect(0, 0, ch.width, ch.height); c.restore(); } });

function base(p, impresion, extra = {}) {
  return {
    responsive: !impresion, maintainAspectRatio: false, animation: impresion ? false : { duration: 300 },
    devicePixelRatio: impresion ? 1.5 : undefined,
    plugins: { legend: { labels: { color: p.texto, boxWidth: 12 } }, ...extra.plugins },
    scales: Object.fromEntries(Object.entries(extra.scales || {}).map(([k, s]) => [k,
      { ticks: { color: p.texto }, grid: { color: p.grilla }, title: { color: p.texto, display: !!s.titulo, text: s.titulo }, ...s }])),
  };
}

export function perfilHora(canvas, regs, r, impresion = false) {
  const p = paleta(impresion), g = regs.filter(tieneGlucemia);
  const res = resumen(regs, r);
  const yMax = Math.max(300, ...g.map(x => +x.glucemia)) + 20;
  return new Chart(canvas, {
    data: { datasets: [
      { type: "scatter", label: "Mediciones", data: g.map(x => ({ x: +x.hora.slice(0, 2) + x.hora.slice(3, 5) / 60, y: +x.glucemia })),
        pointBackgroundColor: g.map(x => COL_BANDA[banda(+x.glucemia, r)]), pointRadius: 4, pointBorderWidth: 0 },
      { type: "line", label: "Mediana por hora", data: res.porHora.map(h => ({ x: h.hora + 0.5, y: h.mediana })),
        borderColor: "#1565c0", backgroundColor: "#1565c0", tension: 0.3, pointRadius: 2 },
    ] },
    options: base(p, impresion, {
      scales: { x: { type: "linear", min: 0, max: 24, ticks: { stepSize: 3, color: p.texto, callback: v => `${v}h` }, titulo: "Hora del día" },
        y: { min: 0, max: yMax, titulo: "mg/dl" } },
      plugins: { tooltip: { callbacks: { label: c => `${Math.floor(c.parsed.x)}:${String(Math.round(c.parsed.x % 1 * 60)).padStart(2, "0")} → ${c.parsed.y} mg/dl` } } },
    }),
    plugins: [bandaObjetivo(r), fondo(p.fondo)],
  });
}

export function tendenciaDiaria(canvas, serie, r, impresion = false) {
  const p = paleta(impresion);
  return new Chart(canvas, {
    data: { labels: serie.map(s => fmtFecha(s.fecha).slice(0, 5)), datasets: [
      { type: "bar", label: "Mín–máx del día", data: serie.map(s => [s.min, s.max === s.min ? s.min + 2 : s.max]),
        backgroundColor: "rgba(120,144,156,.35)", borderRadius: 3, barPercentage: 0.6 },
      { type: "line", label: "Promedio diario", data: serie.map(s => s.prom), borderColor: "#0b6e4f", backgroundColor: "#0b6e4f",
        tension: 0.25, pointRadius: 3 },
    ] },
    options: base(p, impresion, { scales: { x: {}, y: { min: 0, suggestedMax: 300, titulo: "mg/dl" } } }),
    plugins: [bandaObjetivo(r), fondo(p.fondo)],
  });
}

export function insulinaYCarbs(canvas, regs, impresion = false) {
  const p = paleta(impresion), dias = new Map();
  for (const x of regs) {
    const d = dias.get(x.fecha) || { b: 0, r: 0, c: 0 };
    d.b += +x.insulina_basal_u || 0; d.r += (+x.insulina_rapida_u || 0) + (+x.insulina_correccion_u || 0); d.c += +x.carbohidratos_g || 0;
    dias.set(x.fecha, d);
  }
  const fechas = [...dias.keys()].sort();
  return new Chart(canvas, {
    data: { labels: fechas.map(f => fmtFecha(f).slice(0, 5)), datasets: [
      { type: "bar", label: "Basal (U)", data: fechas.map(f => dias.get(f).b), backgroundColor: "#5c6bc0", stack: "i", yAxisID: "y" },
      { type: "bar", label: "Rápida + corrección (U)", data: fechas.map(f => dias.get(f).r), backgroundColor: "#ab47bc", stack: "i", yAxisID: "y" },
      { type: "line", label: "Carbohidratos (g)", data: fechas.map(f => dias.get(f).c || null), borderColor: "#fb8c00",
        backgroundColor: "#fb8c00", yAxisID: "y2", spanGaps: true, pointRadius: 3 },
    ] },
    options: base(p, impresion, { scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true, titulo: "Unidades" },
      y2: { position: "right", beginAtZero: true, grid: { drawOnChartArea: false }, titulo: "g HC" } } }),
    plugins: [fondo(p.fondo)],
  });
}

export function pesoPresion(canvas, regs, impresion = false) {
  const p = paleta(impresion);
  const pts = (f) => regs.filter(x => x[f] != null).map(x => ({ x: x.fecha, y: +x[f] }));
  const fechas = [...new Set(regs.filter(x => x.peso_kg != null || x.pa_sistolica != null).map(x => x.fecha))].sort();
  const porFecha = f => fechas.map(d => { const v = pts(f).filter(q => q.x === d); return v.length ? v[v.length - 1].y : null; });
  return new Chart(canvas, {
    type: "line",
    data: { labels: fechas.map(f => fmtFecha(f).slice(0, 5)), datasets: [
      { label: "Peso (kg)", data: porFecha("peso_kg"), borderColor: "#00897b", backgroundColor: "#00897b", yAxisID: "y", spanGaps: true },
      { label: "PA sistólica", data: porFecha("pa_sistolica"), borderColor: "#e53935", backgroundColor: "#e53935", yAxisID: "y2", spanGaps: true },
      { label: "PA diastólica", data: porFecha("pa_diastolica"), borderColor: "#fb8c00", backgroundColor: "#fb8c00", yAxisID: "y2", spanGaps: true },
    ] },
    options: base(p, impresion, { scales: { x: {}, y: { titulo: "kg" }, y2: { position: "right", grid: { drawOnChartArea: false }, titulo: "mmHg" } } }),
    plugins: [fondo(p.fondo)],
  });
}

export function hba1c(canvas, labs, meta, impresion = false) {
  const p = paleta(impresion), l = labs.filter(x => x.hba1c != null);
  return new Chart(canvas, {
    type: "line",
    data: { labels: l.map(x => fmtFecha(x.fecha)), datasets: [
      { label: "HbA1c (%)", data: l.map(x => +x.hba1c), borderColor: "#0b6e4f", backgroundColor: "#0b6e4f", pointRadius: 4 },
      { label: `Meta < ${meta} %`, data: l.map(() => meta), borderColor: "#e53935", borderDash: [5, 5], pointRadius: 0 },
    ] },
    options: base(p, impresion, { scales: { x: {}, y: { suggestedMin: 5, suggestedMax: 10, titulo: "%" } } }),
    plugins: [fondo(p.fondo)],
  });
}

// Renderiza un gráfico fuera de pantalla y devuelve la imagen JPEG liviana (para PDF/HTML)
export function imagen(fn, ...args) {
  const cont = document.getElementById("graficosOcultos");
  const c = document.createElement("canvas");
  c.style.width = "900px"; c.style.height = "400px";
  cont.appendChild(c);
  const ch = fn(c, ...args, true);
  ch.resize(900, 400); ch.update("none");
  const url = c.toDataURL("image/jpeg", 0.85);
  ch.destroy(); c.remove();
  return url;
}
