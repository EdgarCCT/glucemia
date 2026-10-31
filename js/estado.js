// Estado compartido de la interfaz: se recarga desde la base local cada vez que cambian los datos.
import * as db from "./db.js";
import { ordenar } from "./stats.js";

export const S = { cfg: null, regs: [], labs: [] };

export async function recargar() {
  S.cfg = await db.config();
  S.regs = ordenar(await db.todos("registros"));
  S.labs = (await db.todos("laboratorio")).sort((a, b) => a.fecha.localeCompare(b.fecha));
  window.dispatchEvent(new CustomEvent("estado-listo"));
}

export function ir(vista, id) { location.hash = id ? `${vista}/${id}` : vista; }
