import React, { useState, useEffect } from 'react';
import { Container, Stack, Typography, Box, Paper, Stepper, Step, StepLabel, Button, Alert, useTheme } from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import ReplayIcon from '@mui/icons-material/Replay';
import { useNavigate } from 'react-router-dom';
import HandshakeForm from './HandshakeForm';
import SyncControl from './SyncControl';
import ConnectedSources from './ConnectedSources';
import { useGetSyncStatusQuery, useGetSyncHistoryQuery } from '../../store/services/syncApi';

const steps = ['Connect', 'Import', 'Analyze'];

const IngestionPage: React.FC = () => {
	const theme = useTheme();
	const navigate = useNavigate();
	const [config, setConfig] = useState<{ url: string; prefix: string; limit: number; color: string; batchDelay: number; overwrite?: boolean } | null>(null);
	const [activeStep, setActiveStep] = useState(0);
	const [errorMsg, setErrorMsg] = useState<string | null>(null);
	const [ignoredJobId, setIgnoredJobId] = useState<string | null>(() => localStorage.getItem('ignoredJobId'));

	const { data: syncStatus, isSuccess } = useGetSyncStatusQuery(undefined, { pollingInterval: 2000 });
	const { data: historyData, refetch: refetchHistory } = useGetSyncHistoryQuery();

	const handleReset = () => {
		const currentJobId = syncStatus?.job_id;
		if (currentJobId) {
			setIgnoredJobId(currentJobId);
			localStorage.setItem('ignoredJobId', currentJobId);
		}
		setConfig(null);
		setActiveStep(0);
		setErrorMsg(null);
	};

	useEffect(() => {
		if (!isSuccess || !syncStatus) return;
		const { status, processed, total, current_prefix, error_message, job_id } = syncStatus;
		const url = syncStatus.target_url || syncStatus.source_url || '';
		const isCompleted = status === 'completed' || (status === 'idle' && processed > 0 && processed === total);
		const isStopped = status === 'idle' && processed > 0 && processed < total;

		if (status === 'running') {
			if (activeStep !== 1) {
				setConfig((prev) => ({ url, prefix: current_prefix, limit: total, color: prev?.color ?? '#543CF0', batchDelay: prev?.batchDelay ?? 1000 }));
				setActiveStep(1);
			}
			setErrorMsg(null);
		} else if (isCompleted && job_id !== ignoredJobId) {
			if (activeStep !== 2) {
				setConfig((prev) => ({ url, prefix: current_prefix, limit: total, color: prev?.color ?? '#543CF0', batchDelay: prev?.batchDelay ?? 1000 }));
				setActiveStep(2);
				refetchHistory();
			}
			setErrorMsg(null);
		} else if (isStopped && job_id !== ignoredJobId) {
			if (activeStep !== 1) {
				setConfig((prev) => ({ url, prefix: current_prefix, limit: total, color: prev?.color ?? '#543CF0', batchDelay: prev?.batchDelay ?? 1000 }));
				setActiveStep(1);
			}
			setErrorMsg(`Synchronization stopped. Processed ${processed} of ${total} records. Please start a New Import.`);
		} else if (status === 'failed') {
			setErrorMsg(error_message || 'The previous synchronization process failed.');
		}
	}, [isSuccess, syncStatus, activeStep, ignoredJobId]);

	return (
		<Container
			maxWidth="md"
			sx={{
				py: theme.spacing(6),
				minHeight: "100%",
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				width: "100%",
			}}
		>
			<Paper 
				elevation={0}
				variant="outlined" 
				sx={{ 
					p: theme.spacing(4), 
					borderRadius: 2, 
					bgcolor: theme.palette.background.paper,
					borderColor: theme.palette.divider 
				}}
			>
				<Stack spacing={4}>
					<Box>
						<Typography variant="h4" gutterBottom>Data Ingestion</Typography>
						<Typography variant="body2" color="text.secondary">Follow the automated steps to populate your visualization environment.</Typography>
					</Box>

					<Stepper activeStep={activeStep} alternativeLabel sx={{ mb: 2 }}>
						{steps.map((label) => (
							<Step key={label}>
								<StepLabel>{label}</StepLabel>
							</Step>
						))}
					</Stepper>

					{errorMsg && (
						<Alert severity="error" sx={{ mb: 2 }}>
							{errorMsg}
						</Alert>
					)}

					<Box sx={{ minHeight: 300, display: 'flex', flexDirection: 'column' }}>
						{activeStep === 0 && (
							<HandshakeForm 
								onValidated={(c) => { setConfig(c); setActiveStep(1); }} 
								isSystemBusy={syncStatus?.status === 'running'}
							/>
						)}
						{activeStep === 1 && (
							<Box sx={{ width: '100%' }}>
								<SyncControl status={syncStatus || {}} config={config || { url: '', prefix: '', limit: 0, color: '#543CF0', batchDelay: 0 }} />
								<Button 
									sx={{ mt: 3, alignSelf: 'flex-start', textTransform: 'none' }} 
									color="error"
									variant="text" 
									onClick={handleReset}
								>
									Reset
								</Button>
							</Box>
						)}
						{activeStep === 2 && (() => {
							const completedEntry = historyData?.result?.find(e => e.prefix === config?.prefix);
							return (
								<Stack spacing={3} sx={{ mt: 2 }}>
									<Alert severity="success" sx={{ width: '100%', borderRadius: 1 }}>
										<b>{completedEntry?.count_success ?? config?.limit}</b> records imported for <b>{config?.prefix}</b>.
									</Alert>
									<Box>
										<Typography variant="subtitle2" color="text.secondary" gutterBottom>Connected Sources</Typography>
										<ConnectedSources />
									</Box>
									<Stack direction="row" spacing={2}>
										<Button variant="contained" size="medium" startIcon={<DashboardIcon />} onClick={() => navigate('/')} sx={{ textTransform: 'none' }}>View Dashboard</Button>
										<Button variant="outlined" size="medium" startIcon={<ReplayIcon />} onClick={handleReset} sx={{ textTransform: 'none' }}>New Import</Button>
									</Stack>
								</Stack>
							);
						})()}
					</Box>
				</Stack>
			</Paper>
		</Container>
	);
};

export default IngestionPage;
