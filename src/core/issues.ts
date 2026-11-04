/** Lo que `validateSpec`, la auditoría y `isofig check` devuelven: un código estable, dónde y qué pasa. */
export type Severity = "error" | "warning" | "info";

export interface Issue {
  /** Estable entre versiones y entre idiomas: es lo que se filtra o se compara. */
  code: IssueCode;
  severity: Severity;
  /** Dónde: `parts[3].size`, `params[0].value`, `presets[1].values.rate`. Vacío si afecta a toda la figura. */
  path: string;
  message: string;
}

/** Lo que un mensaje puede nombrar: cada código usa unas pocas de estas variables. */
type VarName =
  | "field" | "expected" | "got" | "key" | "where" | "suggest" | "known" | "id" | "kinds" | "kind" | "first" | "more" | "on"
  | "mount" | "a" | "b" | "group" | "min" | "max" | "value" | "shown" | "step" | "implicit" | "last" | "param" | "length"
  | "count" | "total" | "text" | "zoomed" | "mobile" | "need" | "near" | "kb" | "budget" | "reason" | "when" | "list"
  | "hidden" | "runs" | "at" | "seconds";
export type V = Partial<Record<VarName, string | number>>;
type Q = (s: string | number | undefined) => string;
/** Traduce lo que se esperaba (`array`, `positive`…): los códigos de `EXPECTED` no cambian, el texto sí. */
type X = (key: string) => string;
interface Entry {
  /** Gravedad en 0.9. En 1.0 los avisos que dejan la figura rota pasarán a error (ver docs/en/validate.md). */
  severity: Severity;
  en: (v: V, q: Q, x: X) => string;
  es: (v: V, q: Q, x: X) => string;
}

/** Cada mensaje en inglés (idioma por defecto) y en español; el código es la clave y no cambia. */
const CATALOG = {
  // La spec en conjunto
  "spec-not-object": { severity: "error", en: () => "The spec must be an object.", es: () => "La spec debe ser un objeto." },
  "type-invalid": {
    severity: "error",
    en: (v, q, x) => `${q(v.field)} must be ${x(String(v.expected))}, got ${v.got}.`,
    es: (v, q, x) => `${q(v.field)} debe ser ${x(String(v.expected))}; llegó ${v.got}.`,
  },
  "unknown-key": {
    severity: "warning",
    en: (v, q) => `Unknown key ${q(v.key)} in ${v.where}.${v.suggest ? ` Typo for ${q(v.suggest)}?` : ""} Known keys: ${v.known}.`,
    es: (v, q) => `Clave desconocida ${q(v.key)} en ${v.where}.${v.suggest ? ` ¿Errata de ${q(v.suggest)}?` : ""} Claves conocidas: ${v.known}.`,
  },
  "id-invalid": {
    severity: "error",
    en: (v, q) => `id ${q(v.id)}: use letters, numbers and hyphens.`,
    es: (v, q) => `id ${q(v.id)}: usa letras, números y guiones.`,
  },
  "title-missing": {
    severity: "warning",
    en: () => "The figure has no title: the SVG <title> would be empty.",
    es: () => "La figura no tiene título: el <title> del SVG quedaría vacío.",
  },
  "alt-missing": {
    severity: "info",
    en: () => "The figure has neither alt nor caption: a screen reader only gets the title.",
    es: () => "La figura no tiene alt ni pie: un lector de pantalla solo oiría el título.",
  },
  "dimension-invalid": {
    severity: "error",
    en: (v, q, x) => `${q(v.field)} must be ${x(String(v.expected))}, got ${v.got}: the drawing would have no scale.`,
    es: (v, q, x) => `${q(v.field)} debe ser ${x(String(v.expected))}; llegó ${v.got}: el dibujo se quedaría sin escala.`,
  },
  "number-invalid": {
    severity: "error",
    en: (v, q) => `${q(v.field)} must be a finite number, got ${v.got}.`,
    es: (v, q) => `${q(v.field)} debe ser un número finito; llegó ${v.got}.`,
  },
  "vector-length-invalid": {
    severity: "error",
    en: (v, q) => `${q(v.field)} must have ${v.expected} numbers, got ${v.got}.`,
    es: (v, q) => `${q(v.field)} debe tener ${v.expected} números; llegó ${v.got}.`,
  },
  "option-invalid": {
    severity: "warning",
    en: (v, q) => `${q(v.field)} is ${q(v.got)}; expected one of: ${v.expected}.`,
    es: (v, q) => `${q(v.field)} es ${q(v.got)}; se esperaba uno de: ${v.expected}.`,
  },
  "parts-missing": {
    severity: "error",
    en: () => "The spec has no parts (a list in 'parts', or a 'root' tree or a 'map').",
    es: () => "La spec no tiene piezas (una lista en 'parts', un árbol en 'root' o un 'map').",
  },
  "parts-empty": {
    severity: "warning",
    en: () => "The figure has no parts: there is nothing to draw.",
    es: () => "La figura no tiene piezas: no hay nada que dibujar.",
  },
  "camera-invalid": {
    severity: "error",
    en: (v, q) => `${q(v.field)} must be a finite number of degrees, got ${v.got}.`,
    es: (v, q) => `${q(v.field)} debe ser un número finito de grados; llegó ${v.got}.`,
  },
  "model-name-invalid": {
    severity: "warning",
    en: (v) => `model must be the non-empty name the page registers the model under, got ${v.got}.`,
    es: (v) => `model debe ser el nombre, no vacío, con el que la página registra el modelo; llegó ${v.got}.`,
  },
  "autoplay-without-model": {
    severity: "warning",
    en: () => "autoplay is on but there is no model: a figure driven only by controls has nothing to play.",
    es: () => "autoplay está activo pero no hay modelo: una figura que solo responde a los controles no tiene qué reproducir.",
  },
  "motion-invalid": {
    severity: "warning",
    en: (v, q, x) => `${q(v.field)} must be ${x(String(v.expected))}, got ${v.got}.`,
    es: (v, q, x) => `${q(v.field)} debe ser ${x(String(v.expected))}; llegó ${v.got}.`,
  },
  "budget-invalid": {
    severity: "warning",
    en: (v) => `budget must be a positive number of KB, got ${v.got}.`,
    es: (v) => `budget debe ser un número positivo de KB; llegó ${v.got}.`,
  },

  // Piezas
  "part-id-missing": {
    severity: "error",
    en: () => "The part has no id (a non-empty string).",
    es: () => "La pieza no tiene id (un texto no vacío).",
  },
  "kind-missing": {
    severity: "error",
    en: (v, q) => `${q(v.id)} has no kind. Kinds: ${v.kinds}.`,
    es: (v, q) => `${q(v.id)} no tiene kind. Tipos: ${v.kinds}.`,
  },
  "kind-unknown": {
    severity: "error",
    en: (v, q) => `${q(v.id)} has an unknown kind ${q(v.kind)}. Kinds: ${v.kinds}.`,
    es: (v, q) => `${q(v.id)} tiene un kind desconocido ${q(v.kind)}. Tipos: ${v.kinds}.`,
  },
  "field-missing": {
    severity: "error",
    en: (v, q) => `${q(v.id)} (${v.kind}) needs ${q(v.field)}.`,
    es: (v, q) => `${q(v.id)} (${v.kind}) necesita ${q(v.field)}.`,
  },
  "id-duplicate": {
    severity: "error",
    en: (v, q) => `Duplicate id ${q(v.id)} (first used at ${v.first})${v.more ? `, and ${v.more} more copies of this part collide too` : ""}.`,
    es: (v, q) => `id repetido ${q(v.id)} (ya aparece en ${v.first})${v.more ? `, y chocan ${v.more} copias más de esta pieza` : ""}.`,
  },
  "on-unknown": {
    severity: "error",
    en: (v, q) => `${q(v.id)} goes on ${q(v.on)}, which does not exist.`,
    es: (v, q) => `${q(v.id)} va sobre ${q(v.on)}, que no existe.`,
  },
  "on-not-solid": {
    severity: "error",
    en: (v, q) => `${q(v.id)} goes on ${q(v.on)}, which is a detail: details go on a box, cylinder or prism.`,
    es: (v, q) => `${q(v.id)} va sobre ${q(v.on)}, que es un detalle: los detalles van sobre una caja, un cilindro o un prisma.`,
  },
  "mount-unknown": {
    severity: "warning",
    en: (v, q) => `${q(v.id)} is mounted in ${q(v.mount)}, which does not exist.`,
    es: (v, q) => `${q(v.id)} va encajada en ${q(v.mount)}, que no existe.`,
  },
  "size-negative": {
    severity: "error",
    en: (v, q) => `${q(v.field)} of ${q(v.id)} is ${v.got}: sizes must be positive.`,
    es: (v, q) => `${q(v.field)} de ${q(v.id)} vale ${v.got}: las medidas deben ser positivas.`,
  },
  "size-zero": {
    severity: "warning",
    en: (v, q) => `${q(v.field)} of ${q(v.id)} is 0: the part is flat and nothing of it is drawn.`,
    es: (v, q) => `${q(v.field)} de ${q(v.id)} vale 0: la pieza es plana y no se dibuja nada de ella.`,
  },
  "number-negative": {
    severity: "warning",
    en: (v, q) => `${q(v.field)} of ${q(v.id)} is ${v.got}: it is treated as 0.`,
    es: (v, q) => `${q(v.field)} de ${q(v.id)} vale ${v.got}: se trata como 0.`,
  },
  "count-invalid": {
    severity: "warning",
    en: (v, q) => `${q(v.field)} of ${q(v.id)} must be a positive whole number, got ${v.got}.`,
    es: (v, q) => `${q(v.field)} de ${q(v.id)} debe ser un entero positivo; llegó ${v.got}.`,
  },
  "count-too-large": {
    severity: "error",
    en: (v, q) => `${q(v.field)} of ${q(v.id)} is ${v.got}: more than ${v.max} copies would take forever to draw.`,
    es: (v, q) => `${q(v.field)} de ${q(v.id)} vale ${v.got}: más de ${v.max} copias no terminarían de dibujarse.`,
  },
  "repeat-from-invalid": {
    severity: "warning",
    en: (v, q) => `repeat.from of ${q(v.id)} must be a whole number (the first value of {i}), got ${v.got}.`,
    es: (v, q) => `repeat.from de ${q(v.id)} debe ser un entero (el primer valor de {i}); llegó ${v.got}.`,
  },
  "prism-plan-short": {
    severity: "error",
    en: (v, q) => `The plan of ${q(v.id)} needs at least 3 points, got ${v.got}.`,
    es: (v, q) => `La planta de ${q(v.id)} necesita al menos 3 puntos; tiene ${v.got}.`,
  },
  "prism-clockwise": {
    severity: "warning",
    en: (v, q) => `The plan of ${q(v.id)} runs clockwise: list the points counterclockwise or the faces come out inside out.`,
    es: (v, q) => `La planta de ${q(v.id)} va en sentido horario: pon los puntos en sentido antihorario o las caras salen al revés.`,
  },
  "prism-concave": {
    severity: "warning",
    en: (v, q) => `The plan of ${q(v.id)} is not convex: split it into convex prisms.`,
    es: (v, q) => `La planta de ${q(v.id)} no es convexa: pártela en prismas convexos.`,
  },
  "prism-degenerate": {
    severity: "warning",
    en: (v, q) => `The plan of ${q(v.id)} has no area (its points are in a line).`,
    es: (v, q) => `La planta de ${q(v.id)} no tiene área (sus puntos están en línea).`,
  },
  "group-ignored": {
    severity: "warning",
    en: (v, q) => `${q(v.id)} is a detail: it moves with the group of ${q(v.on)} and its own group is ignored.`,
    es: (v, q) => `${q(v.id)} es un detalle: se mueve con el grupo de ${q(v.on)} y su propio grupo se ignora.`,
  },
  "label-text-missing": {
    severity: "warning",
    en: (v, q) => `The label ${q(v.id)} has no text.`,
    es: (v, q) => `El rótulo ${q(v.id)} no tiene texto.`,
  },
  "label-size-invalid": {
    severity: "warning",
    en: (v, q) => `The size of the label ${q(v.id)} is ${v.got}: it will not be visible.`,
    es: (v, q) => `El tamaño del rótulo ${q(v.id)} es ${v.got}: no se verá.`,
  },

  // Grupos
  "group-unused": {
    severity: "warning",
    en: (v) => `${v.count} group(s) are declared in groups but no part uses them: ${v.list}.`,
    es: (v) => `${v.count} grupo(s) están declarados en groups pero ninguna pieza los usa: ${v.list}.`,
  },
  "spin-plane-invalid": {
    severity: "error",
    en: (v, q) => `The spin of group ${q(v.group)} needs plane ${v.expected}, got ${q(v.got)}.`,
    es: (v, q) => `El giro del grupo ${q(v.group)} necesita un plano ${v.expected}; llegó ${q(v.got)}.`,
  },

  // Controles
  "param-id-missing": {
    severity: "warning",
    en: () => "The parameter has no id (a non-empty string): no model or preset can reach it.",
    es: () => "El parámetro no tiene id (un texto no vacío): ni un modelo ni un desvío pueden alcanzarlo.",
  },
  "param-id-duplicate": {
    severity: "warning",
    en: (v, q) => `Parameter id ${q(v.id)} is used twice (first at ${v.first}): both controls would move the same value.`,
    es: (v, q) => `El id de parámetro ${q(v.id)} se usa dos veces (primero en ${v.first}): los dos controles moverían el mismo valor.`,
  },
  "param-number-invalid": {
    severity: "warning",
    en: (v, q) => `${q(v.field)} of ${q(v.id)} must be a finite number, got ${v.got}; it is drawn as 0.`,
    es: (v, q) => `${q(v.field)} de ${q(v.id)} debe ser un número finito; llegó ${v.got}, y se dibuja como 0.`,
  },
  "param-range-invalid": {
    severity: "warning",
    en: (v, q) => `${q(v.id)}: min (${v.min}) is not below max (${v.max}): the slider has no travel.`,
    es: (v, q) => `${q(v.id)}: min (${v.min}) no es menor que max (${v.max}): el deslizante no tiene recorrido.`,
  },
  "param-step-invalid": {
    severity: "warning",
    en: (v, q) => `The step of ${q(v.id)} must be a positive number, got ${v.got}.`,
    es: (v, q) => `El paso de ${q(v.id)} debe ser un número positivo; llegó ${v.got}.`,
  },
  "param-value-out-of-range": {
    severity: "warning",
    en: (v, q) => `${q(v.id)} starts at ${v.value}, outside its range ${v.min} to ${v.max}: the slider would show ${v.shown}.`,
    es: (v, q) => `${q(v.id)} arranca en ${v.value}, fuera de su rango ${v.min} a ${v.max}: el deslizante mostraría ${v.shown}.`,
  },
  "param-value-off-step": {
    severity: "warning",
    en: (v, q) => `${q(v.id)} starts at ${v.value}, which is not on its step of ${v.step} from ${v.min}: the slider would show ${v.shown}${v.implicit ? " (step is 1 when omitted)" : ""}.`,
    es: (v, q) => `${q(v.id)} arranca en ${v.value}, que no cae en su paso de ${v.step} desde ${v.min}: el deslizante mostraría ${v.shown}${v.implicit ? " (sin step el paso es 1)" : ""}.`,
  },
  "param-label-missing": {
    severity: "warning",
    en: (v, q) => `The control ${q(v.id)} has no label: nobody can tell what it does.`,
    es: (v, q) => `El control ${q(v.id)} no tiene etiqueta: nadie sabe qué hace.`,
  },
  "choice-options-missing": {
    severity: "warning",
    en: (v, q) => `${q(v.id)} is a choice without options: no control would be drawn.`,
    es: (v, q) => `${q(v.id)} es una elección sin options: no se dibujaría ningún control.`,
  },
  "choice-value-invalid": {
    severity: "warning",
    en: (v, q) => `${q(v.id)} starts at ${v.value}, but it must be the index of an option (0 to ${v.last}).`,
    es: (v, q) => `${q(v.id)} arranca en ${v.value}, pero debe ser el índice de una opción (0 a ${v.last}).`,
  },
  "toggle-value-invalid": {
    severity: "warning",
    en: (v, q) => `${q(v.id)} is a toggle: its value must be 0 or 1, got ${v.value}.`,
    es: (v, q) => `${q(v.id)} es un interruptor: su valor debe ser 0 o 1; llegó ${v.value}.`,
  },

  // bind, desvíos y lectura
  "bind-unknown-param": {
    severity: "warning",
    en: (v, q) => `bind uses the parameter ${q(v.param)}, which does not exist${v.suggest ? `; did you mean ${q(v.suggest)}?` : ""}.`,
    es: (v, q) => `bind usa el parámetro ${q(v.param)}, que no existe${v.suggest ? `; ¿querías ${q(v.suggest)}?` : ""}.`,
  },
  "bind-unknown-group": {
    severity: "warning",
    en: (v, q) => `bind moves the group ${q(v.group)}, which no part has${v.suggest ? `; did you mean ${q(v.suggest)}?` : ""}.`,
    es: (v, q) => `bind mueve el grupo ${q(v.group)}, que ninguna pieza tiene${v.suggest ? `; ¿querías ${q(v.suggest)}?` : ""}.`,
  },
  "bind-spin-no-pivot": {
    severity: "warning",
    en: (v, q) => `bind spins ${q(v.group)} but groups.${v.group}.spin is not defined: the spin is ignored.`,
    es: (v, q) => `bind gira ${q(v.group)} pero groups.${v.group}.spin no está definido: el giro se ignora.`,
  },
  "bind-no-effect": {
    severity: "warning",
    en: (v, q) => `This bind of ${q(v.group)} has no move, spin or fade: it does nothing.`,
    es: (v, q) => `Este bind de ${q(v.group)} no tiene move, spin ni fade: no hace nada.`,
  },
  "bind-with-model": {
    severity: "warning",
    en: () => "bind is ignored when the figure has a model: the model has to move the groups.",
    es: () => "bind se ignora cuando la figura tiene modelo: el modelo es quien debe mover los grupos.",
  },
  "preset-unknown-param": {
    severity: "warning",
    en: (v, q) => `The preset sets ${q(v.param)}, which is not a parameter${v.suggest ? `; did you mean ${q(v.suggest)}?` : ""}.`,
    es: (v, q) => `El desvío fija ${q(v.param)}, que no es un parámetro${v.suggest ? `; ¿querías ${q(v.suggest)}?` : ""}.`,
  },
  "preset-value-invalid": {
    severity: "warning",
    en: (v, q) => `The preset sets ${q(v.param)} to ${v.got}, which is not a finite number.`,
    es: (v, q) => `El desvío fija ${q(v.param)} en ${v.got}, que no es un número finito.`,
  },
  "preset-value-out-of-range": {
    severity: "warning",
    en: (v, q) => `The preset sets ${q(v.param)} to ${v.value}, outside its range ${v.min} to ${v.max}: the slider would show ${v.shown}.`,
    es: (v, q) => `El desvío fija ${q(v.param)} en ${v.value}, fuera de su rango ${v.min} a ${v.max}: el deslizante mostraría ${v.shown}.`,
  },
  "preset-value-off-step": {
    severity: "warning",
    en: (v, q) => `The preset sets ${q(v.param)} to ${v.value}, which is not on its step of ${v.step} from ${v.min}: the slider would show ${v.shown}.`,
    es: (v, q) => `El desvío fija ${q(v.param)} en ${v.value}, que no cae en su paso de ${v.step} desde ${v.min}: el deslizante mostraría ${v.shown}.`,
  },
  "preset-press-invalid": {
    severity: "warning",
    en: (v, q) => `The preset presses ${q(v.param)}, which is not an action parameter.`,
    es: (v, q) => `El desvío pulsa ${q(v.param)}, que no es un parámetro de tipo action.`,
  },
  "preset-no-effect": {
    severity: "warning",
    en: () => "The preset changes no value, presses nothing and does not reset: pressing it does nothing.",
    es: () => "El desvío no cambia ningún valor, no pulsa nada ni reinicia: pulsarlo no hace nada.",
  },
  "preset-label-missing": {
    severity: "warning",
    en: () => "The preset has no label: its button would be empty.",
    es: () => "El desvío no tiene label: su botón quedaría vacío.",
  },
  "preset-note-missing": {
    severity: "warning",
    en: () => "The preset has no note: nothing tells the reader (or a screen reader) what to look at.",
    es: () => "El desvío no tiene note: nada le dice al lector (ni al lector de pantalla) qué mirar.",
  },
  "readout-unknown-param": {
    severity: "warning",
    en: (v, q) => `The readout uses {${v.param}}, which is not a parameter: it would show as written.`,
    es: (v, q) => `La lectura usa {${v.param}}, que no es un parámetro: se vería tal cual.`,
  },
  "readout-long": {
    severity: "warning",
    en: (v) => `The readout is ${v.length} characters long (the card fits ${v.max}): on a phone it wraps and the card jumps while the figure runs.`,
    es: (v) => `La lectura mide ${v.length} caracteres (la tarjeta admite ${v.max}): en el celular salta de línea y la tarjeta se mueve mientras la figura corre.`,
  },

  // Auditoría de la escena (piezas, orden de pintado, peso, rótulos)
  "part-floats": {
    severity: "warning",
    en: (v, q) => `${q(v.id)} floats: it touches no part (mark it float if that is intended).`,
    es: (v, q) => `${q(v.id)} flota: no toca ninguna pieza (márcala con float si es a propósito).`,
  },
  "parts-overlap": {
    severity: "warning",
    en: (v, q) => `${q(v.a)} and ${q(v.b)} cut through each other (use mount if one is fitted in the other).`,
    es: (v, q) => `${q(v.a)} y ${q(v.b)} se atraviesan (usa mount si una va encajada en la otra).`,
  },
  "paint-order-ambiguous": {
    severity: "warning",
    en: (v, q) => `Ambiguous paint order near ${q(v.near)}.`,
    es: (v, q) => `Orden de pintado ambiguo cerca de ${q(v.near)}.`,
  },
  "weight-over-budget": {
    severity: "warning",
    en: (v) => `weighs ${v.kb} KB gzip, over the budget of ${v.budget} KB`,
    es: (v) => `pesa ${v.kb} KB gzip, más que el presupuesto de ${v.budget} KB`,
  },
  "label-unreadable": {
    severity: "warning",
    en: (v, q) => `${v.count} of ${v.total} labels stay under ${v.min} px even in the enlarged view; the smallest, ${q(v.text)}, measures ${v.zoomed} px there (${v.mobile} px on a phone). Raise its size to ${v.need} or more.`,
    es: (v, q) => `${v.count} de ${v.total} rótulos quedan bajo ${v.min} px incluso en la vista ampliada; el menor, ${q(v.text)}, mide ${v.zoomed} px ahí (${v.mobile} px en el celular). Sube su size a ${v.need} o más.`,
  },
  "label-small-mobile": {
    severity: "info",
    en: (v, q) => `${v.count} of ${v.total} labels measure under ${v.min} px on a phone (the smallest, ${q(v.text)}, ${v.mobile} px): they are read through the enlarged view.`,
    es: (v, q) => `${v.count} de ${v.total} rótulos miden menos de ${v.min} px en el celular (el menor, ${q(v.text)}, ${v.mobile} px): se leen con la vista ampliada.`,
  },
  "draw-failed": {
    severity: "error",
    en: (v) => `The figure could not be drawn: ${v.reason}.`,
    es: (v) => `No se pudo dibujar la figura: ${v.reason}.`,
  },

  // isofig check
  "model-invalid": {
    severity: "error",
    en: () => "The model must export an object with init() and view().",
    es: () => "El modelo debe exportar un objeto con init() y view().",
  },
  "model-throws": {
    severity: "error",
    en: (v) => `The model threw ${v.reason} (${v.when}).`,
    es: (v) => `El modelo lanzó ${v.reason} (${v.when}).`,
  },
  "model-group-unknown": {
    severity: "warning",
    en: (v) => `The model writes ${v.count} group(s) that no part has: ${v.list}. Nothing would move.`,
    es: (v) => `El modelo escribe ${v.count} grupo(s) que ninguna pieza tiene: ${v.list}. No se movería nada.`,
  },
  "group-never-driven": {
    severity: "warning",
    en: (v) => `${v.count} group(s) of the spec are never written by the model in the ${v.runs} run(s) checked: ${v.list}.${v.hidden ? " Hidden parts would stay invisible." : ""}`,
    es: (v) => `${v.count} grupo(s) de la spec no los escribe nunca el modelo en las ${v.runs} ejecución(es) revisadas: ${v.list}.${v.hidden ? " Las piezas ocultas seguirían invisibles." : ""}`,
  },
  "group-static": {
    severity: "info",
    en: (v) => `${v.count} group(s) are never written by the model: ${v.list}. Fine if they are meant to stay still.`,
    es: (v) => `${v.count} grupo(s) no los escribe nunca el modelo: ${v.list}. Está bien si deben quedarse quietos.`,
  },
  "model-param-unknown": {
    severity: "warning",
    en: (v, q) => `The model reads the parameter ${q(v.param)}, which the spec does not declare: it is always undefined.`,
    es: (v, q) => `El modelo lee el parámetro ${q(v.param)}, que la spec no declara: siempre es undefined.`,
  },
  "param-never-read": {
    severity: "info",
    en: (v, q) => `The model never reads ${q(v.param)} in the runs checked: moving it changes nothing.`,
    es: (v, q) => `El modelo no lee nunca ${q(v.param)} en las ejecuciones revisadas: moverlo no cambia nada.`,
  },
  "preset-same-view": {
    severity: "warning",
    en: (v) => `Pressed ${v.at} s into the run, this preset leaves the same view as not pressing it for the next ${v.seconds} s.`,
    es: (v) => `Pulsado a los ${v.at} s de la ejecución, este desvío deja la misma vista que no pulsarlo durante los ${v.seconds} s siguientes.`,
  },
  "readout-longest": {
    severity: "info",
    en: (v, q) => `The longest readout of the model is ${v.length} characters: ${q(v.text)}.`,
    es: (v, q) => `La lectura más larga del modelo mide ${v.length} caracteres: ${q(v.text)}.`,
  },
  "presets-need-model": {
    severity: "error",
    en: () => "--presets runs the presets through the model: pass it with --model.",
    es: () => "--presets ejecuta los desvíos con el modelo: pásalo con --model.",
  },
  "set-unknown-param": {
    severity: "warning",
    en: (v) => `--set ${v.id}: the spec has no such parameter.`,
    es: (v) => `--set ${v.id}: la spec no tiene ese parámetro.`,
  },
} as const satisfies Record<string, Entry>;

export type IssueCode = keyof typeof CATALOG;

const EXPECTED: Record<string, { en: string; es: string }> = {
  list: { en: "a list", es: "una lista" },
  object: { en: "an object", es: "un objeto" },
  text: { en: "a text", es: "un texto" },
  name: { en: "a non-empty text", es: "un texto no vacío" },
  positive: { en: "a positive number", es: "un número positivo" },
  "non-negative": { en: "a number, 0 or more", es: "un número, 0 o más" },
  "below-half": { en: "a number below half of the smaller side", es: "un número menor que la mitad del lado menor" },
  seconds: { en: "a positive number of seconds", es: "un número positivo de segundos" },
  vector: { en: "a list of numbers", es: "una lista de números" },
};

const QUOTES: Record<"en" | "es", Q> = { en: (s) => `'${s}'`, es: (s) => `«${s}»` };

export const isLang = (lang: string | undefined): lang is "en" | "es" => lang === "en" || lang === "es";

/** Los mensajes existen en `en` y `es`; cualquier otro idioma cae al inglés. */
export const messageLang = (lang: string | undefined): "en" | "es" => (isLang(lang) ? lang : "en");

export function makeIssue(lang: string | undefined, code: IssueCode, path: string, vars: V = {}, severity?: Severity): Issue {
  const entry: Entry = CATALOG[code];
  const l = messageLang(lang);
  return { code, severity: severity ?? entry.severity, path, message: entry[l](vars, QUOTES[l], (k) => EXPECTED[k]?.[l] ?? k) };
}

/** `parts[3].size: «base» vale -4…`: la forma en que `errors` y `warnings` llevan un `Issue`. */
export const formatIssue = (i: Issue): string => (i.path ? `${i.path}: ${i.message}` : i.message);

/** Las gravedades por código, para la tabla de la documentación y para las pruebas. */
export const ISSUE_SEVERITIES: Record<IssueCode, Severity> = Object.fromEntries(
  Object.entries(CATALOG).map(([code, e]) => [code, e.severity]),
) as Record<IssueCode, Severity>;

/** Los prefijos del CLI cambian con el idioma de los mensajes: «aviso:» con `--lang es`, «warning:» con `en`. */
export const PREFIXES: Record<"en" | "es", Record<Severity, string>> = {
  en: { error: "error", warning: "warning", info: "info" },
  es: { error: "error", warning: "aviso", info: "nota" },
};
