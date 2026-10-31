// Pantallas de "Más": laboratorio, configuración, recordatorios, datos, cuenta y ayuda
import * as db from "./db.js";
import * as sync from "./sync.js";
import { S, ir } from "./estado.js";
import { LAB_CAMPOS, DEF_RANGOS, uuid } from "./modelo.js";
import { filasAppVieja, esDuplicado } from "./importar.js";
import { generarICS, enlaceGoogle } from "./ics.js";
import { descargar } from "./informes.js";
import * as G from "./graficos.js";
import { $, $$, esc, fmtFecha, fmtNum, hoyISO, num, txt, toast, confirmar } from "./util.js";

// ---------------- Laboratorio ----------------
let labId = null, chLab = null;

export function initLab() {
  $("#labCampos").innerHTML = LAB_CAMPOS.map(([k, t, u]) =>
    `<label>${t} (${u})<input type="number" step="0.01" inputmode="decimal" name="${k}"></label>`).join("");
  const f = $("#fLab");
  f.addEventListener("submit", async e => {
    e.preventDefault();
    const l = labId ? { ...S.labs.find(x => x.id === labId) } : {};
    l.fecha = f.fecha.value;
    for (const [k] of LAB_CAMPOS) l[k] = num(f[k].value);
    l.otros = txt(f.otros.value); l.notas = txt(f.notas.value);
    if (!LAB_CAMPOS.some(([k]) => l[k] !== null) && !l.otros) { toast("Cargá al menos un resultado"); return; }
    await db.guardar("laboratorio", l);
    toast("Análisis guardado"); abrirLab(null);
  });
  $("#labCancelar").addEventListener("click", () => abrirLab(null));
  $("#labBorrar").addEventListener("click", async () => {
    if (labId && await confirmar("¿Borrar este análisis?")) { await db.borrar("laboratorio", labId); abrirLab(null); }
  });
  $("#labLista").addEventListener("click", e => { const b = e.target.closest("[data-lab]"); if (b) { abrirLab(b.dataset.lab); window.scrollTo({ top: 0, behavior: "smooth" }); } });
}

export function abrirLab(id) {
  const f = $("#fLab"); f.reset(); labId = id;
  const l = id && S.labs.find(x => x.id === id);
  if (l) { f.fecha.value = l.fecha; for (const [k] of LAB_CAMPOS) f[k].value = l[k] ?? ""; f.otros.value = l.otros || ""; f.notas.value = l.notas || ""; }
  else f.fecha.value = hoyISO();
  $("#labTitulo").textContent = l ? "Modificar análisis" : "Nuevo análisis";
  f.classList.toggle("editando", !!l); $("#labEd").hidden = !l;
  pintarLab();
}

export function pintarLab() {
  const labs = S.labs.slice().reverse();
  $("#labLista").innerHTML = labs.length ? labs.map(l => `<button type="button" class="item" data-lab="${l.id}" style="grid-template-columns:90px 1fr">
    <span class="hora">${fmtFecha(l.fecha)}</span><span class="info">${LAB_CAMPOS.filter(([k]) => l[k] != null)
      .map(([k, t, u]) => `<span class="tag">${t}: ${fmtNum(l[k])} ${u}</span>`).join("")}${l.otros ? `<span class="tag">${esc(l.otros)}</span>` : ""}</span></button>`).join("")
    : `<p class="vacio">Todavía no cargaste análisis.</p>`;
  chLab?.destroy(); chLab = null;
  if (window.Chart && S.labs.some(l => l.hba1c != null)) chLab = G.hba1c($("#gHba1c"), S.labs, S.cfg.rangos.hba1cMeta);
}

// ---------------- Configuración ----------------
let tmp = null;
const LISTAS = {
  insulinas: { cont: "#cfgInsulinas", campos: [["nombre", "Nombre (ej. Glargina)"], ["tipo", "sel"]], nuevo: () => ({ nombre: "", tipo: "basal" }) },
  medicacion: { cont: "#cfgMedicacion", campos: [["nombre", "Medicamento"], ["dosis", "Dosis (ej. 850 mg)"]], nuevo: () => ({ nombre: "", dosis: "" }) },
  comidasFrecuentes: { cont: "#cfgComidas", campos: [["nombre", "Comida"], ["carbohidratos_g", "g HC"]], nuevo: () => ({ nombre: "", carbohidratos_g: null }) },
};

function pintarLista(clave) {
  const L = LISTAS[clave];
  $(L.cont).innerHTML = tmp[clave].map((it, i) => `<div class="fila-e" data-l="${clave}" data-i="${i}">${L.campos.map(([k, ph]) => ph === "sel"
    ? `<select data-k="${k}"><option value="basal"${it[k] === "basal" ? " selected" : ""}>Basal / lenta</option><option value="rapida"${it[k] === "rapida" ? " selected" : ""}>Rápida</option></select>`
    : `<input data-k="${k}" placeholder="${ph}" value="${esc(it[k] ?? "")}"${k === "carbohidratos_g" ? ' type="number" inputmode="numeric"' : ""}>`).join("")}
    <button type="button" class="x" aria-label="Quitar">×</button></div>`).join("") || `<p class="hint">Ninguno cargado.</p>`;
}

export function initConfig() {
  const f = $("#fCfg");
  f.addEventListener("input", e => {
    const fila = e.target.closest(".fila-e"); if (!fila) return;
    const it = tmp[fila.dataset.l][+fila.dataset.i], k = e.target.dataset.k;
    it[k] = k === "carbohidratos_g" ? num(e.target.value) : e.target.value;
  });
  f.addEventListener("click", e => {
    const add = e.target.closest("[data-add]");
    if (add) { tmp[add.dataset.add].push(LISTAS[add.dataset.add].nuevo()); pintarLista(add.dataset.add); return; }
    const x = e.target.closest(".fila-e .x");
    if (x) { const fila = x.closest(".fila-e"); tmp[fila.dataset.l].splice(+fila.dataset.i, 1); pintarLista(fila.dataset.l); }
  });
  $("#cfgRangosDef").addEventListener("click", () => { for (const k in DEF_RANGOS) if (f["r_" + k]) f["r_" + k].value = DEF_RANGOS[k]; });
  f.addEventListener("submit", async e => {
    e.preventDefault();
    const c = structuredClone(S.cfg);
    for (const k in c.paciente) if (f["p_" + k]) c.paciente[k] = f["p_" + k].value.trim();
    for (const k in c.rangos) if (f["r_" + k]) c.rangos[k] = num(f["r_" + k].value) ?? DEF_RANGOS[k];
    const r = c.rangos;
    if (!(r.muyBajo < r.bajo && r.bajo < r.alto && r.alto < r.muyAlto && r.preMin < r.preMax)) { toast("Revisá los rangos: deben ir de menor a mayor"); return; }
    c.alertas = f.alertas.checked;
    for (const k in LISTAS) c[k] = tmp[k].filter(it => String(it.nombre || "").trim()).map(it => ({ ...it, nombre: it.nombre.trim() }));
    await db.guardarConfig(c);
    toast("Configuración guardada");
  });
}

export function abrirConfig() {
  const f = $("#fCfg"), c = S.cfg;
  tmp = { insulinas: structuredClone(c.insulinas), medicacion: structuredClone(c.medicacion), comidasFrecuentes: structuredClone(c.comidasFrecuentes) };
  for (const k in c.paciente) if (f["p_" + k]) f["p_" + k].value = c.paciente[k] ?? "";
  for (const k in c.rangos) if (f["r_" + k]) f["r_" + k].value = c.rangos[k];
  f.alertas.checked = !!c.alertas;
  for (const k in LISTAS) pintarLista(k);
}

// ---------------- Recordatorios ----------------
let recs = [];
export function initRecordatorios() {
  const cont = $("#recLista");
  cont.addEventListener("input", e => {
    const fila = e.target.closest(".fila-e"); if (!fila) return;
    const it = recs[+fila.dataset.i], k = e.target.dataset.k;
    it[k] = e.target.type === "checkbox" ? e.target.checked : e.target.value;
  });
  cont.addEventListener("click", e => { const x = e.target.closest(".x"); if (x) { recs.splice(+x.closest(".fila-e").dataset.i, 1); pintarRecs(); } });
  $("#recAgregar").addEventListener("click", () => { recs.push({ id: uuid(), hora: "08:00", texto: "Medir glucemia", activo: true }); pintarRecs(); });
  $("#recGuardar").addEventListener("click", async () => {
    await db.guardarConfig({ ...S.cfg, recordatorios: recs.filter(r => r.hora) }); toast("Recordatorios guardados");
  });
  $("#recIcs").addEventListener("click", () => descargar(new File([generarICS(recs)], "recordatorios_glucemia.ics", { type: "text/calendar" })));
  $("#recNotif").addEventListener("click", async () => {
    if (!("Notification" in window)) { toast("Este navegador no permite avisos"); return; }
    const p = await Notification.requestPermission();
    toast(p === "granted" ? "Avisos activados mientras la app esté abierta" : "Permiso de avisos rechazado");
  });
}
function pintarRecs() {
  $("#recLista").innerHTML = recs.map((r, i) => `<div class="fila-e" data-i="${i}" style="grid-template-columns:110px 1fr auto auto">
    <input type="time" data-k="hora" value="${esc(r.hora)}"><input data-k="texto" value="${esc(r.texto)}">
    <label class="check" style="margin:0"><input type="checkbox" data-k="activo"${r.activo ? " checked" : ""}></label>
    <button type="button" class="x" aria-label="Quitar">×</button></div>`).join("") || `<p class="hint">Sin recordatorios.</p>`;
  $("#recLinks").innerHTML = recs.filter(r => r.activo && r.hora).map(r =>
    `<a class="btn" target="_blank" rel="noopener" href="${esc(enlaceGoogle(r))}">Agregar a Google Calendar: ${esc(r.hora)} ${esc(r.texto)}</a>`).join("");
}
export function abrirRecordatorios() { recs = structuredClone(S.cfg.recordatorios || []); pintarRecs(); }

// ---------------- Datos: importar, respaldo, papelera ----------------
export function initDatos() {
  $("#impArchivo").addEventListener("change", async e => { const f = e.target.files[0]; if (f) $("#impTexto").value = await f.text(); });
  $("#impBtn").addEventListener("click", async () => {
    const { filas, errores } = filasAppVieja($("#impTexto").value);
    let nuevos = 0, rep = 0;
    const existentes = S.regs.slice();
    for (const r of filas) {
      if (esDuplicado(r, existentes)) { rep++; continue; }
      await db.guardar("registros", r); existentes.push(r); nuevos++;
    }
    $("#impRes").textContent = `Importados: ${nuevos}. Repetidos (no se cargaron): ${rep}.` + (errores.length ? ` Filas no reconocidas: ${errores.join(", ")}.` : "");
    if (nuevos) { $("#impTexto").value = ""; toast(`${nuevos} registros importados`); }
  });
  $("#bkDescargar").addEventListener("click", async () => {
    const data = { app: "glucemia", version: 1, exportado: new Date().toISOString(),
      registros: await db.leerTodos("registros"), laboratorio: await db.leerTodos("laboratorio"), configuracion: S.cfg };
    descargar(new File([JSON.stringify(data, null, 1)], `glucemia_respaldo_${hoyISO()}.json`, { type: "application/json" }));
  });
  $("#bkRestaurar").addEventListener("change", async e => {
    const f = e.target.files[0]; if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      if (data.app !== "glucemia") throw new Error("No es un respaldo de esta app");
      if (!(await confirmar(`Restaurar ${data.registros.length} registros y ${data.laboratorio.length} análisis? Se agregan los que falten y se actualizan los más nuevos.`))) return;
      let n = 0;
      for (const t of ["registros", "laboratorio"]) for (const row of data[t]) {
        const local = await db.leer(t, row.id);
        if (!local || (row.updated_at || "") > (local.updated_at || "")) { await db.guardar(t, row, { auditar: !!local }); n++; }
      }
      if (data.configuracion && await confirmar("¿Restaurar también la configuración (perfil, rangos, tratamiento)?")) await db.guardarConfig(data.configuracion);
      toast(`Respaldo restaurado: ${n} elementos`);
    } catch (err) { toast("No se pudo restaurar: " + err.message, 4500); }
    e.target.value = "";
  });
  $("#papLista").addEventListener("click", async e => {
    const b = e.target.closest("[data-rest]"); if (!b) return;
    await db.restaurar(b.dataset.tabla, b.dataset.rest); toast("Recuperado"); pintarPapelera();
  });
}
export async function pintarPapelera() {
  const items = [...(await db.papelera("registros")).map(r => ({ ...r, t: "registros" })), ...(await db.papelera("laboratorio")).map(r => ({ ...r, t: "laboratorio" }))]
    .sort((a, b) => b.deleted_at.localeCompare(a.deleted_at));
  $("#papLista").innerHTML = items.length ? `<table class="t">${items.map(r => `<tr><td>${fmtFecha(r.fecha)} ${r.hora || "(laboratorio)"}</td>
    <td>${r.glucemia != null ? `<b>${r.glucemia}</b> mg/dl` : esc(r.notas || r.actividad_tipo || "")}</td>
    <td class="n"><button class="link" type="button" data-rest="${r.id}" data-tabla="${r.t}">Recuperar</button></td></tr>`).join("")}</table>`
    : `<p class="hint">La papelera está vacía.</p>`;
}

// ---------------- Cuenta ----------------
export async function pintarCuenta() {
  const u = await sync.usuario().catch(() => null);
  const pend = (await db.pendientes()).length, ult = await db.meta("ultima_sync");
  $("#ctaInfo").innerHTML = sync.nubeConfigurada()
    ? `<p>Nube: <b>conectada a Supabase</b></p><p>Usuario: <b>${esc(u?.email || "sin sesión")}</b></p>
       <p>Cambios pendientes de subir: <b>${pend}</b></p><p>Última sincronización: <b>${ult ? new Date(ult).toLocaleString("es-AR") : "nunca"}</b></p>`
    : `<p><b>Modo local:</b> los datos se guardan solo en este dispositivo (${pend} cambios esperando subir a la nube).</p>
       <p class="hint">Para sincronizar PC y celular completá <code>js/config.js</code> con los datos de Supabase (ver LEEME.md).</p>`;
  $("#ctaSalir").hidden = !u;
}
export function initCuenta() {
  $("#ctaSync").addEventListener("click", async () => { await sync.sincronizar(); pintarCuenta(); });
  $("#ctaSalir").addEventListener("click", async () => {
    const pend = (await db.pendientes()).length;
    if (!(await confirmar(pend ? `Hay ${pend} cambios sin subir que se perderán. ¿Cerrar sesión igual?` : "¿Cerrar sesión? Se borran los datos de este dispositivo (quedan en la nube)."))) return;
    await sync.salir(); await db.vaciarTodo(); location.hash = "login"; location.reload();
  });
}

// ---------------- Ayuda ----------------
export function pintarAyuda() {
  const r = S.cfg.rangos;
  $("#ayudaTxt").innerHTML = `
  <h2>Cómo se usa</h2>
  <ol><li>Tocá <b>Cargar</b>. La fecha, la hora y el momento del día vienen sugeridos: corregilos si hace falta.</li>
  <li>Escribí la glucemia y abrí solo las secciones que necesites (insulina, medicación, comida, actividad, síntomas, peso y presión).</li>
  <li><b>GUARDAR</b>. Queda guardado al instante en el dispositivo y se sube a la nube cuando hay internet.</li>
  <li>Para modificar, tocá el registro en <b>Historial</b>. Cada cambio queda anotado en “Historial de cambios”. Lo borrado va a la papelera.</li>
  <li>En <b>Informes</b> elegí el período y compartí PDF, Excel o HTML con tu médico.</li></ol>
  <h3>Metas (ADA 2026 y consenso internacional de Tiempo en Rango)</h3>
  <ul><li>Ayunas y antes de comer: <b>${r.preMin}–${r.preMax} mg/dl</b>.</li><li>1–2 h después de comer: <b>menos de ${r.postMax}</b>.</li>
  <li>Tiempo en rango ${r.bajo}–${r.alto}: <b>más del ${r.tirMeta} %</b>.</li><li>Por debajo de ${r.bajo}: menos del 4 %; por debajo de ${r.muyBajo}: menos del 1 %.</li>
  <li>Por encima de ${r.alto}: menos del 25 %; por encima de ${r.muyAlto}: menos del 5 %.</li>
  <li>Variabilidad (CV): <b>≤ ${r.cvMeta} %</b>. HbA1c: <b>menos de ${r.hba1cMeta} %</b>.</li></ul>
  <h3>Colores</h3>
  <ul><li><span class="v-muyBajo"><b>Bordó</b></span>: menor a ${r.muyBajo} · <span class="v-bajo"><b>Rojo</b></span>: menor a ${r.bajo}</li>
  <li><span class="v-ok"><b>Verde</b></span>: en meta para ese momento · <span class="v-alto"><b>Naranja</b></span>: por encima de la meta · <span class="v-muyAlto"><b>Marrón</b></span>: mayor a ${r.muyAlto}</li></ul>
  <h3>Hipoglucemia: regla 15/15</h3>
  <p>Si estás por debajo de ${r.bajo}: tomá 15 g de hidratos rápidos (½ vaso de jugo o gaseosa común, 3 caramelos o 1 cucharada de azúcar), esperá 15 minutos y volvé a medir. Repetí si sigue baja. Si hay confusión o no podés tragar, otra persona debe pedir ayuda médica.</p>
  <h3>HbA1c estimada (GMI)</h3>
  <p>Se calcula con el promedio: 3,31 + 0,02392 × promedio. Con mediciones de dedo depende de los horarios en que medís; la HbA1c de laboratorio es la referencia.</p>
  <p class="hint">Esta app es un registro personal y no reemplaza la indicación de tu médico.</p>`;
}
