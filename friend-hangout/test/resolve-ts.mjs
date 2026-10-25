import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('@/')) {
    const abs = path.join(root, specifier.slice(2));
    const candidates = /\.[a-z0-9]+$/i.test(abs)
      ? [abs]
      : [`${abs}.ts`, `${abs}.tsx`, path.join(abs, 'index.ts'), path.join(abs, 'index.tsx')];
    let lastError;
    for (const candidate of candidates) {
      try {
        return await nextResolve(pathToFileURL(candidate).href, context);
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError;
  }

  const relative = specifier.startsWith('./') || specifier.startsWith('../');
  const hasExtension = /\.[a-z0-9]+$/i.test(specifier);
  if (relative && !hasExtension) {
    try {
      return await nextResolve(`${specifier}.ts`, context);
    } catch {
      return nextResolve(specifier, context);
    }
  }
  return nextResolve(specifier, context);
}
