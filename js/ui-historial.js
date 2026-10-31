// Historial: lista por día con filtros
import { S, ir } from "./estado.js";
import { claseValor } from "./stats.js";
import { tieneGlucemia, insulinaTotal } from "./modelo.js";
import { textoMedicacion } from "./ui-registro.js";
import { $, esc, fmtFecha, diaSemana, fmtNum, sumarDias, hoyISO } from "./util.js";

export function tagsRegistro(r) {
  const t = [];
  if (r.insulina_basal_u != null) t.push(`Basal ${fmtNum(r.insulina_basal_u)} U${r.insulina_basal_tipo ? " " + r.insulina_basal_tipo : ""}`);
  if (r.insulina_rapida_u != null) t.push(`Rápida ${fmtNum(r.insulina_rapida_u)} U${r.insulina_rapida_tipo ? " " + r.insulina_rapida_tipo : ""}`);
  if (r.insulina_correccion_u != null) t.push(`Corrección ${fmtNum(r.insulina_correccion_u)} U`);
  if (r.medicacion) t.push(textoMedicacion(r.medicacion));
  if (r.comida_tipo || r.comida_desc || r.carbohidratos_g != null)
    t.push([r.comida_tipo, r.comida_desc, r.carbohidratos_g != null ? `${fmtNum(r.carbohidratos_g)} g HC` : ""].filter(Boolean).join(" · "));
  if (r.actividad_tipo || r.actividad_min != null)
    t.push([r.actividad_tipo, r.actividad_min != null ? `${r.actividad_min} min` : "", r.actividad_intensidad].filter(Boolean).join(" · "));
  if (r.sintomas) t.push("Síntomas: " + r.sintomas.join(", "));
  if (r.peso_kg != null) t.push(`${fmtNum(r.peso_kg)} kg`);
  if (r.pa_sistolica != null || r.pa_diastolica != null) t.push(`PA ${r.pa_sistolica ?? "–"}/${r.pa_diastolica ?? "–"}`);
  if (r.pulso != null) t.push(`${r.pulso} lpm`);
  return t;
}

export function itemHTML(r) {
  const g = tieneGlucemia(r);
  const cls = g ? "v-" + claseValor(+r.glucemia, r.momento, S.cfg.rangos) : "";
  return `<button type="button" class="item" data-id="${r.id}">
    <span class="hora">${r.hora}</span>
    <span class="val ${cls}">${g ? r.glucemia : "—"}${g ? "<small>mg/dl</small>" : ""}</span>
    <span class="info"><span class="m">${esc(r.momento || (g ? "" : "Sin glucemia"))}</span>
      ${tagsRegistro(r).map(x => `<span class="tag">${esc(x)}</span>`).join("")}
      ${r.notas ? `<div>${esc(r.notas)}</div>` : ""}</span>
  </button>`;
}

export function listaPorDia(regs) {
  if (!regs.length) return `<p class="vacio">No hay registros.</p>`;
  const dias = new Map();
  for (const r of regs.slice().reverse()) (dias.get(r.fecha) || dias.set(r.fecha, []).get(r.fecha)).push(r);
  return [...dias].map(([d, rs]) => {
    const v = rs.filter(tieneGlucemia).map(r => +r.glucemia);
    const ins = rs.reduce((a, r) => a + insulinaTotal(r), 0);
    const extra = [v.length ? `prom. ${Math.round(v.reduce((a, b) => a + b, 0) / v.length)}` : "", ins ? `${fmtNum(ins)} U` : ""]
      .filter(Boolean).join(" · ");
    return `<div class="dia"><div class="dia-tit"><span>${diaSemana(d)} ${fmtFecha(d)}</span><span>${extra}</span></div>${rs.map(itemHTML).join("")}</div>`;
  }).join("");
}

export function initHistorial() {
  $("#hDesde").value = sumarDias(hoyISO(), -30);
  for (const id of ["hDesde", "hHasta", "hBuscar", "hTipo"]) $("#" + id).addEventListener("input", pintarHistorial);
  $("#hLista").addEventListener("click", e => { const b = e.target.closest(".item"); if (b) ir("registro", b.dataset.id); });
}

export function pintarHistorial() {
  const desde = $("#hDesde").value, hasta = $("#hHasta").value, q = $("#hBuscar").value.trim().toLowerCase(), tipo = $("#hTipo").value;
  const r = S.cfg.rangos;
  const sel = S.regs.filter(x => (!desde || x.fecha >= desde) && (!hasta || x.fecha <= hasta)
    && (!q || JSON.stringify(x).toLowerCase().includes(q))
    && (!tipo || (tipo === "gluc" && tieneGlucemia(x)) || (tipo === "hipo" && tieneGlucemia(x) && x.glucemia < r.bajo)
      || (tipo === "alto" && tieneGlucemia(x) && x.glucemia > r.alto) || (tipo === "ins" && insulinaTotal(x) > 0)
      || (tipo === "sint" && x.sintomas?.length)));
  $("#hLista").innerHTML = listaPorDia(sel);
}
