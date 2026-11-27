import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// The page polls /sync/status; when idle the backend keeps returning the last (failed) job.
const poll = vi.hoisted(() => ({ status: null as any }));
vi.mock('../../store/services/syncApi', () => ({
  useGetSyncStatusQuery: () => ({ data: poll.status, isSuccess: true }),
  useGetSyncHistoryQuery: () => ({ data: undefined, refetch: () => {} }),
}));
vi.mock('./HandshakeForm', () => ({ default: () => <div>connect-step</div> }));
vi.mock('./StagingView', () => ({ default: () => null }));
vi.mock('./SyncControl', () => ({ default: () => <div>import-step</div> }));
vi.mock('./ConnectedSources', () => ({ default: () => null }));

import IngestionPage from './IngestionPage';

const MSG = 'Handshake failed: The API Endpoint is currently unreachable or timed out.';
const failedJob = { status: 'failed', processed: 0, total: 100, current_prefix: 'pangaea', job_id: '42', error_message: MSG };
const page = () => <MemoryRouter><IngestionPage /></MemoryRouter>;

// ponytail: in-memory localStorage, because Node 25's built-in (method-less) localStorage shadows jsdom's.
beforeEach(() => {
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  });
});

describe('IngestionPage: failed sync job', () => {
  it('shows the failure on the Import step, and after Reset the next poll does not bring it back', () => {
    poll.status = failedJob;
    const { rerender } = render(page());
    expect(screen.getByText(MSG)).toBeInTheDocument();
    expect(screen.getByText('import-step')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    poll.status = { ...failedJob }; // next poll: same failed job, fresh object
    rerender(page());

    expect(screen.queryByText(MSG)).not.toBeInTheDocument();
    expect(screen.getByText('connect-step')).toBeInTheDocument();
  });

  it('still reports a new failure after an earlier one was reset', () => {
    localStorage.setItem('ignoredJobId', '42');
    poll.status = { ...failedJob, job_id: '43' };
    render(page());
    expect(screen.getByText(MSG)).toBeInTheDocument();
  });
});
