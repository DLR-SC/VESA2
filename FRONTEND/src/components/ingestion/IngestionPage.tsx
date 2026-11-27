import React, { useState, useEffect } from 'react';
import { Container, Stack, Typography, Box, Paper, Stepper, Step, StepLabel, Button, Alert, useTheme } from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import ReplayIcon from '@mui/icons-material/Replay';
import { useNavigate } from 'react-router-dom';
import HandshakeForm from './HandshakeForm';
import StagingView, { StagingConfig } from './StagingView';
import SyncControl from './SyncControl';
import ConnectedSources from './ConnectedSources';
import { useGetSyncStatusQuery, useGetSyncHistoryQuery } from '../../store/services/syncApi';

const steps = ['Connect', 'Inspect', 'Import', 'Analyze'];

const IngestionPage: React.FC = () => {
	const theme = useTheme();
	const navigate = useNavigate();
	const [stagingConfig, setStagingConfig] = useState<StagingConfig | null>(null);
	const [config, setConfig] = useState<{ url: string; prefix: string; limit: number; color: string; batchDelay: number; overwrite?: boolean } | null>(null);
	const [activeStep, setActiveStep] = useState(0);
	const [ignoredJobId, setIgnoredJobId] = useState<string | null>(() => localStorage.getItem('ignoredJobId'));

	const { data: syncStatus, isSuccess } = useGetSyncStatusQuery(undefined, { pollingInterval: 2000 });
	const { data: historyData, refetch: refetchHistory } = useGetSyncHistoryQuery();

	const handleReset = () => {
		const currentJobId = syncStatus?.job_id;
		if (currentJobId) {
			setIgnoredJobId(currentJobId);
			localStorage.setItem('ignoredJobId', currentJobId);
		}
		setStagingConfig(null);
		setConfig(null);
		setActiveStep(0);
	};

	// The polled job status decides the step: running/stopped/failed -> Import (SyncControl shows
	// progress, or Resume / Start Over), completed -> Analyze. A job the user has Reset stays ignored,
	// so its outcome can't pull the page back; idle (no job yet) leaves the user where they are.
	useEffect(() => {
		if (!isSuccess || !syncStatus) return;
		const { status, total, current_prefix, job_id } = syncStatus;
		if (status === 'idle' || (status !== 'running' && job_id === ignoredJobId)) return;

		const step = status === 'completed' ? 3 : 2;
		if (activeStep === step) return;
		const url = syncStatus.target_url || syncStatus.source_url || '';
		setConfig((prev) => ({ url, prefix: current_prefix, limit: total, color: prev?.color ?? '#543CF0', batchDelay: prev?.batchDelay ?? 1000 }));
		setActiveStep(step);
		if (step === 3) refetchHistory();
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

					<Box sx={{ minHeight: 300, display: 'flex', flexDirection: 'column' }}>
						{activeStep === 0 && (
							<HandshakeForm
								onInspect={(sc) => { setStagingConfig(sc); setActiveStep(1); }}
								onIngestDirect={(c) => { setConfig(c); setActiveStep(2); }}
								isSystemBusy={syncStatus?.status === 'running'}
							/>
						)}
						{activeStep === 1 && stagingConfig && (
							<StagingView
								config={stagingConfig}
								onIngest={(c) => { setConfig(c); setActiveStep(2); }}
								onBack={() => setActiveStep(0)}
							/>
						)}
						{activeStep === 2 && (
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
						{activeStep === 3 && (() => {
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
