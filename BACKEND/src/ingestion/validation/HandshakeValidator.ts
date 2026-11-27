import axios from 'axios';

// The first page of every import doubles as the handshake: its first record must match the
// IDataAdapter contract before anything is written (or purged). Returns what is wrong, or null.
export function checkRecord(record: any): string | null {
  if (!record) return 'The source returned no records.';
  if (!record.dataset?.id || !record.dataset?.title) return 'Missing required dataset fields (dataset.id, dataset.title).';
  if (!Array.isArray(record.authors) || !Array.isArray(record.keywords)) return 'Authors or keywords are not arrays.';
  return null;
}

// Turns a failed source request into a message a person can act on.
export function describeFetchError(err: any): string {
  if (!axios.isAxiosError(err)) return err?.message ?? String(err);
  if (!err.response) return 'The API Endpoint is currently unreachable or timed out.';
  if (err.response.status === 404) return 'The specified API Endpoint could not be found. Please check the URL and try again.';
  const detail = (err.response.data as any)?.error; // the bundled proxies answer { error } on failure
  return `API Endpoint responded with error ${err.response.status}${detail ? `: ${detail}` : ''}.`;
}
