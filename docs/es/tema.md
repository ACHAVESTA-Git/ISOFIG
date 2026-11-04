# Tema

El tema es un solo archivo, `isofig/theme.css`, y todo lo que se puede cambiar es una variable `--isofig-*`.
Esta guía dice qué controla cada una, cómo sobrescribirla sin pelear con la especificidad y qué hace la tarjeta para que
la lectura no salte mientras la figura corre.

## Sobrescribir un token

Todos los tokens van dentro de `:where()`, con especificidad 0, también los del tema oscuro. Una regla tuya con una sola
clase les gana siempre, se cargue antes o después del tema:

```css
.isofig {
  --isofig-card: var(--surface);
  --isofig-ink: var(--ink);
  --isofig-accent: var(--accent);
  --isofig-on-accent: var(--accent-contrast);
}
```

Un valor así vale en claro **y** en oscuro, porque gana a los dos juegos del tema. Si necesitas uno distinto en cada tema,
usa `light-dark()` (el tema pone `color-scheme` en `.isofig` y lo cambia con el modo) o dos reglas:

```css
.isofig { --isofig-accent: light-dark(#0a7d5a, #4fe0b4); }

/* o, sin light-dark() */
.isofig { --isofig-accent: #0a7d5a; }
:root[data-theme="dark"] .isofig { --isofig-accent: #4fe0b4; }
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) .isofig { --isofig-accent: #4fe0b4; }
}
```

El tema oscuro se activa con `prefers-color-scheme: dark` o con `data-theme="dark"` en `<html>`; `data-theme="light"`
fuerza el claro. Las reglas de un wrapper (`.mi-figura .isofig { … }`, especificidad 0,2,0) siguen ganando, como antes.

## Qué controla cada variable

| Variable | Qué pinta |
|---|---|
| `--isofig-paper` | Fondo del diálogo «Ampliar» y, en `--format page`, de la página. |
| `--isofig-card` | Fondo de la tarjeta y de la barra del diálogo «Ampliar». |
| `--isofig-ink`, `--isofig-ink-soft` | Texto principal (título, lectura) y secundario (pista, leyendas). |
| `--isofig-edge` | Canto de las piezas y su trazo. |
| `--isofig-lo`, `--isofig-mid`, `--isofig-hi` | Los tres grises de las piezas (`tone`). Las caras salen de mezclarlos con `--isofig-light` y `--isofig-shade`. |
| `--isofig-light`, `--isofig-shade` | El extremo claro y el oscuro con que se sombrea cada cara. |
| `--isofig-accent` | La pieza `lit`, el deslizante y el selector marcado. |
| `--isofig-on-accent` | **Tinta sobre el acento**: el texto grabado en una pieza `lit` y la etiqueta del selector marcado. |
| `--isofig-ok`, `--isofig-warn`, `--isofig-fail` | Color de las piezas en cada estado (`data-state`). |
| `--isofig-ink-on-color` | **Tinta sobre un estado**: el texto grabado en una pieza `ok`, `warn` o `fail`. |
| `--isofig-halo`, `--isofig-chip` | Sombra de la tarjeta; fondo de chips y controles. |
| `--isofig-focus` | Contorno del foco (por defecto, el acento). |
| `--isofig-radius`, `--isofig-font`, `--isofig-mono` | Esquinas de la tarjeta; tipografía del texto y de la lectura. |
| `--isofig-paint-<nombre>`, `--isofig-paint-<nombre>-ink` | Pintura y tinta de cada material o rol (ver [color.md](color.md)). |
| `--isofig-readout-lines` | Líneas que reserva la lectura (ver más abajo). Sin valor, 2, 3 o 4 según el ancho de la tarjeta. |
| `--isofig-zoom-width` | Ancho del dibujo en el diálogo «Ampliar» (1150 px). |

### Tinta sobre el acento y sobre los estados

El texto grabado en una pieza (`.tx`) toma su color de `--fx`, una variable interna que cada pieza calcula. No la
sobrescribas: cambia la variable pública que corresponde.

- Sobre una pieza `lit` usa `--isofig-on-accent`. Es la misma tinta que lleva el selector marcado, que también
  es acento: si cambias `--isofig-accent`, cambia esta con él.
- Sobre una pieza con `data-state` usa `--isofig-ink-on-color`. No depende del acento: los tres estados comparten
  tinta. Si una pieza es `lit` y además está en un estado, gana el estado.
- Una pieza con `paint` usa la tinta de su pintura (`--isofig-paint-<nombre>-ink`), salvo que esté en un estado.

Elige una tinta que contraste al menos 4,5:1 con el color de encima en los dos temas (por ejemplo, `npx isofig palette
--report` mide las pinturas del tema).

## Lectura estable

En una figura con modelo, la lectura (el texto de abajo a la derecha) cambia varias veces por segundo y puede pasar de una
línea a cuatro. Si la tarjeta cambia de alto con ella, todo lo que hay debajo salta. La tarjeta evita tres causas:

1. **La altura se reserva.** La lectura ocupa siempre `--isofig-readout-lines` líneas como mínimo. Sin valor tuyo, son 2
   y en una tarjeta estrecha 3 (hasta 28 rem) o 4 (hasta 20 rem), porque caben menos caracteres por línea. Con eso, una
   lectura de hasta 110 caracteres no cambia el alto de la tarjeta a ningún ancho; nueve de cada diez figuras de la
   academia caben ahí.
2. **El ancho no depende del texto.** La pista (`isofig-hint`) ocupa lo que mide su texto, como mucho el 34 %, y la
   lectura el resto. Ninguna de las dos columnas cambia con el valor mostrado, así que el texto no se reacomoda.
3. **Los números miden igual.** La lectura va en la tipografía `--isofig-mono` con `tabular-nums`: `9` y `10` no
   mueven el resto de la línea.

La reserva solo se aplica si la figura tiene lectura o modelo (`data-live`); una figura sin lectura no deja un hueco.

`isofig check --model` informa de la lectura más larga del modelo (`readout-longest`) y avisa (`readout-long`) si pasa de 70
caracteres. Acórtala: **70 caracteres como máximo** caben en dos líneas hasta en un celular. Si no puedes, reserva más
líneas para esa figura:

```css
[data-isofig="sala-de-alarmas"] { --isofig-readout-lines: 4; }
```

## Tarjeta estrecha

La tarjeta es un contenedor (`container: isofig-card / inline-size`) y el diseño responde a **su** ancho, no al de la
pantalla: la misma figura se ve igual en una columna estrecha de escritorio que en un celular. Con 40 rem de ancho o
menos:

- la lectura pasa arriba, a todo el ancho y alineada a la izquierda; la pista baja, más pequeña. En el DOM la pista
  sigue primero, así que el lector de pantalla no cambia;
- el control deslizante cede ancho antes de que se parta el valor: «3000 ms» nunca se corta en dos líneas.

Si metes la figura en un contenedor que se ajusta a su contenido (un `inline-block` o un hijo de flex sin ancho), dale un
ancho: una tarjeta con `inline-size` contenido no puede medirse por lo que tiene dentro.

## Clases que puedes tocar

`isofig`, `isofig-card`, `isofig-top`, `isofig-title`, `isofig-art`, `isofig-bottom`, `isofig-hint`, `isofig-readout`,
`isofig-controls`, `isofig-chip`, `isofig-param`, `isofig-value`, `isofig-note`. Cámbialas con selectores de dos clases
(`.mi-figura .isofig-card { … }`) o con las variables de arriba; no dependas de los selectores internos del dibujo
(`.isofig-art .lit`, `--fx`, `--ft`…), que pueden cambiar entre versiones.
