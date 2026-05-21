import React, { useState } from "react";
import {
  Badge,
  Box,
  Divider,
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
  keyword: <LocalOfferIcon sx={{ fontSize: 13 }} />,
  geo:     <RoomIcon sx={{ fontSize: 13 }} />,
  time:    <DateRangeIcon sx={{ fontSize: 13 }} />,
};

const TYPE_COLOR: Record<FilterEntry["type"], string> = {
  keyword: "primary.main",
  geo:     "secondary.main",
  time:    "warning.main",
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
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        transformOrigin={{ vertical: "top", horizontal: "center" }}
        slotProps={{ paper: { sx: { mt: 1 } } }}
      >
        <Box sx={{ p: 1.5, minWidth: 220 }}>
          <Typography variant="overline" color="text.secondary">
            Filter History
          </Typography>
          <Divider sx={{ mt: 0.5, mb: 1 }} />
          <Stack spacing={0.75}>
            {filterStack.map((entry, i) => (
              <Box
                key={entry.type}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                  px: 0.5,
                  opacity: i === filterStack.length - 1 ? 1 : 0.55,
                }}
              >
                <Typography variant="caption" color="text.disabled" sx={{ minWidth: 14, textAlign: "right" }}>
                  {i + 1}
                </Typography>
                <Box sx={{ color: TYPE_COLOR[entry.type], display: "flex" }}>
                  {TYPE_ICON[entry.type]}
                </Box>
                <Typography variant="body2" sx={{ flex: 1 }}>
                  {entry.label}
                </Typography>
                {i === filterStack.length - 1 && (
                  <Typography variant="caption" color="text.disabled">
                    ← last
                  </Typography>
                )}
              </Box>
            ))}
          </Stack>
          <Divider sx={{ mt: 1, mb: 0.5 }} />
          <Typography variant="caption" color="text.disabled">
            Undo removes the most recent filter
          </Typography>
        </Box>
      </Popover>
    </Box>
  );
};

export default FilterBar;
