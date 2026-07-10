import * as am5 from "@amcharts/amcharts5";
import am5themes_Animated from "@amcharts/amcharts5/themes/Animated";
import * as am5wc from "@amcharts/amcharts5/wc";
import React from "react";
import { IKeywordData } from "types/appData";

interface IWordCloudProps {
  data: IKeywordData[];
  selectedKeywordCallback: (keywordObj: IKeywordData) => void;
}

function WordCloud(props: IWordCloudProps): JSX.Element {
  const series = React.useRef<am5wc.WordCloud>();
  const initDataRef = React.useRef(props.data);
  React.useEffect(() => { initDataRef.current = props.data; }, [props.data]);
  const colorPalette = [
    "#11609c",
    "#0068a5",
    "#0070ae",
    "#0077b5",
    "#007fbb",
    "#0087c0",
    "#008fc3",
    "#0097c4",
    "#009ec4",
    "#00a6c3",
    "#00adc0",
    "#00b4bb",
    "#00bbb4",
    "#00c1ad",
    "#00c8a4",
    "#00ce9a",
    "#00d48f",
    "#00da83",
    "#00df76",
    "#33e468",
    "#5ee95a",
    "#7eed4a",
    "#9af039",
    "#b5f325",
    "#d0f500",
  ];

  // Deferred init — browser paints the shell before amCharts runs.
  // initDataRef holds the latest data so the chart can populate immediately after init
  // without waiting for a subsequent props.data change.
  React.useEffect(() => {
    let root: am5.Root | undefined;
    const id = setTimeout(() => {
      root = am5.Root.new("wordcloud-chart");
      root.setThemes([am5themes_Animated.new(root)]);

      const wcChart = am5wc.WordCloud.new(root, {
        autoFit: false,
        minValue: 1,
        angles: [0],
        colors: am5.ColorSet.new(root, {
          colors: colorPalette.map((color) => am5.color(color)),
        }),
        categoryField: "keyword",
        valueField: "count",
      });

      series.current = root.container.children.push(wcChart);

      series.current.labels.template.states.create("hover", {
        fill: am5.color(0x297373),
        cursorOverStyle: "pointer",
        scale: 1.15,
      });
      series.current.labels.template.states.create("disabled", {
        fill: am5.color(0x060f0f),
      });

      series.current.labels.template.events.on("pointerover", (event) => {
        event.target.states.applyAnimate("hover");
      });

      series.current.labels.template.events.on("click", (event) => {
        props.selectedKeywordCallback(
          event.target.dataItem?.dataContext as IKeywordData
        );
      });

      // Load data that arrived while init was deferred
      series.current.setAll({ minFontSize: 9, maxFontSize: 36 });
      series.current.data.setAll(initDataRef.current.slice(0, 500));
      series.current.labels.template.setAll({
        paddingTop: 5,
        paddingBottom: 5,
        paddingLeft: 5,
        paddingRight: 5,
        fontFamily: "Montserrat, sans-serif",
        fontWeight: "500",
      });
    }, 0);

    return () => {
      clearTimeout(id);
      root?.dispose();
    };
  }, []);

  React.useLayoutEffect(() => {
    // if (props.data)
    //   if (props.data.length < 6) {
    series.current?.setAll({
      minFontSize: 9,
      maxFontSize: 36,
    });
    //   }
    series.current?.data.setAll(props.data.slice(0, 500)); // wordcloud will not render smoothly above 500
    series.current?.labels.template.setAll({
      paddingTop: 5,
      paddingBottom: 5,
      paddingLeft: 5,
      paddingRight: 5,
      fontFamily: "Montserrat, sans-serif",
      fontWeight: "500",
    });
  }, [props.data]);

  return (
    <div id="wordcloud-chart" className="chart_div"/>
  );
}

export default WordCloud;
