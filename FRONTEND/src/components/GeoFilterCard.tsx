import { Button, Grid, Typography, useTheme } from "@mui/material";
import { useCallback } from "react";
import { removeFilter } from "../store/dataset/datasetSlice";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { ILocation } from "types/appData";

interface IGeoFilterCard {
  hoverPoints: ILocation;
}

function GeoFilterCard(props: IGeoFilterCard): JSX.Element {
  const theme = useTheme();
  const geoFilterCount = useAppSelector(
    (state) => state.dataset.filterStack.find((e) => e.type === "geo")?.datasetIds.length ?? 0
  );
  const dispatch = useAppDispatch();

  const formattedCoordinates = useCallback(() => {
    const { lat, lon } = props.hoverPoints;
    const isEmpty = !lat.trim() && !lon.trim();

    return isEmpty ? (
      <>
        <Typography variant="body1" color={theme.palette.text.disabled}>
          Place cursor over a location
        </Typography>
      </>
    ) : (
      <>
        <Typography variant="body1" color="initial">
          {lat}, {lon}
        </Typography>
      </>
    );
  }, [props.hoverPoints]);

  const resetFilter = () => {
    dispatch(removeFilter("geo"));
  };

  return (
    <>
      <Grid container padding={2} justifyContent={"space-between"}>
        <Grid item display="flex">
          <Typography variant="h4">Coordinates: &nbsp;</Typography>
          {formattedCoordinates()}
        </Grid>
        <Grid item>
          {geoFilterCount ? (
            <Button
              variant="outlined"
              sx={{ padding: 0 }}
              onClick={resetFilter}
              size="small"
            >
              Clear
            </Button>
          ) : (
            <></>
          )}
        </Grid>
      </Grid>
    </>
  );
}

export default GeoFilterCard;
