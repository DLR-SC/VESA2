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

function ColumnSeriesChart(props: ITimeSeriesProps): JSX.Element {
  const chartRef = React.useRef<am5xy.XYChart | null>(null);
  const scrollbarRef = React.useRef<am5xy.XYChartScrollbar | null>(null);
  const customColor = { blue: am5.color(0x6894dc) };

  const [timeRange, setTimeRange] = React.useState<TemporalCoverage>(
    props.initialDate
  );

  // Ref to the main date axis. The dispatch effect uses its zoom position to tell a
  // programmatic reset (snapped to full: start 0 / end 1) from a real user selection.
  const xAxisRef = React.useRef<am5xy.DateAxis<am5xy.AxisRenderer> | null>(null);

  // Holds the latest props.data so the deferred init can populate the chart
  // without waiting for a subsequent data change.
  const initDataRef = React.useRef(props.data);
  useEffect(() => { initDataRef.current = props.data; }, [props.data]);

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

  // Chart initialisation — deferred so the browser can paint the shell before
  // amCharts runs. initDataRef holds the latest data so we can populate the chart
  // immediately after init without waiting for another props.data change.
  useEffect(() => {
    let root: am5.Root | undefined;
    const id = setTimeout(() => {
      root = createRoot("time-chart");
      const chart = createChart(root);
      const { xAxis, yAxis } = createAxes(root, chart, props.initialDate);
      const series = createSeries(root, chart, xAxis, yAxis);
      const scrollbar = createScrollbar(root, chart, xAxis, props.initialDate);
      addCursor(root, chart, xAxis);

      series.appear(1000, 100);
      chart.appear(1000, 100);

      chartRef.current = chart;
      scrollbarRef.current = scrollbar;
      xAxisRef.current = xAxis;

      // Populate with data that arrived while init was pending
      const data = initDataRef.current;
      if (data.length) {
        const mainSeries = chart.series.getIndex(0);
        const sbSeries = scrollbar.chart.series.getIndex(0);
        if (mainSeries && sbSeries) {
          mainSeries.data.setAll(data.map(({ date, value }) => ({ date, value: value || null })));
          sbSeries.data.setAll(data);
          xAxis.zoom(0, 1, 0);
        }
      }
    }, 0);

    return () => {
      clearTimeout(id);
      root?.dispose();
    };
  }, []);

  // Data update — fires whenever the Redux timeData slice changes. Snap back to the
  // full extent instantly (duration 0) so the reset emits no animation frames the
  // dispatch effect could mistake for a user selection.
  useEffect(() => {
    if (chartRef.current && scrollbarRef.current && xAxisRef.current) {
      const mainSeries = chartRef.current.series.getIndex(0);
      const sbSeries = scrollbarRef.current.chart.series.getIndex(0);

      if (mainSeries && sbSeries) {
        mainSeries.data.setAll(props.data.map(({ date, value }) => ({ date, value: value || null })));
        sbSeries.data.setAll(props.data);
      }

      xAxisRef.current.zoom(0, 1, 0);
    }
  }, [props.data]);

  // Propagate the selected range to the container — but skip the programmatic reset,
  // which leaves the axis at full zoom (start 0 / end 1). The null check also covers
  // the deferred mount, before the chart exists.
  useEffect(() => {
    const axis = xAxisRef.current;
    if (!axis) return;
    if (axis.get("start") === 0 && axis.get("end") === 1) return;
    handleScrollRef.current(timeRange);
  }, [timeRange]);

  return <div id="time-chart" className="chart_div" />;
}

export default ColumnSeriesChart;
