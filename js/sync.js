// Sincronización con Supabase: sube la cola local y baja lo modificado en otros dispositivos.
import { CONFIG } from "./config.js";
import * as db from "./db.js";

let sb = null, corriendo = false, otraVez = false, timer = null;

export function nubeConfigurada() { return !!(CONFIG.SUPABASE_URL && CONFIG.SUPABASE_ANON_KEY && window.supabase); }

export function cliente() {
  if (!sb && nubeConfigurada())
    sb = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY,
      { auth: { persistSession: true, autoRefreshToken: true } });
  return sb;
}

export async function usuario() {
  const c = cliente(); if (!c) return null;
  const { data } = await c.auth.getSession();
  return data.session?.user || null;
}

export async function ingresar(email, clave) {
  const { data, error } = await cliente().auth.signInWithPassword({ email, password: clave });
  if (error) throw error;
  return data.user;
}

export async function salir() { await cliente()?.auth.signOut(); }

function estado(e, extra = {}) {
  window.dispatchEvent(new CustomEvent("estado-sync", { detail: { estado: e, ...extra } }));
}

export async function sincronizar() {
  if (!nubeConfigurada()) { estado("local", { pendientes: (await db.pendientes()).length }); return; }
  if (corriendo) { otraVez = true; return; }
  if (!navigator.onLine) { estado("offline", { pendientes: (await db.pendientes()).length }); return; }
  const u = await usuario();
  if (!u) { estado("sin-sesion"); return; }
  corriendo = true; estado("sincronizando");
  try {
    // 1) Subir cambios locales
    const ops = await db.pendientes();
    for (const tabla of db.TABLAS) {
      const del = ops.filter(o => o.tabla === tabla);
      for (let i = 0; i < del.length; i += 200) {
        const lote = del.slice(i, i + 200);
        const { error } = await cliente().from(tabla)
          .upsert(lote.map(o => o.fila), { onConflict: tabla === "configuracion" ? "user_id,id" : "id" });
        if (error) throw error;
        for (const o of lote) await db.confirmarSubida(o);
      }
    }
    // 2) Bajar lo nuevo (marcado por la hora del servidor)
    for (const tabla of db.TABLAS) {
      let desde = (await db.meta(`sync_${tabla}`)) || "1970-01-01T00:00:00Z";
      for (;;) {
        const { data, error } = await cliente().from(tabla).select("*")
          .gt("sync_at", desde).order("sync_at", { ascending: true }).limit(1000);
        if (error) throw error;
        if (!data.length) break;
        await db.aplicarRemoto(tabla, data);
        desde = data[data.length - 1].sync_at;
        await db.setMeta(`sync_${tabla}`, desde);
        if (data.length < 1000) break;
      }
    }
    await db.setMeta("ultima_sync", new Date().toISOString());
    estado("ok", { pendientes: (await db.pendientes()).length });
  } catch (e) {
    console.error(e);
    estado("error", { mensaje: e.message || String(e), pendientes: (await db.pendientes()).length });
  } finally {
    corriendo = false;
    if (otraVez) { otraVez = false; solicitar(); }
  }
}

export function solicitar(ms = 1200) { clearTimeout(timer); timer = setTimeout(sincronizar, ms); }

export function iniciar() {
  window.addEventListener("online", () => solicitar(300));
  window.addEventListener("offline", () => sincronizar());
  window.addEventListener("cola-cambiada", () => solicitar());
  document.addEventListener("visibilitychange", () => { if (!document.hidden) solicitar(300); });
  setInterval(() => solicitar(0), 120000);
  sincronizar();
}
