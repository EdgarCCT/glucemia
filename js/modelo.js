// Catálogos, campos y configuración por defecto
export const MOMENTOS = ["Ayunas", "Antes desayuno", "Después desayuno", "Antes almuerzo", "Después almuerzo",
  "Antes merienda", "Después merienda", "Antes cena", "Después cena", "Al acostarse", "Madrugada", "Otro"];
export const PRE = new Set(["Ayunas", "Antes desayuno", "Antes almuerzo", "Antes merienda", "Antes cena"]);
export const POST = new Set(["Después desayuno", "Después almuerzo", "Después merienda", "Después cena"]);
export const COMIDAS = ["Desayuno", "Almuerzo", "Merienda", "Cena", "Colación"];
export const INTENSIDADES = ["Leve", "Moderada", "Intensa"];
export const SINTOMAS = ["Temblor", "Sudoración", "Mareo", "Hambre", "Confusión", "Palpitaciones", "Sed",
  "Orina frecuente", "Visión borrosa", "Cansancio", "Dolor de cabeza", "Otro"];

export const CAMPOS = {
  registros: ["id", "fecha", "hora", "glucemia", "momento", "insulina_basal_u", "insulina_basal_tipo",
    "insulina_rapida_u", "insulina_rapida_tipo", "insulina_correccion_u", "medicacion", "comida_tipo",
    "comida_desc", "carbohidratos_g", "actividad_tipo", "actividad_min", "actividad_intensidad", "sintomas",
    "peso_kg", "pa_sistolica", "pa_diastolica", "pulso", "notas", "created_at", "updated_at", "deleted_at"],
  laboratorio: ["id", "fecha", "hba1c", "glucemia_lab", "colesterol_total", "ldl", "hdl", "trigliceridos",
    "creatinina", "microalbuminuria", "otros", "notas", "created_at", "updated_at", "deleted_at"],
  historial_cambios: ["id", "tabla", "registro_id", "fecha_cambio", "datos_anteriores", "updated_at", "deleted_at"],
  configuracion: ["id", "data", "updated_at", "deleted_at"],
};

export const LAB_CAMPOS = [
  ["hba1c", "HbA1c", "%"], ["glucemia_lab", "Glucemia en ayunas (lab.)", "mg/dl"],
  ["colesterol_total", "Colesterol total", "mg/dl"], ["ldl", "LDL", "mg/dl"], ["hdl", "HDL", "mg/dl"],
  ["trigliceridos", "Triglicéridos", "mg/dl"], ["creatinina", "Creatinina", "mg/dl"],
  ["microalbuminuria", "Microalbuminuria", "mg/g"],
];

export const DEF_RANGOS = { muyBajo: 54, bajo: 70, alto: 180, muyAlto: 250, preMin: 80, preMax: 130, postMax: 180,
  hba1cMeta: 7, tirMeta: 70, cvMeta: 36 };

export const DEF_CONFIG = {
  paciente: { nombre: "Edgardo", nacimiento: "", tipo: "Diabetes tipo 2 con insulina", diagnostico: "",
    medico: "", emailMedico: "" },
  rangos: { ...DEF_RANGOS },
  insulinas: [],          // [{nombre, tipo: "basal"|"rapida"}]
  medicacion: [],         // [{nombre, dosis}]
  comidasFrecuentes: [],  // [{nombre, carbohidratos_g}]
  recordatorios: [{ id: "r1", hora: "06:45", texto: "Medir glucemia en ayunas", activo: true }],
  alertas: true,
};

export function uuid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, c =>
    (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16));
}

// Deja en el objeto solo los campos conocidos de la tabla
export function limpiar(tabla, obj) {
  const o = {};
  for (const k of CAMPOS[tabla]) if (obj[k] !== undefined) o[k] = obj[k];
  return o;
}

export function mezclarConfig(data) {
  const d = data || {};
  return { ...DEF_CONFIG, ...d, paciente: { ...DEF_CONFIG.paciente, ...(d.paciente || {}) },
    rangos: { ...DEF_RANGOS, ...(d.rangos || {}) } };
}

export function insulinaTotal(r) {
  return (+r.insulina_basal_u || 0) + (+r.insulina_rapida_u || 0) + (+r.insulina_correccion_u || 0);
}

export function tieneGlucemia(r) {
  return r.glucemia !== null && r.glucemia !== undefined && r.glucemia !== "" && isFinite(+r.glucemia);
}
