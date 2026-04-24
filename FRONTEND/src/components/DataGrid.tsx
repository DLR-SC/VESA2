import { useState, useMemo } from "react";
import { Box, LinearProgress, Link, Typography } from "@mui/material";
import { GridColDef, DataGrid as MuiDataGrid } from "@mui/x-data-grid";
import { IDatasetID, IDataset } from "types/appData";
import { useGetAbstractMutation } from "../store/services/miscApi";
import { useGetSyncHistoryQuery } from "../store/services/syncApi";

const FALLBACK_SOURCE_COLOR = "#ff8c00";

interface ResultTableProps {
  data: IDataset[];
}

function DataGrid(props: ResultTableProps): JSX.Element {
  const rows = props.data;
  const [fetchAbstract, { data, isLoading: isAbstractLoading, error: abstractError }] = useGetAbstractMutation();
  const [selectedRow, setSelectedRow] = useState<IDatasetID | null>(null);

  const { data: historyData } = useGetSyncHistoryQuery();
  const sourceColorMap = useMemo(
    () => Object.fromEntries(
      (historyData?.result ?? []).map((s) => [s.prefix, s.ui_config?.color ?? FALLBACK_SOURCE_COLOR])
    ),
    [historyData]
  );

  const getAuthorsOrProviders = (row: IDataset): string => {
    if (row.authors) return row.authors.join(", ");
    if (row.providers) return row.providers.join(", ");
    return "No authors or providers to display.";
  };

  const getPublicationYear = (row: IDataset): string => {
    if (!row.dataset_publication_date) return "";
    return ` (${new Date(row.dataset_publication_date).getFullYear()})`;
  };

  const getAbstract = (row: IDataset): React.ReactNode => {
    if (data?.result[0]) return data.result[0];
    if (abstractError) return "Error fetching abstract";
    if (isAbstractLoading) return (
      <Box>
        <Typography variant="body2" sx={{ mb: 1 }}>Fetching abstract...</Typography>
        <LinearProgress />
      </Box>
    );
    return "No abstract available";
  };

  const columns: GridColDef[] = [
    {
      field: "formattedData",
      headerName: "Title (Year); Authors",
      flex: 1,
      renderCell: (params) => {
        const accentColor = sourceColorMap[params.row.dataset_source_prefix] ?? FALLBACK_SOURCE_COLOR;
        return (
          <Box sx={{ display: "flex", alignItems: "stretch", width: "100%", py: 1.5 }}>
            <Box sx={{ width: 3, borderRadius: 1, bgcolor: accentColor, flexShrink: 0, mr: 2, my: 0.5, opacity: 0.8 }} />
            <Box sx={{ flex: 1 }}>
              <Typography variant="body2" sx={{ fontWeight: 500, lineHeight: "20px", color: "#176B87" }}>
                <Link
                  href={params.row.doi || "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  underline="hover"
                  sx={{ color: "#04364A", fontWeight: 600 }}
                >
                  {params.row.dataset_title}
                </Link>
                <Box component="span" sx={{ color: "#04364A" }}>
                  {getPublicationYear(params.row)}
                </Box>
                {"; "}
                {getAuthorsOrProviders(params.row)}
              </Typography>
              {selectedRow === params.row.id && (
                <Box sx={{ color: "#04364A", fontWeight: 400, pb: 2, pt: 0.5 }}>
                  {getAbstract(params.row)}
                </Box>
              )}
            </Box>
          </Box>
        );
      },
    },
  ];

  const handleRowClick = (row: IDataset): void => {
    setSelectedRow((prev) => (prev === row.id ? null : row.id));
    fetchAbstract({ key: row.id });
  };

  return (
    <MuiDataGrid
      sx={{
        ".MuiDataGrid-virtualScroller": { overflowX: "clip" },
        ".MuiTablePagination-root": { overflowX: "clip" },
      }}
      rows={rows.map((row) => ({ ...row, formattedData: row.id }))}
      columns={columns}
      initialState={{ pagination: { paginationModel: { page: 0, pageSize: 5 } } }}
      getRowHeight={() => "auto"}
      onRowClick={(row) => handleRowClick(row.row)}
      pageSizeOptions={[5, 10, 15]}
      checkboxSelection={false}
      disableRowSelectionOnClick
      columnHeaderHeight={0}
    />
  );
}

export default DataGrid;
