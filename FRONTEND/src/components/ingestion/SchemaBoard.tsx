import React from 'react';
import { Box, Chip, Stack, Tooltip, Typography } from '@mui/material';
import { IInspectResult } from '../../types/appData';

// Negotiation board: the schemas a source serves, ranked, with the auto-selected one
// highlighted. Click another to override; unsupported ones (409 on probe) are struck out.
const RANK_LABEL: Record<number, string> = { 3: 'rich (geo/temporal)', 1: 'generic', 0: 'Dublin Core floor' };
const RANK_COLOR: Record<number, 'success' | 'info' | 'default'> = { 3: 'success', 1: 'info', 0: 'default' };

interface Props {
  discovered: IInspectResult['discovered'];
  unsupported: string[];
  disabled?: boolean;
  onSelect: (prefix: string) => void;
}

const SchemaBoard: React.FC<Props> = ({ discovered, unsupported, disabled, onSelect }) => (
  <Box>
    <Typography variant="caption" color="text.disabled" display="block" sx={{ mb: 1 }}>
      Metadata schema — the richest available is auto-selected. Click to override.
    </Typography>
    <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
      {discovered.map((s) => {
        const dead = unsupported.includes(s.prefix);
        return (
          <Tooltip key={s.prefix} title={dead ? 'Not served by this source' : RANK_LABEL[s.rank]} placement="top">
            <span>
              <Chip
                label={s.prefix}
                onClick={() => !disabled && !dead && !s.selected && onSelect(s.prefix)}
                variant={s.selected ? 'filled' : 'outlined'}
                color={dead ? 'default' : s.selected ? 'primary' : RANK_COLOR[s.rank]}
                size="small"
                disabled={disabled || dead}
                sx={dead ? { textDecoration: 'line-through', opacity: 0.5 } : undefined}
              />
            </span>
          </Tooltip>
        );
      })}
    </Stack>
  </Box>
);

export default SchemaBoard;
