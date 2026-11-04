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
| `motion.settle` | `number` | Con movimiento reducido, segundos que se simulan de golpe al montar y tras cada control o desvío (los desvíos simulan 8 si no se indica). |
| `budget` | `number` | KB gzip que no debe pasar (por defecto 40). |
| `palette` | `{ base?, use? }` | Los roles de la figura (`use`, en el orden de la leyenda) y, opcional, el color de marca del que se derivan (`base`). Ver [color.md](color.md). |

`Text` es `"texto"` o `{ es: "…", en: "…" }`.

## Piezas sólidas

Todas aceptan: `id`, `tone` (`lo` base, `mid` estructura, `hi` sujeto, `lit` el único acento), `group`, `hidden`,
`repeat`, `float`, `mount`, `shadow` y `paint` (un rol o un material: `"data"`, `"steel"`…; ver [color.md](color.md)).

| `kind` | Campos | Notas |
|---|---|---|
| `box` | `at` (esquina mínima), `size: [w, d, h]`, `radius`, `bevel` | Rectángulo redondeado en planta, extruido hacia arriba. |
| `cylinder` | `at` (centro de la cara inicial), `r`, `h`, `axis` (`x`/`y`/`z`), `bevel` | Ruedas, perillas, fichas, postes. |
| `prism` | `plan: [x, y][]` (convexa, antihoraria), `z`, `h`, `bevel` | Cualquier planta convexa. Las cóncavas se arman con varias piezas. |

- `bevel` corta el canto de la tapa: entre 0,4 y 1,6 se ve como una pieza fabricada.
- `repeat: { count, step, from }` crea copias desplazadas. `{i}` en `id` o `group` se reemplaza por el índice; si `id`
  no lo lleva, se agrega `-i`. `from` es el primer valor de `{i}` (0 por defecto): la copia número k se desplaza
  `step × k` y se llama `from + k`, así dos filas se reparten los números de un mismo grupo (`fila-0…13` y
  `fila-14…27`).
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
  { label: "Borra un pod", values: { replicas: 3 }, press: ["borrar"], note: "El Deployment lo repone en segundos." },
],
```

- `toggle` vale 0 o 1; `choice` vale el índice de la opción elegida; `action` es un botón que suma 1 al pulsarlo.
- `presets` son botones «Prueba a romperlo»: fijan parámetros, muestran `note` y la anuncian a los lectores de pantalla. `press` pulsa acciones después de fijar los valores (y de `reset`), así que el desvío no tiene que pedir «pulsa…».
- El modelo puede teñir un grupo con `s: "ok" | "warn" | "fail"`.

## Lo que el modelo recibe en `ctx`

```ts
step(s, dt, p, ctx) {
  if (ctx.changed("replicas")) s.deseado = p.replicas;     // el control cambió
  if (ctx.pressed("borrar")) {                              // la acción se pulsó (botón o desvío con press)
    s.pods.pop();
    ctx.say("Se borró un pod: el Deployment crea otro");   // un evento, una vez
  }
}
```

- `ctx.pressed(id)` y `ctx.changed(id)` son verdaderos durante el paso siguiente a la pulsación o al cambio: el modelo no necesita guardar una copia del parámetro para compararla.
- `ctx.say(texto)` anuncia un evento en el momento en que pasa. El runtime decide cuándo hablar: calla hasta que el lector toca la figura, espera 1,5 s de silencio, no pisa la nota de un desvío, habla como mucho dos veces por interacción y no repite lo último que dijo. Si el eco de la lectura lo pisa, lo dice después. `view.say` sigue funcionando como antes.
- `ctx.reducedMotion` cambia en vivo si el lector cambia la preferencia del sistema. Con `motion.settle`, el runtime ya muestra el estado asentado: el modelo no tiene que calcularlo a mano. La simulación sigue desde el estado actual; un desvío con `reset` da siempre el mismo resultado.

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
- **Rótulos:** los que no se leen ni en la vista ampliada (ver [validar.md](validar.md#rótulos-legibles)).

La spec misma se valida antes de dibujar: [validar.md](validar.md).

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

## Ampliar la figura

En un celular el dibujo mide unos 326 px y sus rótulos, de 2 a 5 px. La tarjeta trae un chip «Ampliar» que abre un
diálogo con el mismo SVG a 1150 px de ancho (o más, hasta que la mediana de los rótulos llegue a 11 px), con
desplazamiento y pellizco. La figura sigue animándose y girando dentro; se cierra con Esc o con «Cerrar» y el foco
vuelve al chip. El chip sale oculto y aparece al montar la figura si la página dio un cargador:

```ts
import { zoomOnDemand, mountAll } from "isofig/runtime";

zoomOnDemand(() => import("isofig/zoom")); // antes de montar; el módulo (~1 KB gzip) se descarga al pulsar
mountAll();
```

`renderFigure(spec, { zoom: false })` quita el chip. `--isofig-zoom-width` cambia el ancho mínimo del diálogo.

## Importar y previsualizar

- `isofig import compose <archivo.json|->` arma una spec desde `docker compose config --format json` (ver
  [importar.md](importar.md)). Es un punto de partida: enriquécela a mano.
- `isofig build <spec> --format page --model <modelo> --advance 3` arma una página suelta que empaqueta el modelo
  y los archivos locales que importa, y arranca con 3 s ya simulados para poder capturarla en Chrome headless.
- Si un aviso dice «orden de pintado ambiguo cerca de A ↔ B, C», esas son las piezas que forman el ciclo: separa
  sus cajas en algún eje o parte la pieza larga.
