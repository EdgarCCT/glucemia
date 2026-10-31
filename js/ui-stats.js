// Pantalla de estadísticas
import { S } from "./estado.js";
import { resumen, evaluar, filtrarPeriodo, etiquetasBandas, BANDAS } from "./stats.js";
import * as G from "./graficos.js";
import { selectorPeriodo } from "./periodo.js";
import { $, esc, fmtFecha, fmtNum } from "./util.js";

let per, charts = [];

export function initStats() { per = selectorPeriodo($("#sPeriodo"), pintarStats, 14); }

export function kpisHTML(res, r, compacto = false) {
  const ev = evaluar(res, r);
  const k = (t, n, suf, meta, e) => `<div class="kpi"><div class="t">${t}</div><div class="n">${n}${suf ? `<small> ${suf}</small>` : ""}</div>
    ${meta ? `<div class="meta ${e || ""}">${e === "ok" ? "✓ " : e === "mal" ? "✗ " : ""}${meta}</div>` : ""}</div>`;
  const lista = [
    k("Tiempo en rango", fmtNum(res.bandas.rango), "%", `Meta &gt; ${r.tirMeta} %`, ev.tir),
    k("Promedio", fmtNum(res.prom), "mg/dl", res.n ? `${res.n} mediciones` : ""),
    k("HbA1c estimada (GMI)", fmtNum(res.gmi), "%", `Meta &lt; ${r.hba1cMeta} %`, ev.gmi),
    k("Hipoglucemias", res.hipos.length, "", `${res.hipos54} graves (&lt;${r.muyBajo})`, res.hipos.length ? "mal" : res.n ? "ok" : ""),
    k("Variabilidad (CV)", fmtNum(res.cv), "%", `Meta ≤ ${r.cvMeta} %`, ev.cv),
    k("Mediciones por día", fmtNum(res.medPorDia), "", res.dias ? `${res.dias} días con datos` : ""),
    k("Insulina diaria", fmtNum(res.insulinaDiaria), "U", res.insulinaDiaria != null ? `basal ${fmtNum(res.basalDiaria)} · rápida ${fmtNum(res.rapidaDiaria)}` : ""),
    k("Carbohidratos diarios", fmtNum(res.carbsDiarios), "g"),
  ];
  return `<div class="kpis">${(compacto ? lista.slice(0, 4) : lista).join("")}</div>`;
}

export function bandasHTML(res, r, nota = true) {
  if (!res.n) return "";
  const et = etiquetasBandas(r), metas = { muyBaja: "< 1 %", baja: "< 4 %*", rango: `> ${r.tirMeta} %`, alta: "< 25 %*", muyAlta: "< 5 %" };
  const css = { muyBaja: "--b-muybaja", baja: "--b-baja", rango: "--b-rango", alta: "--b-alta", muyAlta: "--b-muyalta" };
  return `<div class="barra">${BANDAS.slice().reverse().map(([k]) => res.bandas[k] ? `<div style="width:${res.bandas[k]}%;background:var(${css[k]})" title="${et[k]}"></div>` : "").join("")}</div>
    <div class="leyenda">${BANDAS.slice().reverse().map(([k]) => `<div><i style="background:var(${css[k]})"></i>${et[k]}<b>${fmtNum(res.bandas[k])} %</b><span class="meta">${metas[k]}</span></div>`).join("")}</div>
    ${nota ? `<p class="hint">* Las metas de “baja” y “alta” incluyen las bandas extremas. Con mediciones capilares los porcentajes dependen de los horarios en que medís.</p>` : ""}`;
}

export function porMomentoHTML(res) {
  if (!res.porMomento.length) return "";
  return `<div class="scroll-x"><table class="t"><tr><th>Momento</th><th class="n">N</th><th class="n">Prom.</th><th class="n">Mín</th><th class="n">Máx</th><th class="n">En meta</th></tr>
    ${res.porMomento.map(m => `<tr><td>${esc(m.momento)}</td><td class="n">${m.n}</td><td class="n">${m.prom}</td><td class="n">${m.min}</td><td class="n">${m.max}</td><td class="n">${fmtNum(m.enMeta)} %</td></tr>`).join("")}
  </table></div>`;
}

export function hiposHTML(res) {
  if (!res.hipos.length) return `<p class="hint">Sin hipoglucemias en el período.</p>`;
  return `<div class="scroll-x"><table class="t"><tr><th>Fecha</th><th>Hora</th><th class="n">mg/dl</th><th>Momento</th><th>Síntomas / notas</th></tr>
    ${res.hipos.slice().reverse().map(h => `<tr><td>${fmtFecha(h.fecha)}</td><td>${h.hora}</td><td class="n v-bajo"><b>${h.glucemia}</b></td><td>${esc(h.momento || "")}</td><td>${esc([(h.sintomas || []).join(", "), h.notas].filter(Boolean).join(" · "))}</td></tr>`).join("")}
  </table></div>`;
}

export function pintarStats() {
  charts.forEach(c => c.destroy()); charts = [];
  const r = S.cfg.rangos, { desde, hasta } = per.rango();
  const regs = filtrarPeriodo(S.regs, desde, hasta);
  const res = resumen(regs, r);
  const conIns = regs.some(x => x.insulina_basal_u || x.insulina_rapida_u || x.insulina_correccion_u || x.carbohidratos_g);
  const conPeso = regs.some(x => x.peso_kg != null || x.pa_sistolica != null);
  $("#sCuerpo").innerHTML = !regs.length ? `<div class="card vacio">No hay registros en este período.</div>` : `
    ${kpisHTML(res, r)}
    <div class="card"><h2>Distribución por rangos</h2>${res.n ? bandasHTML(res, r) : `<p class="hint">Sin glucemias en el período.</p>`}</div>
    ${res.n ? `<div class="card"><h2>Perfil por hora del día</h2><p class="hint">Cada punto es una medición; la línea azul es la mediana de cada hora. Banda verde: ${r.bajo}–${r.alto} mg/dl.</p><div class="graf"><canvas id="cPerfil"></canvas></div></div>
    <div class="card"><h2>Evolución diaria</h2><div class="graf"><canvas id="cTend"></canvas></div></div>
    <div class="card"><h2>Promedio por momento del día</h2>${porMomentoHTML(res)}<p class="hint">“En meta”: antes de comer ${r.preMin}–${r.preMax}; después de comer &lt; ${r.postMax}; otros ${r.bajo}–${r.alto}.</p></div>
    <div class="card"><h2>Hipoglucemias</h2>${hiposHTML(res)}</div>` : ""}
    ${conIns ? `<div class="card"><h2>Insulina y carbohidratos por día</h2><div class="graf"><canvas id="cIns"></canvas></div></div>` : ""}
    ${conPeso ? `<div class="card"><h2>Peso y presión arterial</h2><div class="graf"><canvas id="cPeso"></canvas></div></div>` : ""}`;
  if (!window.Chart) return;
  if (res.n) {
    charts.push(G.perfilHora($("#cPerfil"), regs, r));
    charts.push(G.tendenciaDiaria($("#cTend"), res.serieDiaria, r));
  }
  if (conIns) charts.push(G.insulinaYCarbs($("#cIns"), regs));
  if (conPeso) charts.push(G.pesoPresion($("#cPeso"), regs));
}
