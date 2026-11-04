# isofig con Astro

El componente `Figure` genera el SVG al compilar. A la página llegan el HTML de la figura, el CSS del tema (una vez, en
línea) y un arranque de ~2 KB gzip. El runtime (~3 KB gzip), el modelo, el giro y la ampliación se descargan después,
cuando el lector se acerca a la figura o la usa, y el runtime solo trabaja mientras la figura está en pantalla.

## 1. Instalar

```sh
npm i isofig
```

Requiere Node 22.18 o superior (para cargar specs escritas en TypeScript) y Astro 5 o superior.

## 2. Escribir la spec

Una spec es un objeto con piezas, grupos que se mueven y parámetros. Guárdala junto a tus componentes, por
ejemplo en `src/figuras/balde.ts`:

```ts
import type { FigureSpec } from "isofig";

const spec: FigureSpec = {
  id: "balde",
  title: { es: "Balde de fichas", en: "Token bucket" },
  hint: { es: "Mueve los controles", en: "Drag the sliders" },
  model: "balde",
  params: [{ id: "refill", label: { es: "Recarga", en: "Refill" }, min: 0.5, max: 6, step: 0.5, value: 2 }],
  parts: [
    { id: "base", kind: "box", at: [0, 0, 0], size: [130, 260, 8], radius: 7, bevel: 1.4, tone: "lo", shadow: true },
    // …
  ],
};

export default spec;
```

La referencia completa está en [spec.md](spec.md). Un ejemplo entero, con 40 piezas y su modelo, está en
[`examples/token-bucket`](../../examples/token-bucket).

## 3. Usar el componente

```astro
---
import Figure from "isofig/astro";
import balde from "../figuras/balde";
---

<Figure spec={balde} lang="es" n={1} />
```

| Prop | Para qué |
|---|---|
| `spec` | La `FigureSpec`. |
| `lang` | Idioma de los textos (`"es"`, `"en"`…). Si falta una traducción, cae al inglés. |
| `n` | Número que se muestra como «Fig. n». |
| `class` | Clase extra para el contenedor. |
| `instance` | Nombre de esta copia en el DOM. Por defecto sale solo ([sección 6](#6-la-misma-figura-varias-veces)). |
| `orbit` | Añade los controles y el arrastre para girar la figura ([sección 7](#7-girar-y-ampliar-la-figura)). |
| `load` | Cuándo se descarga el runtime: `"visible"` (por defecto), `"idle"` o `"eager"` ([sección 5](#5-cuándo-se-descarga-cada-cosa)). |
| `overrides` | `{ values, presets, hide, title, caption }`: cambia valores iniciales, desvíos, controles y textos sin tocar la spec ([sección 8](#8-cambiar-una-figura-sin-tocar-su-spec)). |
| `zoom` | `false` quita el chip «Ampliar» ([sección 7](#7-girar-y-ampliar-la-figura)). |
| `theme` | `false` si tu sitio ya carga `isofig/theme.css` ([sección 9](#9-tema)). |

Cualquier otro atributo (`id`, `data-*`, `transition:persist`…) pasa al contenedor. Si la spec tiene un error (un
`on` que apunta a una pieza que no existe, un id repetido), o un `overrides` no encaja, el build falla. Los avisos de
la auditoría (piezas que flotan, piezas que se atraviesan, peso de más) salen en la consola del build.

## 4. Darle vida con un modelo

Sin modelo, los parámetros pueden mover grupos con `bind` (ver [spec.md](spec.md#bind)). Si la figura simula algo
en el tiempo, escribe un modelo y regístralo con el mismo nombre que `spec.model`.

El registro va en un `<script>` del componente que usa la figura, con `models()` y un `import()` por modelo. Así Astro
parte cada modelo en su propio archivo y el navegador solo lo pide cuando la figura se acerca:

```astro
---
// src/componentes/Balde.astro: una figura = un componente
import Figure from "isofig/astro";
import balde from "../figuras/balde";
---

<Figure spec={balde} lang="es" {...Astro.props} />

<script>
  import { models } from "isofig/astro/client";
  models({ balde: () => import("../figuras/balde.model.ts") });
</script>
```

> **Por qué no es una prop.** Un `model={() => import("./modelo.ts")}` en `<Figure>` se ejecutaría en el servidor:
> Astro no serializa funciones y el `import()` queda en el paquete del servidor, no en el del navegador. El `<script>`
> es lo único que Astro empaqueta para el cliente, por eso el registro va allí.

```ts
// src/figuras/balde.model.ts
import type { Model } from "isofig/runtime";

interface State { tokens: number }

const model: Model<State, { refill: number }> = {
  init: () => ({ tokens: 8 }),
  step(s, dt, p) {
    s.tokens = Math.min(8, s.tokens + p.refill * dt);
  },
  view(s) {
    return {
      groups: { "coin-0": { o: s.tokens >= 1 ? 1 : 0 } },
      readout: `${Math.floor(s.tokens)}/8`,
    };
  },
};

export default model;
```

- `init` crea el estado. `step` lo avanza `dt` segundos y solo corre cuando la figura está en reproducción.
- `view` dice qué muestra cada grupo: `t` (desplazamiento en el mundo), `r` (giro en grados, si el grupo tiene
  `spin`) y `o` (opacidad). Los valores se interpolan solos; usa `snap: true` cuando el modelo ya da un movimiento
  continuo.
- `ctx.pressed`, `ctx.changed` y `ctx.say` dicen qué tocó el lector y anuncian eventos (ver [spec.md](spec.md)).
- `models()` acepta cargadores que devuelven el módulo (con `export default`) o el modelo mismo.
- El orden de registro no importa. Si prefieres cargar el modelo de entrada, `register("balde", model)` de
  `isofig/runtime` en un `<script>` sigue funcionando: la figura espera al modelo.
- Si nadie registra el modelo, la figura se queda quieta y la consola avisa a los 3 segundos.

## 5. Cuándo se descarga cada cosa

El HTML ya trae la figura dibujada, con sus controles ocultos (`hidden`): hasta que se monta no hay nada que se pueda
perder ni mover. Lo demás se descarga con `import()`:

| Qué | Cuándo | Peso (gzip) |
|---|---|---|
| Arranque de `<Figure>` | Con la página; solo si tiene una figura | ~2 KB |
| Runtime y modelo | Según `load` | ~3 KB + el modelo |
| Giro (`isofig/orbit`) | Al pasar el puntero, enfocar o tocar la figura | ~6,8 KB |
| Ampliación (`isofig/zoom`) | Al pulsar «Ampliar» | ~0,8 KB |

- `load="visible"` (por defecto): al acercarse a 600 px de la pantalla, o al pasar el puntero, enfocar o tocar la figura.
- `load="idle"`: cuando el navegador está libre (como máximo 2 s después). Para figuras que se ven al abrir la página.
- `load="eager"`: de inmediato.

## 6. La misma figura varias veces

Los ids del SVG (`-t`, `-d`, las piezas repetidas de `<defs>`) y el `name` de los radios salen de la spec. Si la misma
figura aparece dos veces en una página, `<Figure>` da a cada copia su propio nombre: la primera conserva el id de la
spec (su marcado no cambia) y las demás salen `balde-2`, `balde-3`…

```astro
<Figure spec={balde} />                        <!-- ids: balde-t, balde-p0… -->
<Figure spec={balde} />                        <!-- ids: balde-2-t, balde-2-p0… -->
<Figure spec={balde} instance="balde-prueba" /> <!-- el nombre que tú elijas -->
```

Un `instance` explícito que ya usa otra copia de la página es un error de build. Fuera de Astro, `renderFigure(spec, {
instance })` hace lo mismo: solo cambia los `id` y los `name`; `data-isofig` y el JSON del runtime siguen siendo los de
la spec.

## 7. Girar y ampliar la figura

`orbit` añade los botones de giro y el arrastre. El giro vuelve a dibujar la escena en el navegador, así que la spec
viaja en la página (como un `<script type="application/json">`): cuesta ~1,6 KB gzip por figura con giro en el token
bucket de ejemplo (40 piezas). El código del giro se descarga solo cuando el lector lo usa.

El chip «Ampliar» sale en toda figura montada y abre el dibujo en un diálogo a pantalla grande, con los rótulos legibles
en el celular. `<Figure>` activa `isofig/zoom` por ti (se descarga solo si alguien lo pulsa); `zoom={false}` quita el
chip. El diálogo no añade ids: usa el `aria-label` y el mismo SVG, que no cambia de copia.

## 8. Cambiar una figura sin tocar su spec

Un sitio puede querer otros valores iniciales, otros desvíos o ocultar un control sin editar la spec compartida:

```astro
<Figure
  spec={balde}
  overrides={{
    values: { refill: 4 },
    presets: [{ label: "Sin recarga", values: { refill: 0.5 }, note: "Mira cómo se vacía el tubo." }],
    hide: ["rate"],
    title: "Balde de este capítulo",
  }}
/>
```

| Campo | Efecto |
|---|---|
| `values` | Valor inicial de cada parámetro, por id. |
| `presets` | **Sustituye** los desvíos de la spec. |
| `hide` | Ids de parámetros cuyo control no se muestra (el modelo los sigue recibiendo). |
| `title`, `caption` | Textos (cadena o `{ es, en }`). |

`applyOverrides(spec, overrides, { lang })` hace lo mismo y se puede usar solo (es pura y no toca la spec original).
Lo que cambia se revisa con `validateSpec`: mismos códigos y mismos mensajes (`en` o `es`, ver [validar.md](validar.md)).
Si algo no encaja lanza un `OverridesError` con todos los problemas en `error.issues` (código, gravedad y `path`): un
valor fuera de `min`–`max` o del `step`, un 2 en un interruptor, un índice fuera de un selector, un desvío sin `label`
o `note`, o que fija un parámetro que no existe o pulsa algo que no es una acción. Los dos casos que `validateSpec` no
puede ver (un id que no es un parámetro, y un valor inicial para una acción) tienen sus propios códigos:
`override-unknown-param` y `override-action-value`. Un problema que ya traía la spec, y que el cambio no toca, no lo
lanza.

```ts
import { applyOverrides } from "isofig";

applyOverrides(balde, { values: { refill: 7 } }, { lang: "es" });
// OverridesError: applyOverrides «token-bucket»:
//   - values.refill: «refill» arranca en 7, fuera de su rango 0.5 a 6: el deslizante mostraría 6.
```

`<Figure>` le pasa su `lang`, así que el error del build sale en el idioma de la figura.

## 9. Tema

Todos los colores son variables CSS `--isofig-*`. Para conectarlas a los tokens de tu sitio:

```css
.isofig {
  --isofig-card: var(--surface);
  --isofig-ink: var(--ink);
  --isofig-accent: var(--accent);
  --isofig-on-accent: var(--accent-contrast); /* tinta del texto grabado sobre el acento */
}
```

Los tokens del tema van dentro de `:where()` (especificidad 0), también los del tema oscuro: un `.isofig { … }` tuyo gana
siempre, se cargue antes o después de `theme.css`, y no hace falta tocar `--fx` ni subir a dos clases. Esa regla vale en
claro y en oscuro; para un valor distinto en cada tema usa `light-dark()`. El tema oscuro se activa con
`prefers-color-scheme: dark` o con `data-theme="dark"` en `<html>`; `data-theme="light"` fuerza el claro.

La tarjeta responde a su propio ancho (container query) y reserva altura para la lectura, así que no salta mientras la
figura corre. Qué controla cada variable, la tinta sobre el acento y los estados, y `--isofig-readout-lines`: [tema.md](tema.md).

**Dónde va el CSS del tema.** `<Figure>` lo incrusta en una etiqueta `<style>` al principio de la primera figura de cada
página (unos 2,8 KB gzip por página). Se probaron las tres formas en un proyecto Astro 7 con `<ClientRouter />` (Chromium y WebKit, con la hoja retrasada 500 ms):

| Forma | Páginas sin figura | Tras navegar con `ClientRouter` |
|---|---|---|
| `import "isofig/theme.css"` en el componente | Lo reciben las que *importan* el componente aunque no lo dibujen (un envoltorio, un mapa de componentes de MDX) | Sin parpadeo (el router lo precarga) |
| `<link>` a `theme.css?url` en el cuerpo | No lo reciben | La figura se ve **sin estilo** hasta que llega la hoja |
| `<style>` en línea, una vez por página (la de `<Figure>`) | No lo reciben | Sin parpadeo |

Si tu sitio ya carga el tema en su layout (por ejemplo para cachearlo entre páginas), pasa `theme={false}` y
`import "isofig/theme.css"` donde quieras.

## 10. View transitions

`<Figure>` funciona con `<ClientRouter />` sin código extra. Busca figuras nuevas en cada `astro:page-load` y, antes de
cada cambio de página (`astro:before-swap`), detiene solo las que Astro va a quitar.

Con `transition:persist` la figura sigue viva al navegar: el nodo del DOM, su animación y su estado son los mismos.

```astro
<Figure spec={balde} load="eager" transition:persist="balde" />
```

Pon el mismo nombre en las dos páginas. También sirve envolverla: `<div transition:persist="balde"><Figure … /></div>`.

## 11. Revisar antes de publicar

```sh
npx isofig check src/figuras/balde.ts --lang es --strict
npx isofig build src/figuras/balde.ts --format page --model src/figuras/balde.model.ts -o vista.html
```

`check` imprime el peso y los avisos (falla con `--strict` si hay alguno). `page` arma una página suelta para
mirarla en el navegador o capturarla en headless.

Para medir el peso desde tu propio código de build, usa `isofig/node`. Es la única entrada que necesita Node
(`node:zlib`); `isofig` e `isofig/runtime` corren también en el navegador.

```ts
import { renderFigure } from "isofig";
import { checkBudget, measure } from "isofig/node";

const figure = renderFigure(spec);
const size = measure(figure.html); // { bytes, gzip }
for (const warning of checkBudget(spec, size)) console.warn(warning); // más que `spec.budget` (40 KB por defecto)
```

## Problemas frecuentes

| Síntoma | Causa |
|---|---|
| La figura no se mueve | El nombre en `models()` o en `register` no coincide con `spec.model`, o el usuario tiene activado el movimiento reducido (arranca en pausa: prueba con el botón). Si nadie registró el modelo, la consola lo avisa. |
| Dos copias de la figura comparten controles o ids | Usaste `renderFigure` a mano con la misma spec: pasa `instance` distinto a cada copia (`<Figure>` lo hace solo). |
| El CSS del tema llega a páginas sin figuras | Importaste `isofig/theme.css` en un layout, o pasaste `theme={false}`. Quita el import o deja `theme` por defecto. |
| Una pieza se dibuja delante de otra que debería taparla | El orden se calcula en reposo. Evita que una pieza que se mueve cruce detrás de otra; parte la pieza o cambia el recorrido. |
| `No cached compile metadata` al compilar | Instalaste isofig con `file:` y un symlink fuera del proyecto. Usa `npm pack` y la tarball, o publícalo. |
