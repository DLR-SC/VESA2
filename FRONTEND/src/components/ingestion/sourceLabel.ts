import repoPresets from './repoPresets.json';

// The backend harvests through its own proxies, so a job's URL is internal plumbing. Show the source
// the user actually picked instead:
//   [self]/oai/records?source=<repo>&set=<set>&prefix=…  (universal OAI proxy) -> "<repo> (set: <set>)"
//   [self]/proxy/pangaea/records                          (bundled proxy)      -> "PANGAEA (bundled proxy)"
// [self] = relative, or this backend's loopback address as stored by the sync job. A custom external
// proxy URL is shown exactly as entered.
const RELATIVE_BASE = 'http://self.invalid';
const SELF_HOSTS = new Set(['self.invalid', '127.0.0.1', 'localhost']);
const PRESETS = repoPresets as { label: string; proxyPath?: string }[];

export const sourceLabel = (url: string): string => {
  let u: URL;
  try { u = new URL(url, RELATIVE_BASE); } catch { return url; }
  if (!SELF_HOSTS.has(u.hostname)) return url;

  const source = u.searchParams.get('source');
  if (u.pathname === '/oai/records' && source) {
    const set = u.searchParams.get('set');
    return set ? `${source} (set: ${set})` : source;
  }
  const preset = PRESETS.find((p) => p.proxyPath && u.pathname.startsWith(p.proxyPath));
  return preset ? `${preset.label} (bundled proxy)` : url;
};
