/**
 * API base resolution for LeadCaller.
 *
 * Why: in production LeadCaller is mounted under a path prefix (/leadcaller/
 * via the nginx reverse proxy). Root-absolute fetch('/api/...') calls resolve
 * to the DOMAIN root — which is the main CRM, not this app — so client-side
 * API calls returned the main CRM's HTML and broke JSON parsing
 * ("Unexpected token '<' ... is not valid JSON" on the dashboard + dialer).
 * apiUrl() prefixes our mount path at runtime (derived from window.location)
 * so fetches reach OUR routes. Local dev (app at /) resolves to plain
 * /api/... as before. Same pattern as apps/leadg/src/lib/api-base.ts.
 */
const APP_PREFIXES = ['/leadcaller', '/leadg', '/foreclosure', '/contentplanner', '/media-workflow', '/legacyleads'];

function detectBase(): string {
  if (typeof window === 'undefined') return '';
  const m = APP_PREFIXES.find((p) => window.location.pathname === p || window.location.pathname.startsWith(p + '/'));
  return m || '';
}

/** Build a fetch URL for one of our API routes, prefix-aware in production. */
export function apiUrl(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${detectBase()}${p}`;
}
