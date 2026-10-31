// Selector de período reutilizable (7/14/30/90 días o personalizado)
import { hoyISO, sumarDias, esc } from "./util.js";

const OPC = [[7, "7 días"], [14, "14 días"], [30, "30 días"], [90, "90 días"], [0, "Todo"], [-1, "Elegir"]];

export function selectorPeriodo(cont, alCambiar, inicial = 14) {
  let dias = inicial;
  const pid = cont.id;
  cont.innerHTML = OPC.map(([d, t]) => `<button type="button" data-d="${d}">${esc(t)}</button>`).join("")
    + `<div class="rango"><label>Desde<input type="date" id="${pid}-d"></label><label>Hasta<input type="date" id="${pid}-h"></label></div>`;
  const inD = cont.querySelector(`#${pid}-d`), inH = cont.querySelector(`#${pid}-h`);
  inH.value = hoyISO(); inD.value = sumarDias(hoyISO(), -29);
  const marcar = () => {
    cont.querySelectorAll("button").forEach(b => b.classList.toggle("on", +b.dataset.d === dias));
    cont.classList.toggle("custom", dias === -1);
  };
  cont.addEventListener("click", e => {
    const b = e.target.closest("button[data-d]"); if (!b) return;
    dias = +b.dataset.d; marcar(); alCambiar();
  });
  inD.addEventListener("change", alCambiar); inH.addEventListener("change", alCambiar);
  marcar();
  return {
    rango() {
      if (dias === -1) return { desde: inD.value || null, hasta: inH.value || null };
      if (dias === 0) return { desde: null, hasta: null };
      return { desde: sumarDias(hoyISO(), -(dias - 1)), hasta: hoyISO() };
    },
  };
}
