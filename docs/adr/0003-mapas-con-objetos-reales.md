# ADR 0003 · Mapas con objetos reales

- **Estado:** aceptada (2026-11-04), isofig 0.9
- **Relacionada:** [ADR 0001](0001-nucleo-ligero-y-especificacion-declarativa.md) (la figura es un dato, el objeto es la
  explicación) y [ADR 0002](0002-especificacion-anidada-y-despiece.md) (el árbol que se aplana al compilar)

## Contexto

isofig dibuja máquinas: un dispensador de fichas, un rack, un motor. Quien quiere explicar una **topología de red**,
el **flujo de un pedido** o un **diagrama UML** tenía dos malos caminos: una caja con flechas (lo que la skill prohíbe)
o escribir a mano cada pieza en coordenadas de mundo. El importador de docker compose ya era un mapa en pequeño (un rack
por servicio, rieles de red) con su propio reparto de filas, y no había forma de nombrar un VPC que contiene una subred
que contiene servidores. La filosofía no cambia: **cada nodo es un objeto pequeño y reconocible**, no un rectángulo con
un nombre.

## Decisión

1. **`map` en la `FigureSpec`, compilado a un árbol y a recorridos.** `compileMap(map)` es una función pura (sin Node,
   corre en el navegador) que devuelve `{ root, tracks, width, height, camera }`: un `Node` del [árbol anidado](0002-especificacion-anidada-y-despiece.md)
   (contenedores con `children`, cada objeto con sus `parts`) y los recorridos de los paquetes. De ahí en adelante es una
   spec anidada: `assembleTree` compila el `map` primero y el resto del núcleo no sabe que existió.
2. **Un catálogo de 17 objetos**, cada uno una función de unas decenas de piezas que se arma con un `ROLE` en el cuerpo
   y se pinta con el rol de color de su categoría (`client`, `edge`, `compute`, `data`, `messaging`, `storage`,
   `external`): un celular en su soporte, un rack de tres unidades, una pila de discos, una cinta transportadora con
   paquetes, un carrusel de reparto, un archivador con cajones. Cada objeto va sobre un zócalo con una **placa de tono
   neutro** donde se graba el nombre: el texto nunca depende del color.
3. **Contenedores = bandejas bajas**, no cajas que envuelven a sus hijos (una caja que contiene a otra la tapa en el
   orden de pintado). Su tono sube un paso por nivel (`lo`, `mid`, `hi`) y su tamaño sale de lo que hay dentro.
4. **Tres repartos.** `flow` (rangos de izquierda a derecha, los de un rango apilados hacia el lector), `layers` (de
   arriba abajo, la herencia con el padre arriba) y `grid` (celdas explícitas). Los rangos salen del camino más largo
   sobre los enlaces (los ciclos se cortan donde cierran), se ordenan por el promedio de sus vecinos y se separan lo que
   un objeto alto le tapa al de atrás: `altura × cos(azimut) / tan(elevación)`. La cámara por defecto de cada reparto
   mira de frente y un poco de la izquierda, de modo que se ven el frente y el costado por donde entran las flechas.
5. **Rutas ortogonales sobre el piso.** Dijkstra sobre una cuadrícula dispersa (bordes y centros de los nodos y el medio
   de cada pasillo, desplazado hacia la parte que se ve): cada giro, cada tramo ya usado y cada cruce cuestan; las cintas
   que comparten origen o destino **y se dibujan igual** se juntan en un tronco. A la herencia se le obliga a entrar por
   el frente del padre y al rombo a salir por el del todo, que son los lados visibles. Los tramos se dibujan como cajas
   que no se encimen, y lo que se cruza por naturaleza (dos cintas, una punta sobre su cinta) va con `mount`.
6. **Extremos UML como piezas del piso:** triángulo hueco (herencia, realización con cinta punteada), rombo lleno o hueco
   (composición, agregación), punta (flecha, dependencia punteada), con multiplicidades y rótulos de pie junto a la
   cinta. Los rótulos esquivan a los objetos y a lo que estos tapan.
7. **Los flujos son `tracks`.** Un paquete por recorrido, parejos a `every` segundos, que sigue la cinta de cada tramo
   y **se apaga mientras pasa por dentro de un objeto** (`hide`). Un flujo sobre un par sin enlace crea la cinta que
   falta.
8. **`tracks` en la spec y en el runtime:** `{ group, path, period, delay?, loop?, hide? }`. El build calcula el arco
   acumulado; el runtime solo interpola y lleva su reloj dentro del `bindModel`, con o sin modelo propio. Respeta la
   pausa y, con movimiento reducido, deja cada grupo a mitad de camino. Costo: **+207 B gzip** (3458 → 3665 B).
9. **La letra se ajusta sola.** El compilador busca el menor tamaño de rótulo con el que todo mide ~10 px en la vista
   ampliada (el `viewBox` a 1150 px de ancho), que es lo que mide `label-unreadable`; si no cabe (demasiados nodos para
   una figura) lo dice con `map-label-small` en vez de entregar letra ilegible.
10. **Piezas del piso (`ground`).** Las bandejas y las cintas se pintan primero, de abajo hacia arriba y de lejos a
    cerca, y lo que viaja por un recorrido se pinta al final. Sin esto, un mapa denso daba decenas de órdenes ambiguos
    entre cintas, puntas y objetos que se solapan en pantalla sin tocarse.
11. **Color con las garantías de la paleta.** Las cintas y las puntas no se pintan (tonos neutros); solo el rombo lleno
    lleva el acento; los paquetes usan el acento o el color de un rol que ya está en el mapa. Así un mapa con cuatro o
    cinco roles pasa `isofig check --strict` y el color nunca es el único portador del significado: cada objeto tiene su
    forma y su nombre, y la leyenda lista los colores, los flujos y las puntas que aparecen.
12. **Importadores sobre el mismo compilador.** `fromCompose` deja de tener su reparto de racks y arma un mapa;
    `fromMermaid` (flowchart y classDiagram) también. El rótulo manda sobre la forma: «Postgres» es una base de datos
    aunque Mermaid lo dibuje con un rectángulo.

## Consecuencias

- Un mapa de 14 objetos, 21 enlaces y 2 flujos cabe en 1,6 KB de JSON y compila a 154 KB de SVG (31 KB gzip); el del
  pedido (7 objetos) pesa 20 KB y el UML (8 clases) 22 KB. Un mapa pesa más que una máquina por lo mismo que se lee mejor:
  cada objeto son 8–15 piezas.
- El compilador entra en el núcleo (`isofig`), **no** en el giro: `assembleTree` compila el mapa solo si recibe
  `resolveMap` (lo ponen `renderFigure`, `<Figure>` y la CLI), y el giro recibe la spec ya armada, como con cualquier
  árbol (ADR 0002). Con el compilador dentro del giro, este crecía de 12,2 a 27,7 KB gzip para todas las figuras. Lo
  que viaja con `<Figure orbit>` es el árbol armado: 7,6 KB gzip la tienda, 4,5 el pedido y 5,6 el UML.
- La vista de un mapa denso a 390 px no se lee (los rótulos miden ~3 px): se leen con el chip «Ampliar», y por eso la
  medida es la de la vista ampliada.
- Lo que no resuelve: más de ~20 nodos en una figura (la letra o el tamaño ceden: conviene partir el mapa), cintas que
  tienen que cruzarse (se cruzan, sin puente), `RL` y `BT` de Mermaid (se dibujan como `LR` y `TD`) y un orden de pintado
  que, por ser el de reposo, puede dejar un paquete delante de un objeto que lo tapa de verdad (se pinta siempre encima,
  y se apaga dentro de los objetos para que no los atraviese).
