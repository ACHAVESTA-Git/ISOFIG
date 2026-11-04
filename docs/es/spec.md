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
| `parts` | `Part[]` | Las piezas (con `root`, el escenario fijo). |
| `root`, `defs` | `Node`, `Record<string, Node>` | Un árbol de nodos anidados que se aplana al compilar y, si algún nodo trae `explode`, se puede desarmar. Ver [anidar.md](anidar.md). |
| `reorder` | `{ param, at }` | Recalcula el orden de pintado con los grupos movidos por `bind` en cada valor `at` del parámetro (el despiece lo pone solo). |
| `groups` | `Record<string, GroupSpec>` | Qué se mueve y cuánto, para que quepa en cualquier pose. |
| `params` | `ParamSpec[]` | Controles deslizantes. |
| `bind` | `BindSpec[]` | Enlaces parámetro → grupo sin escribir modelo. |
| `tracks` | `TrackSpec[]` | Grupos que recorren una polilínea sin modelo (los paquetes de un mapa). Ver [Recorridos](#recorridos). |
| `map` | `MapSpec` | Una topología, un mapa de flujo o un diagrama UML, compilado a un árbol `root` y a `tracks`. Ver [mapas.md](mapas.md). |
| `readout` | `Text` | Plantilla de la lectura, con `{param}`. El modelo puede reemplazarla. |
| `model` | `string` | Nombre con el que se registra el modelo en el runtime. |
| `autoplay` | `boolean` | Por defecto, `true` si hay modelo o recorridos. Con movimiento reducido siempre arranca en pausa. |
| `motion.tau` | `number` | Constante de tiempo de la interpolación (s), por defecto 0,18. |
| `motion.settle` | `number` | Con movimiento reducido, segundos que se simulan de golpe al montar y tras cada control o desvío (los desvíos simulan 8 si no se indica). |
| `budget` | `number` | KB gzip que no debe pasar (por defecto 40). |
| `palette` | `{ base?, use? }` | Los roles de la figura (`use`, en el orden de la leyenda) y, opcional, el color de marca del que se derivan (`base`). Ver [color.md](color.md). |

`Text` es `"texto"` o `{ es: "…", en: "…" }`.

## Piezas sólidas

Todas aceptan: `id`, `tone` (`lo` base, `mid` estructura, `hi` sujeto, `lit` el único acento), `group`, `hidden`,
`repeat`, `float`, `mount`, `shadow`, `paint` (un rol o un material: `"data"`, `"steel"`…; ver [color.md](color.md)) y
`ground` (una pieza del piso, como una bandeja o una cinta pegada al suelo: se pinta antes que todo lo que se alza o
pasa sobre ella y no entra en las dudas del orden de pintado; los mapas la usan).

| `kind` | Campos | Notas |
|---|---|---|
| `box` | `at` (esquina mínima), `size: [w, d, h]`, `radius`, `bevel` | Rectángulo redondeado en planta, extruido hacia arriba. |
| `cylinder` | `at` (centro de la cara inicial), `r`, `h`, `axis` (`x`/`y`/`z` o un vector como `[1, 0, 1]`), `bevel` | Ruedas, perillas, fichas, postes; con un vector, una biela o un pistón inclinados. |
| `cone` | `at`, `r` (cara inicial), `r2` (la otra; 0 es una punta), `h`, `axis` | Tronco de cono: toberas, embudos, trompetas. La primera pieza de revolución. |
| `prism` | `plan` (convexa), `z`, `h`, `axis` (`z` por defecto; `y` o `x`), `bevel` | Cualquier planta convexa. Con `axis: "y"` la planta es `[x, z]` y se extruye a lo largo de y desde `z`: el perfil de un bloque en V o de una viga. Las cóncavas se arman con varias piezas. |
| `sphere` | `at` (el **centro**), `r` | Bolas, articulaciones, cráneos, átomos, cuentas. |
| `capsule` | `at` (centro de la cara inicial del tramo recto), `r`, `h` (largo del tramo recto), `axis` (`x`/`y`/`z` o un vector como `[1, 0, 1]`) | Un cilindro con media esfera de radio `r` en cada punta: mide `h + 2r` de punta a punta. Huesos largos, bielas redondeadas, tubos, enlaces de una molécula. Con `h: 0` es una esfera. |

- `bevel` corta el canto de la tapa: entre 0,4 y 1,6 se ve como una pieza fabricada.
- **Esferas y cápsulas** se ven siempre como un círculo y un «estadio» (la envolvente de dos círculos), mires desde donde
  mires; el volumen lo dan seis capas de tono, con la misma luz y los mismos tonos de cara que las demás piezas, y el
  canto lleva el mismo trazo. `tone`, `paint`, `shadow` (un halo redondo) y los estados `ok`/`warn`/`fail` funcionan
  igual, y el giro y el despiece las mueven sin cambios. Como no hay z-buffer, dos piezas que se atraviesan se pintan una
  encima de la otra: apoya una cápsula en una esfera, o declara el encaje con `mount`.

  ```json
  { "id": "cabeza", "kind": "sphere", "at": [20, 20, 12], "r": 10, "tone": "hi" }
  { "id": "femur", "kind": "capsule", "at": [40, 20, 8], "r": 5, "h": 50, "axis": [1, 0, 1], "tone": "hi" }
  ```
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
opacidad. Varios enlaces al mismo grupo se suman (y, si la figura tiene modelo, se suman a lo que el modelo fije).

- `win: [a, b]` usa `(valor − a) / (b − a)`, recortado entre 0 y 1: el grupo solo se mueve mientras el parámetro
  cruza esa ventana (así sale cada etapa de un despiece).
- `keep: [1, 3]` con una elección: si vale algo distinto de 0 que no está en la lista, el grupo se atenúa.

Un parámetro con `texts` (un texto por valor entero) los usa en la lectura (`{id}`) y en lo que anuncia el lector de
pantalla; un texto puede nombrar a su vez otro parámetro (`"{explode}"`).

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

`renderFigure(spec, { orbit: true })` añade botones para girar y la pista «arrastra o usa las flechas para girar». En la
página, el giro se carga solo cuando hace falta:

```ts
import { orbitOnDemand } from "isofig/runtime";

orbitOnDemand(el, async () => {
  const { enableOrbit } = await import("isofig/orbit");
  return enableOrbit(el, spec, { lang: "es" });
});
```

Al pasar el puntero o enfocar la figura se precarga; al presionar el dibujo, un botón o una flecha se activa. El módulo
pesa ~10 KB gzip más la spec, y solo lo descarga quien gira la figura.

Opciones de `enableOrbit`:

| Opción | Por defecto | Qué hace |
|---|---|---|
| `lang` | `"en"` | Idioma de los rótulos al redibujar. |
| `range` | sin tope | Grados que puede girar el azimut a cada lado del de la spec. Sin él da la **vuelta entera** (módulo 360°) y ningún botón se deshabilita; con él, el botón del tope se marca `aria-disabled`. |
| `minElevation`, `maxElevation` | `12`, `60` | Límites de la elevación, en grados. |
| `instance` | el del SVG | Nombre de la copia en el DOM (ver `RenderOptions.instance`). |

**Cómo se mueve**

- **Arrastrar** gira 0,35° por píxel (y con ratón, 0,25° de elevación por píxel; con el dedo solo gira de lado). **Al soltar
  sigue girando con inercia y frena con suavidad** (la velocidad cae al 37 % cada 0,18 s). Agarrar la figura la detiene.
  Con `prefers-reduced-motion` no hay inercia ni deslizamiento: la cámara salta al ángulo pedido.
- **Teclado.** El dibujo se enfoca (`tabindex="0"`, `aria-keyshortcuts`) y su pista se lee tras su descripción. Con el foco
  en él, ←/→ giran 15° (como ↺/↻) y ↑/↓ cambian la elevación 5°; con Ctrl, Alt o Meta no hacen nada, y los controles
  conservan sus flechas. «Vista inicial» vuelve por el camino corto.
- **Cabe desde cualquier ángulo.** La escala de la vista inicial es el **tope**: desde otro azimut o elevación la cámara se
  achica lo justo para que la figura entera quepa en el marco, en todas las poses del despiece (`groups.*.extent`). El
  cambio es continuo, sin saltos, y nunca agranda. El `viewBox` no cambia: lo mueve el acercamiento a la pieza.
- **Nada se ve a través ni en espejo.** Los puntos, líneas, marcas (`ticks`) y rótulos grabados en una cara que no mira al
  lector no se dibujan. Una tapa con rótulo (`face: "top"`) vista desde el otro lado gira el texto media vuelta sobre su
  ancla para que se lea al derecho; el de una cara de lado (`x`, `y`) que no mira al lector se oculta. Esto vale también
  en la vista inicial: lo que estaba grabado en una cara de atrás ya no asoma.
- **Fluidez.** Mientras la cámara se mueve (arrastre, inercia, flechas) la escena se dibuja en **borrador**: sin compartir
  piezas idénticas con `<use>`, con menos capas en las esferas y cápsulas y calculando solo el orden de pintado de la pose
  del despiece que se ve (el valor del control de `reorder`). En cuanto se detiene, se dibuja completa, igual que desde ese
  ángulo con `drawScene`. Si el lector mueve el control del despiece, durante 1,2 s se calculan todas las poses. Con
  `drawScene(spec, lang, { draft: true, pose: valor })` puedes pedir lo mismo a mano.

El giro dibuja la spec **armada**. Una spec anidada (`root`, ver [anidar.md](anidar.md)) se aplana al compilar con
`assemble(spec)` de `isofig`, y a la página viaja la aplanada (`<Figure orbit>` y `isofig build --format page --orbit`
lo hacen solos). Así el navegador no descarga el aplanador del árbol, el catálogo del kit ni el validador, y el giro
sigue reordenando las piezas por pose. Si le llega un árbol, `enableOrbit` lo dice.

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

## Recorridos

`tracks` mueve un grupo por una polilínea sin modelo: los paquetes de un mapa, un carrito sobre un riel.

```json
"tracks": [
  { "group": "paquete", "path": [[0, 0, 0], [0, 120, 0], [60, 120, 0]], "period": 6, "delay": 1, "hide": [[0.4, 0.5]] }
]
```

| Campo | Para qué |
|---|---|
| `group` | El grupo (el `group` de sus piezas) que viaja. Sus piezas se dibujan donde empieza `path`. |
| `path` | Puntos del recorrido en el mundo; al menos dos distintos. |
| `period` | Segundos que tarda en recorrer `path` entera, a velocidad constante según el arco. Mayor que 0. |
| `delay` | Segundos que espera antes de salir la primera vez. |
| `loop` | `false`: lo recorre una vez y se queda al final. Por defecto vuelve a empezar. |
| `hide` | Tramos del recorrido, como fracciones del arco (`[0.4, 0.5]`), en que el grupo no se ve: pasa por dentro de un objeto. |

El grupo aparece y se apaga en los extremos. El build calcula el arco una vez; el runtime solo interpola, con o sin un
modelo propio (los grupos del modelo y los recorridos se dibujan juntos). El botón de pausa los detiene (una figura con
recorridos arranca andando: `autoplay` es `true` por defecto) y con movimiento reducido cada grupo queda a mitad de
camino y a la vista. Un grupo que ninguna pieza tiene es un aviso (`track-group-unknown`); un `period` que no es mayor
que 0, o un `path` con menos de dos puntos distintos, es un error. Lo que viaja se pinta al final, así que siempre se
ve. Costo en el runtime: 207 B gzip.

## Importar y previsualizar

- `isofig import compose <archivo.json|->` arma un mapa desde `docker compose config --format json`, y `isofig import
  mermaid <archivo.mmd|->` uno desde un flowchart o un diagrama de clases de Mermaid (ver [importar.md](importar.md)
  y [mapas.md](mapas.md)). Son un punto de partida: edítalos a mano.
- `isofig build <spec> --format page --model <modelo> --advance 3` arma una página suelta que empaqueta el modelo
  y los archivos locales que importa, y arranca con 3 s ya simulados para poder capturarla en Chrome headless.
- Si un aviso dice «orden de pintado ambiguo cerca de A ↔ B, C», esas son las piezas que forman el ciclo: separa
  sus cajas en algún eje o parte la pieza larga.
