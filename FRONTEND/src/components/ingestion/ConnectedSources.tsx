import React from 'react';
import { Box, Stack, Typography, Chip, Divider, Skeleton, Switch, Tooltip } from '@mui/material';
import { useGetSyncHistoryQuery } from '../../store/services/syncApi';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { toggleSourceConnection } from '../../store/ui/uiSlice';

const fmt = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

const ConnectedSources: React.FC = () => {
  const { data, isLoading } = useGetSyncHistoryQuery();
  const dispatch = useAppDispatch();
  const disconnectedSources = useAppSelector((s) => s.ui.disconnectedSources);
  const sources = data?.result ?? [];

  if (isLoading) {
    return (
      <Stack spacing={2}>
        <Skeleton variant="text" width="60%" />
        <Skeleton variant="text" width="80%" />
      </Stack>
    );
  }

  if (sources.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        No data sources connected yet.
      </Typography>
    );
  }

  return (
    <Stack divider={<Divider />} spacing={0}>
      {sources.map((source) => {
        const isConnected = !disconnectedSources.includes(source.prefix);
        return (
        <Box key={source.prefix} sx={{ py: 1.5, opacity: isConnected ? 1 : 0.55, transition: 'opacity 0.15s' }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: isConnected ? (source.ui_config?.color ?? 'primary.main') : 'text.disabled', flexShrink: 0 }} />
              <Typography variant="body2" fontWeight={600}>{source.prefix}</Typography>
              <Chip
                label={isConnected ? 'Active' : 'Hidden'}
                size="small"
                color={isConnected ? 'success' : 'default'}
                variant="outlined"
                sx={{ height: 18, fontSize: '9pt', fontWeight: 600 }}
              />
            </Stack>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Typography variant="caption" color="text.disabled">
                {source.count_success.toLocaleString()} records
              </Typography>
              <Tooltip title={isConnected ? 'Disconnect (hide from charts)' : 'Connect (show in charts)'}>
                <Switch
                  size="small"
                  checked={isConnected}
                  onChange={() => dispatch(toggleSourceConnection(source.prefix))}
                  inputProps={{ 'aria-label': `toggle-source-${source.prefix}` }}
                />
              </Tooltip>
            </Stack>
          </Stack>
          <Stack direction="row" justifyContent="space-between">
            <Typography
              variant="caption"
              color="text.disabled"
              sx={{ maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            >
              {source.source_url}
            </Typography>
            <Typography variant="caption" color="text.disabled">
              {fmt(source.end_time)}
            </Typography>
          </Stack>
        </Box>
        );
      })}
    </Stack>
  );
};

export default ConnectedSources;
