import { CircularProgress } from "@mui/material";
import CenteredCard from "../components/CenteredCard";
import _ from "lodash";
import { IContainerProps, TemporalCoverage } from "types/appData";
import EmptyDatasetCard from "../components/EmptyDatasetCard";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { useGetInitialDatasetsQuery } from "../store/services/dataApi";
import { convertToDateString } from "../store/dataset/utility/utility";
import { filterByTimeRange } from "../store/dataset/datasetSlice";
import ColumnSeriesChart from "../chartHooks/ColumnSeriesChart";

function LineSeriesChartContainer(props: IContainerProps): JSX.Element {
  const { isFetching } = useGetInitialDatasetsQuery();
  const timeData = useAppSelector((state) => state.dataset.timeData);
  const dispatch = useAppDispatch();

  const debouncedHandleScroll = _.debounce((range: TemporalCoverage) => {
    dispatch(filterByTimeRange(range));
  }, 500);

  const handleScroll = (range: TemporalCoverage) => {
    debouncedHandleScroll(range);
  };

  if (isFetching) {
    return (
      <CenteredCard>
        <CircularProgress size={60} />
      </CenteredCard>
    );
  }

  const firstDate = timeData.length
    ? new Date(timeData[0].date as number)
    : new Date("1950-01-01");
  const lastDate = timeData.length
    ? new Date(timeData[timeData.length - 1].date as number)
    : new Date("2030-01-01");

  return timeData.length ? (
    <>
      <ColumnSeriesChart
        data={timeData}
        handleScroll={handleScroll}
        initialDate={{
          start_date: convertToDateString(firstDate),
          end_date: convertToDateString(lastDate),
        }}
      />
    </>
  ) : (
    <EmptyDatasetCard />
  );
}

export default LineSeriesChartContainer;
