const claims = new WeakMap<object, Set<string>>();

const claimsOf = (page: object): Set<string> => {
  let used = claims.get(page);
  if (!used) claims.set(page, (used = new Set()));
  return used;
};

/**
 * Reparte los nombres de copia de una página (una petición de Astro). La primera copia de una figura conserva
 * `base` (el id de la spec); las siguientes salen `base-2`, `base-3`… Un `asked` explícito se respeta tal cual y,
 * si ya lo usa otra copia de la página, es un error: dos copias con el mismo nombre compartirían ids.
 */
export function claimInstance(page: object, base: string, asked?: string): string {
  const used = claimsOf(page);
  let name = asked ?? base;
  if (asked !== undefined && used.has(name)) throw new Error(`isofig «${base}»: la instancia «${name}» ya está en esta página`);
  for (let k = 2; used.has(name); k++) name = `${base}-${k}`;
  used.add(name);
  return name;
}

/** `true` solo la primera vez que se pregunta por `key` en esta página: lo que va una vez por página (el CSS). */
export function firstOnPage(page: object, key: string): boolean {
  const used = claimsOf(page);
  const first = !used.has(`\0${key}`);
  used.add(`\0${key}`);
  return first;
}
