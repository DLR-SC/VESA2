import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

const idle = [() => {}, { isLoading: false }] as const;
vi.mock('../../store/services/syncApi', () => ({
  useStartSyncMutation: () => idle,
  useStopSyncMutation: () => idle,
  useResumeSyncMutation: () => idle,
}));

import SyncControl from './SyncControl';

const config = { url: '/proxy/pangaea/records', prefix: 'pangaea', limit: 100, color: '#543CF0', batchDelay: 1000 };
const show = (status: any) => render(<SyncControl config={config} status={{ processed: 20, total: 100, job_id: '42', ...status }} />);

describe('SyncControl', () => {
  it('keeps showing Stopping… while the backend winds the job down', () => {
    show({ status: 'running', stopping: true });
    expect(screen.getByRole('button', { name: /Stopping/ })).toBeDisabled();
  });

  it.each([
    ['stopped', 'Import stopped'],
    ['failed', 'Import failed'],
  ])('a %s job offers Resume and Start Over', (status, title) => {
    show({ status, error_message: 'Handshake failed: x' });
    expect(screen.getByText(title)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Resume Import/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Start Over/ })).toBeInTheDocument();
  });

  it('shows the error for a failed job', () => {
    show({ status: 'failed', error_message: 'Handshake failed: x' });
    expect(screen.getByText(/Handshake failed: x/)).toBeInTheDocument();
  });
});
