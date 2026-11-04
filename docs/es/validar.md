# Validar la spec, revisar la figura

Una spec es un dato, y un dato escrito a mano (o por un agente) falla de maneras que los tipos no ven: un `bind` a un
parámetro que no existe, un deslizante que arranca en un valor que no puede mostrar, un rótulo demasiado chico para
leerse. isofig lo revisa en tres niveles:

| Nivel | Qué corre | Dónde |
|---|---|---|
| `validateSpec(spec)` | La spec como dato: campos, números, referencias entre piezas, controles, desvíos | Node y navegador, sin dependencias |
| `renderFigure(spec)` | `validateSpec` + la auditoría del dibujo (apoyo, choques, orden de pintado, peso, rótulos) | al compilar |
| `isofig check <spec> --model <modelo> --presets` | Todo lo anterior, y además **ejecuta la figura**: el modelo unos segundos simulados y luego cada desvío | Node |

## `validateSpec`

```ts
import { validateSpec } from "isofig";

const issues = validateSpec(spec, { lang: "es" }); // o "en"
// [{ code: "bind-unknown-param", severity: "warning", path: "bind[0].param",
//    message: "bind usa el parámetro «nada», que no existe." }]
```

- `code` es estable: filtra y compara por él. `path` apunta al campo (`parts[3].size`, `params[0].value`,
  `presets[1].values.rate`); va vacío si afecta a toda la figura. `message` sale en inglés por defecto y en español con
  `lang: "es"`; cualquier otro idioma cae al inglés.
- Acepta `unknown`, así que lee un JSON tal cual, y nunca lanza.
- Una spec con un árbol `root` o un `map` se acepta sin mirar aquí sus piezas: se aplanan al compilar.

### Gravedad en 0.9

Solo es `error` lo que ya rompe el dibujo: un `NaN` en una coordenada, una medida negativa, un `kind` desconocido, un
campo que falta, ids de pieza repetidos, un detalle sobre una pieza que no existe, un contenedor con el tipo
equivocado. Todo lo demás es `warning`. **En 1.0 se endurecerá**: los avisos que dejan un control o una figura rotos
(abajo) pasarán a error.

`renderFigure` llama a `validateSpec`: los errores van a `errors`, los avisos a `warnings` (los dos como texto
`path: mensaje`), y `issues` trae todo con su código, su `path` y su gravedad, incluidas las notas `info`. Una spec rota
no lanza: devuelve sus errores.

### Códigos

**Errores**

| Código | Qué |
|---|---|
| `spec-not-object`, `type-invalid` | La spec, o un campo que debe ser lista u objeto, no lo es |
| `id-invalid`, `instance-invalid` | El `id` de la figura, o el `instance` que se pasa a `renderFigure`, no es letras, números y guiones |
| `parts-missing` | Sin `parts`, sin `root`, sin `map` |
| `part-id-missing`, `kind-missing`, `kind-unknown` | Una pieza sin id o sin kind, o con un kind que no existe (el mensaje lista los kinds) |
| `field-missing` | A una pieza le falta un campo sin el que no se dibuja (`size` de una caja, `on` de un detalle…) |
| `number-invalid`, `vector-length-invalid` | Una coordenada o medida que no es un número finito (`NaN`, `"4"`, `Infinity`), o un vector del largo equivocado |
| `size-negative` | Un `size`, `r` o `h` negativo |
| `prism-plan-short` | Una planta de prisma con menos de 3 puntos |
| `id-duplicate` | Dos piezas sólidas con el mismo id después del `repeat` |
| `on-unknown`, `on-not-solid` | Un detalle sobre una pieza que no existe, o que es otro detalle |
| `dimension-invalid`, `camera-invalid`, `spin-plane-invalid` | `width`, `height`, `pad`, los ángulos de la cámara o el plano de un giro que no sirven |
| `draw-failed`, `model-invalid`, `model-throws`, `presets-need-model` | Falló el dibujo o el modelo; `--presets` sin `--model` |

**Avisos** (los marcados ↑ pasan a error en 1.0)

| Área | Códigos |
|---|---|
| Spec | `unknown-key` (con las claves conocidas y un «¿errata de…?»), `parts-empty`, `title-missing`, `model-name-invalid`, `autoplay-without-model`, `motion-invalid`, `budget-invalid`, `option-invalid` |
| Piezas | `mount-unknown` ↑, `size-zero`, `number-negative`, `count-invalid` ↑, `repeat-from-invalid` ↑, `prism-clockwise` ↑, `prism-concave` ↑, `prism-degenerate`, `group-ignored`, `label-text-missing`, `label-size-invalid`, `group-unused` ↑ |
| Controles | `param-id-missing` ↑, `param-id-duplicate` ↑, `param-number-invalid` ↑, `param-range-invalid` ↑, `param-step-invalid`, `param-value-out-of-range` ↑, `param-value-off-step` ↑, `param-label-missing`, `choice-options-missing` ↑, `choice-value-invalid` ↑, `toggle-value-invalid` |
| `bind` | `bind-unknown-param` ↑, `bind-unknown-group` ↑, `bind-spin-no-pivot` ↑, `bind-no-effect`, `bind-with-model` |
| Desvíos y lectura | `preset-unknown-param` ↑, `preset-value-invalid` ↑, `preset-value-out-of-range` ↑, `preset-value-off-step` ↑, `preset-press-invalid` ↑, `preset-no-effect`, `preset-label-missing`, `preset-note-missing`, `readout-unknown-param`, `readout-long` |
| Auditoría | `part-floats`, `parts-overlap`, `paint-order-ambiguous`, `label-unreadable`, y `weight-over-budget`, que necesita Node: lo dan `isofig check` y `budgetIssues(spec, measure(html), lang)` de `isofig/node` |
| Color ([color.md](color.md)) | `paint-unknown` ↑, `paint-is-state`, `palette-base-invalid`, `palette-use-invalid`, y sobre el dibujo `palette-roles-unmet`, `palette-too-many-colors`, `paint-indistinct`, `paint-text-contrast` |
| `check` | `model-group-unknown` ↑, `group-never-driven`, `model-param-unknown` ↑, `preset-same-view`, `set-unknown-param` |

**Notas** (`info`, nunca hacen fallar `--strict`): `alt-missing`, `label-small-mobile`, `group-static`, `param-never-read`,
`readout-longest`.

Dos detalles que conviene saber:

- **Valor y paso.** El navegador ajusta un deslizante a su paso contado desde `min` y lo recorta al rango. Un valor
  inicial que no cae ahí hace que el deslizante muestre un número y el modelo use otro (`param-value-off-step`,
  `param-value-out-of-range`). Sin `step` el paso es 1: un deslizante de `0.5` a `6` sin `step` no puede quedar en
  `2.5`. Lo mismo vale para los valores de un desvío.
- **Claves desconocidas** son avisos, no errores: pueden ser una errata o un campo de una versión más nueva. La lista de
  claves conocidas incluye los campos de 0.9 (`paint`, `palette`, `root`, `defs`, `tracks`, `map`, `repeat.from`,
  `presets[].press`, `motion.settle`).

### `repeat.from`

`repeat: { count, step, from }`: `from` es el primer valor de `{i}` (0 por defecto). La copia número `k` se desplaza
`step × k` y se llama `from + k`. Es lo que deja que dos filas se repartan los números de un mismo grupo: una segunda
fila de 14 con `from: 14` responde a `fila-14…27` y queda justo encima de la primera. Antes las dos respondían a
`fila-0…13` y el modelo no alcanzaba el resto.

## Rótulos legibles

El tamaño de un rótulo en pantalla es `size × escala de la cámara × (ancho en pantalla / ancho del viewBox)`, por el
acortamiento de su cara (un rótulo tumbado en el piso se ve más bajo que uno de pie: cerca de 0,79 y 0,87 con la cámara
por defecto). Coincide con lo que mide un navegador: en las 114 figuras de la academia con rótulos difiere en 0,005 px.

La auditoría mide a dos anchos: un celular de 390 px (la figura mide entonces 326 px) y la vista ampliada que abre el
chip «Ampliar» (unos 1150 px).

- **Aviso** (`label-unreadable`): un rótulo bajo **9 px incluso ampliado**. Un aviso por figura, con el rótulo menor y el
  `size` que llegaría a 9 px.
- **Nota** (`label-small-mobile`): un rótulo bajo 9 px en el celular pero legible ampliado. Un resumen por figura.

Por qué 9 y no 11. Medido en las 114 figuras de la academia con rótulos (807 rótulos), a 390 px la mediana es 3,3 px y
**las 114 figuras** tienen algún rótulo bajo 9 px: eso solo puede ser una nota. Ampliada, la mediana pasa a 11,7 px y el
10 % menor queda bajo 8,2 px. Con 9 px avisan 34 figuras (149 rótulos); con 11 px avisarían 65 (341 rótulos), demasiadas
para que un aviso frene una rama que ya las tiene. Las constantes son `LABEL_MIN_PX` y `LABEL_WIDTHS` (exportadas);
`auditLabels(items, cam, width, lang, { min, widths })` acepta otros valores. Para exigir 11 px en un proyecto nuevo,
pasa `{ min: { zoomed: 11 } }`.

## `isofig check`

```sh
isofig check figura.ts --lang es --strict
isofig check figura.ts --model modelo.ts --presets [--seconds 12]
```

- Sin `--model`: `validateSpec` y la auditoría, más el peso. `--strict` también falla con avisos (nunca con `info`).
- `--lang en|es` fija el idioma de los mensajes **y de sus prefijos**: `error:` / `warning:` / `info:` en inglés,
  `error:` / `aviso:` / `nota:` en español. Cada línea termina con su `[código]`.
- Con `--model`, ejecuta el modelo en Node, como lo haría el runtime, durante `--seconds` segundos simulados (12 por
  defecto) con los valores iniciales. Con `--presets` ejecuta además cada desvío: el modelo corre la mitad de `--seconds`,
  se pulsa el desvío como lo hace el runtime (sus `values`, luego `reset` si lo pide, luego cada `press` una vez) y la
  figura corre `--seconds` más. El modelo recibe un `ctx` completo: `ctx.pressed(id)` y `ctx.changed(id)` valen durante
  el paso siguiente al desvío (y cuentan como lecturas de ese parámetro), y `ctx.say` se acepta y se ignora.

Lo que reporta con `--model`:

| Código | Cuándo |
|---|---|
| `model-group-unknown` | El modelo escribe grupos que ninguna pieza tiene (no se movería nada) |
| `group-never-driven` | Un grupo con piezas ocultas, o con `extent` o `spin`, que el modelo no escribe nunca: la pieza quedaría quieta o invisible |
| `group-static` | (nota) Cualquier otro grupo que el modelo no escribe |
| `preset-same-view` | Tras pulsar el desvío, la vista es la misma que no pulsarlo durante los `--seconds` siguientes. Puede ser a propósito si el desvío restituye el estado inicial, pero conviene mirarlo |
| `model-param-unknown` | El modelo lee un parámetro que la spec no declara |
| `param-never-read` | (nota) Un control que el modelo no lee nunca |
| `readout-longest` / `readout-long` | La lectura más larga del modelo; aviso si pasa de 70 caracteres (lo que cabe en la tarjeta de un celular) |
| `model-throws` | `init`, `step` o `view` lanzaron una excepción |

Los valores de desvíos fuera de rango o de paso los reporta `validateSpec`, que `check` corre siempre.

El mismo chequeo está disponible desde código: `checkModel(spec, model, { lang, seconds, presets })` devuelve `Issue[]`.

## Cambios para 1.0

- Los avisos marcados ↑ pasan a error.
