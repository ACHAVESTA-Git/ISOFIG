# ADR 0001 · Núcleo ligero y figuras como datos

- **Estado:** aceptada (2026-10-15)
- **Contexto de origen:** inspirada en [anatomy](https://github.com/wheresryan22/anatomy) de @wheresryan22 (MIT). No se copia
  su código: se reescriben las ideas.

## Contexto

anatomy dibuja figuras isométricas muy cuidadas, pero cada figura es un script de cientos de líneas, las páginas
pesan de 30 a 323 KB gzip (el 83 % son atributos `d`), el kit se inyecta dentro del HTML y depende de React para el
adaptador web. Queremos lo mismo para Astro (destino principal) y Angular, dentro de un presupuesto de peso estricto.

## Decisión

1. **La figura es un dato.** Una `FigureSpec` (objeto TS/JSON) describe piezas, grupos que se mueven, parámetros y
   textos bilingües. El modelo que da vida a la figura es una función pura aparte (`Model`), opcional.
2. **El SVG se genera al compilar.** El núcleo (`isofig`) corre solo en Node: proyecta, sombrea, ordena y serializa.
   Al navegador llega SVG ya hecho y un runtime de pocos KB (`isofig/runtime`).
3. **El movimiento es una transformación**, nunca un redibujo: cada grupo recibe un desplazamiento en el mundo
   (que el runtime proyecta con la base de la cámara), un giro en su plano o una opacidad.
4. **Peso:** coordenadas en medios píxeles (antes décimas; ver 0.5.0) con comandos relativos, caras del mismo tono en un solo `path`, puntos como
   segmentos de longitud cero, clases cortas. Presupuesto por defecto: 40 KB gzip por figura; `isofig check` falla
   si se pasa.
5. **Tema por variables CSS** (`--isofig-*`). El proyecto que la usa conecta sus propios tokens.
6. **Accesibilidad de serie:** botón de pausa (WCAG 2.2.2), controles nativos `input[type=range]`, `prefers-reduced-motion`
   arranca en pausa y sin interpolación, el bucle se detiene fuera de pantalla.
7. **Adaptadores:** componente `.astro` que renderiza en build; para Angular 19+, un componente standalone que se
   copia al proyecto y consume un módulo generado por la CLI (`--format module`), así el núcleo no entra al bundle.
8. **Fuera de la v1:** WebGL, modo 3D, tubos, sólidos de revolución y la auditoría completa de anatomy. La auditoría
   propia es reducida: orden de pintado con ciclos, piezas flotando, piezas hundidas y peso.

## Consecuencias

- Una figura nueva se escribe como datos y se valida en build; Claude (la skill) produce la spec, no código de dibujo.
- Las figuras que necesiten formas curvas complejas tendrán que esperar a módulos opcionales.
- El orden de pintado se calcula en reposo: las piezas que se mueven deben recorrer zonas sin cruces ambiguos (la
  auditoría lo advierte).
