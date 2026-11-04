const EN = `isofig: isometric figures from a spec

  isofig build <spec> [-o file] [--format html|module|json|page] [--lang en] [--n 1] [--model file]
  isofig check <spec> [--lang en|es] [--strict] [--model file [--presets] [--seconds 12]]
  isofig add angular <dir>    copy the standalone Angular component into your app
  isofig import compose <file.json|-> [-o spec.json]
                              a map from \`docker compose config --format json\`
  isofig import mermaid <file.mmd|-> [-o spec.json]
                              a map from a Mermaid flowchart or classDiagram
  isofig palette [--base "#2fb58b"] [--format css|json] [--report] [-o file]
                              map roles derived from a brand color, with a contrast,
                              ΔE and color-blindness table on stderr (--report)
  isofig --version

  check   validates the spec, audits the drawing and, with --model, runs the model for --seconds simulated
          seconds (and every preset with --presets) to find groups, controls and presets that do nothing.
          --lang en|es sets the language of the messages and of their prefixes; --strict also fails on warnings

  html    the <figure> markup (default)
  module  a TS module exporting { id, html, data }, for Angular
  json    { html, data } as JSON
  page    a standalone preview page with theme and runtime inlined (use --model for a model file,
          --advance 3 to open it 3 s into the simulation, --set id=value to start a control
          at another value, --orbit to try turning it)`;

const ES = `isofig: figuras isométricas a partir de una spec

  isofig build <spec> [-o archivo] [--format html|module|json|page] [--lang es] [--n 1] [--model archivo]
  isofig check <spec> [--lang en|es] [--strict] [--model archivo [--presets] [--seconds 12]]
  isofig add angular <dir>    copia el componente standalone de Angular en tu aplicación
  isofig import compose <archivo.json|-> [-o spec.json]
                              un mapa a partir de \`docker compose config --format json\`
  isofig import mermaid <archivo.mmd|-> [-o spec.json]
                              un mapa a partir de un flowchart o un classDiagram de Mermaid
  isofig palette [--base "#2fb58b"] [--format css|json] [--report] [-o archivo]
                              roles de mapa derivados de un color de marca, con una tabla de
                              contraste, ΔE y daltonismo por stderr (--report)
  isofig --version

  check   valida la spec, audita el dibujo y, con --model, ejecuta el modelo durante --seconds segundos
          simulados (y cada desvío con --presets) para encontrar grupos, controles y desvíos que no hacen nada.
          --lang en|es fija el idioma de los mensajes y de sus prefijos; --strict también falla con avisos

  html    el marcado <figure> (por defecto)
  module  un módulo TS que exporta { id, html, data }, para Angular
  json    { html, data } como JSON
  page    una página de vista previa suelta, con el tema y el runtime dentro (--model para el archivo del
          modelo, --advance 3 para abrirla 3 s dentro de la simulación, --set id=valor para arrancar un
          control en otro valor, --orbit para probar el giro)`;

/** La ayuda en el idioma de los mensajes (`--lang`); cualquier otro idioma cae al inglés. */
export const helpOf = (lang: "en" | "es"): string => (lang === "es" ? ES : EN);
