# Importar desde lo que ya tienes

## docker compose

```sh
docker compose config --format json | npx isofig import compose - -o figures/stack.json
npx isofig build figures/stack.json --format page --lang es -o vista.html
```

`docker compose config` resuelve el archivo (variables, `extends`, perfiles) y entrega JSON, así isofig no
necesita leer YAML. La figura sale así:

| En compose | En la figura |
|---|---|
| un servicio | un rack con su nombre grabado en la tapa |
| `deploy.replicas` | una unidad por réplica (hasta 4) |
| `ports` publicados | conectores en el frente, en el color de acento |
| un volumen con nombre | un tambor al lado del primer servicio que lo usa |
| una red | un riel al fondo, con un cable a cada servicio que la usa |
| `depends_on` | filas: lo que depende de otros queda más cerca del lector |

El resultado es una spec normal: edítala para agregar piezas, controles o un modelo.

![Un compose de cinco servicios convertido en figura](../assets/compose-light.png)

## Un boceto o una captura

Con la skill de Claude Code, pasa la imagen y pide la figura:

```text
/isofig convierte este diagrama en una figura interactiva para la lección de colas
```

Claude lee la imagen, saca los componentes y lo que fluye entre ellos, inventa la máquina que lo explica y
escribe la spec y el modelo. No calca el dibujo: el boceto es el concepto, no el objeto.
