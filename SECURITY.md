# Security

## Reporting a vulnerability

Please report security problems privately through GitHub: open the repository's **Security** tab and choose
**Report a vulnerability**. Do not open a public issue for them. You will get an answer in the advisory thread.

## Installing safely

- isofig is published only from this repository: `npm i github:ACHAVESTA-Git/ISOFIG#v0.10.0`, or the Claude Code
  plugin from `claude plugin marketplace add ACHAVESTA-Git/ISOFIG`.
- The name `isofig` on the npm registry does not belong to this project yet. Do not install a package with that name
  from npm until this file says it is published there.
- Run the CLI as `npx --no-install isofig`: it uses your installed copy and never downloads a package.
- The package has no runtime dependencies. Installing it runs only `tsc` (the `prepare` script) to build `dist/`.
- The plugin has no hooks, MCP servers or commands that run on their own: everything it does goes through Claude
  Code's normal permission prompts.

## Seguridad (español)

Reporta los problemas de seguridad en privado desde la pestaña **Security** del repositorio, con **Report a
vulnerability**, y no en un issue público. Instala isofig solo desde este repositorio
(`npm i github:ACHAVESTA-Git/ISOFIG#v0.10.0`) y usa la CLI con `npx --no-install isofig`. El nombre `isofig` en el
registro de npm todavía no es de este proyecto.
