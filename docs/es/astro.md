# isofig con Astro

El componente `Figure` genera el SVG al compilar. A la página llegan el HTML de la figura, el CSS del tema y un
runtime de ~1,7 KB gzip que solo trabaja mientras la figura está en pantalla.

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

El componente importa `isofig/theme.css`, así el CSS solo llega a las páginas que tienen una figura. Si la spec
tiene un error (un `on` que apunta a una pieza que no existe, un id repetido), el build falla. Los avisos de la
auditoría (piezas que flotan, piezas que se atraviesan, peso de más) salen en la consola del build.

## 4. Darle vida con un modelo

Sin modelo, los parámetros pueden mover grupos con `bind` (ver [spec.md](spec.md#bind)). Si la figura simula algo
en el tiempo, escribe un modelo y regístralo con el mismo nombre que `spec.model`:

```astro
<script>
  import { register } from "isofig/runtime";
  import balde from "../figuras/balde.model";
  register("balde", balde);
</script>
```

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
- El orden de registro no importa: si la figura monta antes, espera al modelo.
- `ctx.pressed`, `ctx.changed` y `ctx.say` dicen qué tocó el lector y anuncian eventos (ver [spec.md](spec.md)).
- `<Figure>` activa el chip «Ampliar»: `isofig/zoom` se descarga solo si alguien lo pulsa.

## 5. Tema

Todos los colores son variables CSS `--isofig-*`. Para conectarlas a los tokens de tu sitio:

```css
.isofig {
  --isofig-card: var(--surface);
  --isofig-ink: var(--ink);
  --isofig-accent: var(--accent);
}
```

Las reglas del tema van dentro de `:where()`, así que cualquier selector tuyo con una clase les gana. El tema oscuro se activa con `prefers-color-scheme: dark` o con `data-theme="dark"` en `<html>`.
`data-theme="light"` fuerza el claro.

## 6. View transitions

El runtime vuelve a montar las figuras en `astro:page-load`, así funcionan con `<ClientRouter />` sin código extra.

## 7. Revisar antes de publicar

```sh
npx isofig check src/figuras/balde.ts --lang es --strict
npx isofig build src/figuras/balde.ts --format page --model src/figuras/balde.model.ts -o vista.html
```

`check` imprime el peso y los avisos (falla con `--strict` si hay alguno). `page` arma una página suelta para
mirarla en el navegador o capturarla en headless.

## Problemas frecuentes

| Síntoma | Causa |
|---|---|
| La figura no se mueve | El nombre en `register` no coincide con `spec.model`, o el usuario tiene activado el movimiento reducido (arranca en pausa: prueba con el botón). |
| Una pieza se dibuja delante de otra que debería taparla | El orden se calcula en reposo. Evita que una pieza que se mueve cruce detrás de otra; parte la pieza o cambia el recorrido. |
| `No cached compile metadata` al compilar | Instalaste isofig con `file:` y un symlink fuera del proyecto. Usa `npm pack` y la tarball, o publícalo. |
