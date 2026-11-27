import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// The page polls /sync/status; when idle the backend keeps returning the last job.
const poll = vi.hoisted(() => ({ status: null as any }));
vi.mock('../../store/services/syncApi', () => ({
  useGetSyncStatusQuery: () => ({ data: poll.status, isSuccess: true }),
  useGetSyncHistoryQuery: () => ({ data: undefined, refetch: () => {} }),
}));
vi.mock('./HandshakeForm', () => ({ default: () => <div>connect-step</div> }));
vi.mock('./StagingView', () => ({ default: () => null }));
vi.mock('./SyncControl', () => ({ default: () => <div>import-step</div> }));
vi.mock('./ConnectedSources', () => ({ default: () => <div>analyze-step</div> }));

import IngestionPage from './IngestionPage';

const job = (status: string, job_id = '42') =>
  ({ status, processed: 20, total: 100, current_prefix: 'pangaea', job_id, error_message: 'Handshake failed: x' });
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

describe('IngestionPage: the polled job status decides the step', () => {
  it.each(['running', 'stopped', 'failed'])('a %s job opens the Import step', (status) => {
    poll.status = job(status);
    render(page());
    expect(screen.getByText('import-step')).toBeInTheDocument();
  });

  it('a completed job opens the Analyze step', () => {
    poll.status = job('completed');
    render(page());
    expect(screen.getByText('analyze-step')).toBeInTheDocument();
  });

  it('after Reset, the next poll of the same failed job does not pull the page back', () => {
    poll.status = job('failed');
    const { rerender } = render(page());
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    poll.status = job('failed'); // next poll: same job, fresh object
    rerender(page());
    expect(screen.getByText('connect-step')).toBeInTheDocument();
    expect(screen.queryByText('import-step')).not.toBeInTheDocument();
  });

  it('a new job after a reset is still shown', () => {
    localStorage.setItem('ignoredJobId', '42');
    poll.status = job('stopped', '43');
    render(page());
    expect(screen.getByText('import-step')).toBeInTheDocument();
  });
});
