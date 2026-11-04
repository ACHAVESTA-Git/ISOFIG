# Security

## Reporting a vulnerability

Please report security problems privately through GitHub: open the repository's **Security** tab and choose
**Report a vulnerability**. Do not open a public issue for them. You will get an answer in the advisory thread.

## Installing safely

- isofig is published on npm as [`isofig`](https://www.npmjs.com/package/isofig) by its author (`anthonychavesta`), and
  from this repository (`npm i github:ACHAVESTA-Git/ISOFIG#v0.10.2`). The Claude Code plugin comes from
  `claude plugin marketplace add ACHAVESTA-Git/ISOFIG`.
- Run the CLI as `npx --no-install isofig`: it uses your installed copy and never downloads a package on its own.
- The package has no runtime dependencies. Installing it from npm runs nothing; installing it from GitHub runs only
  `tsc` (the `prepare` script) to build `dist/`.
- The plugin has no hooks, MCP servers or commands that run on their own: everything it does goes through Claude
  Code's normal permission prompts.

## Seguridad (español)

Reporta los problemas de seguridad en privado desde la pestaña **Security** del repositorio, con **Report a
vulnerability**, y no en un issue público. Instala isofig desde npm (`npm i isofig`, publicado por su autor
`anthonychavesta`) o desde este repositorio, y usa la CLI con `npx --no-install isofig`.
