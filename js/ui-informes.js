// Pantalla de informes
import { S } from "./estado.js";
import { filtrarPeriodo } from "./stats.js";
import { tieneGlucemia } from "./modelo.js";
import { selectorPeriodo } from "./periodo.js";
import * as I from "./informes.js";
import { $, $$, toast } from "./util.js";

let per;

export function initInformes() {
  per = selectorPeriodo($("#iPeriodo"), pintarInformes, 30);
  $$("[data-inf]").forEach(b => b.addEventListener("click", () => generar(b.dataset.inf, b.dataset.modo, b)));
  $("#btnVerInforme").addEventListener("click", () => {
    const { desde, hasta } = per.rango();
    const w = window.open("", "_blank");
    if (!w) { toast("El navegador bloqueó la ventana"); return; }
    w.document.write(I.htmlInforme(desde, hasta, opciones())); w.document.close();
  });
}

function opciones() { return { tabla: $("#iTabla").checked, graficos: $("#iGraf").checked }; }

export function pintarInformes() {
  const { desde, hasta } = per.rango();
  const regs = filtrarPeriodo(S.regs, desde, hasta);
  $("#iInfo").textContent = `${regs.length} registros en el período (${regs.filter(tieneGlucemia).length} con glucemia).`;
}

async function generar(tipo, modo, btn) {
  const libs = { pdf: window.jspdf, xlsx: window.XLSX, html: true };
  if (!libs[tipo]) { toast("Falta cargar una librería. Abrí la app con internet una vez."); return; }
  const { desde, hasta } = per.rango();
  btn.disabled = true;
  try {
    await new Promise(r => setTimeout(r, 30));
    const file = tipo === "pdf" ? I.generarPDF(desde, hasta, opciones())
      : tipo === "xlsx" ? I.generarXLSX(desde, hasta) : I.generarHTML(desde, hasta, opciones());
    if (modo === "descargar") { I.descargar(file); toast("Archivo descargado"); return; }
    const r = await I.compartir(file, `Informe de glucemia de ${S.cfg.paciente.nombre || ""}`);
    if (r === "descargado") toast("Este navegador no permite compartir ese archivo: se descargó. Envialo desde Descargas.", 4500);
  } catch (e) {
    console.error(e); toast("No se pudo generar: " + e.message, 4500);
  } finally { btn.disabled = false; }
}
