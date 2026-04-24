import React, { useState } from 'react';
import { Box, TextField, Typography, Alert, Button, CircularProgress, Stack, useTheme, AlertTitle, Checkbox, FormControlLabel, Tooltip, Chip, Divider, InputAdornment } from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';
import LockIcon from '@mui/icons-material/Lock';
import { useValidateUrlMutation } from '../../store/services/syncApi';

const BASE_URL = (import.meta.env.VITE_API_URL as string) || '';

const PRESETS = [
  { id: 'pangaea', label: 'PANGAEA', path: '/pangaea/records', prefix: 'pangaea', limit: 500, batchDelay: 1 },
  { id: 'gbif',    label: 'GBIF',    path: '/gbif/records',    prefix: 'gbif',    limit: 500, batchDelay: 5 },
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

interface HandshakeFormProps {
  onValidated: (config: { url: string; prefix: string; limit: number; color: string; batchDelay: number; overwrite?: boolean }) => void;
  isSystemBusy?: boolean;
}

const HandshakeForm: React.FC<HandshakeFormProps> = ({ onValidated, isSystemBusy }) => {
  const theme = useTheme();
  const [url, setUrl] = useState('');
  const [prefix, setPrefix] = useState('');
  const [limit, setLimit] = useState(1000);
  const [color, setColor] = useState(PALETTE[0]);
  const [batchDelay, setBatchDelay] = useState(1);
  const [overwrite, setOverwrite] = useState(false);
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [validateUrl, { isLoading, error }] = useValidateUrlMutation();

  const handlePreset = (preset: typeof PRESETS[number]) => {
    if (activePreset === preset.id) {
      setActivePreset(null);
      setUrl('');
      setPrefix('');
      setLimit(1000);
      setBatchDelay(1);
    } else {
      setActivePreset(preset.id);
      setUrl(`${BASE_URL}${preset.path}`);
      setPrefix(preset.prefix);
      setLimit(preset.limit);
      setBatchDelay(preset.batchDelay);
    }
  };

  const err = error as any;
  const isConflict = err?.status === 409;
  const errData = err?.data;

  const handleValidate = async () => {
    try {
      const response = await validateUrl({ target_url: url, dataset_id: prefix, overwrite }).unwrap();
      if (response.valid) onValidated({ url, prefix, limit, color, batchDelay: batchDelay * 1000, overwrite });
    } catch {
      // Error state is automatically captured by RTK Query's 'error' object
    }
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
          Verify the research repository compatibility to begin the synchronization process.
        </Typography>
      )}

      <Box>
        <Typography variant="caption" color="text.disabled" display="block" sx={{ mb: 1 }}>
          Built-in proxies
        </Typography>
        <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
          {PRESETS.map((preset) => (
            <Chip
              key={preset.id}
              label={preset.label}
              onClick={() => !isLoading && !isSystemBusy && handlePreset(preset)}
              variant={activePreset === preset.id ? 'filled' : 'outlined'}
              color={activePreset === preset.id ? 'primary' : 'default'}
              size="small"
              disabled={isLoading || isSystemBusy}
            />
          ))}
        </Stack>
        <Typography variant="caption" color="text.disabled">
          External APIs like PANGAEA and GBIF return data in their own formats. The built-in proxies translate those responses into the VESA Data Adapter schema that the ingestion pipeline expects. Select a preset to auto-fill the endpoint and recommended settings for that source.
        </Typography>
      </Box>

      <Divider />

      <TextField
        fullWidth
        label="API Endpoint URL"
        variant="outlined"
        value={activePreset ? PRESETS.find(p => p.id === activePreset)!.path : url}
        onChange={(e) => { setActivePreset(null); setUrl(e.target.value); }}
        disabled={isLoading || isSystemBusy || !!activePreset}
        InputProps={activePreset ? {
          startAdornment: (
            <InputAdornment position="start">
              <Chip
                label={PRESETS.find(p => p.id === activePreset)!.label}
                size="small"
                color="primary"
                sx={{ fontWeight: 600, letterSpacing: 0.3 }}
              />
            </InputAdornment>
          ),
          endAdornment: (
            <Tooltip title="URL is managed by the built-in proxy. Deselect the preset to enter a custom endpoint.">
              <LockIcon fontSize="small" sx={{ color: 'text.disabled' }} />
            </Tooltip>
          ),
        } : undefined}
      />

      <Box sx={{ display: 'flex', gap: theme.spacing(2) }}>
        <TextField
          sx={{ flex: 1 }}
          label="Dataset Label"
          variant="outlined"
          value={prefix}
          onChange={(e) => setPrefix(e.target.value)}
          placeholder="e.g. pangaea:"
          disabled={isLoading || isSystemBusy}
        />
        <TextField
          type="number"
          label="Limit"
          variant="outlined"
          value={limit}
          onChange={(e) => setLimit(Number(e.target.value))}
          sx={{ width: 120 }}
          disabled={isLoading || isSystemBusy}
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
            disabled={isLoading || isSystemBusy}
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

      {isConflict && (
        <Alert severity="warning" variant="outlined" sx={{ borderRadius: 1 }}>
          <AlertTitle>Dataset Already Exists</AlertTitle>
          <Typography variant="body2">
            This dataset label is currently in use. If you continue, the existing data will be permanently overwritten.
          </Typography>
          <FormControlLabel
            control={<Checkbox checked={overwrite} onChange={(e) => setOverwrite(e.target.checked)} />}
            label="Confirm overwrite"
            sx={{ mt: 1 }}
          />
        </Alert>
      )}

      {error && !isConflict && (
        <Alert
          severity="error"
          variant="outlined"
          sx={{ borderRadius: 1, backgroundColor: 'rgba(211, 47, 47, 0.04)' }}
        >
          <AlertTitle>
            Connection Failed {errData?.originalStatus ? `(Error ${errData.originalStatus})` : (err?.status ? `(Status ${err.status})` : '')}
          </AlertTitle>
          <Typography variant="body2">{errData?.message || errData?.error || 'An unexpected error occurred while verifying the connection.'}</Typography>
          {errData?.reason && (
            <Typography variant="caption" sx={{ display: 'block', mt: 0.5, fontStyle: 'italic', opacity: 0.8 }}>
              Reason: {errData.reason}
            </Typography>
          )}
        </Alert>
      )}

      <Button
        variant="contained"
        onClick={handleValidate}
        disabled={isLoading || isSystemBusy || !url || !prefix || (isConflict && !overwrite)}
        size="large"
        sx={{ py: 1.5, mt: 1, alignSelf: 'flex-start', minWidth: 180, textTransform: 'none' }}
      >
        {isLoading ? <CircularProgress size={24} color="inherit" /> : 'Verify Connection'}
      </Button>
    </Stack>
  );
};

export default HandshakeForm;
