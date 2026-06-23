import { Fab, Typography, Box, useTheme, Tooltip, IconButton } from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import DashboardIcon from "@mui/icons-material/Dashboard";
import { useNavigate } from "react-router-dom";
import { useAppDispatch } from "../../store/hooks";
import { hardReset } from "../../store";
import GridSettingsButton from "./GridSettingsButton";
import DataSourcesButton from "./DataSourcesButton";
import FilterBar from "./FilterBar";

const AppBar = (): JSX.Element => {
  const theme = useTheme();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  const handleReset = () => {
    dispatch(hardReset());
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

      <Box sx={{ display: "flex", alignItems: "center", gap: theme.spacing(2) }}>
          <FilterBar />
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
      </Box>
    </Box>
  );
};

export default AppBar;
