import { ThemeProvider } from "@emotion/react";
import { Box, CssBaseline, Stack } from "@mui/material";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import MainContent from "./components/MainContent";
import { Provider } from "react-redux";
import { Store } from "./store";
import Theme from "./utils/Theme";
import "./App.scss";
import Footer from "./components/Footer";
import AppBar from "./components/AppBar";
import { IngestionPage } from "./components/ingestion";
import { useGetSyncHistoryQuery } from "./store/services/syncApi";

// Global subscription + route guard: redirects "/" to "/setup" when no data has been ingested yet.
function AppRoutes(): JSX.Element {
  const { data, isLoading } = useGetSyncHistoryQuery();
  const isEmpty = !isLoading && (data?.result?.length ?? 0) === 0;

  return (
    <Routes>
      <Route path="/" element={isEmpty ? <Navigate to="/setup" replace /> : <MainContent />} />
      <Route path="/setup" element={<IngestionPage />} />
    </Routes>
  );
}

function AppContent(): JSX.Element {
  return (
    <BrowserRouter>
      <Stack id="app" sx={{ minHeight: "100vh", width: "100%" }}>
        <AppBar />
        <Box component="main" sx={{ flex: 1, width: "100%" }}>
          <AppRoutes />
        </Box>
        <Footer />
      </Stack>
    </BrowserRouter>
  );
}

function App(): JSX.Element {
  return (
    <Provider store={Store}>
      <ThemeProvider theme={Theme}>
        <CssBaseline />
        <AppContent />
      </ThemeProvider>
    </Provider>
  );
}

export default App;
