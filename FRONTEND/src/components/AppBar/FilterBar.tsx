import React, { useState } from "react";
import {
  Badge,
  Box,
  IconButton,
  Popover,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import UndoIcon from "@mui/icons-material/Undo";
import FilterListIcon from "@mui/icons-material/FilterList";
import LocalOfferIcon from "@mui/icons-material/LocalOffer";
import RoomIcon from "@mui/icons-material/Room";
import DateRangeIcon from "@mui/icons-material/DateRange";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import { undoFilter } from "../../store/dataset/datasetSlice";
import type { FilterEntry } from "types/appData";

const TYPE_ICON: Record<FilterEntry["type"], React.ReactElement> = {
  keyword: <LocalOfferIcon sx={{ fontSize: 16 }} />,
  geo:     <RoomIcon sx={{ fontSize: 16 }} />,
  time:    <DateRangeIcon sx={{ fontSize: 16 }} />,
};

const FilterBar = () => {
  const filterStack = useAppSelector((state) => state.dataset.filterStack);
  const dispatch = useAppDispatch();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  if (filterStack.length === 0) return null;

  const last = filterStack[filterStack.length - 1];

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, flexShrink: 0 }}>
      <Tooltip title={`Undo: ${last.label}`}>
        <IconButton onClick={() => dispatch(undoFilter())} color="primary">
          <UndoIcon sx={{ fontSize: "1.6rem" }} />
        </IconButton>
      </Tooltip>

      <Tooltip title="Filter history">
        <IconButton color="primary" onClick={(e) => setAnchor(e.currentTarget)}>
          <Badge badgeContent={filterStack.length} color="primary" sx={{ "& .MuiBadge-badge": { fontSize: 10, minWidth: 16, height: 16 } }}>
            <FilterListIcon sx={{ fontSize: "1.6rem" }} />
          </Badge>
        </IconButton>
      </Tooltip>

      <Popover
        open={Boolean(anchor)}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        PaperProps={{
          elevation: 0,
          variant: "outlined",
          sx: { width: 280, borderRadius: 2, mt: 1 },
        }}
      >
        <Box sx={{ px: 3, pt: 3, pb: 2 }}>
          <Typography variant="h3" sx={{ mb: 2 }}>Active Filters</Typography>
          <Stack spacing={1.5}>
            {filterStack.map((entry) => (
              <Box key={entry.type} sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                <Box sx={{ color: "text.secondary", display: "flex" }}>
                  {TYPE_ICON[entry.type]}
                </Box>
                <Typography variant="body2">{entry.label}</Typography>
              </Box>
            ))}
          </Stack>
        </Box>
      </Popover>
    </Box>
  );
};

export default FilterBar;
