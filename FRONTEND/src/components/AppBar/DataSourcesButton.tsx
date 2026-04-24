import { useState } from 'react';
import { IconButton, Tooltip, Popover, Box, Stack, Typography, Button, Badge, Divider } from '@mui/material';
import StorageIcon from '@mui/icons-material/Storage';
import AddIcon from '@mui/icons-material/Add';
import { useNavigate } from 'react-router-dom';
import ConnectedSources from '../ingestion/ConnectedSources';

const DataSourcesButton = (): JSX.Element => {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const navigate = useNavigate();

  const handleOpen = (e: React.MouseEvent<HTMLElement>) => setAnchorEl(e.currentTarget);
  const handleClose = () => setAnchorEl(null);
  const handleSetup = () => { handleClose(); navigate('/setup'); };

  return (
    <>
      <Tooltip title="Data Sources">
        <IconButton aria-label="data-sources-button" color="primary" onClick={handleOpen}>
            <StorageIcon sx={{ fontSize: '1.6rem' }} />
        </IconButton>
      </Tooltip>

      <Popover
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        PaperProps={{
          elevation: 0,
          variant: 'outlined',
          sx: { width: 420, borderRadius: 2, mt: 1 },
        }}
      >
        <Box sx={{ px: 3, pt: 3, pb: 1 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
            <Typography variant="h3">Data Sources</Typography>
            <Button
              size="small"
              startIcon={<AddIcon />}
              onClick={handleSetup}
              sx={{ textTransform: 'none' }}
            >
              Add Source
            </Button>
          </Stack>
          <ConnectedSources />
        </Box>
        <Divider />
      </Popover>
    </>
  );
};

export default DataSourcesButton;
