import React, { useState } from 'react';
import { Box, TextField, Typography, Alert, Button, Stack, useTheme, AlertTitle, Tooltip, Chip, Divider, ToggleButton, ToggleButtonGroup } from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';

const BASE_URL = (import.meta.env.VITE_API_URL as string) || '';

// Known OAI-PMH repositories — prefill the real base URL; the proxy negotiates the schema.
// `proxyPath` (when present) is a curated hand-written proxy for that source, offering an
// exact mapping as an alternative to the universal heuristic — see the Mapping toggle.
interface RepoPreset {
  id: string; label: string; oaiUrl: string; set: string; dataset: string; batchDelay: number;
  proxyPath?: string;
}
const PRESETS: RepoPreset[] = [
  { id: 'pangaea',   label: 'PANGAEA',   oaiUrl: 'https://ws.pangaea.de/oai/provider', set: 'citable', dataset: 'pangaea', batchDelay: 1, proxyPath: '/proxy/pangaea' },
  { id: 'gbif',      label: 'GBIF',      oaiUrl: 'https://api.gbif.org/v1/oai-pmh/registry', set: '', dataset: 'gbif', batchDelay: 5, proxyPath: '/proxy/gbif' },
  { id: 'zenodo',    label: 'Zenodo',    oaiUrl: 'https://zenodo.org/oai2d', set: '', dataset: 'zenodo', batchDelay: 1, proxyPath: '/proxy/zenodo' },
  { id: 'arxiv',     label: 'arXiv',     oaiUrl: 'https://oaipmh.arxiv.org/oai', set: '', dataset: 'arxiv', batchDelay: 5 },
  { id: 'figshare',  label: 'Figshare',  oaiUrl: 'https://api.figshare.com/v2/oai', set: '', dataset: 'figshare', batchDelay: 2 },
  { id: 'dataverse', label: 'Dataverse', oaiUrl: 'https://dataverse.harvard.edu/oai', set: '', dataset: 'dataverse', batchDelay: 2 },
];

// amCharts 5 default series color palette
const PALETTE = [
  '#543CF0', // VESA primary
  '#45a1cd',
  '#4a7edc',
  '#6b52ce',
  '#9a4bd6',
  '#ce46be',
  '#ce426a',
  '#cc7045',
  '#c4a03c',
  '#42c176',
];

// A custom proxy exposes GET <base>/records returning IDataAdapter. Accept a base URL or a
// full /records URL — normalise to the endpoint SyncOrchestrator harvests.
const buildRecordsUrl = (base: string) => {
  const trimmed = base.trim().replace(/\/+$/, '');
  return /\/records$/.test(trimmed) ? trimmed : `${trimmed}/records`;
};

export interface InspectConfig {
  source: string;        // raw OAI base URL
  set?: string;
  datasetLabel: string;  // graph namespace label
  limit: number;
  color: string;
  batchDelay: number;    // milliseconds
}

interface HandshakeFormProps {
  onInspect: (config: InspectConfig) => void;
  // Curated path: known source with a hand-written proxy → skip inspection, import directly.
  onIngestDirect?: (config: { url: string; prefix: string; limit: number; color: string; batchDelay: number }) => void;
  isSystemBusy?: boolean;
}

const HandshakeForm: React.FC<HandshakeFormProps> = ({ onInspect, onIngestDirect, isSystemBusy }) => {
  const theme = useTheme();
  const [url, setUrl] = useState('');
  const [setName, setSetName] = useState('');
  const [prefix, setPrefix] = useState('');
  const [limit, setLimit] = useState(100);
  const [color, setColor] = useState(PALETTE[0]);
  const [batchDelay, setBatchDelay] = useState(1);
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [curated, setCurated] = useState(false);
  // 'oai' = explore via ListMetadataFormats (inspect first); 'custom' = user's own proxy (import direct).
  const [mode, setMode] = useState<'oai' | 'custom'>('oai');
  const [proxyUrl, setProxyUrl] = useState('');

  const active = PRESETS.find((p) => p.id === activePreset);
  const useCurated = !!active?.proxyPath && curated;

  const handlePreset = (preset: RepoPreset) => {
    setActivePreset(preset.id);
    setUrl(preset.oaiUrl);
    setSetName(preset.set);
    setPrefix(preset.dataset);
    setLimit(100);
    setBatchDelay(preset.batchDelay);
    setCurated(!!preset.proxyPath); // default a known source to its exact mapping
  };

  // Prefill Custom Proxy with a bundled hand-written proxy — a working example of the /records contract.
  const handleExampleProxy = (preset: RepoPreset) => {
    setProxyUrl(`${BASE_URL}${preset.proxyPath}`);
    setPrefix(preset.dataset);
  };

  const handleSubmit = () => {
    if (mode === 'custom') {
      onIngestDirect?.({ url: buildRecordsUrl(proxyUrl), prefix, limit, color, batchDelay: batchDelay * 1000 });
      return;
    }
    if (useCurated && active?.proxyPath) {
      onIngestDirect?.({
        url: `${BASE_URL}${active.proxyPath}/records`,
        prefix,
        limit,
        color,
        batchDelay: batchDelay * 1000,
      });
      return;
    }
    onInspect({
      source: url.trim(),
      set: setName || undefined,
      datasetLabel: prefix,
      limit,
      color,
      batchDelay: batchDelay * 1000,
    });
  };

  return (
    <Stack spacing={3} sx={{ mt: theme.spacing(1) }}>
      {isSystemBusy ? (
        <Alert severity="info" variant="outlined" sx={{ borderRadius: 1 }}>
          <AlertTitle>System Busy</AlertTitle>
          An import is currently in progress. Please wait for completion or stop the current job.
        </Alert>
      ) : (
        <>
          <ToggleButtonGroup
            value={mode}
            exclusive
            size="small"
            onChange={(_, v) => v && setMode(v)}
            sx={{ alignSelf: 'flex-start' }}
          >
            <ToggleButton value="oai" sx={{ textTransform: 'none', px: 2 }}>OAI-PMH Source</ToggleButton>
            <ToggleButton value="custom" sx={{ textTransform: 'none', px: 2 }}>Custom Proxy</ToggleButton>
          </ToggleButtonGroup>
          <Typography variant="body2" color="text.secondary">
            {mode === 'oai'
              ? `Paste any OAI-PMH endpoint URL, or pick a known repository below. The next step inspects the
                 source — schema, a sample of records, and what VESA can extract — before anything is imported.`
              : `For a source VESA doesn't support out of the box, write your own proxy that exposes
                 GET /records returning the { dataset, authors, keywords } contract, then point VESA at it.
                 Records import directly — no inspection step.`}
          </Typography>
        </>
      )}

      {mode === 'oai' ? (
        <>
          <Box>
            <Typography variant="caption" color="text.disabled" display="block" sx={{ mb: 1 }}>
              Known Repositories
            </Typography>
            <Stack direction="row" spacing={1} useFlexGap sx={{ mb: 1, flexWrap: 'wrap' }}>
              {PRESETS.map((preset) => (
                <Chip
                  key={preset.id}
                  label={preset.label}
                  onClick={() => !isSystemBusy && handlePreset(preset)}
                  variant={activePreset === preset.id ? 'filled' : 'outlined'}
                  color={activePreset === preset.id ? 'primary' : 'default'}
                  size="small"
                  disabled={isSystemBusy}
                />
              ))}
            </Stack>
            <Typography variant="caption" color="text.disabled">
              Prefills the repository's OAI-PMH base URL. The richest available schema is selected
              automatically; unknown schemas fall back to Dublin Core.
            </Typography>
          </Box>

          <Divider />

          <TextField
            fullWidth
            label="OAI-PMH Endpoint URL"
            variant="outlined"
            placeholder="e.g. https://zenodo.org/oai2d"
            value={url}
            onChange={(e) => { setActivePreset(null); setSetName(''); setCurated(false); setUrl(e.target.value); }}
            disabled={isSystemBusy}
            helperText="The repository's OAI-PMH base URL."
          />
        </>
      ) : (
        <Box>
          <Typography variant="caption" color="text.disabled" display="block" sx={{ mb: 1 }}>
            Example Proxies
          </Typography>
          <Stack direction="row" spacing={1} useFlexGap sx={{ mb: 2, flexWrap: 'wrap' }}>
            {PRESETS.filter((p) => p.proxyPath).map((preset) => (
              <Chip
                key={preset.id}
                label={preset.label}
                onClick={() => !isSystemBusy && handleExampleProxy(preset)}
                variant="outlined"
                size="small"
                disabled={isSystemBusy}
              />
            ))}
          </Stack>
          <TextField
            fullWidth
            label="Proxy URL"
            variant="outlined"
            placeholder="e.g. http://localhost:3001/proxy/my-source"
            value={proxyUrl}
            onChange={(e) => setProxyUrl(e.target.value)}
            disabled={isSystemBusy}
            helperText="Base URL of your proxy (GET /records is appended if omitted). Records must match { dataset, authors, keywords }."
          />
        </Box>
      )}

      <Box sx={{ display: 'flex', gap: theme.spacing(2) }}>
        <TextField
          sx={{ flex: 1 }}
          label="Repository Label"
          variant="outlined"
          value={prefix}
          onChange={(e) => setPrefix(e.target.value)}
          placeholder="e.g. zenodo:"
          disabled={isSystemBusy}
        />
        <TextField
          type="number"
          label="Limit"
          variant="outlined"
          value={limit}
          onChange={(e) => setLimit(Number(e.target.value))}
          sx={{ width: 120 }}
          disabled={isSystemBusy}
        />
        <Tooltip title="Seconds to wait between page requests." placement="top">
          <TextField
            type="number"
            label="Batch Delay (s)"
            variant="outlined"
            value={batchDelay}
            onChange={(e) => setBatchDelay(Math.max(0, Number(e.target.value)))}
            inputProps={{ min: 0 }}
            sx={{ width: 140 }}
            disabled={isSystemBusy}
          />
        </Tooltip>
      </Box>

      {/* Curated proxies exist only for known sources — offer the exact mapping vs. the heuristic. */}
      {mode === 'oai' && active?.proxyPath && (
        <Box>
          <Typography variant="caption" color="text.disabled" display="block" sx={{ mb: 1 }}>
            Mapping
          </Typography>
          <Stack direction="row" spacing={1}>
            <Chip
              label="Curated (exact)"
              size="small"
              onClick={() => !isSystemBusy && setCurated(true)}
              variant={curated ? 'filled' : 'outlined'}
              color={curated ? 'primary' : 'default'}
              disabled={isSystemBusy}
            />
            <Chip
              label="Universal (heuristic)"
              size="small"
              onClick={() => !isSystemBusy && setCurated(false)}
              variant={!curated ? 'filled' : 'outlined'}
              color={!curated ? 'primary' : 'default'}
              disabled={isSystemBusy}
            />
          </Stack>
          <Typography variant="caption" color="text.disabled" display="block" sx={{ mt: 1 }}>
            Curated uses this repository's hand-written mapping and imports directly. Universal
            negotiates the schema and lets you inspect a sample first.
          </Typography>
        </Box>
      )}

      {/* Source colour — drives the accent in ConnectedSources and chart series */}
      <Box>
        <Typography variant="caption" color="text.disabled" display="block" sx={{ mb: 1 }}>
          Source Color
        </Typography>
        <Stack direction="row" spacing={1}>
          {PALETTE.map((hex) => (
            <Tooltip key={hex} title={hex} placement="top">
              <Box
                onClick={() => !isSystemBusy && setColor(hex)}
                sx={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  bgcolor: hex,
                  cursor: isSystemBusy ? 'default' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  outline: color === hex ? `2px solid ${theme.palette.text.primary}` : '2px solid transparent',
                  outlineOffset: 2,
                  transition: 'outline 0.15s',
                }}
              >
                {color === hex && (
                  <CheckIcon sx={{ fontSize: 14, color: '#fff' }} />
                )}
              </Box>
            </Tooltip>
          ))}
        </Stack>
      </Box>

      <Button
        variant="contained"
        onClick={handleSubmit}
        disabled={isSystemBusy || !prefix || (mode === 'custom' ? !proxyUrl : !url)}
        size="large"
        sx={{ py: 1.5, mt: 1, alignSelf: 'flex-start', minWidth: 180, textTransform: 'none' }}
      >
        {mode === 'custom' ? 'Import Records' : useCurated ? 'Import (curated)' : 'Inspect Source'}
      </Button>
    </Stack>
  );
};

export default HandshakeForm;
