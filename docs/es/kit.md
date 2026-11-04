# El kit de piezas comunes

Casi toda figura empieza igual: una base sobre patas con tornillos en las esquinas, una placa de rótulo, una regla en
el borde, un depósito de piezas ocultas (fichas, paquetes, cajas) y las entradas de `groups` que lo acompañan.
`isofig/kit` da cada una como una función pura pequeña que devuelve `Part[]`: escribes la línea en lugar de copiar el
bloque.

Viene con el paquete: `import { bench, labelPlate, pool } from "isofig/kit"`.

## En TypeScript

```ts
import { defineFigure } from "isofig";
import { bench, groupsOf, labelPlate, pool, ruler } from "isofig/kit";

export default defineFigure({
  id: "tray",
  title: { es: "Bandeja de pedidos", en: "Order tray" },
  width: 520,
  height: 360,
  groups: groupsOf("order", 5, { extent: [[0, 100, 0]] }),
  parts: [
    ...bench({ size: [120, 220] }),
    ...labelPlate({ at: [10, 8], text: { es: "PEDIDOS", en: "ORDERS" } }),
    ...ruler({ at: [104, 20], length: 180 }),
    { id: "belt", kind: "box", at: [44, 60, 11], size: [24, 140, 4], radius: 1.5, bevel: 0.6, tone: "mid" },
    ...pool({ id: "order", count: 5, piece: { kind: "box", at: [48, 64, 15], size: [16, 14, 8], radius: 1.6, bevel: 0.8, tone: "hi" } }),
  ],
});
```

`bench` es la base con cuatro patas y cuatro tornillos; `labelPlate` graba el nombre en dos idiomas; `ruler` añade la
tira con sus marcas; `pool` crea los cinco pedidos ocultos, cada uno en su grupo (`order-0` … `order-4`), y `groupsOf`
escribe las entradas de `groups` para que la cámara encuadre cualquier pose.

## En JSON

Una spec en JSON no puede llamar funciones: cada nodo nombra una pieza con `use` y le pasa sus opciones en `with`.
Esto necesita la spec anidada (`root`, ver [spec.md](spec.md)); el nodo resuelve `use` contra `catalog`.

```json
{
  "id": "tray",
  "title": { "es": "Bandeja de pedidos", "en": "Order tray" },
  "width": 520,
  "height": 360,
  "root": {
    "id": "tray",
    "children": [
      { "id": "frame", "use": "bench", "with": { "size": [120, 220] } },
      { "id": "plate", "use": "labelPlate", "with": { "at": [10, 8], "text": { "es": "PEDIDOS", "en": "ORDERS" } } },
      { "id": "scale", "use": "ruler", "with": { "at": [104, 20], "length": 180 } },
      {
        "id": "belt",
        "parts": [{ "id": "belt", "kind": "box", "at": [44, 60, 11], "size": [24, 140, 4], "radius": 1.5, "bevel": 0.6, "tone": "mid" }]
      },
      {
        "id": "orders",
        "use": "pool",
        "with": {
          "id": "order",
          "count": 5,
          "extent": [[0, 100, 0]],
          "piece": { "kind": "box", "at": [48, 64, 15], "size": [16, 14, 8], "radius": 1.6, "bevel": 0.8, "tone": "hi" }
        }
      }
    ]
  }
}
```

En JSON no hay `groupsOf`: dale a `pool` un `extent` y su resultado trae también las entradas de `groups`.

## Las piezas

Cada función recibe un solo objeto de opciones. Los tamaños son `[ancho (x), fondo (y)]`; todo se apoya en la tapa de la
base, `z = BASE_TOP` (11).

| Función | Qué dibuja | Opciones (por defecto) |
|---|---|---|
| `bench` | La base sobre cuatro patas, con un tornillo en cada esquina | `size`, `id` (`base`), `legInset` (12), `screwInset` (6), `radius` (7) |
| `plinth` | Una base sin patas: maciza, o sobre una peana baja. Para piezas altas o largas, donde las patas confunden el orden de pintado | `size`, `id` (`base`), `step` (`false`; `true` o `{ inset: 5, radius: 6 }`), `screwInset`, `radius` |
| `labelPlate` | Una placa de 1,2 de grueso con líneas grabadas o un nombre, y cuatro tornillos | `at`, `size` (`[32, 40]`), `id` (`plate`), `z`, `text`, `textSize` (5), `lines` (3, o 0 con `text`), `rules`, `screws` (`true`) |
| `ruler` | Una tira a lo largo de y con una marca cada `pitch` y una mayor cada `every` | `at`, `length`, `id` (`ruler`), `z`, `width` (5), `pitch` (4), `margin` (4), `count`, `every` (5), `size` (`[2, 4]`), `toward` (1 o -1) |
| `screws` | Un tornillo en cada esquina de una tapa, para cualquier caja tuya | `on`, `at`, `size`, `z`, `inset` (3), `id` |
| `pool` | N piezas iguales, ocultas, cada una en su grupo: un depósito o una fila que el modelo enciende y apaga | `id`, `count`, `piece`, `step` (`[0, 0, 0]`), `group`, `from` (0), `hidden` (`true`) |
| `groupsOf` | Las entradas de `groups` de una familia, en lugar de `Object.fromEntries(range(n).map(…))` | `groupsOf("order", 5, { extent })` o `groupsOf(["a", "b"], { extent })` |

- **El `text` de `labelPlate`** se graba a lo largo de y y centrado. Ocupa unas `0,6 × textSize` unidades por letra: en una
  placa de 40 de fondo caben unas doce letras con tamaño 5. Las reglas son `inset` y `pitch` a lo largo de x, `margin`
  a lo largo de y y `taper`, lo que se acorta cada línea respecto de la anterior; los valores por defecto dibujan la placa
  que usan casi todas las figuras.
- **`pool`** es una sola pieza con `repeat`: cien piezas cuestan una línea de spec. `piece` es una caja, un cilindro o un
  prisma sin `id`, `group`, `hidden` ni `repeat`. Para una pila visible (`hidden: false`) usa `step` para separarlas.
- **Las marcas de `ruler`** empiezan a `margin` de la punta; `count` reemplaza la cantidad que cabe, y `toward: -1` pone
  las marcas en el otro borde.

## Ids

Cada función recibe un `id` base para que dos usos en la misma figura no choquen, y de él deriva el resto:

| Llamada | Ids |
|---|---|
| `bench({ id })` | `<id>`, `<id>-legs-far-0/1`, `<id>-legs-near-0/1`, `<id>-screws` |
| `plinth({ id })` | `<id>`, `<id>-step` (con `step`), `<id>-screws` |
| `labelPlate({ id })` | `<id>`, `<id>-line-1…`, `<id>-text`, `<id>-screws` |
| `ruler({ id })` | `<id>`, `<id>-ticks` |
| `pool({ id })` | `<id>-0`, `<id>-1`… (también los nombres de los grupos) |

Si tus propias piezas se refieren a alguno (`on: "plate"`, `mount: ["base"]`), conserva el nombre con `id`.

## Dos filas que comparten grupos

Una segunda fila de la misma familia necesita ids de pieza propios pero la misma familia de grupos, y a menudo
números que continúan los de la primera. `group` nombra la familia y `from` el primer número; las posiciones siguen
contando desde 0:

```ts
import { groupsOf, pool, type PoolPiece } from "isofig/kit";

const piece: PoolPiece = { kind: "box", at: [43, 214, 16], size: [16, 11, 10], tone: "hi" };

const parts = [
  ...pool({ id: "row", count: 14, step: [0, -14, 0], piece }),
  ...pool({ id: "row-high", group: "row", count: 14, from: 14, step: [0, -14, 0], piece: { ...piece, at: [43, 214, 26] } }),
];
const groups = groupsOf("row", 28); // row-0 … row-27
```

## El catálogo

`catalog` asocia cada nombre con una función `(options) => { parts }`, que es lo que llaman `use` y `with`. `pool` añade
`groups` cuando recibe `extent` (o `spin`). Las opciones desconocidas se rechazan por su nombre (`«legInsett»`), así que
un error de tipeo en JSON no se ignora en silencio, y `catalog` no tiene prototipo: `catalog["constructor"]` es
`undefined`.

```ts
import { catalog } from "isofig/kit";

const { parts } = catalog.bench({ size: [150, 250] });
```

## Lo que se queda en la figura

El kit guarda lo que toda figura repite. La máquina en sí (una tolva, un pórtico, una compuerta) es distinta cada vez y
se queda en tu spec.

## Pasar una figura que ya existe

Reemplaza un bloque a la vez; el SVG no cambia. Las pruebas dibujan las piezas que Software Academy escribía a mano
(`banco`, `zocalo`, `placa`, `regla`, la base con peana) y las del kit, y comparan el marcado carácter por carácter.
