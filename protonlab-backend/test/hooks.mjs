// test/hooks.mjs — module loader hook that swaps the real `stripe` package for
// test/mock-stripe.mjs and `@vercel/blob` for test/mock-blob.mjs (an
// in-memory store). Registered per test file:
// `register('./hooks.mjs', import.meta.url)`.
export async function resolve(specifier, context, next) {
  if (specifier === 'stripe') return { url: new URL('./mock-stripe.mjs', import.meta.url).href, shortCircuit: true };
  if (specifier === '@vercel/blob') return { url: new URL('./mock-blob.mjs', import.meta.url).href, shortCircuit: true };
  return next(specifier, context);
}
