// Importación desde la app anterior (CSV con ";" o texto copiado con tabulaciones) y respaldo JSON
import { uuid } from "./modelo.js";

export function parsearCSV(texto) {
  const t = texto.replace(/^﻿/, "").replace(/\r\n?/g, "\n").trim();
  if (!t) return [];
  const primera = t.split("\n")[0];
  const sep = primera.includes("\t") ? "\t" : primera.includes(";") ? ";" : ",";
  const filas = []; let fila = [], campo = "", q = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) {
      if (c === '"') { if (t[i + 1] === '"') { campo += '"'; i++; } else q = false; }
      else campo += c;
    } else if (c === '"' && campo === "") q = true;
    else if (c === sep) { fila.push(campo); campo = ""; }
    else if (c === "\n") { fila.push(campo); filas.push(fila); fila = []; campo = ""; }
    else campo += c;
  }
  fila.push(campo); filas.push(fila);
  return filas.map(f => f.map(s => s.trim()));
}

function fechaISO(s) {
  let m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (m) { const a = m[3].length === 2 ? "20" + m[3] : m[3]; return `${a}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`; }
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? s : null;
}
function horaHM(s) { const m = s.match(/^(\d{1,2})[:.](\d{2})/); return m ? `${m[1].padStart(2, "0")}:${m[2]}` : null; }

// "10 U lenta" → {insulina_basal_u: 10, ...}; si no se entiende queda en observaciones
export function interpretarInsulina(s) {
  if (!s) return {};
  const m = s.match(/(\d+(?:[.,]\d+)?)\s*(?:u|ui|unidades)?\b/i);
  if (!m) return { extra: s };
  const u = +m[1].replace(",", ".");
  if (/lenta|basal|glargina|lantus|toujeo|degludec|tresiba|detemir|levemir|nph/i.test(s)) return { insulina_basal_u: u, insulina_basal_tipo: s.replace(m[0], "").replace(/lenta/i, "").trim() || null };
  if (/r[aá]pida|ultra|lispro|humalog|aspart|novorapid|fiasp|glulisina|apidra|regular|correcci/i.test(s))
    return /correcci/i.test(s) ? { insulina_correccion_u: u } : { insulina_rapida_u: u, insulina_rapida_tipo: s.replace(m[0], "").replace(/r[aá]pida/i, "").trim() || null };
  return { extra: s };
}

// Columnas de la app vieja: Fecha, Hora, Registro, Actividad, Insulina/Medicación, Comida/Notas
export function filasAppVieja(texto) {
  const out = [], errores = [];
  parsearCSV(texto).forEach((f, i) => {
    if (f.every(c => !c)) return;
    const fecha = fechaISO(f[0] || ""), hora = horaHM(f[1] || "");
    if (!fecha || !hora) { if (i > 0 || !/fecha/i.test(f[0])) errores.push(i + 1); return; }
    const g = f[2] ? Number(f[2].replace(",", ".")) : null;
    const ins = interpretarInsulina(f[4] || "");
    const notas = [ins.extra ? `Insulina/medicación: ${ins.extra}` : "", f[5] || ""].filter(Boolean).join(" · ") || null;
    delete ins.extra;
    out.push({ id: uuid(), fecha, hora, glucemia: Number.isFinite(g) ? g : null, actividad_tipo: f[3] || null, notas, ...ins });
  });
  return { filas: out, errores };
}

export function esDuplicado(nuevo, existentes) {
  return existentes.some(e => e.fecha === nuevo.fecha && e.hora === nuevo.hora && (e.glucemia ?? null) === (nuevo.glucemia ?? null));
}
