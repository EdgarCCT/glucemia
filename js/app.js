// Arranque, navegación y pantalla de inicio
import * as db from "./db.js";
import * as sync from "./sync.js";
import { S, recargar, ir } from "./estado.js";
import { resumen, filtrarPeriodo, claseValor } from "./stats.js";
import { tieneGlucemia } from "./modelo.js";
import { initRegistro, abrirRegistro } from "./ui-registro.js";
import { initHistorial, pintarHistorial, listaPorDia } from "./ui-historial.js";
import { initStats, pintarStats, kpisHTML, bandasHTML } from "./ui-stats.js";
import { initInformes, pintarInformes } from "./ui-informes.js";
import * as mas from "./ui-mas.js";
import { $, $$, esc, fmtFecha, hoyISO, sumarDias, ahoraHM, toast } from "./util.js";

const TITULOS = { inicio: null, registro: "Registro", historial: "Historial", stats: "Estadísticas", informes: "Informes",
  mas: "Más", lab: "Laboratorio", config: "Perfil y tratamiento", recordatorios: "Recordatorios", datos: "Datos", cuenta: "Cuenta", ayuda: "Ayuda", login: "Glucemia" };
const DE_MAS = ["lab", "config", "recordatorios", "datos", "cuenta", "ayuda"];
let vista = "inicio", param = null;

function pintar(v = vista) {
  ({
    inicio: pintarInicio, historial: pintarHistorial, stats: pintarStats, informes: pintarInformes, lab: mas.pintarLab,
    datos: mas.pintarPapelera, cuenta: mas.pintarCuenta, ayuda: mas.pintarAyuda,
  })[v]?.();
}

async function mostrar() {
  const [v, id] = (location.hash.slice(1) || "inicio").split("/");
  vista = TITULOS[v] !== undefined ? v : "inicio"; param = id || null;
  if (vista !== "login" && sync.nubeConfigurada() && navigator.onLine && !(await sync.usuario())) vista = "login";
  $$(".vista").forEach(s => { s.hidden = s.id !== "v-" + vista; });
  $("#tabs").hidden = vista === "login";
  $$("#tabs button").forEach(b => b.classList.toggle("on", b.dataset.ir === vista || (b.dataset.ir === "mas" && DE_MAS.includes(vista))));
  $("#titulo").textContent = TITULOS[vista] || `Glucemia – ${S.cfg.paciente.nombre || ""}`.replace(/ – $/, "");
  if (vista === "registro") await abrirRegistro(param);
  else if (vista === "lab") mas.abrirLab(null);
  else if (vista === "config") mas.abrirConfig();
  else if (vista === "recordatorios") mas.abrirRecordatorios();
  else pintar();
  window.scrollTo(0, 0);
}

// ---------------- Inicio ----------------
function haceCuanto(r) {
  const [a, m, d] = r.fecha.split("-").map(Number), [h, mi] = r.hora.split(":").map(Number);
  const min = Math.round((Date.now() - new Date(a, m - 1, d, h, mi)) / 60000);
  if (min < 1) return "recién"; if (min < 60) return `hace ${min} min`;
  if (min < 1440) return `hace ${Math.floor(min / 60)} h`; return `hace ${Math.floor(min / 1440)} días`;
}

function pintarInicio() {
  const r = S.cfg.rangos, g = S.regs.filter(tieneGlucemia), u = g[g.length - 1];
  $("#ultimo").innerHTML = u
    ? `<div class="num v-${claseValor(+u.glucemia, u.momento, r)}">${u.glucemia}</div><div><b>Última glucemia</b> · mg/dl<div class="det">${fmtFecha(u.fecha)} ${u.hora} · ${esc(u.momento || "")}<br>${haceCuanto(u)}</div></div>`
    : `<div><b>Bienvenido.</b><div class="det">Cargá tu primera medición con el botón de abajo. Si tenías datos en la app anterior, importalos desde Más → Importar.</div></div>`;
  const res = resumen(filtrarPeriodo(S.regs, sumarDias(hoyISO(), -13), hoyISO()), r);
  $("#resumen14").innerHTML = res.n ? kpisHTML(res, r, true) + bandasHTML(res, r, false)
    : `<p class="hint">Sin mediciones en los últimos 14 días.</p>`;
  const hoy = S.regs.filter(x => x.fecha === hoyISO());
  $("#hoyLista").innerHTML = hoy.length ? listaPorDia(hoy).replace(/<div class="dia-tit">[\s\S]*?<\/div>/, "") : `<p class="hint">Nada cargado hoy.</p>`;
  const recs = (S.cfg.recordatorios || []).filter(x => x.activo && x.hora).sort((a, b) => a.hora.localeCompare(b.hora));
  const aMin = hm => +hm.slice(0, 2) * 60 + +hm.slice(3, 5), ahora = aMin(ahoraHM());
  $("#cardRecord").hidden = !recs.length;
  $("#cardRecord").innerHTML = `<div class="card-tit"><h2>Recordatorios de hoy</h2><button class="link" data-ir="recordatorios" type="button">Editar</button></div>` +
    recs.map(x => {
      const hecho = hoy.some(h => Math.abs(aMin(h.hora) - aMin(x.hora)) <= 90);
      const est = hecho ? `<span class="v-ok">✓ hecho</span>` : aMin(x.hora) < ahora ? `<span class="v-alto">pendiente</span>` : `<span class="hint">más tarde</span>`;
      return `<div class="leyenda"><div><b style="margin:0">${x.hora}</b> ${esc(x.texto)}<b>${est}</b></div></div>`;
    }).join("");
}

// ---------------- Sincronización: indicador ----------------
function indicador(e) {
  const b = $("#btnSync"), d = e.detail;
  const txt = { local: "Solo este equipo", offline: "Sin conexión", sincronizando: "Sincronizando…", ok: "Sincronizado",
    error: "Error de sincronización", "sin-sesion": "Sin sesión" }[d.estado] || d.estado;
  b.dataset.e = d.estado === "ok" && d.pendientes ? "pendiente" : d.estado;
  $("#syncTxt").textContent = d.pendientes && d.estado !== "sincronizando" && d.estado !== "local" ? `${txt} · ${d.pendientes} pend.` : txt;
  b.title = d.mensaje || txt;
}

// ---------------- Avisos de recordatorios con la app abierta ----------------
function revisarRecordatorios() {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  const hm = ahoraHM(), clave = "rec_" + hoyISO();
  let hechos; try { hechos = JSON.parse(localStorage.getItem(clave) || "[]"); } catch { hechos = []; }
  for (const r of (S.cfg.recordatorios || [])) {
    if (!r.activo || r.hora !== hm || hechos.includes(r.id)) continue;
    hechos.push(r.id);
    navigator.serviceWorker?.ready.then(reg => reg.showNotification("Glucemia", { body: r.texto, icon: "icons/icon-192.png", tag: r.id }))
      .catch(() => new Notification("Glucemia", { body: r.texto }));
  }
  try { localStorage.setItem(clave, JSON.stringify(hechos)); } catch { /* sin almacenamiento */ }
}

// ---------------- Arranque ----------------
async function iniciar() {
  if ("serviceWorker" in navigator && location.protocol !== "file:") navigator.serviceWorker.register("sw.js").catch(console.warn);
  await recargar();
  initRegistro(); initHistorial(); initStats(); initInformes();
  mas.initLab(); mas.initConfig(); mas.initRecordatorios(); mas.initDatos(); mas.initCuenta();

  document.addEventListener("click", e => {
    const b = e.target.closest("[data-ir]"); if (!b) return;
    const destino = b.dataset.ir;
    if (destino === vista && destino !== "registro") { mostrar(); return; }
    ir(destino);
  });
  $("#btnSync").addEventListener("click", () => { sync.sincronizar(); if (!sync.nubeConfigurada()) toast("Modo local: configurá Supabase para sincronizar (ver LEEME.md)", 4000); });
  window.addEventListener("hashchange", mostrar);
  window.addEventListener("datos-cambiados", async () => { await recargar(); if (vista !== "registro" && !DE_MAS.slice(1, 3).includes(vista)) pintar(); });
  window.addEventListener("estado-sync", indicador);

  $("#fLogin").addEventListener("submit", async e => {
    e.preventDefault(); $("#lError").textContent = "";
    try { await sync.ingresar($("#lEmail").value.trim(), $("#lClave").value); await sync.sincronizar(); ir("inicio"); }
    catch (err) { $("#lError").textContent = /invalid/i.test(err.message) ? "Email o clave incorrectos." : "No se pudo ingresar: " + err.message; }
  });

  sync.iniciar();
  setInterval(revisarRecordatorios, 20000);
  await mostrar();
}

iniciar().catch(e => { console.error(e); document.body.insertAdjacentHTML("afterbegin", `<p class="error" style="padding:16px">Error al iniciar: ${esc(e.message)}</p>`); });
