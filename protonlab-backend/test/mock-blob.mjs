// test/mock-blob.mjs — in-memory stand-in for @vercel/blob (put / get / list /
// head / del) driven by globalThis.__blob = Map<pathname, string>. Mirrors
// the SDK's overwrite rule: put() on an existing pathname throws unless
// allowOverwrite is true.
const S = () => (globalThis.__blob ||= new Map());
// Op counter so tests can assert budgets (e.g. unauthenticated requests touch no Blob).
const OPS = () => (globalThis.__blobOps ||= { put: 0, get: 0, list: 0, head: 0, del: 0 });
// ETag per pathname (bumped on every write) so ifMatch behaves like the SDK.
const E = () => (globalThis.__blobEtag ||= new Map());
const U = () => (globalThis.__blobAt ||= new Map());   // upload time per pathname (tests may set it)
let etagSeq = 0;
class BlobPreconditionFailedError extends Error { constructor() { super('Precondition failed: ETag mismatch'); this.name = 'BlobPreconditionFailedError'; } }
const url = (p) => `https://test.private.blob.vercel-storage.com/${p}`;

export async function put(pathname, body, opts = {}) {
  OPS().put++;
  if (S().has(pathname) && !opts.allowOverwrite) {
    throw new Error('This blob already exists, use `allowOverwrite: true` if you want to overwrite it');
  }
  if (opts.ifMatch && E().get(pathname) !== opts.ifMatch) throw new BlobPreconditionFailedError();
  S().set(pathname, typeof body === 'string' ? body : String(body));
  const etag = `"e${++etagSeq}"`;
  E().set(pathname, etag);
  U().set(pathname, globalThis.__blobNow ? new Date(globalThis.__blobNow) : new Date());
  return { pathname, url: url(pathname), contentType: opts.contentType || 'application/octet-stream', etag };
}
export async function get(pathname) {
  OPS().get++;
  if (!S().has(pathname)) return null;
  const text = S().get(pathname);
  return { statusCode: 200, headers: {}, stream: new Blob([text]).stream(), blob: { pathname, url: url(pathname), contentType: 'application/json', etag: E().get(pathname) || '"e0"' } };
}
export async function list(opts = {}) {
  OPS().list++;
  const prefix = opts.prefix || '';
  const blobs = [...S().keys()].filter((p) => p.startsWith(prefix)).sort().map((p) => ({ pathname: p, url: url(p), size: S().get(p).length, uploadedAt: U().get(p) || new Date(0) }));
  return { blobs, hasMore: false, cursor: undefined };
}
export async function head(pathname) {
  OPS().head++;
  if (!S().has(pathname)) throw new Error('BlobNotFoundError');
  return { pathname, url: url(pathname), size: S().get(pathname).length };
}
export async function del(pathnames) {
  OPS().del++;
  for (const p of [].concat(pathnames)) S().delete(String(p).replace(/^https?:\/\/[^/]+\//, ''));
}
