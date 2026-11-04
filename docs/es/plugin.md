# isofig como plugin de Claude Code

El repositorio también es un marketplace de Claude Code. El plugin `isofig` instala la skill que escribe las specs
de isofig, sin copiar archivos a mano.

## 1. Instalar

En una terminal:

```sh
claude plugin marketplace add ACHAVESTA-Git/ISOFIG
claude plugin install isofig@isofig
```

Dentro de una sesión de Claude Code, los mismos pasos son:

```text
/plugin marketplace add ACHAVESTA-Git/ISOFIG
/plugin install isofig@isofig
```

Al instalar eliges el alcance: usuario (todos tus proyectos), proyecto o local. Si ya copiaste la skill a mano en
`~/.claude/skills/isofig`, bórrala: si no, la skill aparecerá dos veces.

Para compilar las figuras, la skill usa el paquete npm: si el proyecto no lo tiene, la skill te pedirá
`npm i github:ACHAVESTA-Git/ISOFIG#v0.10.0`.

## 2. Invocar la skill

- Pídela en lenguaje natural, por ejemplo: «haz una figura isométrica de cómo funciona un rate limiter». Claude carga
  la skill cuando la tarea encaja con su descripción.
- Escribe `/isofig:isofig` (el formato es `/<plugin>:<skill>`).

Para comprobar que está activa, escribe `/` y busca `isofig`, o ejecuta `claude plugin list` en la terminal.

## 3. Actualizar

```sh
claude plugin marketplace update isofig
claude plugin update isofig@isofig
```

Después, ejecuta `/reload-plugins` en la sesión abierta, o reinicia Claude Code.

El plugin fija su versión (`version` en `.claude-plugin/plugin.json`): una actualización llega cuando el repositorio
publica una versión nueva. Para que se actualice sola al iniciar Claude Code, abre `/plugin`, ve a **Marketplaces**,
elige `isofig` y activa **Enable auto-update**. Por defecto está desactivado en marketplaces de terceros.

## Desinstalar

```sh
claude plugin uninstall isofig@isofig
```
