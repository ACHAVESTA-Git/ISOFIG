# Import from what you already have

## docker compose

```sh
docker compose config --format json | npx --no-install isofig import compose - -o figures/stack.json
npx --no-install isofig build figures/stack.json --format page -o preview.html
```

`docker compose config` resolves the file (variables, `extends`, profiles) and prints JSON, so isofig never has
to parse YAML. You get a [map](maps.md):

| In compose | In the map |
|---|---|
| a service | the object its image suggests: `postgres` a database, `redis` a cache, `nginx` a load balancer, `worker` a function, anything else a service |
| `deploy.replicas` | «api ×3» in the label |
| `depends_on` | a ribbon from the service to what it needs (the dependency ends up on the right) |
| published `ports` | a ribbon from an «Internet» globe, with `8080→80` on its sign |
| a named volume | a bucket a dotted ribbon points to (a bind mount is not a volume) |
| a network | named in the caption |

The result is a plain spec: edit it to change an object (`is`), group services in a container, add a flow or a model.

![A five-service compose file turned into a map](../assets/compose-light.png)

## Mermaid

```sh
npx --no-install isofig import mermaid diagram.mmd -o figures/map.json      # or "-" to read standard input
npx --no-install isofig build figures/map.json --format page -o preview.html
```

A subset of `flowchart` / `graph` (shapes, arrows with text, `&`, subgraphs) and of `classDiagram` (classes with their
fields and methods, stereotypes, inheritance, composition, aggregation, dependency, multiplicities). The label wins over
the shape: «Postgres» is a database even when it arrives in a rectangle. Whatever it does not understand it skips and
lists under `skipped:`. The full table is in [maps.md](maps.md#import).

## A sketch or a screenshot

With the Claude Code skill, attach the image and ask for the figure:

```text
/isofig turn this diagram into an interactive figure for the queues lesson
```

Claude reads the image, lists the components and what flows between them, invents the machine that explains
it and writes the spec and the model. It never traces the drawing: the sketch is the concept, not the object.
