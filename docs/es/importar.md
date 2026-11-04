# Importar desde lo que ya tienes

## docker compose

```sh
docker compose config --format json | npx isofig import compose - -o figures/stack.json
npx isofig build figures/stack.json --format page --lang es -o vista.html
```

`docker compose config` resuelve el archivo (variables, `extends`, perfiles) y entrega JSON, así isofig no
necesita leer YAML. Sale un [mapa](mapas.md):

| En compose | En el mapa |
|---|---|
| un servicio | el objeto que sugiere su imagen: `postgres` una base de datos, `redis` un caché, `nginx` un balanceador, `worker` una función, lo demás un servicio |
| `deploy.replicas` | «api ×3» en el rótulo |
| `depends_on` | una cinta del servicio a lo que necesita (la dependencia queda a la derecha) |
| `ports` publicados | una cinta desde un globo «Internet», con el `8080→80` en su cartel |
| un volumen con nombre | un balde al que apunta una cinta punteada (un bind mount no es un volumen) |
| una red | se nombra en el pie |

El resultado es una spec normal: edítala para cambiar un objeto (`is`), agrupar servicios en un contenedor, añadir un
flujo o un modelo.

![Un compose de cinco servicios convertido en mapa](../assets/compose-light.png)

## Mermaid

```sh
npx isofig import mermaid diagrama.mmd -o figures/mapa.json      # o «-» para leer de la entrada estándar
npx isofig build figures/mapa.json --format page --lang es -o vista.html
```

Un subconjunto de `flowchart` / `graph` (formas, flechas con texto, `&`, subgrafos) y de `classDiagram` (clases con sus
atributos y métodos, estereotipos, herencia, composición, agregación, dependencia, multiplicidades). El rótulo manda sobre
la forma: «Postgres» es una base de datos aunque venga en un rectángulo. Lo que no entiende lo salta y lo lista en
`skipped:`. La tabla completa está en [mapas.md](mapas.md#importar).

## Un boceto o una captura

Con la skill de Claude Code, pasa la imagen y pide la figura:

```text
/isofig convierte este diagrama en una figura interactiva para la lección de colas
```

Claude lee la imagen, saca los componentes y lo que fluye entre ellos, inventa la máquina que lo explica y
escribe la spec y el modelo. No calca el dibujo: el boceto es el concepto, no el objeto.
