// Pantalla de carga / edición de un registro
import * as db from "./db.js";
import { S, ir } from "./estado.js";
import { MOMENTOS, COMIDAS, INTENSIDADES, SINTOMAS, tieneGlucemia } from "./modelo.js";
import { claseValor } from "./stats.js";
import { $, $$, esc, hoyISO, ahoraHM, fmtFecha, num, txt, toast, confirmar } from "./util.js";

export const ETIQUETAS = {
  fecha: "Fecha", hora: "Hora", glucemia: "Glucemia", momento: "Momento", insulina_basal_u: "Insulina basal (U)",
  insulina_basal_tipo: "Insulina basal", insulina_rapida_u: "Insulina rápida (U)", insulina_rapida_tipo: "Insulina rápida",
  insulina_correccion_u: "Corrección (U)", medicacion: "Medicación", comida_tipo: "Comida", comida_desc: "Qué comió",
  carbohidratos_g: "Carbohidratos (g)", actividad_tipo: "Actividad", actividad_min: "Duración (min)",
  actividad_intensidad: "Intensidad", sintomas: "Síntomas", peso_kg: "Peso (kg)", pa_sistolica: "PA sistólica",
  pa_diastolica: "PA diastólica", pulso: "Pulso", notas: "Observaciones", deleted_at: "Borrado",
};
const NUMS = ["glucemia", "insulina_basal_u", "insulina_rapida_u", "insulina_correccion_u", "carbohidratos_g",
  "actividad_min", "peso_kg", "pa_sistolica", "pa_diastolica", "pulso"];
const TXTS = ["momento", "insulina_basal_tipo", "insulina_rapida_tipo", "comida_tipo", "comida_desc", "actividad_tipo",
  "actividad_intensidad", "notas"];
const SECCIONES = {
  insulina: ["insulina_basal_u", "insulina_rapida_u", "insulina_correccion_u"],
  comida: ["comida_tipo", "comida_desc", "carbohidratos_g"],
  actividad: ["actividad_tipo", "actividad_min"],
  signos: ["peso_kg", "pa_sistolica", "pa_diastolica", "pulso"],
};

let editId = null;
const F = () => $("#fReg");

export function momentoSugerido(hm) {
  const m = +hm.slice(0, 2) * 60 + +hm.slice(3, 5);
  if (m < 300) return "Madrugada";
  if (m < 600) return "Ayunas";
  if (m < 750) return "Antes almuerzo";
  if (m < 960) return "Después almuerzo";
  if (m < 1110) return "Antes merienda";
  if (m < 1260) return "Antes cena";
  if (m < 1350) return "Después cena";
  return "Al acostarse";
}

export function textoMedicacion(med) {
  return (med || []).map(m => [m.nombre, m.dosis].filter(Boolean).join(" ")).join(", ");
}

export function initRegistro() {
  const f = F();
  f.momento.innerHTML = `<option value="">—</option>` + MOMENTOS.map(m => `<option>${m}</option>`).join("");
  f.comida_tipo.innerHTML += COMIDAS.map(m => `<option>${m}</option>`).join("");
  f.actividad_intensidad.innerHTML += INTENSIDADES.map(m => `<option>${m}</option>`).join("");
  $("#chipsSint").innerHTML = SINTOMAS.map(s =>
    `<label><input type="checkbox" name="sint" value="${s}"><span>${s}</span></label>`).join("");

  f.glucemia.addEventListener("input", alertaGlucemia);
  f.momento.addEventListener("change", alertaGlucemia);
  f.hora.addEventListener("change", () => { if (!editId && f.momento.dataset.auto === "1") sugerir(); });
  f.momento.addEventListener("change", () => { f.momento.dataset.auto = "0"; });
  f.comida_desc.addEventListener("change", () => {
    const c = (S.cfg.comidasFrecuentes || []).find(x => x.nombre === f.comida_desc.value);
    if (c && c.carbohidratos_g != null && !f.carbohidratos_g.value) f.carbohidratos_g.value = c.carbohidratos_g;
  });
  f.addEventListener("input", marcarSecciones);
  f.addEventListener("submit", guardarForm);
  $("#btnCancelar").addEventListener("click", () => history.back());
  $("#btnBorrar").addEventListener("click", async () => {
    if (!editId || !(await confirmar("¿Borrar este registro? Va a la papelera y se puede recuperar."))) return;
    await db.borrar("registros", editId);
    toast("Registro borrado");
    ir("historial");
  });
}

function sugerir() { const f = F(); f.momento.value = momentoSugerido(f.hora.value || ahoraHM()); f.momento.dataset.auto = "1"; }

function listas() {
  const cfg = S.cfg;
  const ins = t => cfg.insulinas.filter(i => i.tipo === t).map(i => i.nombre);
  const uniq = arr => [...new Set(arr.filter(Boolean))];
  $("#dlBasal").innerHTML = uniq([...ins("basal"), "Glargina", "Degludec", "Detemir", "NPH"]).map(o => `<option value="${esc(o)}">`).join("");
  $("#dlRapida").innerHTML = uniq([...ins("rapida"), "Lispro", "Aspart", "Glulisina", "Regular"]).map(o => `<option value="${esc(o)}">`).join("");
  $("#dlAct").innerHTML = uniq(S.regs.map(r => r.actividad_tipo)).map(o => `<option value="${esc(o)}">`).join("");
  $("#dlComidas").innerHTML = uniq([...(cfg.comidasFrecuentes || []).map(c => c.nombre), ...S.regs.map(r => r.comida_desc)])
    .map(o => `<option value="${esc(o)}">`).join("");
  $("#medHabitual").innerHTML = (cfg.medicacion || []).length
    ? cfg.medicacion.map((m, i) => `<label><input type="checkbox" name="medh" value="${i}"><span>${esc(textoMedicacion([m]))}</span></label>`).join("")
    : `<p class="hint">Cargá tu medicación habitual en Más → Perfil para marcarla con un toque.</p>`;
}

export async function abrirRegistro(id) {
  const f = F();
  listas();
  f.reset();
  editId = null;
  let r = null;
  if (id) r = S.regs.find(x => x.id === id) || await db.leer("registros", id);
  if (r) {
    editId = r.id;
    for (const k of [...NUMS, ...TXTS, "fecha", "hora"]) if (f[k]) f[k].value = r[k] ?? "";
    const meds = (r.medicacion || []).slice();
    $$('input[name="medh"]', f).forEach(ch => {
      const m = S.cfg.medicacion[+ch.value];
      const i = meds.findIndex(x => x.nombre === m.nombre && (x.dosis || "") === (m.dosis || ""));
      if (i >= 0) { ch.checked = true; meds.splice(i, 1); }
    });
    f.med_otra.value = textoMedicacion(meds);
    $$('input[name="sint"]', f).forEach(ch => { ch.checked = (r.sintomas || []).includes(ch.value); });
    $("#regTitulo").textContent = "Modificar registro";
    $("#regMod").textContent = r.updated_at && r.updated_at !== r.created_at
      ? "Modificado " + new Date(r.updated_at).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" }) : "";
    f.classList.add("editando");
    $("#btnGuardar").textContent = "GUARDAR CAMBIOS";
    $("#accEdicion").hidden = false;
    $("#secCambios").open = false;
    mostrarCambios(r);
  } else {
    f.fecha.value = hoyISO(); f.hora.value = ahoraHM();
    sugerir();
    const basal = S.cfg.insulinas.find(i => i.tipo === "basal"), rap = S.cfg.insulinas.find(i => i.tipo === "rapida");
    if (basal) f.insulina_basal_tipo.value = basal.nombre;
    if (rap) f.insulina_rapida_tipo.value = rap.nombre;
    $("#regTitulo").textContent = "Nuevo registro";
    $("#regMod").textContent = "";
    f.classList.remove("editando");
    $("#btnGuardar").textContent = "GUARDAR";
    $("#accEdicion").hidden = true;
  }
  $$("details.sec[data-sec]", f).forEach(d => { d.open = false; });
  marcarSecciones(true);
  alertaGlucemia();
  if (!r) setTimeout(() => f.glucemia.focus(), 50);
}

function marcarSecciones(abrir = false) {
  const f = F();
  const lleno = {
    ...Object.fromEntries(Object.entries(SECCIONES).map(([s, ks]) => [s, ks.filter(k => f[k].value).length])),
    medicacion: $$('input[name="medh"]:checked', f).length + (f.med_otra.value.trim() ? 1 : 0),
    sintomas: $$('input[name="sint"]:checked', f).length,
  };
  $$("details.sec[data-sec]", f).forEach(d => {
    const n = lleno[d.dataset.sec];
    const s = d.querySelector("summary");
    s.querySelector(".badge")?.remove();
    if (n) s.insertAdjacentHTML("beforeend", `<span class="badge">${n}</span>`);
    if (abrir === true && n) d.open = true;
  });
}

function alertaGlucemia() {
  const f = F(), box = $("#alertaGluc"), v = num(f.glucemia.value), r = S.cfg.rangos;
  f.glucemia.className = "";
  box.hidden = true;
  if (v === null) return;
  f.glucemia.classList.add("v-" + claseValor(v, f.momento.value, r));
  if (!S.cfg.alertas) return;
  let msg = "", cls = "";
  if (v < r.muyBajo) { cls = "bajo"; msg = `<b>Hipoglucemia nivel 2 (&lt;${r.muyBajo}).</b> Tomá 15 g de hidratos de absorción rápida y volvé a medir en 15 minutos. Si no mejora, hay confusión o somnolencia, pedí ayuda y avisá a tu médico.`; }
  else if (v < r.bajo) { cls = "bajo"; msg = `<b>Hipoglucemia (&lt;${r.bajo}).</b> Regla 15/15: 15 g de hidratos rápidos (ej. ½ vaso de jugo o 3 caramelos) y volvé a medir en 15 minutos. Marcá los síntomas si los tenés.`; }
  else if (v > 300) { cls = "alto"; msg = `<b>Glucemia muy alta (&gt;300).</b> Tomá agua, revisá si omitiste medicación y volvé a medir. Si se repite o tenés vómitos, mucha sed o somnolencia, contactá a tu médico.`; }
  else if (v > r.muyAlto) { cls = "alto"; msg = `<b>Glucemia alta (&gt;${r.muyAlto}).</b> Tomá agua y volvé a medir más tarde. Anotá qué comiste o si hubo algún cambio.`; }
  if (msg) { box.className = "alerta " + cls; box.innerHTML = msg; box.hidden = false; }
}

async function guardarForm(e) {
  e.preventDefault();
  const f = F();
  const r = editId ? { ...(S.regs.find(x => x.id === editId) || await db.leer("registros", editId)) } : {};
  r.fecha = f.fecha.value; r.hora = f.hora.value;
  for (const k of NUMS) r[k] = num(f[k].value);
  for (const k of TXTS) r[k] = txt(f[k].value);
  const meds = $$('input[name="medh"]:checked', f).map(ch => ({ ...S.cfg.medicacion[+ch.value] }));
  for (const o of f.med_otra.value.split(",").map(s => s.trim()).filter(Boolean)) meds.push({ nombre: o, dosis: "" });
  r.medicacion = meds.length ? meds : null;
  const sint = $$('input[name="sint"]:checked', f).map(ch => ch.value);
  r.sintomas = sint.length ? sint : null;

  if (!r.fecha || !r.hora) { toast("Falta la fecha o la hora"); return; }
  const algo = [...NUMS, ...TXTS.filter(k => !["momento", "insulina_basal_tipo", "insulina_rapida_tipo"].includes(k))].some(k => r[k] !== null)
    || r.medicacion || r.sintomas;
  if (!algo) { toast("Cargá al menos la glucemia u otro dato"); f.glucemia.focus(); return; }
  if (tieneGlucemia(r) && (r.glucemia < 20 || r.glucemia > 600)
    && !(await confirmar(`El valor ${r.glucemia} mg/dl es poco habitual. ¿Lo guardo igual?`))) return;
  if (r.insulina_basal_u === null) r.insulina_basal_tipo = null;
  if (r.insulina_rapida_u === null && r.insulina_correccion_u === null) r.insulina_rapida_tipo = null;

  await db.guardar("registros", r);
  toast(editId ? "Cambios guardados" : "Registro guardado");
  if (editId) history.back(); else ir("inicio");
}

function valorTexto(k, v) {
  if (v === null || v === undefined || v === "") return "—";
  if (k === "medicacion") return textoMedicacion(v);
  if (k === "sintomas") return v.join(", ");
  if (k === "fecha") return fmtFecha(v);
  if (k === "deleted_at") return "sí";
  return String(v);
}

async function mostrarCambios(actual) {
  const cambios = await db.cambiosDe(actual.id);
  const box = $("#listaCambios");
  if (!cambios.length) { box.innerHTML = `<p class="hint">Sin modificaciones desde que se cargó.</p>`; return; }
  const versiones = [actual, ...cambios.map(c => c.datos_anteriores)];
  box.innerHTML = cambios.map((c, i) => {
    const nuevo = versiones[i], viejo = versiones[i + 1];
    const difs = Object.keys(ETIQUETAS).filter(k => JSON.stringify(nuevo[k] ?? null) !== JSON.stringify(viejo[k] ?? null));
    const cuando = new Date(c.fecha_cambio).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" });
    return `<div class="hint"><b>${cuando}</b><br>${difs.map(k =>
      `${ETIQUETAS[k]}: ${esc(valorTexto(k, viejo[k]))} → ${esc(valorTexto(k, nuevo[k]))}`).join("<br>") || "Sin cambios visibles"}</div>`;
  }).join("<hr>");
}
