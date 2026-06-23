import { CircularProgress } from "@mui/material";
import CenteredCard from "../components/CenteredCard";
import { useAppSelector } from "../store/hooks";
import { useGetInitialAuthorDataQuery } from "../store/services/dataApi";
import NodeChart from "../chartHooks/NodeChart";
import EmptyDatasetCard from "../components/EmptyDatasetCard";
import { IContainerProps } from "types/appData";

function NodeChartContainer(props: IContainerProps): JSX.Element {
  const { isFetching } = useGetInitialAuthorDataQuery();
  const isFiltering = useAppSelector((state) => state.dataset.isFiltering);
  const chordData = useAppSelector((state) => state.dataset.chordData);

  if (isFetching || isFiltering) {
    return (
      <CenteredCard>
        <CircularProgress size={60} />
      </CenteredCard>
    );
  }

  return chordData.length ? (
    <NodeChart data={chordData} />
  ) : (
    <EmptyDatasetCard
      message="Author information is not available for current datasets."
    />
  );
}

export default NodeChartContainer;
