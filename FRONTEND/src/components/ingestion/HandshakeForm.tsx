import React, { useState } from 'react';
import { Box, TextField, Typography, Alert, Button, Stack, useTheme, AlertTitle, Tooltip, Chip, Divider } from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';

// Known OAI-PMH repositories — prefill the real base URL; the proxy negotiates the schema.
const PRESETS = [
  { id: 'pangaea',   label: 'PANGAEA',   oaiUrl: 'https://ws.pangaea.de/oai/provider', set: 'citable', dataset: 'pangaea', batchDelay: 1 },
  { id: 'gbif',      label: 'GBIF',      oaiUrl: 'https://api.gbif.org/v1/oai-pmh/registry', set: '', dataset: 'gbif', batchDelay: 5 },
  { id: 'zenodo',    label: 'Zenodo',    oaiUrl: 'https://zenodo.org/oai2d', set: '', dataset: 'zenodo', batchDelay: 1 },
  { id: 'arxiv',     label: 'arXiv',     oaiUrl: 'https://oaipmh.arxiv.org/oai', set: '', dataset: 'arxiv', batchDelay: 5 },
  { id: 'figshare',  label: 'Figshare',  oaiUrl: 'https://api.figshare.com/v2/oai', set: '', dataset: 'figshare', batchDelay: 2 },
  { id: 'dataverse', label: 'Dataverse', oaiUrl: 'https://dataverse.harvard.edu/oai', set: '', dataset: 'dataverse', batchDelay: 2 },
] as const;

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
  isSystemBusy?: boolean;
}

const HandshakeForm: React.FC<HandshakeFormProps> = ({ onInspect, isSystemBusy }) => {
  const theme = useTheme();
  const [url, setUrl] = useState('');
  const [setName, setSetName] = useState('');
  const [prefix, setPrefix] = useState('');
  const [limit, setLimit] = useState(100);
  const [color, setColor] = useState(PALETTE[0]);
  const [batchDelay, setBatchDelay] = useState(1);
  const [activePreset, setActivePreset] = useState<string | null>(null);

  const handlePreset = (preset: typeof PRESETS[number]) => {
    setActivePreset(preset.id);
    setUrl(preset.oaiUrl);
    setSetName(preset.set);
    setPrefix(preset.dataset);
    setLimit(100);
    setBatchDelay(preset.batchDelay);
  };

  const handleInspect = () => {
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
        <Typography variant="body2" color="text.secondary">
          Paste any OAI-PMH endpoint URL, or pick a known repository below. The next step inspects the
          source — schema, a sample of records, and what VESA can extract — before anything is imported.
        </Typography>
      )}

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
        onChange={(e) => { setActivePreset(null); setSetName(''); setUrl(e.target.value); }}
        disabled={isSystemBusy}
        helperText="The repository's OAI-PMH base URL."
      />

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
        onClick={handleInspect}
        disabled={isSystemBusy || !url || !prefix}
        size="large"
        sx={{ py: 1.5, mt: 1, alignSelf: 'flex-start', minWidth: 180, textTransform: 'none' }}
      >
        Inspect Source
      </Button>
    </Stack>
  );
};

export default HandshakeForm;
