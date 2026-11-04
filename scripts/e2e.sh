#!/usr/bin/env bash
# Prueba de punta a punta del paquete publicado: empaca con `npm pack`, instala el .tgz en un proyecto vacío y
# comprueba lo que un usuario vería: los tipos con tsc (7 y 5.9), las entradas de exports, la CLI sobre el ejemplo
# instalado y que el navegador no reciba código de Node. Uso: scripts/e2e.sh   (ISOFIG_E2E_KEEP=1 conserva la carpeta)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HERE="$ROOT/scripts/e2e"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/isofig-e2e.XXXXXX")"
[ -n "${ISOFIG_E2E_KEEP:-}" ] && echo "Carpeta de trabajo: $WORK" || trap 'rm -rf "$WORK"' EXIT

step() { printf '\n== %s\n' "$*"; }

step "npm pack"
mkdir -p "$WORK/pack"
(cd "$ROOT" && npm pack --pack-destination "$WORK/pack" --silent >/dev/null)
TGZ="$(ls "$WORK/pack"/isofig-*.tgz)"
echo "$(basename "$TGZ"): $(wc -c < "$TGZ" | tr -d ' ') B, $(tar -tzf "$TGZ" | wc -l | tr -d ' ') archivos"
# El paquete no debe llevar pruebas, scripts ni instantáneas.
if tar -tzf "$TGZ" | grep -E '^package/(test|scripts|\.github)/' >/dev/null; then
  echo "El paquete lleva archivos de desarrollo" >&2
  exit 1
fi

step "proyecto vacío con el .tgz, TypeScript 7 y esbuild"
PROJECT="$WORK/project"
mkdir -p "$PROJECT/src" "$PROJECT/out"
cp "$HERE"/tsconfig*.json "$HERE/smoke.mjs" "$PROJECT/"
cd "$PROJECT"
printf '{"name":"e2e","private":true,"type":"module"}\n' > package.json
TS_VERSION="$(node -p "require('$ROOT/package.json').devDependencies.typescript")"
npm install --no-audit --no-fund --silent "$TGZ" "typescript@$TS_VERSION" esbuild
mkdir -p "$WORK/ts59"
npm install --prefix "$WORK/ts59" --no-audit --no-fund --silent typescript@5.9.3

step "tsc: el ejemplo del paquete compila (copia en src/, en su sitio y con moduleResolution bundler)"
mkdir -p src/example
cp node_modules/isofig/examples/token-bucket/*.ts src/example/
./node_modules/.bin/tsc -p tsconfig.json && echo "ok TypeScript $(./node_modules/.bin/tsc -v | cut -d' ' -f2), copia"
./node_modules/.bin/tsc -p tsconfig.inplace.json && echo "ok TypeScript 7, en su sitio"
./node_modules/.bin/tsc -p tsconfig.bundler.json && echo "ok TypeScript 7, bundler"
"$WORK/ts59/node_modules/.bin/tsc" -p tsconfig.json && echo "ok TypeScript 5.9, copia"
"$WORK/ts59/node_modules/.bin/tsc" -p tsconfig.inplace.json && echo "ok TypeScript 5.9, en su sitio"

step "isofig check y build sobre el ejemplo instalado"
EXAMPLE=node_modules/isofig/examples/token-bucket
# La CLI lee la spec .ts desde node_modules quitando los tipos; esa advertencia de Node no debe llegar al usuario.
run() {
  local log="$WORK/stderr.log"
  "$@" 2> "$log" || { cat "$log" >&2; return 1; }
  cat "$log"
  if grep -q stripTypeScriptTypes "$log"; then echo "La CLI dejó pasar la ExperimentalWarning de stripTypeScriptTypes" >&2; return 1; fi
}
./node_modules/.bin/isofig --version
run ./node_modules/.bin/isofig check "$EXAMPLE/spec.ts" --strict
run ./node_modules/.bin/isofig check "$EXAMPLE/spec.ts" --model "$EXAMPLE/model.ts" --presets --strict
run ./node_modules/.bin/isofig build "$EXAMPLE/spec.ts" -o out/fig.html
run ./node_modules/.bin/isofig build "$EXAMPLE/spec.ts" --format page --model "$EXAMPLE/model.ts" -o out/page.html
run ./node_modules/.bin/isofig build "$EXAMPLE/spec.ts" --format module -o out/fig.module.ts
./node_modules/.bin/isofig add angular src/app/isofig >/dev/null
for f in out/fig.html out/page.html out/fig.module.ts src/app/isofig/isofig-figure.ts; do
  [ -s "$f" ] || { echo "Falta o está vacío: $f" >&2; exit 1; }
done
grep -q 'data-isofig="token-bucket"' out/fig.html
grep -q '<script type="module">' out/page.html
if ./node_modules/.bin/isofig build "$EXAMPLE/spec.ts" --format nada >/dev/null 2>&1; then echo "--format nada debía fallar" >&2; exit 1; fi
echo "ok"

step "las entradas de exports se importan y las demás están cerradas"
node smoke.mjs

step "lo que llega al navegador no trae código de Node"
for entry in isofig isofig/runtime isofig/orbit isofig/zoom isofig/astro/client; do
  out="out/browser-$(echo "$entry" | tr / -).js"
  printf 'export * from "%s";\n' "$entry" > entry.mjs
  ./node_modules/.bin/esbuild entry.mjs --bundle --platform=browser --format=esm --minify --outfile="$out" --log-level=warning
  # Un import de Node es `from"node:zlib"` o `import("node:fs")`; una clave `{node:x}` de un objeto no lo es.
  if grep -Eq '(from|import\()\s*["'"'"']node:' "$out"; then echo "$entry arrastra un import de node:" >&2; exit 1; fi
  echo "$entry: $(gzip -9 < "$out" | wc -c | tr -d ' ') B min+gzip, sin node:"
done

step "todo en orden"
