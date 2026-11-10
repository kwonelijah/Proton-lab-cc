// test/mock-blob.mjs — in-memory stand-in for @vercel/blob (put / get / list /
// head / del) driven by globalThis.__blob = Map<pathname, string>. Mirrors
// the SDK's overwrite rule: put() on an existing pathname throws unless
// allowOverwrite is true.
const S = () => (globalThis.__blob ||= new Map());
const url = (p) => `https://test.private.blob.vercel-storage.com/${p}`;

export async function put(pathname, body, opts = {}) {
  if (S().has(pathname) && !opts.allowOverwrite) {
    throw new Error('This blob already exists, use `allowOverwrite: true` if you want to overwrite it');
  }
  S().set(pathname, typeof body === 'string' ? body : String(body));
  return { pathname, url: url(pathname), contentType: opts.contentType || 'application/octet-stream' };
}
export async function get(pathname) {
  if (!S().has(pathname)) return null;
  const text = S().get(pathname);
  return { statusCode: 200, headers: {}, stream: new Blob([text]).stream(), blob: { pathname, url: url(pathname), contentType: 'application/json' } };
}
export async function list(opts = {}) {
  const prefix = opts.prefix || '';
  const blobs = [...S().keys()].filter((p) => p.startsWith(prefix)).sort().map((p) => ({ pathname: p, url: url(p), size: S().get(p).length, uploadedAt: new Date() }));
  return { blobs, hasMore: false, cursor: undefined };
}
export async function head(pathname) {
  if (!S().has(pathname)) throw new Error('BlobNotFoundError');
  return { pathname, url: url(pathname), size: S().get(pathname).length };
}
export async function del(pathnames) {
  for (const p of [].concat(pathnames)) S().delete(String(p).replace(/^https?:\/\/[^/]+\//, ''));
}
