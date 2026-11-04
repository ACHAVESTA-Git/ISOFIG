# Referencia de la spec

Una `FigureSpec` es un objeto plano: se puede escribir en TypeScript (con autocompletado) o en JSON.

## Mundo y cámara

- Unidades del mundo: más o menos 1 px del objeto real. `x` e `y` en el piso, `z` hacia arriba.
- Con el azimut por defecto (45°), `x` crece hacia abajo a la izquierda de la pantalla e `y` hacia abajo a la
  derecha. Lo que tiene `x` o `y` mayor está más cerca del lector.
- `camera: { azimuth, elevation }`: 35–60° muestra el lado largo; la elevación por defecto es 30°.
- La figura se ajusta sola al `viewBox` (`width` × `height`, por defecto 640 × 400) con un margen `pad`.

## Campos de la figura

| Campo | Tipo | Para qué |
|---|---|---|
| `id` | `string` | Único en la página. |
| `title`, `hint`, `caption`, `alt` | `Text` | Título (arriba a la derecha), pista (abajo a la izquierda), pie bajo la tarjeta, descripción para lectores de pantalla (por defecto el pie). |
| `parts` | `Part[]` | Las piezas. |
| `groups` | `Record<string, GroupSpec>` | Qué se mueve y cuánto, para que quepa en cualquier pose. |
| `params` | `ParamSpec[]` | Controles deslizantes. |
| `bind` | `BindSpec[]` | Enlaces parámetro → grupo sin escribir modelo. |
| `readout` | `Text` | Plantilla de la lectura, con `{param}`. El modelo puede reemplazarla. |
| `model` | `string` | Nombre con el que se registra el modelo en el runtime. |
| `autoplay` | `boolean` | Por defecto, `true` si hay modelo. Con movimiento reducido siempre arranca en pausa. |
| `motion.tau` | `number` | Constante de tiempo de la interpolación (s), por defecto 0,18. |
| `budget` | `number` | KB gzip que no debe pasar (por defecto 40). |

`Text` es `"texto"` o `{ es: "…", en: "…" }`.

## Piezas sólidas

Todas aceptan: `id`, `tone` (`lo` base, `mid` estructura, `hi` sujeto, `lit` el único acento), `group`, `hidden`,
`repeat`, `float`, `mount` y `shadow`.

| `kind` | Campos | Notas |
|---|---|---|
| `box` | `at` (esquina mínima), `size: [w, d, h]`, `radius`, `bevel` | Rectángulo redondeado en planta, extruido hacia arriba. |
| `cylinder` | `at` (centro de la cara inicial), `r`, `h`, `axis` (`x`/`y`/`z`), `bevel` | Ruedas, perillas, fichas, postes. |
| `prism` | `plan: [x, y][]` (convexa, antihoraria), `z`, `h`, `bevel` | Cualquier planta convexa. Las cóncavas se arman con varias piezas. |

- `bevel` corta el canto de la tapa: entre 0,4 y 1,6 se ve como una pieza fabricada.
- `repeat: { count, step }` crea copias desplazadas. `{i}` en `id` o `group` se reemplaza por el índice; si `id`
  no lo lleva, se agrega `-i`.
- `hidden: true` empieza invisible (para un depósito de piezas que el modelo muestra).
- `mount: ["otra"]` dice que la pieza va encajada en otra a propósito, y la auditoría no lo cuenta como choque.
- `float: true` dice que la pieza cuelga o vuela a propósito.

## Detalles

Se dibujan sobre una pieza sólida (`on`) y comparten su lugar en el orden de pintado. Deben ir en una cara que se
vea (la tapa siempre se ve).

| `kind` | Campos |
|---|---|
| `ticks` | `from`, `along` (paso entre marcas), `count`, `toward` (dirección de la marca), `every` (cada cuántas una mayor), `size: [menor, mayor]` |
| `dots` | `points` — tornillos, remaches, luces |
| `line` | `points`, `bold` — costuras, ranuras, líneas de una placa |
| `label` | `at`, `text`, `size`, `align` (`start`, `middle`, `end`), `face` (`top`, `x` o `y`) — un nombre grabado en una cara, para distinguir piezas iguales (servicios, nodos) |

## Grupos

```ts
groups: {
  carro: { extent: [[0, 120, 0]] },
  aguja: { spin: { center: [40, 40, 20], plane: "xz" } },
}
```

- `extent`: desplazamientos extremos en el mundo. El ajuste de cámara los tiene en cuenta.
- `spin`: el grupo gira dentro de un plano (`xy`, `xz`, `yz`) alrededor de `center`. Sirve para piezas planas:
  agujas, discos vistos de frente, compuertas.

## Parámetros

```ts
params: [{ id: "rate", label: { es: "Tráfico", en: "Traffic" }, min: 0.5, max: 8, step: 0.5, value: 3, unit: "req/s" }]
```

Cada parámetro es un `input[type=range]` nativo: teclado, lector de pantalla y `aria-valuetext` con la unidad.

## Controles discretos y desvíos

```ts
params: [
  { id: "breaker", label: "Breaker", kind: "toggle", min: 0, max: 1, value: 1 },
  { id: "algo", label: "Algoritmo", kind: "choice", options: ["round robin", "menos conexiones"], min: 0, max: 1, value: 0 },
],
presets: [
  { label: "Dependencia lenta", values: { latencia: 3000 }, note: "Mira cómo se llena solo su compartimento.", reset: true },
],
```

- `toggle` vale 0 o 1; `choice` vale el índice de la opción elegida; `action` es un botón que suma 1 al pulsarlo (el modelo compara el contador para saber que pasó algo, p. ej. «borrar un pod»).
- `presets` son botones «Prueba a romperlo»: fijan parámetros, muestran `note` y la anuncian a los lectores de pantalla.
- El modelo puede teñir un grupo con `s: "ok" | "warn" | "fail"` y anunciar un evento con `say`.

## bind

Para figuras que solo responden a los controles:

```ts
bind: [
  { group: "carro", param: "carga", move: [0, 1.2, 0] },
  { group: "aguja", param: "carga", spin: 3 },
  { group: "luz", param: "encendida", fade: true },
]
```

`move` se multiplica por el valor del parámetro; `spin` da grados por unidad; `fade` usa el valor (0–1) como
opacidad.

## Auditoría

`renderFigure` e `isofig check` revisan (el peso, solo `isofig check` e `isofig/node`):

- **Orden de pintado:** pares que se solapan en pantalla sin un eje que los separe en el mundo.
- **Apoyo:** toda pieza visible toca otra o el piso, salvo `float`.
- **Choques:** dos piezas que se hunden más de 0,8 unidades una en otra, salvo `mount`.
- **Peso:** gzip por encima de `budget`. `renderFigure` no lo mide (el gzip necesita Node): lo hacen `isofig check` y `checkBudget(spec, measure(html))` de `isofig/node`.

La auditoría trabaja sobre cajas: es rápida y gruesa. Revisa siempre la figura a 4× en los dos temas.

## Girar la figura (órbita)

`renderFigure(spec, { orbit: true })` añade botones para girar y la pista «arrastra para girar». En la página, el
giro se carga solo cuando hace falta:

```ts
import { orbitOnDemand } from "isofig/runtime";

orbitOnDemand(el, async () => {
  const { enableOrbit } = await import("isofig/orbit");
  return enableOrbit(el, spec, { lang: "es", range: 40 });
});
```

Al pasar el puntero o enfocar la figura se precarga; al presionar el dibujo o un botón se activa. El módulo pesa
~6 KB gzip más la spec, y solo lo descarga quien gira la figura.

## Importar y previsualizar

- `isofig import compose <archivo.json|->` arma una spec desde `docker compose config --format json` (ver
  [importar.md](importar.md)). Es un punto de partida: enriquécela a mano.
- `isofig build <spec> --format page --model <modelo> --advance 3` arma una página suelta que empaqueta el modelo
  y los archivos locales que importa, y arranca con 3 s ya simulados para poder capturarla en Chrome headless.
- Si un aviso dice «orden de pintado ambiguo cerca de A ↔ B, C», esas son las piezas que forman el ciclo: separa
  sus cajas en algún eje o parte la pieza larga.
