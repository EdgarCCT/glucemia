// Recordatorios → calendario (.ics y enlaces a Google Calendar), eventos diarios con alarma
import { hoyISO } from "./util.js";

const compacto = (fecha, hora) => fecha.replace(/-/g, "") + "T" + hora.replace(":", "") + "00";
const finDe = hora => { const [h, m] = hora.split(":").map(Number); const t = h * 60 + m + 10; return `${String(Math.floor(t / 60) % 24).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`; };
const escICS = s => String(s).replace(/([,;\\])/g, "\\$1").replace(/\n/g, "\\n");

export function generarICS(recordatorios, fecha = hoyISO()) {
  const sello = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
  const ev = recordatorios.filter(r => r.activo && r.hora).map(r => [
    "BEGIN:VEVENT", `UID:glucemia-${r.id}@app`, `DTSTAMP:${sello}`, `DTSTART:${compacto(fecha, r.hora)}`,
    `DTEND:${compacto(fecha, finDe(r.hora))}`, "RRULE:FREQ=DAILY", `SUMMARY:${escICS(r.texto || "Glucemia")}`,
    "BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${escICS(r.texto || "Glucemia")}`, "TRIGGER:PT0M", "END:VALARM", "END:VEVENT"].join("\r\n"));
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Glucemia//ES", "CALSCALE:GREGORIAN", ...ev, "END:VCALENDAR"].join("\r\n") + "\r\n";
}

export function enlaceGoogle(r, fecha = hoyISO()) {
  const p = new URLSearchParams({ action: "TEMPLATE", text: r.texto || "Glucemia",
    dates: `${compacto(fecha, r.hora)}/${compacto(fecha, finDe(r.hora))}`, recur: "RRULE:FREQ=DAILY", details: "Recordatorio de la app Glucemia" });
  return "https://calendar.google.com/calendar/render?" + p.toString();
}
