import React, { useEffect, useState } from 'react';
import { Box, Stack, Typography, Button, CircularProgress, Alert, AlertTitle, Divider, Checkbox, FormControlLabel } from '@mui/material';
import { useInspectSourceQuery, useGetSyncHistoryQuery, useGetBackoffQuery } from '../../store/services/syncApi';
import { IInspectResult } from '../../types/appData';
import SchemaBoard from './SchemaBoard';
import FidelityBar from './FidelityBar';
import RecordInspector from './RecordInspector';

const BASE_URL = (import.meta.env.VITE_API_URL as string) || '';

export interface StagingConfig {
  source: string;        // raw OAI base URL
  set?: string;
  datasetLabel: string;  // graph namespace label
  limit: number;
  color: string;
  batchDelay: number;    // milliseconds (caller already converted)
}

interface Props {
  config: StagingConfig;
  onIngest: (c: { url: string; prefix: string; limit: number; color: string; batchDelay: number; overwrite?: boolean }) => void;
  onBack: () => void;
}

const StagingView: React.FC<Props> = ({ config, onIngest, onBack }) => {
  const { source, set, datasetLabel, limit, color, batchDelay } = config;
  const [selectedPrefix, setSelectedPrefix] = useState<string | undefined>(undefined);
  const [unsupported, setUnsupported] = useState<string[]>([]);
  const [result, setResult] = useState<IInspectResult | undefined>();
  const [overwrite, setOverwrite] = useState(false);

  const { data, error, isFetching } = useInspectSourceQuery(
    { source, set, prefix: selectedPrefix, sample: 12 },
    { skip: !source }
  );

  // Detect a dataset-label clash against already-harvested sources (client-side; no extra round-trip).
  const { data: history } = useGetSyncHistoryQuery();
  const conflict = !!history?.result?.some((e) => e.prefix === datasetLabel);

  // While a request is in flight, poll the backoff side-channel so a retry sleep reads as
  // "retrying…" instead of an indefinite hang.
  const { data: backoffData } = useGetBackoffQuery(undefined, { pollingInterval: isFetching ? 1500 : 0, skip: !isFetching });
  const backoff = isFetching ? backoffData?.backoff : null;
  const backoffMsg = backoff
    ? `Source ${backoff.status ? `rate-limited (HTTP ${backoff.status})` : 'slow to respond'} — retrying in ~${Math.max(0, Math.ceil((backoff.retryAt - Date.now()) / 1000))}s (attempt ${backoff.attempt}/${backoff.total})…`
    : null;

  useEffect(() => {
    if (data) setResult(data);
  }, [data]);

  // Override to a schema the source won't serve → 409: mark it dead, revert to last good.
  useEffect(() => {
    const err = error as any;
    if (err?.status === 409 && err.data?.unsupportedPrefix) {
      setUnsupported((u) => [...new Set([...u, err.data.unsupportedPrefix])]);
      setSelectedPrefix(result?.selectedPrefix);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error]);

  const handleIngest = () => {
    if (!result) return;
    const p = new URLSearchParams({ source });
    if (set) p.set('set', set);
    p.set('prefix', result.selectedPrefix); // pin the inspected schema so ingest skips re-negotiation
    onIngest({ url: `${BASE_URL}/oai/records?${p.toString()}`, prefix: datasetLabel, limit, color, batchDelay, overwrite: conflict ? overwrite : undefined });
  };

  if (!result && isFetching) {
    return (
      <Stack alignItems="center" spacing={2} sx={{ py: 6 }}>
        <CircularProgress />
        <Typography variant="body2" color="text.secondary">Inspecting {source}…</Typography>
        <Typography variant="caption" color={backoffMsg ? 'warning.main' : 'text.disabled'}>
          {backoffMsg ?? 'Discover → Negotiate → Sample → Verify'}
        </Typography>
      </Stack>
    );
  }

  const fatal = error as any;
  if (!result && fatal) {
    return (
      <Stack spacing={2}>
        <Alert severity="error">{fatal.data?.error || 'Could not inspect this source.'}</Alert>
        <Button onClick={onBack} sx={{ alignSelf: 'flex-start', textTransform: 'none' }}>Back</Button>
      </Stack>
    );
  }
  if (!result) return null;

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="subtitle1">Staging — {source}</Typography>
        <Typography variant="caption" color="text.disabled">
          Review what VESA will harvest, then ingest. Nothing is written until you click Ingest.
        </Typography>
      </Box>

      <SchemaBoard
        discovered={result.discovered}
        unsupported={unsupported}
        disabled={isFetching}
        onSelect={setSelectedPrefix}
      />

      <Divider />

      <RecordInspector sample={result.sample} />

      <FidelityBar fidelity={result.fidelity} />

      {conflict && (
        <Alert severity="warning" variant="outlined" sx={{ borderRadius: 1 }}>
          <AlertTitle>Repository label “{datasetLabel}” already exists</AlertTitle>
          <Typography variant="body2">Ingesting will permanently overwrite the existing records for this label.</Typography>
          <FormControlLabel
            control={<Checkbox checked={overwrite} onChange={(e) => setOverwrite(e.target.checked)} />}
            label="Confirm overwrite"
            sx={{ mt: 1 }}
          />
        </Alert>
      )}

      <Stack direction="row" spacing={2} alignItems="center">
        <Button
          variant="contained"
          onClick={handleIngest}
          disabled={isFetching || (conflict && !overwrite)}
          sx={{ textTransform: 'none', minWidth: 140 }}
        >
          Ingest ▶
        </Button>
        <Button variant="text" onClick={onBack} sx={{ textTransform: 'none' }}>Back</Button>
        {isFetching && <CircularProgress size={18} />}
        {backoffMsg && <Typography variant="caption" color="warning.main">{backoffMsg}</Typography>}
      </Stack>
    </Stack>
  );
};

export default StagingView;
