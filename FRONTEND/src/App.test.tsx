import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import App from './App';

// Prevent RTK Query from making real network calls during tests
beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ result: [] }),
  }));
});

describe('App', () => {
  it('renders the application title in the AppBar', async () => {
    render(<App />);
    expect(
      await screen.findByText(/Visualisation Enabled Search Application/i)
    ).toBeInTheDocument();
  });
});
