# ADR 0002 · Especificación anidada y despiece declarativo

- **Estado:** aceptada (2026-11-04), isofig 0.9
- **Relacionada:** [ADR 0001](0001-nucleo-ligero-y-especificacion-declarativa.md) (la figura es un dato; el orden de
  pintado se calcula al compilar)

## Contexto

Quien quiere explicar una máquina (un motor V8, un motor cohete) ya piensa en un árbol: el motor tiene bancadas, las
bancadas tienen culatas, las culatas tienen válvulas. Con la spec plana de 0.8 ese árbol se perdía: había que
escribir cada pieza en coordenadas de mundo y, para desarmarla, un modelo en TypeScript que moviera cada grupo. La
información del despiece ya estaba en la estructura; faltaba que isofig la leyera. La segunda oleada (mapas,
topologías, UML) necesita lo mismo: contenedores anidados que se compilan a piezas.

## Decisión

1. **`root` y `defs` en la `FigureSpec`, que se aplanan al compilar.** `assemble(spec)` es una función pura (corre en
   el navegador) que devuelve la `FigureSpec` de siempre: piezas en mundo con ids por ruta (`bloque.bancada-izq.culata`)
   y un grupo por nodo que se desarma o tiene nombre. **El runtime no conoce árboles.** `renderFigure`, `drawScene`,
   `validateSpec` y el CLI aceptan `root` sin pasos extra.
2. **Coordenadas locales** al `at` de cada nodo; `repeat` copia el subárbol entero; `use` toma de `defs` (con
   plantillas `{clave}` de `with`) y luego del catálogo (el de `isofig/kit` por defecto en los puntos de entrada de
   Node). `tone`, `paint` y `mount` se heredan.
3. **Referencias por ámbitos:** `on` y `mount` se buscan en el propio nodo, luego hacia arriba hasta la raíz; una
   ruta con puntos alcanza otra rama desde un ancestro común. Así un subárbol repetido o reutilizado resuelve sus
   referencias dentro de sí mismo sin renombrar nada.
4. **El despiece es declarativo y usa lo que ya había:** `explode` (relativo al padre) y `stage` generan un parámetro
   por pasos, una elección (la lista de piezas) y `bind` con dos capacidades nuevas en el runtime: **varios bind al
   mismo grupo se suman**, cada uno con **su ventana del parámetro** (`win`), y una elección **atenúa** lo que no es
   la pieza (`keep`). Cada nodo se desplaza por la suma de su `explode` y los de sus ancestros, cada uno en la ventana
   de su etapa. Los `bind` se aplican también sobre un modelo (se suman a sus grupos).
5. **Etapas automáticas de fuera hacia dentro** (lo más alejado en su dirección de salida primero, un hijo nunca
   después de su padre) o las del autor con `stage`. El texto de cada paso es el `step` o los nombres de la etapa; la
   lectura de una pieza elegida es su `name · note`. Los parámetros llevan `texts` por valor para la lectura y el
   lector de pantalla.
6. **Una pieza que ya anima un modelo** conserva su `group` y el despiece la lleva desde fuera (`outer`): un `<g>`
   envolvente por pieza (~30 bytes cada una). Se eligió sobre fusionar grupos porque el modelo sigue mandando sobre el
   suyo sin saber del despiece.
7. **Orden de pintado por pose.** ADR 0001 lo calculaba solo en reposo. Ahora también al final de cada etapa
   (`reorder`), y la figura guarda solo las diferencias: por pose, las piezas fuera de la subsecuencia más larga que ya
   va en orden, como pares «mueve esta antes de aquella» sobre el orden en reposo. El runtime reordena el DOM al cruzar
   el umbral (al salir, cuando la pieza llegó; al volver, en cuanto arranca). En el V8: 677 B gzip para 7 poses.
8. **Orden con sólidos orientados.** Para prismas de lado, cilindros inclinados y conos, el orden busca un plano que
   separe las dos piezas entre las normales de sus caras y la recta entre sus centros (con la tolerancia de contacto
   de la auditoría, 0,8), descarta los pares cuyas siluetas no se pisan, y una pieza metida en la caja de otra va
   antes (queda tapada). En un ciclo, sale primero la pieza tapada y no se avisa: no se ve. Sin piezas orientadas, el
   SVG de siempre no cambia.
9. **Primitivas nuevas:** `axis` en `prism` (`y`/`x`: un bloque en V, una culata inclinada), un eje vector en
   `cylinder` (una biela) y `cone`, la primera pieza de revolución (una tobera). ADR 0001 dejaba los sólidos de
   revolución fuera de la v1; el tronco de cono es la excepción mínima: un prisma con otra tapa.

## Consecuencias

- Un motor completo cabe en un JSON de ~30 KB sin TypeScript: [motor V8](../../examples/motor-v8/spec.json) (215
  piezas, 7 pasos, 12 piezas elegibles, 16,6 KB gzip) y [motor cohete](../../examples/motor-cohete/spec.json).
- El runtime crece 387 B gzip (acumular, ventanas, atenuación, textos por valor, reorden). El giro (`isofig/orbit`)
  pasa de ~6,5 a ~8,5 KB gzip porque `drawScene` ahora ordena por pose y dibuja prismas, conos y ejes inclinados; sigue
  cargándose solo al tocar la figura. Con el aplanador dentro llegó a ~12 KB: por eso el giro recibe la spec ya aplanada
  (`assemble` al compilar, que hacen `<Figure orbit>` y la CLI) y ni el aplanador, ni el kit, ni el validador entran en él.
- Dibujar el V8 con sus siete poses tarda ~40 ms (13 ms sin poses): suficiente para el giro, pero no gratis.
- La auditoría, que trabaja sobre cajas, usa también los planos de las caras: una culata inclinada sobre su bancada
  ya no «se atraviesa». Las piezas dentro de otras a propósito se marcan con `mount` (también por nodo).
- Lo que no resuelve: piezas cóncavas (se arman con varias), piezas que se cruzan en pleno movimiento (el orden es
  correcto en cada pose, no entre poses) y un despiece no lineal (cada nodo sale en línea recta).
