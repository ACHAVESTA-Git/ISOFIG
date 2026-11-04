# Color

isofig dibuja casi todo en gris a propósito: el gris es estructura, y un solo acento (`tone: "lit"`) marca el sujeto.
Desde 0.9 una pieza puede llevar además una **pintura** (`paint`): un **material** para máquinas o un **rol** para
mapas. Los dos juegos vienen medidos: el texto grabado se lee, el canto se ve y dos colores del mismo juego se
distinguen también con daltonismo.

## Cuándo usar color y cuándo no

- **Pinta piezas, no el escenario.** La base, los rieles y los soportes se quedan en `lo` o `mid`. Una base grande
  pintada deslumbra en el tema oscuro y le quita protagonismo al sujeto.
- **Un solo acento.** `lit` sigue siendo el único color fuerte: el sujeto. Los roles son más sobrios que el acento
  (croma ≤ 0,09 frente a 0,13) para que el ojo vaya primero a lo que importa. `lit` gana sobre `paint`.
- **Los estados no son pintura.** `ok`, `warn` y `fail` los pone el modelo mientras corre y ganan sobre la pintura.
  Pintar con ellos da el aviso `paint-is-state`.
- **Seis colores como mucho.** Contando los roles, los materiales con color y el acento; los grises (aluminio, acero,
  hierro, carbono, goma, externo) cuentan como uno. Más de seis da `palette-too-many-colors`.
- **El color nunca va solo.** Rotula las piezas y, en un mapa, dibuja la leyenda con `legendOf(spec, lang)`. Con
  daltonismo el acento verde se parece a un gris claro: en una máquina el sujeto también se distingue por moverse.
- **Máquinas con materiales, mapas con roles.** No mezcles los dos juegos en una figura: `data` y `brass`, por
  ejemplo, son dorados en oscuro. Si los mezclas, `paint-indistinct` te lo dice.

## Cómo se pinta

```ts
{ id: "db", kind: "box", at: [0, 0, 6], size: [40, 30, 14], tone: "hi", paint: "data" }
```

La pieza lleva `data-paint="data"` en su `<g>` (o en su `<use>`) y toma el color de `--isofig-paint-data`. Las caras se
sombrean como siempre (`--ft`, `--f0`…), el canto se tiñe con la pintura y el texto grabado usa
`--isofig-paint-data-ink`, la tinta clara u oscura que contrasta con esa tapa. Sin `paint`, el SVG sale idéntico al de
0.8. En un árbol (`root`), los hijos heredan el `paint` de su nodo.

Los tokens están en `theme.css` con `light-dark()`, que sigue a `color-scheme`; el tema lo pone en `.isofig` con los
mismos selectores que el resto del modo oscuro. Para cambiar un color, redefine la variable:

```css
.isofig { --isofig-paint-data: light-dark(oklch(92% .07 95), oklch(78% .09 92)); }
```

**Pinturas propias.** Un nombre que no es de los juegos vale si está en `palette.use` y tu CSS define
`--isofig-paint-<nombre>` (y, si quieres, `--isofig-paint-<nombre>-ink`). La pieza lleva sus dos variables en línea.
isofig no puede medir sus garantías: mídelas con `isofig palette --report` sobre tu marca.

## Roles (mapas)

Categorías que deben distinguirse entre sí. Escalonadas en luminosidad: con una sola L, siete tonos se confunden en
deuteranopía (ΔE de 1 a 2). En oscuro un amarillo oscuro se vuelve oliva, así que `data` sube a oro con tinta oscura.

| Nombre | | Claro | Oscuro | Tinta (claro / oscuro) |
|---|---|---|---|---|
| `client` | cliente | `oklch(80% .075 250)` #99c2ed | `oklch(43% .085 248)` #25537c | oscura / clara |
| `edge` | borde | `oklch(69% .075 286)` #9795c8 | `oklch(32% .09 284)` #2f2a5e | oscura / clara |
| `compute` | cómputo | `oklch(89% .055 208)` #b1e6ee | `oklch(53% .085 200)` #167a7f | oscura / clara |
| `data` | datos | `oklch(93% .075 92)` #fae7af | `oklch(79% .09 90)` #d1b876 | oscura / oscura |
| `messaging` | mensajería | `oklch(77% .075 348)` #d9a1bd | `oklch(40% .09 354)` #6c314b | oscura / clara |
| `storage` | almacenamiento | `oklch(84% .075 56)` #f1bf9c | `oklch(52% .09 40)` #955640 | oscura / clara |
| `external` | externo | `oklch(63% .012 85)` #8c8981 | `oklch(26% .012 85)` #27241e | oscura / clara |

## Materiales (máquinas)

Se reconocen como en un taller: los grises por su luminosidad (aluminio, acero, hierro, carbono, goma), el cobre, el
latón y la laca por su tono, el vidrio por su tinte.

| Nombre | | Claro | Oscuro | Tinta (claro / oscuro) |
|---|---|---|---|---|
| `aluminium` | aluminio | `oklch(91% .006 250)` #dee2e5 | `oklch(82% .006 246)` #c1c4c8 | oscura / oscura |
| `steel` | acero | `oklch(71% .02 245)` #98a3ad | `oklch(58% .024 239)` #6e7d87 | oscura / clara |
| `iron` | hierro | `oklch(50% .012 240)` #5d646a | `oklch(45% .01 246)` #51565b | oscura / clara |
| `copper` | cobre | `oklch(60% .11 50)` #b46b40 | `oklch(56% .097 45)` #a36142 | oscura / clara |
| `brass` | latón | `oklch(80% .1 88)` #d9ba70 | `oklch(77% .085 90)` #c9b274 | oscura / oscura |
| `rubber` | goma | `oklch(23% .006 60)` #1f1c1a | `oklch(22% .005 66)` #1c1a18 | clara / clara |
| `carbon` | carbono | `oklch(37% .018 260)` #3a4049 | `oklch(33% .026 255)` #2c3643 | oscura / clara |
| `glass` | vidrio | `oklch(81% .05 200)` #9bcbce | `oklch(73% .065 195)` #76b5b4 | oscura / oscura |
| `lacquer` | laca | `oklch(52% .16 27)` #b33832 | `oklch(42% .128 29)` #852920 | oscura / clara |

## Garantías

Se miden en `src/core/palette` (sin dependencias, corre en el navegador) y las pruebas las exigen, en claro y en
oscuro:

| Qué | Mínimo | Cómo |
|---|---|---|
| Texto grabado sobre la tapa | 4,5:1 | Contraste WCAG 2 entre la tinta elegida y la tapa (el color aclarado un 40 % como `--ft`) |
| Canto frente al papel y a la tarjeta | 3:1 | WCAG 1.4.11: el canto es lo que dibuja la silueta |
| Dos pinturas del juego, visión típica | ΔE 10 | Distancia euclídea en OKLab ×100 |
| Dos pinturas del juego, con daltonismo | ΔE 6 | Igual, tras simular protanopía, deuteranopía y tritanopía (Machado, Oliveira y Fernandes 2009, severidad 1) |
| Cada rol frente al acento | ΔE 10 / 6 | Para que el sujeto no se confunda con una categoría |

ΔE se mide sobre el color de la pieza (`--c`, la cara lateral sin sombra); la tapa, aclarada un 40 %, conserva cerca
del 60 % de esa distancia. Un ΔE de 2 apenas se nota; de 6 en adelante se distingue con rótulos al lado, y de 10 en
adelante, de un vistazo. Todas las pruebas entre pares son **todos contra todos**, porque en un mapa cualquier rol
puede quedar junto a otro.

## Un color de marca: `palette.base`

```ts
palette: { base: "#3b82f6", use: ["client", "compute", "data"] }
```

Con `base`, los roles se derivan alrededor de ese color: el juego del tema girado en tono hasta que la base cae en el
hueco del acento, con la misma luminosidad y el mismo croma de cada rol. Si alguna garantía falla con ese giro, una
búsqueda determinista corre tonos (hasta ±45°), retoca L (hasta ±0,06) o intercambia la L o el tono de dos roles
hasta cumplir; misma base, mismos roles. Las variables salen en el `style` del `<figure>`, solo las de los roles que
la figura usa, con su valor claro y oscuro en `light-dark()`. Sin `base`, se usan los del tema. `use` fija también
el orden de la leyenda.

La base se toma como acento: en claro tal cual y en oscuro con la luminosidad del acento oscuro del tema. Los
materiales no cambian con la base. Una base pastel (L ≥ 0,8) puede no llegar a separar algún rol del acento; el aviso
`palette-roles-unmet` lo dice.

## `isofig palette`

```sh
isofig palette --base "#e4572e"                 # el bloque CSS de los roles, para pegar después de theme.css
isofig palette --base "#e4572e" --format json   # valores, tinta, contraste y vecinos más cercanos
isofig palette --base "#e4572e" --report        # además, la tabla de garantías por stderr
```

La tabla trae, por tema y por rol: el color, la tinta, el contraste del texto y del canto, la pintura más cercana con
su ΔE en cada visión y la distancia al acento; al pie, el peor valor de cada garantía. Sin `--base` usa el acento del
tema. Termina con código 1 si alguna garantía no se cumple.

## Avisos

| Código | Dónde | Qué |
|---|---|---|
| `paint-unknown` | `validateSpec` | La pintura no es de ningún juego ni está en `palette.use` (con «¿querías…?») |
| `paint-is-state` | `validateSpec` | Se pinta con `ok`, `warn` o `fail` |
| `palette-base-invalid`, `palette-use-invalid` | `validateSpec` | `base` no es un color; un nombre de `use` no sirve como nombre de variable |
| `palette-roles-unmet` | dibujo | Los roles derivados de `base` no cumplen alguna garantía |
| `palette-too-many-colors` | dibujo | Más de seis colores |
| `paint-indistinct` | dibujo | Dos pinturas usadas no se distinguen, con la visión y el tema en que fallan |
| `paint-text-contrast` | dibujo | Un rótulo sobre una cara pintada no llega a 4,5:1 (suele ser uno en una cara lateral) |

## Leyenda: `legendOf(spec, lang)`

Devuelve las pinturas que usa la figura, primero las de `palette.use` y en su orden:

```ts
legendOf(spec, "es"); // [{ name: "data", kind: "role", label: "datos", color: "var(--isofig-paint-data)" }, …]
```
