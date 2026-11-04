/**
 * Silencia solo la advertencia de `stripTypeScriptTypes` («ExperimentalWarning», en Node 22 a 26): la CLI la usa
 * para leer specs `.ts` y no es algo que el usuario pueda arreglar. Cualquier otra advertencia pasa igual.
 * Devuelve la función que deja `emitWarning` como estaba.
 */
export function quietStripTypes(proc: Pick<NodeJS.Process, "emitWarning"> = process): () => void {
  const emit = proc.emitWarning;
  proc.emitWarning = ((warning: string | Error, ...rest: unknown[]) => {
    const text = typeof warning === "string" ? warning : warning.message;
    if (text.includes("stripTypeScriptTypes")) return;
    return (emit as (...a: unknown[]) => void).call(proc, warning, ...rest);
  }) as typeof proc.emitWarning;
  return () => {
    proc.emitWarning = emit;
  };
}
