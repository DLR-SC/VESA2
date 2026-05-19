import * as am5 from "@amcharts/amcharts5";
import am5themes_Animated from "@amcharts/amcharts5/themes/Animated";
import * as am5xy from "@amcharts/amcharts5/xy";
import React, { useEffect } from "react";
import { ITimeData, TemporalCoverage } from "types/appData";

interface ITimeSeriesProps {
  data: ITimeData[];
  handleScroll: (range: TemporalCoverage) => void;
  initialDate: TemporalCoverage;
}

// Returns true when two ISO date strings are within one day of each other.
// Used to distinguish a programmatic zoomOut() reset from a genuine user scroll.
function withinOneDay(a: string | null, b: string | null): boolean {
  if (!a || !b) return false;
  return Math.abs(new Date(a).getTime() - new Date(b).getTime()) <= 86_400_000;
}

function ColumnSeriesChart(props: ITimeSeriesProps): JSX.Element {
  const chartRef = React.useRef<am5xy.XYChart | null>(null);
  const scrollbarRef = React.useRef<am5xy.XYChartScrollbar | null>(null);
  const customColor = { blue: am5.color(0x6894dc) };

  const [timeRange, setTimeRange] = React.useState<TemporalCoverage>(
    props.initialDate
  );

  // The date range that zoomOut() will settle to after the latest data update.
  // Updated before every programmatic data.setAll() so useEffect([timeRange]) can
  // distinguish the axis reset from a genuine user scroll.
  const resetRangeRef = React.useRef<TemporalCoverage>(props.initialDate);

  // Stable ref to the callback so the chart-init closure never captures a stale value.
  const handleScrollRef = React.useRef(props.handleScroll);
  useEffect(() => {
    handleScrollRef.current = props.handleScroll;
  });

  function createRoot(containerId: string): am5.Root {
    let root = am5.Root.new(containerId);
    root.setThemes([am5themes_Animated.new(root)]);
    root.dateFormatter.setAll({
      dateFormat: "yyyy",
      dateFields: ["valueX"],
    });
    return root;
  }

  function createChart(root: am5.Root): am5xy.XYChart {
    return root.container.children.push(
      am5xy.XYChart.new(root, {
        panX: false,
        panY: false,
        wheelX: "panX",
        wheelY: "zoomX",
        paddingLeft: 0,
      })
    );
  }

  function createAxes(
    root: am5.Root,
    chart: am5xy.XYChart,
    initialDate: TemporalCoverage
  ) {
    let xAxis = chart.xAxes.push(
      am5xy.DateAxis.new(root, {
        min: new Date(initialDate.start_date as string).getTime(),
        max: new Date(initialDate.end_date as string).getTime(),
        strictMinMaxSelection: true,
        maxDeviation: 0.1,
        groupData: true,
        baseInterval: {
          timeUnit: "day",
          count: 1,
        },
        renderer: am5xy.AxisRendererX.new(root, {
          minorGridEnabled: true,
          minGridDistance: 70,
        }),
        tooltip: am5.Tooltip.new(root, {}),
      })
    );

    let yAxis = chart.yAxes.push(
      am5xy.ValueAxis.new(root, {
        maxPrecision: 0,
        maxDeviation: 0.2,
        min: 0,
        renderer: am5xy.AxisRendererY.new(root, {}),
      })
    );

    return { xAxis, yAxis };
  }

  function createSeries(
    root: am5.Root,
    chart: am5xy.XYChart,
    xAxis: am5xy.DateAxis<am5xy.AxisRenderer>,
    yAxis: am5xy.ValueAxis<am5xy.AxisRenderer>
  ) {
    let series = chart.series.push(
      am5xy.ColumnSeries.new(root, {
        name: "Series",
        xAxis: xAxis,
        yAxis: yAxis,
        valueYField: "value",
        valueXField: "date",
        tooltip: am5.Tooltip.new(root, {
          labelText: "{valueY}",
        }),
      })
    );

    series.columns.template.setAll({
      strokeOpacity: 0,
      fill: customColor.blue,
      stroke: customColor.blue,
    });

    return series;
  }

  function createScrollbar(
    root: am5.Root,
    chart: am5xy.XYChart,
    xAxis: am5xy.DateAxis<am5xy.AxisRenderer>,
    initialDate: TemporalCoverage
  ) {
    let scrollbar = am5xy.XYChartScrollbar.new(root, {
      orientation: "horizontal",
      height: 60,
    });

    xAxis.onPrivate("selectionMin", function (value) {
      if (value) {
        setTimeRange((prev) => ({
          ...prev,
          start_date: new Date(value).toISOString(),
        }));
      }
    });

    xAxis.onPrivate("selectionMax", function (value) {
      if (value) {
        setTimeRange((prev) => ({
          ...prev,
          end_date: new Date(value).toISOString(),
        }));
      }
    });

    chart.set("scrollbarX", scrollbar);
    chart.bottomAxesContainer.children.push(scrollbar);

    const scrollBarX = chart.get("scrollbarX");
    const sbBg = scrollBarX?.get("background");

    sbBg?.setAll({
      fill: customColor.blue,
      fillOpacity: 0.1,
    });

    scrollBarX?.thumb.setAll({
      fill: customColor.blue,
      fillOpacity: 0.05,
    });

    let sbxAxis = scrollbar.chart.xAxes.push(
      am5xy.DateAxis.new(root, {
        min: new Date(initialDate.start_date as string).getTime(),
        max: new Date(initialDate.end_date as string).getTime(),
        baseInterval: { timeUnit: "day", count: 1 },
        renderer: am5xy.AxisRendererX.new(root, {
          minorGridEnabled: true,
          opposite: false,
          strokeOpacity: 0,
        }),
      })
    );

    let sbyAxis = scrollbar.chart.yAxes.push(
      am5xy.ValueAxis.new(root, {
        renderer: am5xy.AxisRendererY.new(root, {}),
      })
    );

    let sbseries = scrollbar.chart.series.push(
      am5xy.LineSeries.new(root, {
        xAxis: sbxAxis,
        yAxis: sbyAxis,
        valueYField: "value",
        valueXField: "date",
        stroke: customColor.blue,
      })
    );

    sbseries.strokes.template.setAll({
      strokeWidth: 2,
    });

    return scrollbar;
  }

  function addCursor(
    root: am5.Root,
    chart: am5xy.XYChart,
    xAxis: am5xy.DateAxis<am5xy.AxisRenderer>
  ) {
    let cursor = chart.set(
      "cursor",
      am5xy.XYCursor.new(root, {
        xAxis: xAxis,
        behavior: "zoomX",
      })
    );
    cursor.lineY.set("visible", false);
  }

  // Chart initialisation — runs once on mount.
  useEffect(() => {
    let root = createRoot("time-chart");
    let chart = createChart(root);
    let { xAxis, yAxis } = createAxes(root, chart, props.initialDate);
    let series = createSeries(root, chart, xAxis, yAxis);
    let scrollbar = createScrollbar(root, chart, xAxis, props.initialDate);
    addCursor(root, chart, xAxis);

    series.appear(1000, 100);
    chart.appear(1000, 100);

    chartRef.current = chart;
    scrollbarRef.current = scrollbar;

    return () => {
      root.dispose();
      chart.dispose();
    };
  }, []);

  // Data update — fires whenever the Redux timeData slice changes.
  // Records the new full extent as the "reset range" BEFORE calling zoomOut() so
  // useEffect([timeRange]) can distinguish the programmatic axis reset from user scroll.
  useEffect(() => {
    if (chartRef.current && scrollbarRef.current) {
      if (props.data.length) {
        resetRangeRef.current = {
          start_date: new Date(props.data[0].date as number).toISOString(),
          end_date: new Date(props.data[props.data.length - 1].date as number).toISOString(),
        };
      }

      const mainSeries = chartRef.current.series.getIndex(0);
      const sbSeries = scrollbarRef.current.chart.series.getIndex(0);

      if (mainSeries && sbSeries) {
        const processedData = props.data.map(({ date, value }) => ({
          date,
          value: value || null,
        }));
        mainSeries.data.setAll(processedData);
        sbSeries.data.setAll(props.data);
      }

      chartRef.current.zoomOut();
    }
  }, [props.data]);

  // Propagate timeRange to the container — but ONLY for genuine user interactions.
  // A programmatic zoomOut() after data update settles the axis to the full data extent;
  // that matches resetRangeRef within one day and is silently ignored.
  useEffect(() => {
    const isReset =
      withinOneDay(timeRange.start_date, resetRangeRef.current.start_date) &&
      withinOneDay(timeRange.end_date, resetRangeRef.current.end_date);

    if (!isReset) {
      handleScrollRef.current(timeRange);
    }
  }, [timeRange]);

  return <div id="time-chart" className="chart_div" />;
}

export default ColumnSeriesChart;
