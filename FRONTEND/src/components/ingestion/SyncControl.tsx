import React from 'react';
import { Box, Button, Typography, LinearProgress, Alert, Stack, useTheme } from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';
import ReplayIcon from '@mui/icons-material/Replay';
import { useStartSyncMutation, useStopSyncMutation, useResumeSyncMutation } from '../../store/services/syncApi';

interface SyncControlProps {
	config: { url: string; prefix: string; limit: number; color: string; batchDelay: number; overwrite?: boolean };
	status: any;
}

const SyncControl: React.FC<SyncControlProps> = ({ config, status }) => {
	const theme = useTheme();
	const [startSync, { isLoading: isStarting, error }] = useStartSyncMutation();
	const [stopSync, { isLoading: isStopping }] = useStopSyncMutation();
	const [resumeSync, { isLoading: isResuming, error: resumeError }] = useResumeSyncMutation();

	const isRunning = status?.status === 'running';
	const isFailed = status?.status === 'failed' && !!status?.job_id;
	const totalRecords = status?.total || config.limit || 1;
	const processedRecords = status?.processed || 0;
	const progress = (processedRecords / totalRecords) * 100;

	return (
		<Box sx={{ mt: 1 }}>
			<Stack spacing={3}>
					{config.url && (
					<Typography variant="body2" color="text.secondary">
						Connected to <b>{config.url}</b>. Ready to process <b>{config.limit}</b> records for dataset <b>{config.prefix}</b>.
					</Typography>
				)}
				
				{isRunning ? (
					<Stack spacing={1}>
						<Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
							<Typography variant="body2" fontWeight="medium">Importing Records...</Typography>
							<Typography variant="body2" color="primary">{Math.round(progress)}%</Typography>
						</Box>
						<LinearProgress
							variant="determinate"
							value={progress}
							sx={{
								height: 8,
								borderRadius: 4,
								backgroundColor: theme.palette.grey[200],
							}}
						/>
						<Typography variant="caption" color="text.secondary">
							Processed {processedRecords} of {totalRecords} items.
						</Typography>
						<Button
							variant="outlined"
							color="error"
							startIcon={<StopIcon />}
							size="small"
							onClick={() => stopSync()}
							disabled={isStopping}
							sx={{
								mt: 2,
								alignSelf: 'flex-start',
								textTransform: 'none'
							}}
						>
							{isStopping ? 'Stopping...' : 'Stop Import'}
						</Button>
					</Stack>
				) : isFailed ? (
					<Stack spacing={1.5}>
						<Alert severity="warning" variant="outlined" sx={{ borderRadius: 1 }}>
							Import stopped at {processedRecords} of {totalRecords} records.
							{status?.error_message && ` Error: ${status.error_message}`}
						</Alert>
						<Stack direction="row" spacing={1.5}>
							<Button
								variant="contained"
								color="warning"
								startIcon={<ReplayIcon />}
								size="large"
								onClick={() => resumeSync({ job_id: status.job_id! })}
								disabled={isResuming}
								sx={{ py: 1.5, minWidth: 180, textTransform: 'none' }}
							>
								{isResuming ? 'Resuming...' : 'Resume Import'}
							</Button>
							<Button
								variant="outlined"
								color="primary"
								startIcon={<PlayArrowIcon />}
								size="large"
								onClick={() =>
									startSync({ target_url: config.url, dataset_id: config.prefix, total_limit: config.limit, overwrite: true, inter_batch_sleep_ms: config.batchDelay, ui_config: { color: config.color } })
								}
								disabled={isStarting}
								sx={{ py: 1.5, minWidth: 180, textTransform: 'none' }}
							>
								{isStarting ? 'Initializing...' : 'Start Over'}
							</Button>
						</Stack>
						{resumeError && (
							<Alert severity="error" variant="outlined" sx={{ borderRadius: 1 }}>
								Could not resume import. Check terminal logs.
							</Alert>
						)}
					</Stack>
				) : (
					<Button
						variant="contained"
						color="primary"
						startIcon={<PlayArrowIcon />}
						size="large"
						onClick={() =>
							startSync({ target_url: config.url, dataset_id: config.prefix, total_limit: config.limit, overwrite: config.overwrite, inter_batch_sleep_ms: config.batchDelay, ui_config: { color: config.color } })
						}
						disabled={isStarting}
						sx={{
							py: 1.5,
							alignSelf: 'flex-start',
							minWidth: 180,
							textTransform: 'none'
						}}
					>
						{isStarting ? 'Initializing...' : 'Start Import'}
					</Button>
				)}
				{error && (
					<Alert severity="error" variant="outlined" sx={{ borderRadius: 1 }}>
						Synchronization failed to start. Please check terminal logs.
					</Alert>
				)}
			</Stack>
		</Box>
	);
};

export default SyncControl;
