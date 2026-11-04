/** Mediana que deben alcanzar los rótulos del dibujo ampliado, en px de pantalla. */
const LABEL_PX = 11;
const MAX_WIDTH = 2400;

/**
 * Abre una figura montada en un `<dialog>` modal, al ancho de `--isofig-zoom-width` (1150 px) o al que haga falta para
 * que la mediana de sus rótulos llegue a 11 px: a 390 px miden de 2 a 5. Se mueve el mismo SVG, no una copia, para que
 * el runtime lo siga animando y el giro lo siga redibujando sin saber que cambió de lugar. Al cerrar vuelve a su sitio.
 */
export function openZoom(el: HTMLElement): void {
  const svg = el.querySelector<SVGSVGElement>(".isofig-art");
  if (!svg || svg.closest("dialog")) return;
  const chip = el.querySelector<HTMLElement>("[data-zoom]");
  const readout = el.querySelector<HTMLElement>(".isofig-readout");
  const title = el.querySelector(".isofig-title")?.textContent ?? "";

  const make = <K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, text = "") => {
    const node = document.createElement(tag);
    node.className = cls;
    node.textContent = text;
    return node;
  };
  const box = make("dialog", "isofig-zoombox");
  box.setAttribute("aria-label", title);
  // Alto de cada rótulo por px de ancho del dibujo (como lo mide la academia: tamaño × escala vertical del grabado).
  const perPx = [...svg.querySelectorAll("text")]
    .map((t) => {
      const m = t.transform.baseVal.consolidate()?.matrix;
      return (Number(t.getAttribute("font-size")) * (m ? Math.hypot(m.c, m.d) : 1)) / svg.viewBox.baseVal.width;
    })
    .filter((k) => k > 0)
    .sort((a, b) => a - b);
  const mid = perPx[perPx.length >> 1];
  if (mid) box.style.setProperty("--isofig-zoom-need", `${Math.min(MAX_WIDTH, Math.ceil(LABEL_PX / mid))}px`);
  const bar = make("div", "isofig-zoombar");
  const close = make("button", "isofig-chip isofig-zoomclose", chip?.dataset["close"] ?? "Close");
  close.type = "button";
  const pane = make("div", "isofig-zoompane");
  // Enfocable para desplazarse con las flechas; el SVG de dentro ya se nombra con su <title>.
  pane.tabIndex = 0;
  // El hueco conserva el alto de la tarjeta: detrás del diálogo la página no salta.
  const hold = make("div", "isofig-zoomhold");
  hold.style.height = `${svg.getBoundingClientRect().height}px`;
  const mark = document.createComment("");

  // Como en la tarjeta, el título visible no se lee: ya nombran la figura el diálogo y el <title> del SVG.
  const heading = make("span", "isofig-zoomtitle", title);
  heading.ariaHidden = "true";
  svg.replaceWith(hold);
  readout?.replaceWith(mark);
  bar.append(heading, close);
  if (readout) bar.append(readout);
  pane.append(svg);
  box.append(bar, pane);
  // Dentro de la figura: hereda el tema y el runtime encuentra las piezas si el giro redibuja la escena.
  el.append(box);

  close.addEventListener("click", () => box.close());
  // El diálogo nativo deja salir el foco a la barra del navegador; aquí Tab da la vuelta entre «Cerrar» y el dibujo.
  box.addEventListener("keydown", (e) => {
    if (e.key !== "Tab") return;
    const [first, last] = e.shiftKey ? [pane, close] : [close, pane];
    if (document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  });
  box.addEventListener("close", () => {
    hold.replaceWith(svg);
    if (readout) mark.replaceWith(readout);
    box.remove();
    chip?.focus();
  });
  box.showModal();
  pane.scrollLeft = (pane.scrollWidth - pane.clientWidth) / 2;
  pane.scrollTop = (pane.scrollHeight - pane.clientHeight) / 2;
}
