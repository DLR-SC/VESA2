import { CircularProgress } from "@mui/material";
import GeoChart from "../chartHooks/GeoChart";
import { updateSelectedGeoData } from "../store/dataset/datasetSlice";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { useGetInitialDatasetsQuery } from "../store/services/dataApi";
import { IContainerProps, IDatasetID, IPointHoverHandler } from "types/appData";
import CenteredCard from "../components/CenteredCard";
import EmptyDatasetCard from "../components/EmptyDatasetCard";

const EMPTY_GEO_IDS: IDatasetID[] = [];

interface IGeoChartContainer extends IContainerProps {
  handlePointerHover: IPointHoverHandler;
}

function GeoChartContainer(props: IGeoChartContainer): JSX.Element {
  const { isFetching } = useGetInitialDatasetsQuery();
  const locationData = useAppSelector((state) => state.dataset.geoData);
  const selectedGeoData = useAppSelector(
    (state) => state.dataset.filterStack.find((e) => e.type === "geo")?.datasetIds ?? EMPTY_GEO_IDS
  );
  const dispatch = useAppDispatch();

  const handleCoordinateSelection = (id: IDatasetID) => {
    dispatch(updateSelectedGeoData(id));
  };

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
