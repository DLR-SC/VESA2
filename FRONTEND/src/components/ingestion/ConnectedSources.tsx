import React from 'react';
import { Box, Stack, Typography, Chip, Divider, Skeleton } from '@mui/material';
import { useGetSyncHistoryQuery } from '../../store/services/syncApi';

const fmt = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

const ConnectedSources: React.FC = () => {
  const { data, isLoading } = useGetSyncHistoryQuery();
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
      {sources.map((source) => (
        <Box key={source.prefix} sx={{ py: 1.5 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: source.ui_config?.color ?? 'primary.main', flexShrink: 0 }} />
              <Typography variant="body2" fontWeight={600}>{source.prefix}</Typography>
              <Chip
                label="Active"
                size="small"
                color="success"
                variant="outlined"
                sx={{ height: 18, fontSize: '9pt', fontWeight: 600 }}
              />
            </Stack>
            <Typography variant="caption" color="text.disabled">
              {source.count_success.toLocaleString()} records
            </Typography>
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
      ))}
    </Stack>
  );
};

export default ConnectedSources;
