# isofig

**Máquinas, mapas y diagramas 3D interactivos en SVG puro. Sin WebGL. Sin renders. Sin imágenes.**

Describe una máquina, una red o un modelo UML en JSON (anidado). isofig lo dibuja en 3D isométrico al compilar, le da
vida con un runtime de 4,2 KB, lo desarma pieza por pieza y acerca la cámara a la pieza que elijas, sin que escribas
una sola función. No es solo para software: el mismo JSON dibuja un auto o un esqueleto. Trae adaptadores para Astro y
Angular, y un plugin de Claude Code que escribe las figuras, las valida y las mira por ti.

[English](README.md) · [Más allá del software](#más-allá-del-software) · [Galería](#galería) · [Inicio rápido](#inicio-rápido) ·
[Plugin de Claude Code](#plugin-de-claude-code) · [Documentación](#documentación) · [Créditos](NOTICE.md)

<p align="center">
  <img src="docs/assets/motor-v8-luxe-dark.png" width="32%" alt="Un motor V8 de competición, armado, sobre su soporte de taller">
  <img src="docs/assets/motor-v8-luxe-dark-half.png" width="32%" alt="El mismo V8 a mitad del despiece: caja de aire, tapas y árboles de levas levantados">
  <img src="docs/assets/motor-v8-luxe-dark-exploded.png" width="32%" alt="El V8 desarmado del todo: culatas, bloque, cigüeñal, ocho pistones y bielas">
</p>

<p align="center"><sub><code>examples/motor-v8/spec.json</code>: 215 piezas en JSON puro, <b>16,6 KB gzip</b> la figura
entera. El control «Desarmar», la lista de piezas y la lectura de cada paso salen del anidamiento del JSON: no hay
modelo ni código. Se muestra con el <a href="docs/es/lujo.md">estilo de lujo</a> opcional.</sub></p>

---

## Por qué isofig

Un diagrama de cajas y flechas dice *qué* tiene un sistema. Una máquina muestra *cómo funciona*: ves un fallo de caché
bajar hasta la base de datos, empujas el tráfico y la compuerta empieza a rechazar, desarmas el motor y ves qué hay
bajo las culatas. isofig hace que esas máquinas cuesten tan poco que se pueden poner en cada página de un curso, de
una documentación o de una landing.

| | |
|---|---|
| **Sin renders ni WebGL** | La figura es SVG generado al compilar a partir de geometría 3D. No hay nada que renderizar, grabar ni alojar. |
| **Ligera** | Runtime de 4,2 KB gzip. Una figura completa pesa de 7 a 34 KB gzip. El giro (9,1 KB) y el diálogo «Ampliar» (0,8 KB) se descargan solo cuando alguien los usa. |
| **Funciona sin JavaScript** | La página ya trae el dibujo. Con JS se anima; sin JS sigue siendo una figura. |
| **La leen buscadores y lectores de pantalla** | Títulos, rótulos y descripciones son texto real en el HTML, no píxeles de un video. |
| **Accesible de serie** | Botón de pausa, controles nativos, `prefers-reduced-motion` (seguido en vivo), región viva cortés, diálogo «Ampliar» con foco atrapado y contraste medido en cada color. |
| **Las figuras son datos** | Una spec tipada o JSON puro. Se lee bien en un diff de git, se revisa en un pull request y la puede escribir una persona o una IA. |
| **Validada** | `isofig check` encuentra referencias rotas, valores fuera de su paso, controles que no hacen nada, rótulos demasiado pequeños y colores que no se distinguen, cada uno con su ruta en el JSON y un código estable. |

### Cómo se compara

Medido, no supuesto: el peso es el JavaScript minificado y con gzip que cada opción manda al navegador.

| | isofig | Three.js / WebGL | Render en video o GIF | Mermaid | Lottie |
|---|---|---|---|---|---|
| JS que llega al navegador | **4,2 KB** de runtime | 167 KB (solo el núcleo) | nada, pero megabytes de video | 726 KB | 74 KB |
| Muestra algo sin JS | **Sí** | No | Sí | No | No |
| Texto indexable y que se lee en voz alta | **Sí** | No | No | Sí | No |
| El lector puede jugar con ella | **Sí**: deslizantes, interruptores, desvíos, despiece | Sí, si lo programas | No | No | No |
| Acercarse a una pieza del modelo | **Sí**: eliges un nombre y la cámara va hacia ella | Sí, si lo programas | Solo lo que hayas renderizado | No | No |
| Fuente que se puede comparar y revisar | **JSON** | Código | Binario | Texto | JSON exportado |
| Cámara libre, iluminación real | Giro arrastrando o por pasos, sombreado plano | **Sí** | Lo que hayas renderizado | No | No |

isofig no es un motor 3D: para cámara libre, física o fotorrealismo, usa Three.js. isofig es para **explicar**: una
figura que carga al instante, se lee como una ilustración y deja que el lector rompa el sistema a propósito.

---

## Qué lo hace distinto

1. **El objeto es la explicación.** Un limitador de tasa es un tubo de fichas con una compuerta. Una caché es una
   cerradura de pines. Una cola es una cinta transportadora. Una clase es un archivador con cajones. isofig está hecho
   para objetos reales y reconocibles, no para cajas flotantes.
2. **El JSON anidado te da el despiece gratis.** Escribe el motor como un árbol (bloque → bancadas → culatas →
   válvulas) y ponle `explode` a los nodos. isofig añade un control «Desarmar» por pasos, una lista de piezas y una
   lectura en cada paso. [Guía](docs/es/anidar.md).
3. **Eliges una pieza y la cámara va hacia ella.** En una figura que se desarma, cada nodo con nombre es una entrada de
   la lista «Pieza». Elige una y la vista viaja hasta ella con una animación, la pieza se pinta delante de todo (aunque
   esté dentro de otra), lo demás queda al 35 % para que no pierdas la orientación y su nota aparece en la lectura.
   «Todo» vuelve al encuadre completo, y el acercamiento sigue a la pieza cuando desarmas la figura o la giras. No
   escribes código de cámara: sale del `name` de tus nodos. [Guía](docs/es/anidar.md#el-despiece).
4. **Mapas hechos de objetos.** Topologías, mapas de flujo y diagramas de clases UML, con celulares, racks, bases de
   datos como pilas de discos, colas como cintas y paquetes que recorren las rutas. Se importan desde Mermaid o desde
   `docker compose`. [Guía](docs/es/mapas.md).
5. **Color con garantías.** Siete roles para mapas y nueve materiales para máquinas (acero, cobre, laca, carbono…),
   en OKLCH, con garantías medidas en claro y oscuro: texto grabado ≥ 4,5:1, cantos ≥ 3:1 y cualquier par de colores
   distinguible, también con protanopía, deuteranopía y tritanopía. Se derivan de tu color de marca con un comando.
   [Guía](docs/es/color.md).
6. **«Prueba a romperlo».** Los desvíos fijan varios controles a la vez (y pueden pulsar botones), así el lector ve
   la falla de la que trata la lección: salta el breaker, la cola se desborda, la réplica se atrasa.
7. **Una IA que dibuja y después mira.** El plugin de Claude Code inventa la máquina, escribe la spec, corre
   `isofig check`, toma capturas a ancho de celular y de computadora en los dos temas, las mira y corrige.

---

## Más allá del software

El despiece no trata solo de código. Cualquier cosa hecha de piezas que encajan puede ser una figura isofig, con el
mismo control, la misma lista de piezas y el mismo acercamiento. El repositorio trae dos demostraciones de fuera del
software, las dos en JSON puro con nombres y notas en español e inglés.

<p align="center">
  <img src="docs/assets/muscle-car-luxe-dark.png" width="32%" alt="Un muscle car tipo Camaro, armado: capó largo, cabina baja, carrocería roja con franjas plateadas">
  <img src="docs/assets/muscle-car-luxe-dark-pick.png" width="32%" alt="El mismo auto con el motor V8 elegido: la cámara se acerca al motor y la carrocería se vuelve transparente a su alrededor">
  <img src="docs/assets/muscle-car-luxe-dark-exploded.png" width="32%" alt="El auto desarmado del todo: capó, puertas, vidrios y carrocería arriba, luego asientos, motor, tren motriz y ruedas, hasta dejar el chasis solo">
</p>

<p align="center"><sub><code>examples/muscle-car/spec.json</code>: un muscle car tipo Camaro, un esquema propio y sin logos.
13 piezas con nombre y 9 pasos, <b>27,4 KB gzip</b>. Salen primero el capó, las puertas y los vidrios; luego el interior
y el V8, y al final las ruedas con sus frenos, hasta dejar el chasis solo. Elige «Motor V8» y la cámara entra.</sub></p>

<p align="center">
  <img src="docs/assets/sistema-oseo-luxe-dark.png" width="32%" alt="Un esqueleto humano en posición anatómica sobre un soporte de exhibición">
  <img src="docs/assets/sistema-oseo-luxe-dark-pick.png" width="32%" alt="El mismo esqueleto con la pelvis elegida: la cámara se acerca a los dos coxales y al sacro, y lo demás se vuelve transparente">
  <img src="docs/assets/sistema-oseo-luxe-dark-exploded.png" width="32%" alt="El esqueleto desarmado en siete pasos: cráneo, brazos, caja torácica, pelvis y piernas se separan alrededor de la columna">
</p>

<p align="center"><sub><code>examples/sistema-oseo/spec.json</code>: el esqueleto humano, con una nota anatómica real en cada pieza
(un adulto tiene 206 huesos, y 106 están en las manos y los pies). 12 piezas con nombre y 7 pasos, <b>33,9 KB gzip</b>.
Es un esquema para enseñar, no un atlas médico. Elige «Pelvis» o «Mano» y lee su nota.</sub></p>

Dónde encaja:

| Rubro | Qué dibujarías | Qué recibe el lector |
|---|---|---|
| **Talleres y manufactura** | Un motor, una caja de cambios, una bomba, una máquina herramienta, una secuencia de ensamblaje | Un manual o un catálogo de repuestos que se maneja: se desarma en el orden en que se desarma lo real y se acerca a la pieza que hay que cambiar |
| **Medicina y anatomía** | Un esqueleto, una articulación, un sistema de órganos | Una ayuda de estudio donde cada nombre trae su nota, y elegir «Pelvis» lleva al estudiante hasta ella |
| **Química** | Átomos y moléculas | `sphere` para los átomos y `capsule` para los enlaces, los dos sólidos nuevos de la 0.10. Todavía no hay una molécula de ejemplo |
| **Educación** | Una célula, una flor, una cámara, una cerradura: lo que una clase desarma | Un JSON, un control y una lista de piezas a las que acercarse, sin un video que grabar ni alojar |

La receta es la misma que la del V8: un árbol de piezas con nombre, un `explode` en cada una y una `note` por entrada.
Las esferas y las cápsulas ([referencia de sólidos](docs/es/spec.md#piezas-sólidas)) te dan las piezas redondas que
necesitan los huesos y las articulaciones. Una buena entrada es una que vale la pena acercar: nombra una biela o una
tapa, no un tornillo. O pídele al plugin que lo dibuje por ti ([plugin](#plugin-de-claude-code)).

---

## Galería

| | |
|---|---|
| ![Una tienda en línea: celular y laptop, CDN, balanceador, tres servidores dentro de una VPC, Redis, Postgres con réplica, una cola y un worker que envía correos](docs/assets/mapa-tienda-light.png) | ![El dominio de una tienda en UML: cada clase es un archivador con sus atributos y métodos grabados en los cajones](docs/assets/mapa-uml-dark.png) |
| **Topología** · `examples/mapa-tienda` · dos flujos animados: una compra y un acierto de caché | **UML** · `examples/mapa-uml` · herencia, composición, multiplicidades; los cajones se abren con «Desarmar» |
| ![Un motor de cohete de combustible líquido con turbobomba, placa de inyectores, cámara de combustión y tobera](docs/assets/motor-cohete-luxe-light.png) | ![Un mapa de flujo de un pedido desde el carrito hasta el envío, con la rama de pago rechazado](docs/assets/mapa-pedido-light.png) |
| **Ensamblaje** · `examples/motor-cohete` · turbobomba, inyectores, cámara, tobera y cardán | **Mapa de flujo** · `examples/mapa-pedido` · carrito, pago, stock, cola, correo y envío |
| ![Un limitador de tasa de balde de fichas como un tubo de fichas, un dispensador y carritos ante una compuerta](docs/assets/token-bucket-light.png) | ![Un stack de docker compose de cinco servicios dibujado como mapa](docs/assets/compose-light.png) |
| **Máquina con modelo** · `examples/token-bucket` · 40 piezas, 7,3 KB gzip | **Importado** · `examples/compose` · desde `docker compose config --format json` |

Hay más en [Más allá del software](#más-allá-del-software): un muscle car y un esqueleto humano. `npm run gallery` junta
todos los ejemplos en un solo HTML que funciona sin conexión, en los dos estilos y los dos temas.

---

## Inicio rápido

### 1. Instalar

```sh
npm i github:ACHAVESTA-Git/ISOFIG
```

Node 22.18 o superior. El paquete se compila solo al instalarse. (`npm i isofig` cuando esté en el registro de npm).

### 2. Escribir una figura en JSON

```json
{
  "id": "caja-con-tapa",
  "title": { "es": "Una caja con tapa", "en": "A box with a lid" },
  "root": {
    "id": "caja",
    "parts": [{ "id": "base", "kind": "box", "at": [0, 0, 0], "size": [60, 60, 20], "radius": 4, "paint": "steel", "shadow": true }],
    "children": [{
      "id": "tapa", "name": { "es": "Tapa", "en": "Lid" }, "at": [0, 0, 20], "explode": [0, 0, 30],
      "parts": [{ "id": "losa", "kind": "box", "at": [0, 0, 0], "size": [60, 60, 6], "radius": 4, "paint": "lacquer" }]
    }]
  }
}
```

### 3. Validarla y verla

```sh
npx isofig check caja.json --strict
npx isofig build caja.json --format page --lang es -o caja.html   # abre caja.html: el control «Desarmar» ya está ahí
```

### 4. Ponerla en una página

**Astro**

```astro
---
import Figure from "isofig/astro";
import caja from "../figuras/caja.json";
---
<Figure spec={caja} lang="es" orbit />
```

El CSS del tema va en línea, una sola vez y solo en las páginas que dibujan una figura. El runtime, el modelo, el giro
y el diálogo «Ampliar» se descargan cuando el lector se acerca o los usa. [Guía de Astro](docs/es/astro.md).

**Angular 19+** (standalone, signals, zoneless)

```sh
npx isofig add angular src/app/isofig
npx isofig build figuras/caja.json --format module -o src/app/figuras/caja.figure.ts
```

[Guía de Angular](docs/es/angular.md).

**Cualquier otro sitio**: `isofig build --format html` te da el marcado `<figure>`. Carga `isofig/theme.css` y llama a
`mountAll()` de `isofig/runtime`.

---

## Los cuatro tipos de figura

| Quieres mostrar… | Escribe | Guía |
|---|---|---|
| Un mecanismo que corre en el tiempo (un limitador, una caché, reintentos con espera) | `parts` y un **modelo** puro pequeño | [spec.md](docs/es/spec.md) |
| Algo que se mueve con un control, sin lógica | `parts` con `bind` o `tracks` | [spec.md](docs/es/spec.md) |
| Cómo está hecha una cosa (un motor, un auto, un esqueleto, un servidor) | un **`root`** anidado con `explode` | [anidar.md](docs/es/anidar.md) |
| Cómo se conectan las cosas (una red, un flujo, un modelo de dominio) | un **`map`** | [mapas.md](docs/es/mapas.md) |

### Un mapa en una docena de líneas

```json
{
  "id": "mapa-minimo",
  "title": { "es": "Un pedido", "en": "An order" },
  "map": {
    "nodes": [
      { "id": "web", "is": "browser", "name": "Tienda" },
      { "id": "api", "is": "service", "name": "API" },
      { "id": "db", "is": "database", "name": "Postgres" }
    ],
    "links": [{ "from": "web", "to": "api", "label": "pedido" }, { "from": "api", "to": "db" }],
    "flows": [{ "path": ["web", "api", "db"], "label": "un pedido" }]
  }
}
```

¿Ya tienes Mermaid? `npx isofig import mermaid diagrama.mmd -o mapa.json`.

### Un modelo en pocas líneas

```ts
import type { Model } from "isofig/runtime";

const balde: Model<{ fichas: number }, { recarga: number }> = {
  init: () => ({ fichas: 8 }),
  step: (s, dt, p) => ({ fichas: Math.min(8, s.fichas + p.recarga * dt) }),
  view: (s, _p, ctx) => {
    if (s.fichas < 1) ctx.say("El balde está vacío: se rechazan peticiones");
    return { readout: `${Math.floor(s.fichas)}/8 fichas`, groups: { compuerta: { s: s.fichas < 1 ? "fail" : "ok" } } };
  },
};
export default balde;
```

Los modelos son funciones puras. El runtime se encarga del reloj, de pausar fuera de pantalla, del movimiento reducido
(`motion.settle`), de los anuncios sin repetir (`ctx.say`) y de los botones (`ctx.pressed`).

---

## Color

```jsonc
{ "id": "tubo", "kind": "cylinder", "paint": "copper" }  // un material, en una pieza o un nodo
{ "id": "db", "is": "database", "paint": "data" }        // un rol, en un nodo de mapa
```

```sh
npx isofig palette --base "#e2231a" --report   # roles derivados de tu color de marca, con la tabla de contraste
```

El tono `lit` sigue siendo el único acento fuerte de una figura. `check` avisa cuando una figura usa más de seis
colores, cuando dos no se distinguen o cuando el texto grabado no tiene contraste. [Guía de color](docs/es/color.md) ·
[Guía de tema](docs/es/tema.md).

### Estilo de lujo (opcional)

```js
import "isofig/theme.css";
import "isofig/themes/luxe.css";
```

```html
<div class="isofig-luxe">… tus figuras …</div>
```

*Atelier* (marfil cálido, tinta espresso, latón) en modo claro y *Nocturne* (laca negra, filetes champán, oro) en
modo oscuro. 1,7 KB gzip, sin fuentes web y con las mismas garantías de contraste y daltonismo. [Guía](docs/es/lujo.md).

---

## Plugin de Claude Code

```sh
claude plugin marketplace add ACHAVESTA-Git/ISOFIG
claude plugin install isofig@isofig
```

Después pide, en el idioma que quieras:

```text
/isofig:isofig explica cómo funciona un circuit breaker, interactivo, para nuestra documentación en Astro
/isofig:isofig dibuja nuestro checkout como un mapa de topología con el flujo de compra
/isofig:isofig un motor de cohete que pueda desarmar pieza por pieza
/isofig:isofig un esqueleto humano que pueda desarmar, con una nota en cada pieza
```

La skill elige el tipo de figura (o te dice cuándo isofig no es la herramienta), inventa el objeto, escribe la spec y
el modelo, corre `isofig check --model --presets --strict`, toma capturas a 390 y 1280 px en claro y oscuro, las mira
y corrige. En un ensamblaje, además, le da a cada entrada de la lista «Pieza» algo que vale la pena acercar, y conoce el
auto y el esqueleto como figuras de referencia. [Guía del plugin](docs/es/plugin.md).

---

## CLI

```text
isofig build <spec> [-o archivo] [--format html|module|json|page] [--lang es] [--model archivo] [--orbit]
isofig check <spec> [--lang en|es] [--strict] [--model archivo [--presets] [--seconds 12]]
isofig import compose <archivo.json|->      un mapa desde `docker compose config --format json`
isofig import mermaid <archivo.mmd|->       un mapa desde un flowchart o classDiagram de Mermaid
isofig palette [--base "#2fb58b"] [--format css|json] [--report]
isofig add angular <carpeta>
isofig --version
```

## Rendimiento

Minificado y con gzip, comprobado en cada push por `npm run size` contra `size-budget.json`:

| Pieza | Cuándo se carga | Peso |
|---|---|---|
| `isofig/runtime` | cuando el lector se acerca a una figura | 4,2 KB |
| `isofig/zoom` (diálogo «Ampliar») | al pulsar el chip | 0,8 KB |
| `isofig/orbit` (giro) | al usar un control de giro | 9,1 KB |
| `isofig/theme.css` | en línea, una vez por página con figura | 3,0 KB |
| `isofig/themes/luxe.css` | si lo importas | 1,7 KB |
| Una figura (SVG y datos) | en el HTML | 7–34 KB |

El núcleo (`isofig`), el kit y el compilador de mapas corren al compilar y no llegan al navegador.

## Accesibilidad

- Cada figura es un `<figure>` con un SVG `role="img"`, título y descripción; los mapas además describen en palabras
  sus objetos y enlaces.
- Controles nativos: `input[type=range]` con `aria-valuetext`, interruptores, grupos de opciones y botones.
- Movimiento: botón de pausa (WCAG 2.2.2), `prefers-reduced-motion` seguido en vivo y animación que se detiene fuera de
  pantalla. Con el movimiento reducido, la cámara salta a la pieza que eliges en vez de viajar.
- La lista de piezas es un grupo de opciones con su leyenda, y la lectura dice qué pieza está elegida.
- Anuncios por una región viva cortés, como máximo dos por interacción y nunca encima de la nota de un desvío.
- «Ampliar» abre un diálogo con foco atrapado donde los rótulos se leen a 11 px o más en un celular.
- Colores: texto ≥ 4,5:1, cantos ≥ 3:1, roles distinguibles con daltonismo, y el color nunca es lo único que lleva el
  significado (los mapas traen leyenda).

## Compatibilidad

Node 22.18+ · Astro 5 y 7 (compilados en el CI) · Angular 19+ · navegadores actuales (comprobado en Chromium y WebKit).

## Documentación

| Español | English |
|---|---|
| [Referencia de la spec](docs/es/spec.md) (sólidos, de la caja a la esfera y la cápsula) | [Spec reference](docs/en/spec.md) (solids from box to sphere and capsule) |
| [Anidar, desarmar y acercarse a una pieza](docs/es/anidar.md) | [Nested specs, teardown and zoom to a part](docs/en/nesting.md) |
| [Mapas: topologías, flujos y UML](docs/es/mapas.md) | [Maps](docs/en/maps.md) |
| [Color](docs/es/color.md) · [Tema](docs/es/tema.md) · [Lujo](docs/es/lujo.md) | [Color](docs/en/color.md) · [Theme](docs/en/theme.md) · [Luxe](docs/en/luxe.md) |
| [Kit de piezas](docs/es/kit.md) | [Kit of common parts](docs/en/kit.md) |
| [Validar](docs/es/validar.md) | [Validation](docs/en/validate.md) |
| [Astro](docs/es/astro.md) · [Angular](docs/es/angular.md) | [Astro](docs/en/astro.md) · [Angular](docs/en/angular.md) |
| [Importar](docs/es/importar.md) · [Plugin de Claude Code](docs/es/plugin.md) | [Importers](docs/en/import.md) · [Plugin](docs/en/plugin.md) |

Decisiones de diseño: [ADR 0001](docs/adr/0001-nucleo-ligero-y-especificacion-declarativa.md) (núcleo ligero, figuras
como datos), [ADR 0002](docs/adr/0002-especificacion-anidada-y-despiece.md) (spec anidada y despiece),
[ADR 0003](docs/adr/0003-mapas-con-objetos-reales.md) (mapas con objetos reales).

## Preguntas frecuentes

**¿Es 3D de verdad?** La geometría es 3D (cajas, cilindros, conos, prismas, esferas y cápsulas, en cualquier eje) y se
proyecta, se sombrea y se ordena en profundidad al compilar. Al girar la figura, el navegador la vuelve a dibujar desde otro
ángulo. No es una cámara 3D libre, y es a propósito: así la figura sigue ligera y se lee bien.

**¿Es solo para software?** No. El mismo JSON dibuja un auto o un esqueleto: mira
[Más allá del software](#más-allá-del-software). Cualquier cosa hecha de piezas que encajan, desde un motor hasta un
hueso, funciona igual.

**¿Tengo que programar el acercamiento a una pieza?** No. Sale del `name` de los nodos de una figura que se desarma: la
lista «Pieza» se arma con ellos y elegir uno lleva la cámara hasta él. Dale una `note` a cada entrada y la lectura la
muestra.

**¿Necesito un framework?** No. Astro y Angular tienen componentes; cualquier sitio puede usar el marcado `<figure>`
de `isofig build` y el runtime.

**¿Puedo usar los colores de mi marca?** Sí: sobrescribe las variables `--isofig-*` con una sola regla `.isofig { … }`,
o deriva los roles de los mapas de tu color con `isofig palette --base`.

**¿Qué tan grande puede ser un mapa?** Unos veinte nodos por figura se leen bien; si pasa de eso, `check` sugiere
partirlo.

**¿Una IA puede escribir las figuras?** Para eso está el plugin. Una figura es un dato con códigos de validación
estables, así que la IA puede revisar su propio trabajo y corregirlo.

## Hoja de ruta

- 1.0: los avisos marcados con ↑ en la [guía de validación](docs/es/validar.md) pasan a ser errores, y el paquete se
  publica en npm.
- Más objetos de mapa e importadores (OpenAPI, manifiestos de Kubernetes).
- Adaptadores para otros frameworks.

## Contribuir

```sh
npm ci
npm run check && npm test && npm run build && npm run size
```

Las instantáneas de cada ejemplo viven en `test/snapshots/`. Actualízalas con `UPDATE_SNAPSHOTS=1 npm test` cuando un
cambio en el dibujo sea a propósito.

## Créditos

Inspirado en [anatomy](https://github.com/wheresryan22/anatomy) de @wheresryan22 (MIT). No se copió código: se
reescribieron las ideas. Ver [NOTICE.md](NOTICE.md).

## Licencia

[MIT](LICENSE)
