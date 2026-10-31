// Informes para el médico: PDF (jsPDF), XLSX (SheetJS) y HTML autónomo
import { S } from "./estado.js";
import { resumen, evaluar, filtrarPeriodo, etiquetasBandas, BANDAS, banda, claseValor } from "./stats.js";
import { kpisHTML, bandasHTML, porMomentoHTML, hiposHTML } from "./ui-stats.js";
import { textoMedicacion } from "./ui-registro.js";
import { LAB_CAMPOS, tieneGlucemia } from "./modelo.js";
import * as G from "./graficos.js";
import { esc, fmtFecha, fmtNum, hoyISO, diaSemana } from "./util.js";

export function datos(desde, hasta) {
  const regs = filtrarPeriodo(S.regs, desde, hasta);
  const r = S.cfg.rangos;
  const res = resumen(regs, r);
  const labs = S.labs.filter(l => !hasta || l.fecha <= hasta);
  const per = `${fmtFecha(desde || res.desde) || "–"} al ${fmtFecha(hasta || res.hasta) || "–"}`;
  return { regs, r, res, labs, per, cfg: S.cfg, p: S.cfg.paciente };
}

function nombreArchivo(ext) { return `glucemia_informe_${hoyISO()}.${ext}`; }

function imagenes(d) {
  if (!window.Chart || !d.regs.length) return {};
  const out = {};
  if (d.res.n) {
    out.perfil = G.imagen(G.perfilHora, d.regs, d.r);
    out.tend = G.imagen(G.tendenciaDiaria, d.res.serieDiaria, d.r);
  }
  if (d.regs.some(x => x.insulina_basal_u || x.insulina_rapida_u || x.insulina_correccion_u || x.carbohidratos_g))
    out.ins = G.imagen(G.insulinaYCarbs, d.regs);
  if (d.regs.some(x => x.peso_kg != null || x.pa_sistolica != null)) out.peso = G.imagen(G.pesoPresion, d.regs);
  if (d.labs.some(l => l.hba1c != null)) out.hba1c = G.imagen(G.hba1c, d.labs, d.r.hba1cMeta);
  return out;
}

function filasMetricas(d) {
  const { res, r } = d, ev = evaluar(res, r), e = k => (ev[k] === "ok" ? "En meta" : ev[k] === "mal" ? "Fuera de meta" : "");
  const bajo = res.n ? fmtNum(Math.round((res.bandas.muyBaja + res.bandas.baja) * 10) / 10) + " %" : "–";
  const alto = res.n ? fmtNum(Math.round((res.bandas.alta + res.bandas.muyAlta) * 10) / 10) + " %" : "–";
  return [
    ["Mediciones de glucemia", `${res.n} (${fmtNum(res.medPorDia)} por día, ${res.dias} días)`, "", ""],
    ["Glucemia promedio", res.n ? `${res.prom} mg/dl (DE ${fmtNum(res.de)})` : "–", "", ""],
    ["Mediana / mínimo / máximo", res.n ? `${res.mediana} / ${res.min} / ${res.max} mg/dl` : "–", "", ""],
    ["HbA1c estimada (GMI)", res.n ? fmtNum(res.gmi) + " %" : "–", `< ${r.hba1cMeta} %`, e("gmi")],
    ["Coeficiente de variación", res.n ? fmtNum(res.cv) + " %" : "–", `<= ${r.cvMeta} %`, e("cv")],
    [`Tiempo en rango (${r.bajo}-${r.alto})`, res.n ? fmtNum(res.bandas.rango) + " %" : "–", `> ${r.tirMeta} %`, e("tir")],
    [`Por debajo de ${r.bajo}`, bajo, "< 4 %", e("bajo")],
    [`Por debajo de ${r.muyBajo}`, res.n ? fmtNum(res.bandas.muyBaja) + " %" : "–", "< 1 %", e("muyBajo")],
    [`Por encima de ${r.alto}`, alto, "< 25 %", e("alto")],
    [`Por encima de ${r.muyAlto}`, res.n ? fmtNum(res.bandas.muyAlta) + " %" : "–", "< 5 %", e("muyAlto")],
    ["Hipoglucemias registradas", `${res.hipos.length} (${res.hipos54} < ${r.muyBajo})`, "", ""],
    ["Insulina total diaria promedio", res.insulinaDiaria != null ? `${fmtNum(res.insulinaDiaria)} U (basal ${fmtNum(res.basalDiaria)}, rápida ${fmtNum(res.rapidaDiaria)})` : "–", "", ""],
    ["Carbohidratos diarios promedio", res.carbsDiarios != null ? fmtNum(res.carbsDiarios) + " g" : "–", "", ""],
  ];
}

function tratamiento(cfg) {
  const ins = cfg.insulinas.map(i => `${i.nombre} (${i.tipo === "basal" ? "basal" : "rápida"})`).join(", ");
  return [ins, textoMedicacion(cfg.medicacion)].filter(Boolean).join(" · ") || "No cargado";
}

function filaRegistro(x) {
  const ins = [x.insulina_basal_u != null ? `B ${fmtNum(x.insulina_basal_u)}` : "", x.insulina_rapida_u != null ? `R ${fmtNum(x.insulina_rapida_u)}` : "",
    x.insulina_correccion_u != null ? `C ${fmtNum(x.insulina_correccion_u)}` : ""].filter(Boolean).join(" ");
  const comida = [x.comida_tipo, x.comida_desc, x.carbohidratos_g != null ? `${fmtNum(x.carbohidratos_g)} g HC` : ""].filter(Boolean).join(" · ");
  const act = [x.actividad_tipo, x.actividad_min != null ? `${x.actividad_min} min` : "", x.actividad_intensidad].filter(Boolean).join(" · ");
  const signos = [x.peso_kg != null ? `${fmtNum(x.peso_kg)} kg` : "", x.pa_sistolica != null ? `PA ${x.pa_sistolica}/${x.pa_diastolica ?? "-"}` : "",
    x.pulso != null ? `${x.pulso} lpm` : ""].filter(Boolean).join(" ");
  return [fmtFecha(x.fecha), x.hora, x.momento || "", tieneGlucemia(x) ? String(x.glucemia) : "", ins, textoMedicacion(x.medicacion),
    comida, act, (x.sintomas || []).join(", "), signos, x.notas || ""];
}
const COLS_REG = ["Fecha", "Hora", "Momento", "mg/dl", "Insulina (U)", "Medicación", "Comida / HC", "Actividad", "Síntomas", "Peso / PA", "Observaciones"];

// ---------------- PDF ----------------
const pdfTxt = s => String(s ?? "").replace(/[≤]/g, "<=").replace(/[≥]/g, ">=").replace(/[–—]/g, "-").replace(/[“”]/g, '"')
  .replace(/[‘’]/g, "'").replace(/…/g, "...").replace(/[^\x00-\xFF]/g, "");
const RGB = { muyBaja: [142, 0, 0], baja: [229, 57, 53], rango: [67, 160, 71], alta: [251, 140, 0], muyAlta: [191, 54, 12] };
const RGB_CLASE = { muyBajo: [142, 0, 0], bajo: [211, 47, 47], ok: [46, 125, 50], alto: [230, 81, 0], muyAlto: [156, 45, 0] };

export function generarPDF(desde, hasta, { tabla = true, graficos = true } = {}) {
  const d = datos(desde, hasta), { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const M = 14, W = 210 - 2 * M, VERDE = [11, 110, 79];
  let y = 0;
  const T = (t, x, yy, o) => doc.text(pdfTxt(t), x, yy, o);
  const espacio = h => { if (y + h > 282) { doc.addPage(); y = 16; } };
  const titulo = t => { espacio(14); doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.setTextColor(...VERDE); T(t, M, y + 5); y += 9; doc.setTextColor(0); doc.setFont("helvetica", "normal"); };
  const tabla_ = (head, body, opts = {}) => {
    doc.autoTable({ startY: y, head: [head.map(pdfTxt)], body: body.map(f => f.map(pdfTxt)), margin: { left: M, right: M },
      styles: { fontSize: 8.5, cellPadding: 1.6, overflow: "linebreak" }, headStyles: { fillColor: VERDE, textColor: 255 },
      alternateRowStyles: { fillColor: [244, 248, 246] }, ...opts });
    y = doc.lastAutoTable.finalY + 6;
  };

  doc.setFillColor(...VERDE); doc.rect(0, 0, 210, 26, "F");
  doc.setTextColor(255); doc.setFont("helvetica", "bold"); doc.setFontSize(16);
  T("Informe de autocontrol glucémico", M, 12);
  doc.setFont("helvetica", "normal"); doc.setFontSize(10);
  T(`${d.p.nombre || ""}   ·   Período: ${d.per}`, M, 20);
  doc.setTextColor(0); y = 32;
  doc.setFontSize(9.5);
  const datosP = [
    ["Paciente", d.p.nombre], ["Fecha de nacimiento", fmtFecha(d.p.nacimiento)], ["Diagnóstico", [d.p.tipo, d.p.diagnostico ? `desde ${d.p.diagnostico}` : ""].filter(Boolean).join(", ")],
    ["Tratamiento", tratamiento(d.cfg)], ["Médico", d.p.medico], ["Generado", new Date().toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" })],
  ].filter(f => f[1]);
  tabla_(["Dato", ""], datosP, { theme: "plain", showHead: false, styles: { fontSize: 9, cellPadding: 1 }, columnStyles: { 0: { fontStyle: "bold", cellWidth: 40 } } });

  titulo("Resumen de métricas");
  tabla_(["Métrica", "Valor", "Meta", "Estado"], filasMetricas(d), {
    columnStyles: { 0: { cellWidth: 62 }, 2: { cellWidth: 22 }, 3: { cellWidth: 28 } },
    didParseCell: c => { if (c.section === "body" && c.column.index === 3) c.cell.styles.textColor = c.cell.raw === "En meta" ? [46, 125, 50] : [230, 81, 0]; },
  });

  if (d.res.n) {
    titulo("Distribución por rangos");
    espacio(22);
    let x = M;
    const et = etiquetasBandas(d.r);
    for (const [k] of BANDAS.slice().reverse()) {
      const w = W * d.res.bandas[k] / 100; if (w <= 0) continue;
      doc.setFillColor(...RGB[k]); doc.rect(x, y, w, 7, "F"); x += w;
    }
    y += 11; doc.setFontSize(8.5);
    BANDAS.slice().reverse().forEach(([k], i) => {
      const xx = M + (i % 3) * (W / 3), yy = y + Math.floor(i / 3) * 5;
      doc.setFillColor(...RGB[k]); doc.rect(xx, yy - 2.6, 3, 3, "F"); T(`${et[k]}: ${fmtNum(d.res.bandas[k])} %`, xx + 4.5, yy);
    });
    y += 14;
  }

  const img = graficos ? imagenes(d) : {};
  const grafico = (t, url) => { if (!url) return; const h = W * 0.444; espacio(h + 12); titulo(t); doc.addImage(url, "JPEG", M, y, W, h); y += h + 6; };
  grafico("Perfil por hora del día (banda verde = rango objetivo)", img.perfil);
  grafico("Evolución diaria (promedio y mín-máx)", img.tend);

  if (d.res.porMomento.length) {
    titulo("Glucemia por momento del día");
    tabla_(["Momento", "N", "Promedio", "Mín", "Máx", "En meta"], d.res.porMomento.map(m => [m.momento, m.n, m.prom, m.min, m.max, fmtNum(m.enMeta) + " %"]));
  }
  titulo("Hipoglucemias");
  if (d.res.hipos.length) tabla_(["Fecha", "Hora", "mg/dl", "Momento", "Síntomas / notas"], d.res.hipos.map(h =>
    [fmtFecha(h.fecha), h.hora, h.glucemia, h.momento || "", [(h.sintomas || []).join(", "), h.notas].filter(Boolean).join(" · ")]));
  else { doc.setFontSize(9); T("Sin hipoglucemias en el período.", M, y + 2); y += 8; }

  grafico("Insulina y carbohidratos por día", img.ins);
  grafico("Peso y presión arterial", img.peso);

  if (d.labs.length) {
    titulo("Laboratorio");
    const cols = LAB_CAMPOS.filter(([k]) => d.labs.some(l => l[k] != null));
    tabla_(["Fecha", ...cols.map(c => c[1]), "Otros"], d.labs.slice().reverse().map(l => [fmtFecha(l.fecha), ...cols.map(([k]) => fmtNum(l[k])), l.otros || ""]));
    grafico("Evolución de HbA1c", img.hba1c);
  }

  if (tabla && d.regs.length) {
    doc.addPage(); y = 16;
    titulo("Registros del período");
    const filas = d.regs.slice().reverse().map(filaRegistro);
    const clases = d.regs.slice().reverse().map(x => tieneGlucemia(x) ? claseValor(+x.glucemia, x.momento, d.r) : null);
    tabla_(COLS_REG, filas, {
      styles: { fontSize: 7, cellPadding: 1.2, overflow: "linebreak" },
      columnStyles: { 0: { cellWidth: 15 }, 1: { cellWidth: 9 }, 2: { cellWidth: 17 }, 3: { cellWidth: 10, fontStyle: "bold" }, 4: { cellWidth: 15 } },
      didParseCell: c => { if (c.section === "body" && c.column.index === 3 && clases[c.row.index]) c.cell.styles.textColor = RGB_CLASE[clases[c.row.index]]; },
    });
  }

  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i); doc.setFontSize(7.5); doc.setTextColor(120);
    T(`${d.p.nombre || ""} · Página ${i} de ${n} · Registro de autocontrol; no reemplaza la indicación médica.`, M, 292);
  }
  return new File([doc.output("blob")], nombreArchivo("pdf"), { type: "application/pdf" });
}

// ---------------- XLSX ----------------
function serialExcel(iso) { const [a, m, dd] = iso.split("-").map(Number); return (Date.UTC(a, m - 1, dd) - Date.UTC(1899, 11, 30)) / 864e5; }

function hoja(aoa, anchos, colFecha = -1) {
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  if (anchos) ws["!cols"] = anchos.map(w => ({ wch: w }));
  if (colFecha >= 0) for (let i = 1; i < aoa.length; i++) {
    const ref = XLSX.utils.encode_cell({ r: i, c: colFecha });
    if (ws[ref] && typeof ws[ref].v === "number") ws[ref].z = "dd/mm/yyyy";
  }
  return ws;
}

export function generarXLSX(desde, hasta) {
  const d = datos(desde, hasta), wb = XLSX.utils.book_new(), et = etiquetasBandas(d.r);
  const res = [["Informe de autocontrol glucémico"], [], ["Paciente", d.p.nombre], ["Diagnóstico", d.p.tipo], ["Tratamiento", tratamiento(d.cfg)],
    ["Médico", d.p.medico], ["Período", d.per], ["Generado", new Date().toLocaleString("es-AR")], [], ["Métrica", "Valor", "Meta", "Estado"],
    ...filasMetricas(d), [], ["Distribución por rangos", "%"], ...BANDAS.map(([k]) => [et[k], d.res.bandas[k]])];
  XLSX.utils.book_append_sheet(wb, hoja(res, [36, 42, 12, 16]), "Resumen");

  const cab = ["Fecha", "Día", "Hora", "Momento", "Glucemia (mg/dl)", "Rango", "Insulina basal (U)", "Insulina basal", "Insulina rápida (U)",
    "Insulina rápida", "Corrección (U)", "Medicación", "Comida", "Qué comió", "Carbohidratos (g)", "Actividad", "Minutos", "Intensidad",
    "Síntomas", "Peso (kg)", "PA sistólica", "PA diastólica", "Pulso", "Observaciones", "Cargado", "Modificado"];
  const et2 = etiquetasBandas(d.r);
  const filas = d.regs.map(x => [serialExcel(x.fecha), diaSemana(x.fecha), x.hora, x.momento, tieneGlucemia(x) ? +x.glucemia : null,
    tieneGlucemia(x) ? et2[banda(+x.glucemia, d.r)] : null, x.insulina_basal_u, x.insulina_basal_tipo, x.insulina_rapida_u, x.insulina_rapida_tipo,
    x.insulina_correccion_u, textoMedicacion(x.medicacion), x.comida_tipo, x.comida_desc, x.carbohidratos_g, x.actividad_tipo, x.actividad_min,
    x.actividad_intensidad, (x.sintomas || []).join(", "), x.peso_kg, x.pa_sistolica, x.pa_diastolica, x.pulso, x.notas,
    x.created_at ? new Date(x.created_at).toLocaleString("es-AR") : "", x.updated_at && x.updated_at !== x.created_at ? new Date(x.updated_at).toLocaleString("es-AR") : ""]
    .map(v => v ?? ""));
  const wsR = hoja([cab, ...filas], [11, 10, 7, 16, 10, 18, 9, 14, 9, 14, 9, 24, 11, 26, 9, 18, 8, 10, 22, 8, 8, 8, 7, 34, 18, 18], 0);
  wsR["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: filas.length, c: cab.length - 1 } }) };
  XLSX.utils.book_append_sheet(wb, wsR, "Registros");

  XLSX.utils.book_append_sheet(wb, hoja([["Fecha", "Día", "Mediciones", "Promedio", "Mínimo", "Máximo"],
    ...d.res.serieDiaria.map(s => [serialExcel(s.fecha), diaSemana(s.fecha), s.n, s.prom, s.min, s.max])], [11, 10, 11, 10, 9, 9], 0), "Diario");
  XLSX.utils.book_append_sheet(wb, hoja([["Momento", "Mediciones", "Promedio", "Mínimo", "Máximo", "% en meta"],
    ...d.res.porMomento.map(m => [m.momento, m.n, m.prom, m.min, m.max, m.enMeta])], [18, 11, 10, 9, 9, 10]), "Por momento");
  XLSX.utils.book_append_sheet(wb, hoja([["Fecha", "Hora", "Glucemia", "Momento", "Síntomas", "Observaciones"],
    ...d.res.hipos.map(h => [serialExcel(h.fecha), h.hora, +h.glucemia, h.momento || "", (h.sintomas || []).join(", "), h.notas || ""])], [11, 7, 9, 16, 26, 34], 0), "Hipoglucemias");
  XLSX.utils.book_append_sheet(wb, hoja([["Fecha", ...LAB_CAMPOS.map(c => `${c[1]} (${c[2]})`), "Otros", "Notas"],
    ...d.labs.map(l => [serialExcel(l.fecha), ...LAB_CAMPOS.map(([k]) => l[k] ?? ""), l.otros || "", l.notas || ""])], [11, 9, 12, 12, 8, 8, 12, 11, 14, 20, 20], 0), "Laboratorio");
  const rg = d.r;
  XLSX.utils.book_append_sheet(wb, hoja([["Parámetro", "Valor"], ["Hipoglucemia nivel 2 (<)", rg.muyBajo], ["Hipoglucemia (<)", rg.bajo],
    ["Rango objetivo hasta", rg.alto], ["Muy alta (>)", rg.muyAlto], ["Preprandial / ayunas", `${rg.preMin}-${rg.preMax}`], ["Posprandial (<)", rg.postMax],
    ["HbA1c meta (<)", rg.hba1cMeta], ["Tiempo en rango meta (>%)", rg.tirMeta], ["CV meta (<=%)", rg.cvMeta]], [28, 12]), "Rangos");

  const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  return new File([buf], nombreArchivo("xlsx"), { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

// ---------------- HTML ----------------
export function htmlInforme(desde, hasta, { tabla = true, graficos = true } = {}) {
  const d = datos(desde, hasta), img = graficos ? imagenes(d) : {};
  const fig = (t, u) => u ? `<section><h2>${t}</h2><img src="${u}" alt="${t}"></section>` : "";
  const labCols = LAB_CAMPOS.filter(([k]) => d.labs.some(l => l[k] != null));
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Informe de glucemia – ${esc(d.p.nombre)}</title><style>
:root{--b-muybaja:#8e0000;--b-baja:#e53935;--b-rango:#43a047;--b-alta:#fb8c00;--b-muyalta:#bf360c;--borde:#d5ddd9;--suave:#5f6b67}
body{font-family:system-ui,Segoe UI,Roboto,sans-serif;color:#1d2522;margin:0;background:#fff;font-size:15px}
header{background:#0b6e4f;color:#fff;padding:18px 16px}header h1{margin:0;font-size:22px}header p{margin:4px 0 0}
main{max-width:980px;margin:0 auto;padding:12px 16px}h2{font-size:17px;color:#0b6e4f;margin:22px 0 8px}
.ficha{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:4px 16px;font-size:14px}
.kpis{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px}.kpi{border:1px solid var(--borde);border-radius:10px;padding:10px}
.kpi .t{font-size:12px;color:var(--suave)}.kpi .n{font-size:24px;font-weight:800}.kpi .n small{font-size:12px;color:var(--suave);font-weight:400}
.kpi .meta{font-size:12px}.meta.ok{color:#2e7d32}.meta.mal{color:#e65100}
.barra{display:flex;height:26px;border-radius:6px;overflow:hidden;margin:8px 0}.leyenda{display:grid;gap:3px;font-size:14px;max-width:520px}
.leyenda div{display:flex;gap:8px;align-items:center}.leyenda i{width:12px;height:12px;border-radius:3px}.leyenda b{margin-left:auto}.leyenda .meta{color:var(--suave);font-size:12px;min-width:58px;text-align:right}
.hint{font-size:12px;color:var(--suave)}img{width:100%;max-width:980px;border:1px solid var(--borde);border-radius:8px}
table{border-collapse:collapse;width:100%;font-size:13px}th,td{border-bottom:1px solid var(--borde);padding:6px;text-align:left;vertical-align:top}
th{background:#e8f0ec;font-size:12px}td.n,th.n{text-align:right}.scroll-x{overflow-x:auto}
.v-muyBajo{color:#8e0000}.v-bajo{color:#d32f2f}.v-ok{color:#2e7d32}.v-alto{color:#e65100}.v-muyAlto{color:#9c2d00}
footer{font-size:12px;color:var(--suave);padding:20px 16px;text-align:center}
@media print{header{-webkit-print-color-adjust:exact;print-color-adjust:exact}.barra,.leyenda i{-webkit-print-color-adjust:exact;print-color-adjust:exact}section{break-inside:avoid}}
</style></head><body>
<header><h1>Informe de autocontrol glucémico</h1><p>${esc(d.p.nombre)} · Período: ${esc(d.per)}</p></header><main>
<div class="ficha">${[["Paciente", d.p.nombre], ["Nacimiento", fmtFecha(d.p.nacimiento)], ["Diagnóstico", [d.p.tipo, d.p.diagnostico ? "desde " + d.p.diagnostico : ""].filter(Boolean).join(", ")],
    ["Tratamiento", tratamiento(d.cfg)], ["Médico", d.p.medico], ["Generado", new Date().toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" })]]
    .filter(f => f[1]).map(([k, v]) => `<div><b>${k}:</b> ${esc(v)}</div>`).join("")}</div>
<h2>Resumen</h2>${kpisHTML(d.res, d.r)}
<section><h2>Distribución por rangos</h2>${bandasHTML(d.res, d.r) || "<p>Sin glucemias en el período.</p>"}</section>
${fig("Perfil por hora del día", img.perfil)}${fig("Evolución diaria", img.tend)}
${d.res.porMomento.length ? `<section><h2>Glucemia por momento del día</h2>${porMomentoHTML(d.res)}</section>` : ""}
<section><h2>Hipoglucemias</h2>${hiposHTML(d.res)}</section>
${fig("Insulina y carbohidratos por día", img.ins)}${fig("Peso y presión arterial", img.peso)}
${d.labs.length ? `<section><h2>Laboratorio</h2><div class="scroll-x"><table><tr><th>Fecha</th>${labCols.map(c => `<th class="n">${c[1]} (${c[2]})</th>`).join("")}<th>Otros</th></tr>
  ${d.labs.slice().reverse().map(l => `<tr><td>${fmtFecha(l.fecha)}</td>${labCols.map(([k]) => `<td class="n">${fmtNum(l[k])}</td>`).join("")}<td>${esc(l.otros || "")}</td></tr>`).join("")}</table></div></section>${fig("Evolución de HbA1c", img.hba1c)}` : ""}
${tabla && d.regs.length ? `<h2>Registros del período</h2><div class="scroll-x"><table><tr>${COLS_REG.map(c => `<th>${c}</th>`).join("")}</tr>
  ${d.regs.slice().reverse().map(x => { const f = filaRegistro(x), c = tieneGlucemia(x) ? "v-" + claseValor(+x.glucemia, x.momento, d.r) : "";
    return `<tr>${f.map((v, i) => `<td${i === 3 ? ` class="${c}"><b>${esc(v)}</b>` : `>${esc(v)}`}</td>`).join("")}</tr>`; }).join("")}</table></div>` : ""}
</main><footer>Registro de autocontrol del paciente. No reemplaza la indicación médica. Metas: ADA Standards of Care 2026 y consenso internacional de Tiempo en Rango.</footer></body></html>`;
}

export function generarHTML(desde, hasta, opts) {
  return new File([htmlInforme(desde, hasta, opts)], nombreArchivo("html"), { type: "text/html" });
}

// ---------------- Compartir / descargar ----------------
export function descargar(file) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(file); a.download = file.name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

export async function compartir(file, texto) {
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: file.name, text: texto }); return "compartido"; }
    catch (e) { if (e.name === "AbortError") return "cancelado"; }
  }
  descargar(file);
  return "descargado";
}
