import { CircularProgress } from "@mui/material";
import GeoChart from "../chartHooks/GeoChart";
import React from "react";
import { updateSelectedGeoData } from "../store/dataset/datasetSlice";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { useGetInitialDatasetsQuery } from "../store/services/dataApi";
import { IContainerProps, IDatasetID, IPointHoverHandler } from "types/appData";
import CenteredCard from "../components/CenteredCard";
import EmptyDatasetCard from "../components/EmptyDatasetCard";
import { useDatafillContext } from "../hooks/DatafillContext";

interface IGeoChartContainer extends IContainerProps {
  handlePointerHover: IPointHoverHandler;
}

function GeoChartContainer(props: IGeoChartContainer): JSX.Element {
  const { isFetching } = useGetInitialDatasetsQuery();
  const locationData = useAppSelector((state) => state.dataset.geoData);
  const selectedGeoData = useAppSelector((state) => state.dataset.selectedGeoData);
  const dispatch = useAppDispatch();

  const { compareAndResetAgainstGeoData } = useDatafillContext();

  const handleCoordinateSelection = (id: IDatasetID) => {
    dispatch(updateSelectedGeoData(id));
  };

  // Skip the first fire (mount) — initial data is already loaded by useDatafill in MainContent.
  // Subsequent changes represent real user selections or system-driven deselections.
  const hasMountedRef = React.useRef(false);
  React.useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      return;
    }
    compareAndResetAgainstGeoData(selectedGeoData);
  }, [selectedGeoData]);

  if (isFetching) {
    return (
      <CenteredCard>
        <CircularProgress size={60} />
      </CenteredCard>
    );
  }

  return locationData.length ? (
    <GeoChart
      data={locationData}
      selectedCoordinate={handleCoordinateSelection}
      selectedIDs={selectedGeoData}
      onPointHover={props.handlePointerHover}
    />
  ) : (
    <EmptyDatasetCard />
  );
}

export default GeoChartContainer;
