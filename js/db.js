// Base local (IndexedDB) + cola de cambios pendientes de subir a la nube.
// Toda escritura pasa primero por acá: si la app se cierra o no hay internet, el dato ya quedó guardado.
import { uuid, limpiar, mezclarConfig } from "./modelo.js";

export const TABLAS = ["registros", "laboratorio", "historial_cambios", "configuracion"];
let nombreBase = "glucemia";
let dbp = null;

export function usarBase(nombre) { nombreBase = nombre; dbp = null; }

function abrir() {
  return dbp ||= new Promise((res, rej) => {
    const q = indexedDB.open(nombreBase, 1);
    q.onupgradeneeded = () => {
      const d = q.result;
      for (const t of [...TABLAS, "cola", "meta"])
        if (!d.objectStoreNames.contains(t)) d.createObjectStore(t, { keyPath: t === "meta" ? "k" : "id" });
    };
    q.onsuccess = () => res(q.result);
    q.onerror = () => rej(q.error);
  });
}

const prom = q => new Promise((res, rej) => { q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); });

async function store(nombre, modo = "readonly") {
  return (await abrir()).transaction(nombre, modo).objectStore(nombre);
}
export async function leerTodos(nombre) { return prom((await store(nombre)).getAll()); }
export async function leer(nombre, id) { return prom((await store(nombre)).get(id)); }
async function escribir(nombre, obj) { return prom((await store(nombre, "readwrite")).put(obj)); }
async function quitar(nombre, id) { return prom((await store(nombre, "readwrite")).delete(id)); }

function avisar() { window.dispatchEvent(new CustomEvent("datos-cambiados")); }

async function encolar(tabla, fila) {
  await escribir("cola", { id: `${tabla}:${fila.id}`, tabla, fila });
  window.dispatchEvent(new CustomEvent("cola-cambiada"));
}

// Registros vigentes (sin borrar) de una tabla
export async function todos(tabla) { return (await leerTodos(tabla)).filter(x => !x.deleted_at); }
export async function papelera(tabla) { return (await leerTodos(tabla)).filter(x => x.deleted_at); }

// Guarda (alta o modificación). Si existía, deja el valor anterior en el historial de cambios.
export async function guardar(tabla, obj, { auditar = true } = {}) {
  const ahora = new Date().toISOString();
  const fila = limpiar(tabla, obj);
  fila.id ||= uuid();
  const prev = await leer(tabla, fila.id);
  if (prev && auditar && tabla !== "historial_cambios") {
    const h = { id: uuid(), tabla, registro_id: fila.id, fecha_cambio: ahora, datos_anteriores: prev, updated_at: ahora };
    await escribir("historial_cambios", h);
    await encolar("historial_cambios", h);
  }
  fila.created_at = prev?.created_at || fila.created_at || ahora;
  fila.updated_at = ahora;
  await escribir(tabla, fila);
  await encolar(tabla, fila);
  avisar();
  return fila;
}

export async function borrar(tabla, id) {
  const prev = await leer(tabla, id);
  if (prev) await guardar(tabla, { ...prev, deleted_at: new Date().toISOString() });
}
export async function restaurar(tabla, id) {
  const prev = await leer(tabla, id);
  if (prev) await guardar(tabla, { ...prev, deleted_at: null });
}
export async function cambiosDe(registroId) {
  return (await leerTodos("historial_cambios")).filter(h => h.registro_id === registroId)
    .sort((a, b) => b.fecha_cambio.localeCompare(a.fecha_cambio));
}

export async function config() { return mezclarConfig((await leer("configuracion", "config"))?.data); }
export async function guardarConfig(data) {
  const fila = { id: "config", data, updated_at: new Date().toISOString() };
  await escribir("configuracion", fila);
  await encolar("configuracion", fila);
  avisar();
}

// ---- Usado por la sincronización ----
export async function pendientes() { return leerTodos("cola"); }
export async function confirmarSubida(op) {
  const actual = await leer("cola", op.id);
  if (actual && actual.fila.updated_at === op.fila.updated_at) await quitar("cola", op.id);
}
export async function aplicarRemoto(tabla, filas) {
  let cambios = 0;
  for (const r of filas) {
    const fila = limpiar(tabla, r);
    if (await leer("cola", `${tabla}:${fila.id}`)) continue; // hay un cambio local sin subir: gana el local
    const local = await leer(tabla, fila.id);
    if (!local || (fila.updated_at || "") >= (local.updated_at || "")) { await escribir(tabla, fila); cambios++; }
  }
  if (cambios) avisar();
  return cambios;
}
export async function meta(k) { return (await leer("meta", k))?.v; }
export async function setMeta(k, v) { await escribir("meta", { k, v }); }

export async function vaciarTodo() {
  const d = await abrir();
  for (const t of [...TABLAS, "cola", "meta"]) await prom(d.transaction(t, "readwrite").objectStore(t).clear());
  avisar();
}
