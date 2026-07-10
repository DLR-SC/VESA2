import React, { useState } from 'react';
import { Box, Stack, Typography, Chip, Divider, Skeleton, Switch, Tooltip, IconButton, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Button, CircularProgress } from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { useGetSyncHistoryQuery, useDeleteSourceMutation } from '../../store/services/syncApi';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { toggleSourceConnection } from '../../store/ui/uiSlice';
import { hardReset } from '../../store';

const fmt = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

const ConnectedSources: React.FC = () => {
  const { data, isLoading } = useGetSyncHistoryQuery();
  const dispatch = useAppDispatch();
  const disconnectedSources = useAppSelector((s) => s.ui.disconnectedSources);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [deleteSource, { isLoading: isDeleting, error: deleteError, reset: resetDelete }] = useDeleteSourceMutation();
  const sources = data?.result ?? [];
  const pendingSource = sources.find((s) => s.prefix === pendingDelete);

  const closeDialog = () => { setPendingDelete(null); resetDelete(); };
  const confirmDelete = async () => {
    if (!pendingDelete) return;
    try {
      await deleteSource(pendingDelete).unwrap();
      // Drop a stale hide entry if the deleted source was hidden (toggle only ever removes when present).
      if (disconnectedSources.includes(pendingDelete)) dispatch(toggleSourceConnection(pendingDelete));
      dispatch(hardReset()); // reload charts so the purged source's records leave the dataApi cache too
      closeDialog();
    } catch { /* failure stays visible via deleteError */ }
  };

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
    <>
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
              <Tooltip title="Delete permanently">
                <IconButton
                  size="small"
                  aria-label={`delete-source-${source.prefix}`}
                  onClick={() => setPendingDelete(source.prefix)}
                  sx={{ color: 'text.disabled', '&:hover': { color: 'error.main' } }}
                >
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
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

    <Dialog
      open={pendingDelete !== null}
      onClose={closeDialog}
      PaperProps={{ sx: { borderRadius: 2, width: 420, maxWidth: '100%' } }}
    >
      <DialogTitle sx={{ fontWeight: 600 }}>Delete “{pendingDelete}”?</DialogTitle>
      <DialogContent>
        <DialogContentText variant="body2">
          This permanently removes the <b>{pendingSource?.count_success.toLocaleString()}</b> records imported
          from <b>{pendingDelete}</b>, along with their keywords and authors. This action cannot be undone.
        </DialogContentText>
        {deleteError != null && (
          <Typography variant="body2" color="error" sx={{ mt: 2 }}>
            {(deleteError as any)?.data?.error ?? 'Delete failed. Please try again.'}
          </Typography>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={closeDialog} disabled={isDeleting} color="inherit" sx={{ textTransform: 'none' }}>
          Cancel
        </Button>
        <Button
          onClick={confirmDelete}
          color="error"
          variant="contained"
          disabled={isDeleting}
          startIcon={isDeleting ? <CircularProgress size={16} color="inherit" /> : <DeleteOutlineIcon />}
          sx={{ textTransform: 'none' }}
        >
          {isDeleting ? 'Deleting…' : 'Delete'}
        </Button>
      </DialogActions>
    </Dialog>
    </>
  );
};

export default ConnectedSources;
