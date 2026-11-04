# Estilo de lujo

`isofig/themes/luxe.css` es un estilo **opcional** para las figuras: sobrio y caro, como la esfera de un reloj suizo o el
folleto de un auto de competición. No cambia nada hasta que lo activas, no usa fuentes web ni servicios externos y pesa
**1,7 KB** (minificado y con gzip; 10 KB en el archivo). Tiene dos variantes que siguen al tema como el estándar:

| Variante | Cuándo | Qué es |
|---|---|---|
| **Atelier** | claro | Papel marfil, tinta espresso, cantos de grafito fino y acento de latón. |
| **Nocturne** | oscuro | Laca negra profunda, cantos de champán en línea fina y acento de oro. |

El lujo no cuesta legibilidad: las garantías de la paleta (texto ≥ 4,5:1, cantos ≥ 3:1, ΔE entre pinturas también con
daltonismo) se siguen cumpliendo con estos colores y una prueba las comprueba (ver más abajo).

## Activarlo

Carga la hoja **después** de `theme.css` y pon la clase `isofig-luxe` en la figura o en cualquier ancestro:

```astro
---
import "isofig/theme.css";
import "isofig/themes/luxe.css";
---
<body class="isofig-luxe">          <!-- todas las figuras de la página -->
  <Figure spec={spec} />
</body>
```

```html
<figure class="isofig isofig-luxe" data-isofig="…">…</figure>   <!-- solo esta -->
```

- **Va después de `theme.css`.** Las reglas de lujo tienen la misma especificidad que las del tema y ganan por orden. Si
  la hoja llega antes, no se aplica y la figura se ve estándar.
- **Sigue al tema.** Con `prefers-color-scheme: dark` o con `data-theme="dark"` en `<html>` sale Nocturne;
  `data-theme="light"` fuerza Atelier. La clase puede ir también en `<html>`.
- **El diálogo «Ampliar» lo hereda**, porque vive dentro de la figura.
- Sin la clase la hoja no hace nada, y el SVG es el mismo con o sin ella: es solo CSS.

## Qué cambia

- **La tarjeta:** un resplandor tenue arriba a la izquierda, viñeteado en las esquinas y un filo de línea fina por dentro
  (pintura de fondo y sombra interior: no cambia el tamaño). El radio sube a 22 px.
- **El título** en el serif del sistema (`ui-serif`, `"New York"`, `"Iowan Old Style"`, `Georgia`), con un rombo del
  acento delante; en una tarjeta estrecha (menos de 26 rem) baja un punto y el rombo se va. Lo mismo en el diálogo de
  «Ampliar» y en la leyenda (`figcaption`). La **lectura** sigue en mono con `tabular-nums` (y ceros con barra).
- **Los cantos** de las piezas, en línea más fina (0,6 en vez de 0,7): grafito en Atelier, champán en Nocturne.
- **Los chips y los controles:** píldora con un hilo de línea, aro de foco del color del acento y pulgar del deslizante
  de oro, con luz arriba a la izquierda, sobre un riel de un hilo. El área táctil sigue siendo de 24 px. Un grupo
  largo de opciones (la lista «Pieza» de un despiece) se parte en líneas con esquinas de 20 px, no como un óvalo.
- **Los materiales**, más ricos: el cobre quema, la laca es de color vino, el acero tira a azul, el latón es satinado.
  Las caras se sombrean con una luz y una sombra cálidas, no grises.
- **Contraste forzado** (`forced-colors`): sin sombras ni degradados, el hilo pasa a ser un borde de verdad.

## Variables

Todas van en `:where()` (especificidad 0), como las de `theme.css`: una regla tuya con una clase (`.isofig { … }`),
escrita **después** de `luxe.css`, les gana. Las reglas de la tarjeta y de los controles tienen especificidad 0,1,0, la
misma que `theme.css`.

Los tokens del tema que redefine (ver [tema.md](tema.md) para qué pinta cada uno):

| Variable | Atelier (claro) | Nocturne (oscuro) |
|---|---|---|
| `--isofig-paper` | `#f3ecde` | `#0a090b` |
| `--isofig-card` | `#faf7ee` | `#131215` |
| `--isofig-ink`, `--isofig-ink-soft` | `#2a1e18`, `#6a5948` | `#f2e9d6`, `#b8aa90` |
| `--isofig-edge` | `#2f2b27` | `#d8c79b` |
| `--isofig-lo`, `--isofig-mid`, `--isofig-hi` | `#e3d9c3`, `#eee6d3`, `#fffcf2` | `#19181b`, `#222024`, `#2e2b31` |
| `--isofig-accent` | `#ad811f` (latón) | `#e2bc5f` (oro) |
| `--isofig-light`, `--isofig-shade` | `#fffdf6`, `#85755f` | `#58525a`, `#000000` |
| `--isofig-chip`, `--isofig-halo` | `#efe7d5`, `#3a2a1c24` | `#1f1d22`, `#000000b3` |
| `--isofig-ok`, `--isofig-warn`, `--isofig-fail` | `#19966e`, `#f79c40`, `#b71a18` | `#62d0a4`, `#f38835`, `#fc7b6f` |
| `--isofig-ink-on-color`, `--isofig-on-accent` | `#1f150e` | (la misma) |
| `--isofig-focus` | el acento | el acento |
| `--isofig-radius` | `22px` | (el mismo) |

Y las que añade, que solo existen con el estilo:

| Variable | Qué es |
|---|---|
| `--isofig-luxe-serif` | La pila de fuentes del título y la leyenda. |
| `--isofig-luxe-line` | El hilo: filo de la tarjeta, de los chips y de los controles. |
| `--isofig-luxe-track` | El riel del deslizante. |
| `--isofig-luxe-glow` | El resplandor de arriba a la izquierda de la tarjeta. |
| `--isofig-luxe-sheen` | El brillo de una línea en el borde superior de la tarjeta. |
| `--isofig-luxe-vignette` | El oscurecimiento de las esquinas. |

El acento no es el verde del tema estándar, y eso tiene una consecuencia: los estados (`ok`, `warn`, `fail`) y los
materiales dorados no pueden parecérsele. Por eso lujo mueve el latón (de dorado vivo a latón satinado), el amarillo de
`data` en oscuro y el naranja de `warn`.

### Materiales

La tinta del texto grabado es espresso o marfil, no gris; y cambian los colores:

| Material | Claro | Oscuro |
|---|---|---|
| `aluminium` | `oklch(91% .008 250)` | `oklch(82% .008 246)` |
| `steel` | `oklch(69% .035 245)` | `oklch(58% .035 240)` |
| `iron` | `oklch(50% .015 245)` | `oklch(45% .012 246)` |
| `copper` | `oklch(53% .12 42)` | `oklch(54% .11 40)` |
| `brass` | `oklch(84% .09 96)` | `oklch(70% .095 93)` |
| `rubber` | `oklch(21% .008 60)` | `oklch(20% .006 66)` |
| `carbon` | `oklch(37% .03 262)` | `oklch(31% .03 255)` |
| `glass` | `oklch(80% .06 205)` | `oklch(73% .07 195)` |
| `lacquer` | `oklch(41% .14 22)` | `oklch(44% .15 24)` |

De los roles de los mapas solo cambia `data` en oscuro (`oklch(90% .045 92)`, arena clara): el amarillo de siempre se
confundiría con el oro del acento. El resto se queda como en `theme.css`.

## Garantías

`test/luxe.test.ts` lee `luxe.css`, resuelve la cascada con `theme.css` (Atelier vale en los dos modos; Nocturne lo pisa
en oscuro) y mide con las funciones de `src/core/palette`. Lo medido hoy, en el peor caso:

| Qué | Mínimo exigido | Atelier | Nocturne |
|---|---|---|---|
| Texto grabado sobre la tapa (materiales / roles) | 4,5:1 | 4,78 / 8,81 | 4,52 / 5,24 |
| Tinta declarada de cada pintura sobre su tapa | 4,5:1 | 4,78 | 4,52 |
| Canto frente a papel y tarjeta (materiales / roles) | 3:1 | 3,35 / 3,21 | 3,34 / 3,79 |
| ΔE entre pinturas, visión típica (materiales / roles) | 10 | 11,7 / 10,1 | 11,1 / 11,8 |
| ΔE entre pinturas, con daltonismo (materiales / roles) | 6 | 7,1 / 6,5 | 6,6 / 7,0 |
| Cada pintura frente al acento, visión típica | 10 | ≥ 10 | ≥ 10 |
| Tinta sobre el acento, en la tapa y en el selector marcado | 4,5:1 | 8,78 y 5,07 | 5,85 y 9,89 |
| Tinta sobre `ok`, `warn`, `fail` | 4,5:1 | 6,33 o más | 4,64 o más |
| Acento frente a `ok`, `warn`, `fail` (típica / daltonismo) | 10 / 6 | 15 / 8,5 | 11,9 / 7,7 |
| Tinta y tinta suave sobre tarjeta, papel y chip | 7:1 y 4,5:1 | 13,8 y 5,4 | 15,5 y 7,3 |
| Acento (aro de foco, pulgar) frente a la tarjeta y el papel | 3:1 | 3,30 y 3,01 | 10,3 y 11,0 |

Las pruebas son **todos contra todos**, con protanopía, deuteranopía y tritanopía simuladas (Machado, Oliveira y
Fernandes 2009), igual que las del tema estándar. La prueba también exige que cada selector de `luxe.css` empiece por
`:where(` y que no haya `@import`, `url()` ni `@font-face`.

## Derivar un estilo propio

`luxe.css` es una receta, no un caso especial: cualquier estilo con la misma forma funciona igual.

```css
/* mi-estilo.css: se carga después de theme.css */

/* Claro: vale en los dos modos; el oscuro lo pisa */
:where(.mi-estilo .isofig, .isofig.mi-estilo) {
  --isofig-paper: #…;  --isofig-card: #…;  --isofig-ink: #…;  --isofig-ink-soft: #…;
  --isofig-edge: #…;   --isofig-lo: #…;    --isofig-mid: #…;  --isofig-hi: #…;
  --isofig-accent: #…; --isofig-light: #…; --isofig-shade: #…;
  --isofig-chip: #…;   --isofig-halo: #…;  --isofig-ink-on-color: #…; --isofig-on-accent: #…;
  --isofig-ok: #…;     --isofig-warn: #…;  --isofig-fail: #…;
}

/* Oscuro: las dos formas del tema (preferencia del sistema y data-theme) */
@media (prefers-color-scheme: dark) {
  :where(:root:not([data-theme="light"]) :is(.mi-estilo .isofig, .isofig.mi-estilo)) { /* … */ }
}
:where(:root[data-theme="dark"] :is(.mi-estilo .isofig, .isofig.mi-estilo)) { /* … */ }

/* Lo que no son tokens, con :where() para no subir la especificidad */
:where(.mi-estilo) .isofig-card { box-shadow: …; }
```

1. **Un ámbito:** una clase tuya (como `isofig-luxe`) en la figura o en un ancestro, para que el estilo sea opcional.
2. **Tokens en `:where()`** y la hoja **después** de `theme.css`. Define los dos modos con tres reglas: claro, `@media
   (prefers-color-scheme: dark)` con `:not([data-theme="light"])` y `[data-theme="dark"]`, como arriba. Si solo te
   importa un modo, define uno.
3. **Ancestros y la propia figura:** `:where(.mi-estilo .isofig, .isofig.mi-estilo)`. Si la clase puede ir en `<html>`,
   añade `:root.mi-estilo:not([data-theme="light"]) .isofig` en la regla del oscuro, como hace `luxe.css`.
4. **No inventes colores de más:** con `--isofig-accent` basta para el sujeto. Un acento dorado exige apagar los
   materiales y roles dorados, y uno azul, los azules. Si cambias el acento, repasa `ok`, `warn` y `fail`.
5. **Materiales propios:** `--isofig-paint-<nombre>` con `light-dark()` y su `--isofig-paint-<nombre>-ink` (ver
   [color.md](color.md)). Elige tinta oscura o clara según la tapa: la tapa es el color mezclado un 40 % con
   `--isofig-light`.
6. **Mídelo.** En un clon del repositorio, copia `test/luxe.test.ts` y cambia la ruta y los selectores: lee un CSS,
   resuelve la cascada y mide con `measureSet(set, modo, reservados, tema)` de `src/core/palette`, que acepta los
   colores de tu tema como cuarto argumento (`paper`, `card`, `edge`, `light`, `shade`, `accent`, `ok`, `warn`,
   `fail` y, si cambias las tintas, `inks`). `isofig palette --report` mide el tema estándar y los roles de tu marca,
   no un estilo propio.

Pruebas rápidas antes de medir: el texto de 0,8 rem sobre la tarjeta necesita 4,5:1 (`--isofig-ink-soft`), el aro de
foco y el canto, 3:1 frente a la tarjeta **y** al papel (el diálogo de «Ampliar» usa el papel), y la tinta sobre el
acento, 4,5:1 contra la tapa del acento (mezclada con la luz) y contra el acento liso (el selector marcado).

## La galería y las capturas

```sh
npm run gallery        # examples/galeria/index.html
PLAYWRIGHT_PATH=…/node_modules/playwright npm run screenshots   # docs/assets/*.png
```

- `scripts/galeria.mjs` genera **un solo HTML** con todas las figuras de `examples/*/spec.*` (y su modelo, si hay un
  `model.ts` al lado), el runtime, el zoom y el giro empaquetados en línea con esbuild; los `import()` dinámicos
  quedan dentro del archivo como inicializaciones diferidas, así que el giro solo corre al tocar una figura. Las specs
  anidadas (`motor-v8`, `motor-cohete`) traen su «Desarmar» y su lista de piezas. Funciona sin servidor y sin red:
  ábrelo con doble clic. Tiene interruptores de estilo (estándar o lujo) y de tema (claro u oscuro);
  `?style=std&theme=dark` los fija desde la URL y `--lang en` lo genera en inglés. El archivo está en `.gitignore`.
- `scripts/capturas.mjs` saca un PNG por ejemplo, estilo y tema en `docs/assets/`: `<ejemplo>-<tema>.png` para el
  estándar y `<ejemplo>-luxe-<tema>.png` para el de lujo. Cada figura sale con 5 s ya simulados y movimiento reducido,
  así que dos ejecuciones dan la misma imagen. Playwright no es dependencia: se le pasa la ruta (`ISOFIG_CHROME`
  elige otro Chromium). Con `ffmpeg` en el PATH, los PNG se reducen a una paleta de 256 colores y pesan la mitad.
