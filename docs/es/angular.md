# isofig con Angular (19 o superior)

En Angular la figura se compila antes de que la vea el bundler. La CLI de isofig convierte la spec en un
módulo TypeScript con el HTML ya generado; un componente standalone lo muestra y lo anima. El núcleo de isofig no
entra a tu bundle, solo el runtime (~3,5 KB gzip, lo mide `npm run size`).

Probado con Angular 22: standalone, signals, zoneless y `OnPush`.

## 1. Instalar

```sh
npm i isofig
npx isofig add angular src/app/isofig
```

`add angular` copia `isofig-figure.ts` a tu proyecto; es la única forma de instalar el componente. El paquete no
lo exporta como módulo (no existe `isofig/angular`), porque Angular solo compila el TypeScript que es parte de tu
proyecto, no los `.ts` que están dentro de `node_modules`. La copia es tuya: puedes cambiarle el selector o los
estilos. Importa `isofig/runtime`, que sí viene del paquete.

Agrega el tema en `angular.json`, en `architect.build.options.styles`:

```json
"styles": ["isofig/theme.css", "src/styles.css"]
```

`isofig/theme.css` es la única ruta pública del tema. No apuntes a `node_modules/isofig/src/theme/theme.css`: es
una ruta interna y puede cambiar.

## 2. Escribir la spec

Guarda la spec fuera de `src/app` (no hace falta que la compile Angular), por ejemplo en `figures/balde.ts`. El
formato es el mismo que en Astro: ver [spec.md](spec.md) y [`examples/token-bucket`](../../examples/token-bucket).

## 3. Generar el módulo

```sh
npx isofig build figures/balde.ts --format module --lang es -o src/app/figures/balde.figure.ts
```

Conviene dejarlo como script en `package.json` y correrlo antes de `ng build`:

```json
"scripts": {
  "figuras": "isofig build figures/balde.ts --format module --lang es -o src/app/figures/balde.figure.ts",
  "prebuild": "npm run figuras"
}
```

Si Node avisa `MODULE_TYPELESS_PACKAGE_JSON`, renombra la spec a `.mts` o agrega `"type": "module"` a tu
`package.json`. El aviso no afecta el resultado.

## 4. Usar el componente

```ts
import { Component } from "@angular/core";
import { IsofigFigure } from "./isofig/isofig-figure";
import { figure } from "./figures/balde.figure";
import balde from "./figures/balde.model";

@Component({
  selector: "app-limites",
  imports: [IsofigFigure],
  template: `<isofig-figure [figure]="figure" [model]="model" />`,
})
export class Limites {
  protected readonly figure = figure;
  protected readonly model = balde;
}
```

| Input | Para qué |
|---|---|
| `figure` (requerido) | El objeto que exporta el módulo generado. |
| `model` | El modelo que anima la figura. Sin él, se usan los `bind` de la spec. |

El componente monta el runtime con `afterRenderEffect` (solo en el navegador, compatible con SSR), lo vuelve a
montar si cambian los inputs y lo detiene en `DestroyRef`.

## 5. El modelo

Igual que en Astro. Tipa los parámetros para que el modo estricto de Angular (`noPropertyAccessFromIndexSignature`)
no se queje:

```ts
import type { GroupView, Model } from "isofig/runtime";

const model: Model<State, { refill: number; rate: number }> = {
  init: () => ({ tokens: 8 }),
  step(s, dt, p) {
    s.tokens = Math.min(8, s.tokens + p.refill * dt);
  },
  view(s) {
    const groups: Record<string, GroupView> = {};
    groups["coin-0"] = { o: s.tokens >= 1 ? 1 : 0 };
    return { groups };
  },
};
```

## 6. Seguridad

El componente marca el HTML como confiable (`bypassSecurityTrustHtml`) porque sale del build de isofig a partir de
una spec de tu repositorio. **No le pases HTML que venga del usuario ni de una API.** Los textos de la spec se
escapan al generar el módulo.

## 7. Tema

Igual que en Astro (el tema es `isofig/theme.css`): sobrescribe las variables `--isofig-*` en tu `styles.css`. El oscuro sigue a
`prefers-color-scheme` o a `data-theme="dark"` en `<html>`.

## Problemas frecuentes

| Síntoma | Causa |
|---|---|
| `TS2322 … readonly … not assignable` | Generaste el módulo con una versión vieja de la CLI. Vuelve a generarlo. |
| `TS4111 Property 'x' comes from an index signature` en el modelo | Declara los parámetros: `Model<State, { x: number }>`. |
| La figura se ve sin colores | Falta `isofig/theme.css` en `styles` de `angular.json`. |
| No anima | Revisa el input `model` y el movimiento reducido del sistema (arranca en pausa). |
