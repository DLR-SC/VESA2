import React from 'react';
import { Box, Chip, Stack, Typography } from '@mui/material';
import { IInspectResult } from '../../types/appData';

// What the source actually populates, across the sampled records — so the user sees a
// source's shortcomings (e.g. "no geo") before committing to a harvest.
const pctColor = (p: number): 'success' | 'warning' | 'default' => (p >= 70 ? 'success' : p > 0 ? 'warning' : 'default');

interface Props {
  fidelity: IInspectResult['fidelity'];
}

const FidelityBar: React.FC<Props> = ({ fidelity: f }) => (
  <Box>
    <Typography variant="caption" color="text.disabled" display="block" sx={{ mb: 1 }}>
      What this source populates (sampled {f.sampled} records)
    </Typography>
    <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
      <Chip size="small" variant="outlined" color={pctColor(f.mapPct)} label={`Map ${f.mapPct}%`} />
      <Chip size="small" variant="outlined" color={pctColor(f.timePct)} label={`Time ${f.timePct}%`} />
      <Chip size="small" variant="outlined" color={pctColor(f.abstractPct)} label={`Abstract ${f.abstractPct}%`} />
      <Chip size="small" variant="outlined" label={`Authors avg ${f.authorsAvg}`} />
      <Chip size="small" variant="outlined" label={`Keywords avg ${f.keywordsAvg}`} />
    </Stack>
  </Box>
);

export default FidelityBar;
