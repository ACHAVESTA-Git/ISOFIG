#!/usr/bin/env bash
# Compila un proyecto Astro mínimo con <Figure> usando el paquete instalado desde su .tgz y comprueba el resultado.
# Uso: scripts/e2e-astro.sh [versión-de-astro]   (por defecto 7; ISOFIG_E2E_KEEP=1 conserva la carpeta)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ASTRO="${1:-7}"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/isofig-astro.XXXXXX")"
[ -n "${ISOFIG_E2E_KEEP:-}" ] && echo "Carpeta de trabajo: $WORK" || trap 'rm -rf "$WORK"' EXIT

echo "== npm pack"
mkdir -p "$WORK/pack"
(cd "$ROOT" && npm pack --pack-destination "$WORK/pack" --silent >/dev/null)
TGZ="$(ls "$WORK/pack"/isofig-*.tgz)"

echo "== proyecto con astro@$ASTRO y el .tgz"
PROJECT="$WORK/site"
mkdir -p "$PROJECT"
cp -R "$ROOT/scripts/e2e-astro/." "$PROJECT/"
cd "$PROJECT"
printf '{"name":"e2e-astro","private":true,"type":"module"}\n' > package.json
npm install --no-audit --no-fund --silent "astro@$ASTRO" "$TGZ"
# La figura es la del ejemplo que trae el paquete.
mkdir -p src/figures
cp node_modules/isofig/examples/token-bucket/spec.ts node_modules/isofig/examples/token-bucket/model.ts src/figures/
cp box.json src/figures/box.json

echo "== astro build ($(./node_modules/.bin/astro --version))"
./node_modules/.bin/astro build 2>&1 | tail -n 12

echo "== lo que dejó en dist/"
node check.mjs dist
