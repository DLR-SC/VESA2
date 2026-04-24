import * as am5 from "@amcharts/amcharts5";
import * as am5geodata_worldLow from "@amcharts/amcharts5-geodata/worldLow";
import { IClusteredDataItem } from "@amcharts/amcharts5/.internal/charts/map/ClusteredPointSeries";
import * as am5map from "@amcharts/amcharts5/map";
import am5themes_Animated from "@amcharts/amcharts5/themes/Animated";
import React, { useEffect, useState, useRef, useMemo } from "react";
import { IDatasetID, IGeoData, IPointHoverHandler } from "types/appData";
import { useGetSyncHistoryQuery } from "../store/services/syncApi";

interface IGeoChartProps {
  data: IGeoData[];
  selectedCoordinate: (id: IDatasetID) => void;
  selectedIDs: IDatasetID[];
  onPointHover: IPointHoverHandler;
}

interface GeoDataItem {
  geometry: { type: "Point"; coordinates: [`${number}` | null, `${number}` | null] };
  id: IDatasetID;
  groupId: string;
}

type SourceColor = { prefix: string; color: string };

const LegendToggleIconSvgPath = "M7 4v16h12";
const FALLBACK_DATASET_COLOR = "#ff8c00";
const ACTIVE_COLOR = 0xed254e;

function hexToAmColor(hex: string): am5.Color {
  return am5.color(parseInt(hex.replace("#", ""), 16));
}

function resolveGroupColor(groupId: string, sourceColors: SourceColor[]): am5.Color {
  if (groupId === "active") return am5.color(ACTIVE_COLOR);
  const source = sourceColors.find((s) => s.prefix === groupId);
  return hexToAmColor(source?.color ?? FALLBACK_DATASET_COLOR);
}

const GeoChart: React.FC<IGeoChartProps> = ({
  data,
  selectedCoordinate,
  selectedIDs,
  onPointHover,
}) => {
  const [geoData, setGeoData] = useState<GeoDataItem[]>([]);
  const [chart, setChart] = useState<am5map.MapChart | null>(null);
  const [toggleLegend, setToggleLegend] = useState<boolean>(true);

  const legendRef = useRef<am5.Legend | null>(null);
  const selectedLegendRef = useRef<am5.Legend | null>(null);

  const { data: historyData } = useGetSyncHistoryQuery();
  const sources: SourceColor[] = useMemo(
    () =>
      (historyData?.result ?? []).map((s) => ({
        prefix: s.prefix,
        color: s.ui_config?.color ?? FALLBACK_DATASET_COLOR,
      })),
    [historyData]
  );

  // Stable ref so amCharts callbacks always read the latest colors without stale closures
  const sourceColorRef = useRef<SourceColor[]>(sources);
  useEffect(() => {
    sourceColorRef.current = sources;
  }, [sources]);

  // Map incoming data to geoData format
  useEffect(() => {
    const geoJSONData: GeoDataItem[] = data.map((item) => ({
      geometry: { type: "Point", coordinates: item.coordinates },
      id: item.id,
      groupId: selectedIDs.includes(item.id) ? "active" : item.groupId,
    }));
    setGeoData(geoJSONData);
  }, [data, selectedIDs]);

  // Initialize the chart once
  useEffect(() => {
    const root = am5.Root.new("map-chart");
    root.setThemes([am5themes_Animated.new(root)]);

    const mapChart = createChart(root);
    setChart(mapChart);

    const zoomControl = createZoomControl(root, mapChart, setToggleLegend);
    mapChart.set("zoomControl", zoomControl);

    createMapPolygonSeries(root, mapChart);
    createPointSeries(root, mapChart, selectedCoordinate, onPointHover, sourceColorRef);
    createLegends(root, mapChart, legendRef, selectedLegendRef);

    return () => root.dispose();
  }, []);

  // Update legend entries whenever source list changes
  useEffect(() => {
    if (!legendRef.current) return;
    const entries = sources.length > 0
      ? sources.map((s) => ({ name: s.prefix, color: hexToAmColor(s.color) }))
      : [{ name: "Datasets", color: hexToAmColor(FALLBACK_DATASET_COLOR) }];
    legendRef.current.data.setAll(entries);
  }, [sources]);

  // Re-paint bullets when source colors change (re-set same geoData to trigger bullet recreation)
  useEffect(() => {
    if (!chart || geoData.length === 0) return;
    const pointSeries = chart.series.values.find(
      (s) => s instanceof am5map.ClusteredPointSeries
    ) as am5map.ClusteredPointSeries | undefined;
    pointSeries?.data.setAll(geoData);
  }, [sources]); // eslint-disable-line react-hooks/exhaustive-deps

  // Update legend visibility when selectedIDs or toggleLegend changes
  useEffect(() => {
    if (selectedLegendRef.current) {
      selectedLegendRef.current.set("visible", toggleLegend && selectedIDs.length > 0);
    }
  }, [selectedIDs, toggleLegend]);

  useEffect(() => {
    if (legendRef.current) legendRef.current.set("visible", toggleLegend);
  }, [toggleLegend]);

  // Update pointSeries data when geoData changes
  useEffect(() => {
    if (!chart) return;
    const pointSeries = chart.series.values.find(
      (s) => s instanceof am5map.ClusteredPointSeries
    ) as am5map.ClusteredPointSeries | undefined;
    pointSeries?.data.setAll(geoData);
  }, [geoData, chart]);

  return <div id="map-chart" className="chart_div"></div>;
};

export default GeoChart;

// ── Helper functions ──────────────────────────────────────────────────────────

function createChart(root: am5.Root): am5map.MapChart {
  return root.container.children.push(
    am5map.MapChart.new(root, {
      panX: "rotateX",
      panY: "translateY",
      projection: am5map.geoMercator(),
      cursorOverStyle: "default",
    })
  );
}

function createZoomControl(
  root: am5.Root,
  chart: am5map.MapChart,
  setToggleLegend: React.Dispatch<React.SetStateAction<boolean>>
): am5map.ZoomControl {
  const zoomControl = am5map.ZoomControl.new(root, {});

  const tooltip = am5.Tooltip.new(root, { dy: -15 });
  tooltip.get("background")?.setAll({ fill: am5.color(0xeeeeee) });

  zoomControl.minusButton.set("tooltip", tooltip);
  zoomControl.plusButton.set("tooltip", tooltip);
  zoomControl.homeButton.set("tooltip", tooltip);
  zoomControl.minusButton.set("tooltipText", "Zoom Out");
  zoomControl.plusButton.set("tooltipText", "Zoom In");
  zoomControl.homeButton.set("tooltipText", "Reset Zoom");
  zoomControl.homeButton.set("visible", true);

  const legendButton = createLegendButton(root, setToggleLegend, tooltip);
  zoomControl.children.insertIndex(0, legendButton);

  return zoomControl;
}

function createLegendButton(
  root: am5.Root,
  setToggleLegend: React.Dispatch<React.SetStateAction<boolean>>,
  tooltip: am5.Tooltip
): am5.Button {
  const legendButton = am5.Button.new(root, {
    width: 35,
    height: 35,
    icon: am5.Graphics.new(root, {
      svgPath: LegendToggleIconSvgPath,
      height: 30,
      width: 30,
      stroke: am5.color(0xffffff),
      strokeWidth: 4,
      x: 5,
      y: 5,
    }),
    tooltip,
    tooltipText: "Toggle map legends",
  });

  legendButton.events.on("click", () => setToggleLegend((prev) => !prev));
  return legendButton;
}

function createMapPolygonSeries(root: am5.Root, chart: am5map.MapChart) {
  chart.series.push(
    am5map.MapPolygonSeries.new(root, { geoJSON: am5geodata_worldLow.default })
  );
}

function createPointSeries(
  root: am5.Root,
  chart: am5map.MapChart,
  selectedCoordinate: (id: IDatasetID) => void,
  onPointHover: IPointHoverHandler,
  sourceColorRef: React.MutableRefObject<SourceColor[]>
): am5map.ClusteredPointSeries {
  const pointSeries = chart.series.push(
    am5map.ClusteredPointSeries.new(root, {
      groupIdField: "groupId",
      minDistance: 15,
      affectsBounds: true,
    })
  );

  pointSeries.set("clusteredBullet", (root, series, dataItem) =>
    createClusteredBullet(root, series, dataItem, sourceColorRef)
  );

  pointSeries.bullets.push((root, _series, dataItem) =>
    createBullet(root, dataItem, selectedCoordinate, onPointHover, sourceColorRef)
  );

  return pointSeries;
}

function createClusteredBullet(
  root: am5.Root,
  series: am5map.ClusteredPointSeries,
  dataItem: am5.DataItem<IClusteredDataItem>,
  sourceColorRef: React.MutableRefObject<SourceColor[]>
): am5.Bullet {
  const container = am5.Container.new(root, { cursorOverStyle: "pointer" });

  const defaultColor = resolveGroupColor("dataset", sourceColorRef.current);

  const circle1 = container.children.push(
    am5.Circle.new(root, { radius: 8, tooltipY: 0, fill: defaultColor })
  );
  const circle2 = container.children.push(
    am5.Circle.new(root, { radius: 12, fillOpacity: 0.3, tooltipY: 0, fill: defaultColor })
  );
  const circle3 = container.children.push(
    am5.Circle.new(root, { radius: 16, fillOpacity: 0.3, tooltipY: 0, fill: defaultColor })
  );

  dataItem.on("children", (children, target) => {
    if (!target) return;
    const bullet = target.get("bullet")?.get("sprite");
    if (!children?.length) return;

    let groupId: string | undefined;
    let sameGroup = true;

    am5.array.eachContinue(children, (child) => {
      const ctx = child.dataContext as { groupId: string };
      if (!ctx) return true;
      if (groupId === undefined) { groupId = ctx.groupId; }
      else if (groupId !== ctx.groupId) { sameGroup = false; return false; }
      return true;
    });

    const color = sameGroup && groupId
      ? resolveGroupColor(groupId, sourceColorRef.current)
      : am5.color(0x999998);

    // @ts-ignore
    bullet?.children.each((c) => {
      if (c instanceof am5.Circle) c.setAll({ fill: color });
    });
  });

  container.children.push(
    am5.Label.new(root, {
      centerX: am5.p50,
      centerY: am5.p50,
      fill: am5.color(0xffffff),
      populateText: true,
      fontSize: "8",
      text: "{value}",
    })
  );

  container.events.on("click", (e) => {
    if (e.target.dataItem) series.zoomToCluster(e.target.dataItem);
  });

  return am5.Bullet.new(root, { sprite: container });
}

function createBullet(
  root: am5.Root,
  dataItem: am5.DataItem<am5map.IClusteredPointSeriesDataItem>,
  selectedCoordinate: (id: IDatasetID) => void,
  onPointHover: IPointHoverHandler,
  sourceColorRef: React.MutableRefObject<SourceColor[]>
): am5.Bullet {
  const item = dataItem.dataContext as GeoDataItem;
  const coordinates = dataItem.get("geometry")?.coordinates as [number, number];
  const lat = coordinates[1].toFixed(2);
  const lon = coordinates[0].toFixed(2);

  const color = resolveGroupColor(item.groupId, sourceColorRef.current);

  const circle = am5.Circle.new(root, {
    radius: 6,
    fill: color,
    cursorOverStyle: "pointer",
    toggleKey: "active",
  });

  circle.events.on("click", () => selectedCoordinate(item.id));
  circle.events.on("pointerover", () => onPointHover(lat, lon));
  circle.events.on("pointerout", () => onPointHover("", ""));
  circle.states.create("hover", { scale: 1.4 });
  circle.states.create("active", { fill: am5.color(ACTIVE_COLOR), scale: 1.3 });
  circle.set("active", item.groupId === "active");

  return am5.Bullet.new(root, { sprite: circle });
}

function createLegends(
  root: am5.Root,
  chart: am5map.MapChart,
  legendRef: React.MutableRefObject<am5.Legend | null>,
  selectedLegendRef: React.MutableRefObject<am5.Legend | null>
) {
  const legend = chart.children.push(
    am5.Legend.new(root, {
      nameField: "name",
      fillField: "color",
      strokeField: "color",
      layout: root.verticalLayout,
      centerX: am5.percent(0),
      x: am5.percent(0),
    })
  );

  legend.labels.template.setAll({ fontSize: "12px", fontWeight: "400", textAlign: "left" });
  legendRef.current = legend;

  const selectedLegend = chart.children.push(
    am5.Legend.new(root, {
      nameField: "name",
      fillField: "color",
      strokeField: "color",
      layout: root.verticalLayout,
      centerX: am5.percent(100),
      x: am5.percent(100),
    })
  );

  selectedLegend.data.setAll([{ name: "Selected", color: am5.color(ACTIVE_COLOR) }]);
  selectedLegend.labels.template.setAll({ fontSize: "12px", fontWeight: "400", textAlign: "right" });
  selectedLegend.set("visible", false);
  selectedLegendRef.current = selectedLegend;
}
