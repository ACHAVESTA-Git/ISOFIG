# Import from what you already have

## docker compose

```sh
docker compose config --format json | npx isofig import compose - -o figures/stack.json
npx isofig build figures/stack.json --format page -o preview.html
```

`docker compose config` resolves the file (variables, `extends`, profiles) and prints JSON, so isofig never has
to parse YAML. The figure maps:

| In compose | In the figure |
|---|---|
| a service | a rack with its name engraved on top |
| `deploy.replicas` | one unit per replica (up to 4) |
| published `ports` | jacks on the front, in the accent colour |
| a named volume | a drum next to the first service that mounts it |
| a network | a rail at the back, with a cable to every service on it |
| `depends_on` | rows: whatever depends on others sits nearer the reader |

The result is a plain spec: edit it to add parts, controls or a model.

![A five-service compose file turned into a figure](../assets/compose-light.png)

## A sketch or a screenshot

With the Claude Code skill, attach the image and ask for the figure:

```text
/isofig turn this diagram into an interactive figure for the queues lesson
```

Claude reads the image, lists the components and what flows between them, invents the machine that explains
it and writes the spec and the model. It never traces the drawing: the sketch is the concept, not the object.
