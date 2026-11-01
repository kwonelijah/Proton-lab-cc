// test/hooks.mjs — module loader hook that swaps the real `stripe` package for
// test/mock-stripe.mjs. Registered per test file: `register('./hooks.mjs', import.meta.url)`.
export async function resolve(specifier, context, next) {
  if (specifier === 'stripe') return { url: new URL('./mock-stripe.mjs', import.meta.url).href, shortCircuit: true };
  return next(specifier, context);
}
