// test/hooks-blob.mjs — loader hook that swaps ONLY `@vercel/blob` for the
// in-memory test/mock-blob.mjs (Stripe stays real). Used by local-server.js
// when LOCAL_MOCK_BLOB=1, so the bank-transfer flow can be exercised end to
// end on a dev machine without a Blob store token.
export async function resolve(specifier, context, next) {
  if (specifier === '@vercel/blob') return { url: new URL('./mock-blob.mjs', import.meta.url).href, shortCircuit: true };
  return next(specifier, context);
}
