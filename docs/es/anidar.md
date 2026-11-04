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
| `rotate` | `[x, y, z]` en grados: gira el nodo alrededor de su propio `at`, y arrastra a sus piezas y a sus hijos. Ver [Girar un nodo](#girar-un-nodo-rotate). |
| `parts`, `children` | Sus piezas (las de siempre) y sus subconjuntos. |
| `name`, `note` | Nombre de la pieza y una línea sobre qué hace: aparecen en la lista de piezas y en la lectura al elegirla. |
| `explode` | Cuánto se separa al desarmar, en el espacio de su padre (como `at`: si el padre está girado, gira con él). Usa diagonales cuando cuentan algo (las culatas de un V8 salen a 45°). |
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

## Girar un nodo (`rotate`)

Un nodo ya sabe dónde está (`at`). Con `rotate` sabe también hacia dónde mira: sus tres ejes, como el `Transform` de un
GameObject de Unity. Sirve para lo que no cae en línea recta: un brazo inclinado, una puerta entreabierta, una rueda con
caída, una costilla, una biela a 30°.

```json
{ "id": "brazo", "at": [10, 0, 140], "rotate": [0, 20, 0], "children": [ … ], "parts": [ … ] }
```

`rotate: [x, y, z]` va en **grados** (por defecto `[0, 0, 0]`) y gira el nodo **alrededor de su propio `at`**, que es su
origen local y no se mueve: pon el `at` en la bisagra, el hombro o el codo, y escribe las piezas desde ahí.

| | Unity (`Transform`) | isofig (nodo) |
|---|---|---|
| Posición local | `localPosition` | `at` |
| Rotación local | `localEulerAngles`, en grados | `rotate`, en grados |
| Hijos | siguen al padre | las piezas y los hijos son locales al nodo ya girado |
| Eje vertical | `y` | **`z`** (`x` e `y` son el piso) |
| Orden de los giros | `z`, luego `x`, luego `y` | `x`, luego `y`, luego `z` |
| Mano del sistema | izquierda | derecha: un ángulo positivo gira en sentido antihorario, visto desde la punta del eje |
| Escala | `localScale` | no hay: se escribe en `size`, `r` y `h` |

No copies los ángulos de un Unity a isofig tal cual: cambian la vertical, el orden y la mano.

### El orden de los ejes: x, luego y, luego z

Son giros **extrínsecos**: cada uno es alrededor de un eje fijo del padre, y no del eje que el giro anterior dejó
inclinado. En matrices, `R = Rz · Ry · Rx`: primero se aplica `Rx` a lo que escribiste.

Para verlo, párate sobre un lápiz que está de pie (a lo largo de `z`) y escribe `rotate: [90, 0, 90]`:

1. **`x` primero.** El lápiz se echa hacia `−y` y queda tumbado en el piso, apuntando a `−y`.
2. **`y` después.** Con 0° no pasa nada.
3. **`z` al final.** El piso entero gira 90° en sentido antihorario visto desde arriba, y el lápiz, que apuntaba a `−y`,
   apunta ahora a `+x`.

Si el orden fuera `z` primero, el lápiz seguiría apuntando a `−y`. Con un solo ángulo distinto de cero el orden no
importa; con dos o más, sí. Si dudas, **anida**: un nodo por giro. El hijo gira sobre los ejes de su padre ya girado, así
que se lee «a partir de lo que ya hay»: un padre con `"rotate": [0, 0, 30]` y un hijo con `"rotate": [20, 0, 0]` inclina
20° alrededor del eje x que el padre ya giró 30°.

Los signos, con la regla de la mano derecha: `z` positivo lleva `x` hacia `y`; `y` positivo inclina lo que está de pie
hacia `+x`; `x` positivo lo inclina hacia `−y`.

### Se compone hacia abajo

- Las coordenadas de `parts`, el `at` y el `explode` de los hijos, y los ejes de `cylinder`, `cone` y `capsule` (también
  el `axis` de un `prism`) son **locales al nodo ya girado**. Un hijo con `rotate: [0, -70, 0]` dentro de un padre con
  `rotate: [0, 35, 0]` queda a −35° del vertical: los giros se suman.
- `explode` es un desplazamiento **en el espacio del padre**, igual que `at`. Si el padre está girado, la pieza sale
  siguiendo su eje y no el del mundo: el antebrazo se separa a lo largo del brazo inclinado. El `rotate` del propio nodo
  no cambia su `explode`. El despiece sigue siendo una traslación: en el navegador cada nodo se mueve por la suma de los
  `explode` de sus ancestros ya llevados al mundo.
- `repeat` copia el subárbol con su `rotate`; el `step` está en el espacio del padre.
- La raíz también se puede girar (gira todo alrededor de su `at`); no se puede despiezar, así que `explode` en la raíz se
  sigue ignorando.

### Una puerta entreabierta

La hoja gira 35° en `z` alrededor de la bisagra, que es el `at` del nodo (la cara interior de la jamba izquierda); su
panel se escribe desde la bisagra, hacia `+x`.

```json
{
  "id": "puerta",
  "title": { "es": "Puerta entreabierta", "en": "Ajar door" },
  "root": {
    "id": "marco",
    "parts": [
      { "id": "jamba-i", "kind": "box", "at": [0, 0, 0], "size": [6, 8, 76] },
      { "id": "jamba-d", "kind": "box", "at": [76, 0, 0], "size": [6, 8, 76] },
      { "id": "dintel", "kind": "box", "at": [0, 0, 76], "size": [82, 8, 6] }
    ],
    "children": [{
      "id": "hoja", "at": [6, 2, 0], "rotate": [0, 0, 35], "mount": ["jamba-i"],
      "parts": [
        { "id": "panel", "kind": "box", "at": [0, 0, 0], "size": [70, 4, 74], "radius": 1, "tone": "hi" },
        { "id": "pomo", "kind": "cylinder", "at": [60, 4, 36], "r": 3, "h": 5, "axis": "y", "tone": "lit" }
      ]
    }]
  }
}
```

El pomo sale hacia `+y` del panel (`axis: "y"` es local) y, girado, apunta hacia donde mira la hoja.

### Un brazo inclinado

Dos tramos, cada uno un nodo. El hombro inclina 35° hacia `+x`; el codo, hijo del hombro y colgado de su punta
(`at: [0, 0, 54]`), gira otros −70° en `y`, así que el antebrazo queda a −35° del vertical.

```json
{
  "id": "brazo",
  "title": { "es": "Brazo inclinado", "en": "Tilted arm" },
  "root": {
    "id": "banco",
    "parts": [{ "id": "base", "kind": "box", "at": [0, 0, 0], "size": [50, 40, 10], "radius": 4, "tone": "lo" }],
    "children": [{
      "id": "hombro", "at": [25, 20, 10], "rotate": [0, 35, 0], "mount": ["base"],
      "parts": [
        { "id": "eje", "kind": "sphere", "at": [0, 0, 0], "r": 6, "mount": ["hombro.hueso"] },
        { "id": "hueso", "kind": "capsule", "at": [0, 0, 4], "r": 4, "h": 46, "tone": "hi" }
      ],
      "children": [{
        "id": "codo", "at": [0, 0, 54], "rotate": [0, -70, 0], "mount": ["hombro.hueso"],
        "parts": [
          { "id": "bola", "kind": "sphere", "at": [0, 0, 0], "r": 5, "mount": ["codo.hueso"] },
          { "id": "hueso", "kind": "capsule", "at": [0, 0, 4], "r": 3.2, "h": 34, "tone": "hi" },
          { "id": "pinza", "kind": "sphere", "at": [0, 0, 44], "r": 5, "tone": "lit", "mount": ["codo.hueso"] }
        ]
      }]
    }]
  }
}
```

`examples/sistema-oseo/spec.json` lo usa en el esqueleto: los brazos se separan 7° del tronco desde el hombro y los pies
abren 10° desde el tobillo; al desarmar, el antebrazo y la mano salen a lo largo del brazo inclinado.

### Qué cambia al dibujar

- **Cilindros, conos y cápsulas** giran su centro y su eje; una **esfera**, su centro.
- **Cajas y prismas** se dibujan girados de verdad (con sus esquinas redondeadas y su bisel): el ensamblado les pone una
  base interna, `frame`, que no se escribe a mano. Su caja envolvente, para el orden de pintado y la auditoría, es la de
  sus 8 vértices girados; el encuadre de la cámara y el halo de `shadow` siguen su huella real.
- **`dots`, `line` y `ticks`** giran sus puntos y sus direcciones.
- **Un `label`** sigue pegado a su cara: se lee a lo largo de la cara girada, con la misma inclinación. Si la cara girada
  queda de espaldas a la cámara de la figura, o casi de canto, el texto se leería al revés o no se vería, y `check` lo
  dice (`label-faces-away`).
- **Desde cualquier cámara.** El giro de la figura (`isofig/orbit`) y `drawScene` dibujan lo girado con su propio orden de
  pintado desde cualquier azimut; nada de esto necesita configurarse.
- **Sin `rotate`, nada cambia**: el SVG sale idéntico, byte a byte, al de antes (también con `[0, 0, 0]` o con vueltas
  enteras).

### Límites

- Un tramo girado es una forma distinta para cada inclinación: las piezas que antes eran iguales y compartían un dibujo
  (los dedos de las dos manos, espejados) ya no lo comparten, y la figura pesa un poco más (el esqueleto, +1,4 KB gzip).
- `groups.*.extent`, `spin.center` y `tracks.path` están en coordenadas del **mundo**, no se giran con el nodo; los que
  genera el despiece sí van ya en el mundo. Una pieza del catálogo con sus propios `groups` (un `pool` con `extent`)
  conviene dejarla sin girar.
- Cada giro es un nodo con tres ángulos: no hay animación del giro (`rotate` es estático; lo que se anima son los
  `bind`, en traslaciones y giros de plano de un grupo).
- Los ángulos van en grados. `isofig check` avisa (`rotate-radians`) cuando `rotate` parece estar en radianes.

## El despiece

Si algún nodo trae `explode`, la figura gana sola:

- **«Desarmar»**: un deslizante por pasos, de «Armado» a «Paso 7 de 7». Cada nodo se desplaza por la suma de su
  `explode` y los de sus ancestros, cada uno en la ventana de su etapa: al pasar al paso 3 se mueve lo de la etapa 3, y
  lo que va dentro de ello se mueve con él.
- **La lista de piezas** («Pieza»): un botón por nombre, en el orden del árbol; dos nodos con el mismo nombre (las dos
  culatas) son una sola entrada. Al elegir una, la cámara se acerca a ella con una animación, la pieza pasa al primer
  plano (se pinta encima de todo) y el resto queda al 35 %, translúcido pero a la vista; la lectura muestra su `name` y
  su `note`, y «Todo» vuelve al encuadre completo. Elegir un nodo muestra sus piezas y las de dentro que no se desarman
  por su cuenta: lo que sale aparte es otra pieza. Con la figura armada se ve la pieza dentro (los pistones en su
  bancada), y el acercamiento sigue a la pieza si mueves «Desarmar» o giras la figura.
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
- `sphere` (`at` es el centro) y `capsule` (un cilindro con media esfera en cada punta; `at`, `r`, `h` y `axis` como en
  `cylinder`): articulaciones, huesos largos, bielas redondeadas. Se despiezan, se repiten y giran como cualquier pieza.

## Revisarlo

```sh
npx --no-install isofig check motor.json --lang es                      # forma del árbol, use, referencias, auditoría
npx --no-install isofig build motor.json --format page -o motor.html --set explode=4 --set pick=3
```

`--set` alcanza también `explode` y `pick`: sirve para capturar cada paso y cada pieza elegida. Mira las capturas
armado, a mitad y desarmado: lo que el ojo no cree, no lo arregla un aviso en verde.
