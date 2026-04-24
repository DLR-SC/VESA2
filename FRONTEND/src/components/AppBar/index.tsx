import { Fab, Typography, Box, useTheme, Tooltip, IconButton } from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import DashboardIcon from "@mui/icons-material/Dashboard";
import { useNavigate } from "react-router-dom";
import { useDatafill } from "../../hooks/useDatafill";
import { useAppDispatch } from "../../store/hooks";
import { resetDatasetSlice } from "../../store/dataset/datasetSlice";
import { resetSelectedKeyword } from "../../store/selectedKeyword/selectedKeywordSlice";
import GridSettingsButton from "./GridSettingsButton";
import HelpButton from "./HelpButton";
import DataSourcesButton from "./DataSourcesButton";

const AppBar = (): JSX.Element => {
  const theme = useTheme();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { initialSetterBundle } = useDatafill();

  const handleReset = () => {
    dispatch(resetSelectedKeyword());
    dispatch(resetDatasetSlice());
    initialSetterBundle();
  };

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        minHeight: 56,
        flexShrink: 0,
        backgroundColor: theme.palette.background.default,
        borderBottom: `1px solid ${theme.palette.divider}`,
        px: 4,
        gap: theme.spacing(4),
        justifyContent: "space-between",
      }}
    >
      <Fab size="small" color="default" onClick={handleReset}>
        <RefreshIcon />
      </Fab>

      <Typography variant="h1">
        <b>Visualisation Enabled Search Application</b>
      </Typography>

      <Box>
        <Tooltip title="Go to Dashboard">
          <IconButton
            aria-label="go-to-dashboard-button"
            color="primary"
            onClick={() => navigate("/")}
          >
            <DashboardIcon sx={{ fontSize: "1.6rem" }} />
          </IconButton>
        </Tooltip>
        <DataSourcesButton />
        <GridSettingsButton />
        {/* <HelpButton /> */}
      </Box>
    </Box>
  );
};

export default AppBar;
