# Especificación anidada y despiece

Una máquina ya tiene estructura: el motor tiene bancadas, las bancadas tienen culatas, las culatas tienen válvulas.
Si la spec la cuenta así, como un árbol de nodos en JSON, isofig la aplana para dibujarla y además sabe **desarmarla
pieza por pieza**, sin modelo ni funciones: el control «Desarmar», la lista de piezas y la lectura salen solos.

```json
{
  "id": "caja",
  "title": { "es": "Caja con tapa", "en": "Lidded box" },
  "root": {
    "id": "caja",
    "parts": [{ "id": "base", "kind": "box", "at": [0, 0, 0], "size": [60, 60, 20], "radius": 4, "shadow": true }],
    "children": [{
      "id": "tapa", "name": { "es": "Tapa", "en": "Lid" }, "note": { "es": "cierra la caja", "en": "closes the box" },
      "at": [0, 0, 20], "explode": [0, 0, 30],
      "parts": [{ "id": "losa", "kind": "box", "at": [0, 0, 0], "size": [60, 60, 6], "radius": 4 }],
      "children": [{
        "id": "perilla", "name": { "es": "Perilla", "en": "Knob" }, "at": [30, 30, 6], "explode": [0, 0, 20],
        "parts": [{ "id": "p", "kind": "cylinder", "at": [0, 0, 0], "r": 6, "h": 8, "mount": ["losa"] }]
      }]
    }]
  }
}
```

`isofig build caja.json` funciona tal cual: `renderFigure`, `validateSpec` y el CLI aceptan `root` (`drawScene` y el giro lo reciben ya aplanado con `assemble`).
Ejemplos completos: [`examples/motor-v8/spec.json`](../../examples/motor-v8/spec.json) y
[`examples/motor-cohete/spec.json`](../../examples/motor-cohete/spec.json).

## La forma del árbol

`root` es un `Node`; `defs` guarda subárboles reutilizables; `parts`, si está, es el escenario fijo (un banco, un
soporte) en coordenadas de mundo.

| Campo del nodo | Para qué |
|---|---|
| `id` | Obligatorio. Nombra sus piezas y su grupo: la pieza `losa` del nodo `tapa` se llama `tapa.losa`. Dos hermanos no pueden llamarse igual. |
| `at` | Origen del nodo, relativo a su padre. Las coordenadas de `parts` y de los hijos son **locales** a él. |
| `parts`, `children` | Sus piezas (las de siempre) y sus subconjuntos. |
| `name`, `note` | Nombre de la pieza y una línea sobre qué hace: aparecen en la lista de piezas y en la lectura al elegirla. |
| `explode` | Cuánto se separa al desarmar, **relativo a su padre**. Usa diagonales cuando cuentan algo (las culatas de un V8 salen a 45°). |
| `stage`, `step` | En qué etapa sale y el texto de ese paso («culatas fuera»). |
| `repeat` | `{ count, step, from? }`: copia el subárbol entero. |
| `use`, `with` | Toma el subárbol de `defs` o del catálogo. |
| `tone`, `paint` | Los heredan las piezas y los nodos de dentro que no traen uno propio. |
| `mount` | Piezas en las que va encajado todo el nodo (el tren alternativo dentro del bloque): se suma al `mount` de cada pieza. |

### Referencias: primero el propio nodo, luego hacia arriba

`on` y `mount` se escriben con el id corto. Se buscan primero entre las piezas del propio nodo, luego en las de su
padre, su abuelo… hasta la raíz y las piezas sueltas de la figura. Para alcanzar otra rama se escribe la ruta desde
un ancestro común: desde la admisión del V8, `"bloque.bancada-izq.fundicion"`. Una referencia que no se encuentra queda
como está y la validación lo dice con la ruta del JSON (`root.children[2].parts[0].mount[0]`).

### `repeat` de un subárbol

```json
{ "id": "cilindro-{i}", "repeat": { "count": 4, "step": [0, 36, 0] }, "children": [ … ] }
```

Cada copia es el subárbol entero, desplazado `step × k`. `{i}` (que vale `from + k`) se reemplaza en los textos del
nodo que se repite y de su interior, salvo dentro de un nodo o una pieza que se repite por su cuenta: `{i}` es del
`repeat` más cercano. Sin `{i}` en el id, se añade `-i`. Cada copia resuelve sus referencias dentro de sí misma.

### `use`, `defs` y el catálogo

```json
"children": [{ "id": "pata-{i}", "use": "pata", "with": { "alto": 6 }, "repeat": { "count": 4, "step": [40, 0, 0] } }],
"defs": { "pata": { "parts": [{ "id": "c", "kind": "cylinder", "at": [0, 0, 0], "r": 4, "h": "{alto}" }] } }
```

`use` busca primero en `defs` y luego en el catálogo. En `defs`, `with` reemplaza `{clave}` en los textos del
subárbol; un texto que es solo `"{alto}"` toma el valor tal cual (un número). Lo que el nodo trae (`id`, `at`,
`explode`, `name`…) gana sobre el subárbol, y sus `parts` y `children` se suman a los de él.

El catálogo por defecto de `renderFigure`, `validateSpec` y el CLI es el de [`isofig/kit`](kit.md): `"use": "bench",
"with": { "size": [150, 250] }` funciona desde JSON sin configurar nada. Un `pool` con `extent` trae además sus
`groups`, que se suman a los de la figura. Otro catálogo se pasa en `renderFigure(spec, { catalog })` o
`assemble(spec, { catalog })`. El giro (`enableOrbit`) recibe la spec ya armada con `assemble(spec, { catalog })`: nunca
necesita el catálogo.

## El despiece

Si algún nodo trae `explode`, la figura gana sola:

- **«Desarmar»**: un deslizante por pasos, de «Armado» a «Paso 7 de 7». Cada nodo se desplaza por la suma de su
  `explode` y los de sus ancestros, cada uno en la ventana de su etapa: al pasar al paso 3 se mueve lo de la etapa 3, y
  lo que va dentro de ello se mueve con él.
- **La lista de piezas** («Pieza»): un botón por nombre, en el orden del árbol; dos nodos con el mismo nombre (las dos
  culatas) son una sola entrada. Al elegir una, el resto se atenúa y la lectura muestra su `name` y su `note`. Elegir
  un nodo muestra sus piezas y las de dentro que no se desarman por su cuenta: lo que sale aparte es otra pieza. Con la
  figura armada, el resto se vuelve translúcido y se ve la pieza dentro (los pistones en su bancada).
- **La lectura**: «Paso 3 de 7: culatas fuera», o «Culata · cierra los cilindros…» con una pieza elegida. El lector de
  pantalla oye el paso al moverlo (`aria-valuetext`) y la lista es un grupo de botones de radio con su leyenda.

### Etapas

- **Automáticas** (ningún nodo trae `stage`): sale primero lo que está más afuera en su dirección de salida, y un hijo
  nunca después de su padre (la tapa antes que la culata). Nodos a la misma distancia (las dos culatas) salen juntos.
- **Del autor**: con `stage` en algún nodo, se ordenan por ese número; los que no lo traen heredan el de su ancestro
  más cercano o van en la primera etapa. Los del mismo número salen juntos.
- El texto del paso es el `step` del primer nodo de la etapa que lo traiga; si no, sus nombres en una lista
  («perilla y tapa»).

### Qué genera

El runtime no conoce árboles: `assemble(spec)` devuelve la `FigureSpec` plana de siempre, con

- un grupo por nodo que se desarma o tiene nombre (la ruta: `bloque.bancada-izq.culata`);
- los parámetros `explode` (rango por pasos, con un texto por paso en `texts`) y `pick` (elección); si la spec ya
  trae uno con ese id, se usa el suyo;
- un `bind` por grupo y etapa (`move` con `win`) y uno por grupo para la elección (`keep`);
- `groups[g].extent` con el desplazamiento al final de cada etapa, para que la cámara encuadre la figura desarmada;
- `readout: "{pick}"` (si la spec no trae una lectura propia) y `reorder`, el orden de pintado de cada pose.

### Una pieza que ya anima un modelo

Si una pieza de dentro trae su propio `group` (una rueda que gira con el modelo), lo conserva y el despiece la lleva
desde fuera: se dibuja dentro de un `<g data-g="grupo-del-nodo">`. Las dos transformaciones se componen. Cuesta unos
30 bytes por pieza así. Los `bind` del despiece se suman a lo que el modelo mueva; la lectura, si el modelo da una,
es la del modelo.

## Orden de pintado al desarmar

El orden se calcula en reposo y también en cada pose (al final de cada etapa). La figura guarda solo las diferencias:
por pose, los pares «mueve esta pieza antes de aquella» sobre el orden en reposo (las que no están en la subsecuencia
más larga que ya va en orden). El runtime reordena el DOM al cruzar el umbral: al salir, cuando la pieza ya llegó; al
volver, en cuanto arranca. Así una pieza nunca se pinta encima de la que la tapaba.

Con piezas inclinadas o de revolución, el orden usa además los planos de sus caras (y la recta entre los centros de
dos piezas redondas). Una pieza metida en la caja de otra (un pistón en su bancada) va antes: queda tapada.

## Primitivas para máquinas reales

- `prism` con `axis: "y"` o `"x"`: la planta es `[x, z]` (o `[y, z]`) y se extruye a lo largo de ese eje desde `z`.
  Sirve para el perfil de un bloque en V, una culata inclinada o una viga. Horaria o antihoraria, da igual.
- `cylinder` con un eje vector (`"axis": [-0.71, 0, 0.71]`): una biela o un pistón inclinados.
- `cone`: tronco de cono, `r` en la cara inicial y `r2` en la otra (0 es una punta). Una tobera se arma con varios.

## Revisarlo

```sh
npx isofig check motor.json --lang es                      # forma del árbol, use, referencias, auditoría
npx isofig build motor.json --format page -o motor.html --set explode=4 --set pick=3
```

`--set` alcanza también `explode` y `pick`: sirve para capturar cada paso y cada pieza elegida. Mira las capturas
armado, a mitad y desarmado: lo que el ojo no cree, no lo arregla un aviso en verde.
