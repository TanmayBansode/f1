"use client";

import {
  useRef,
  useEffect,
  useState,
  useMemo,
  useImperativeHandle,
  forwardRef,
} from "react";
import { select } from "d3-selection";
import { scalePoint, scaleLinear } from "d3-scale";
import { line, curveBumpX } from "d3-shape";
import { zoom, zoomIdentity, type ZoomBehavior, type ZoomTransform } from "d3-zoom";
import "d3-transition";
import {
  SeasonData,
  Driver,
  RaceResult,
  HoverInfo,
  EventHoverInfo,
  NodeDisplayMode,
  RaceTypeFilter,
  DisplayState,
} from "@/lib/types";

const MARGIN = { top: 60, right: 80, bottom: 30, left: 50 };
const ROW_HEIGHT = 36;
const COL_WIDTH = 110;
const NODE_RADIUS = 14;
const PHOTO_RADIUS = 18;

const RACE_TYPE_COLORS = {
  race: { bg: "#ffffff", line: "#555" },
  sprint: { bg: "#FF8C00", line: "#FF8C00" },
  qualifying: { bg: "#9B59B6", line: "#9B59B6" },
};

export interface BumpChartHandle {
  centerView: () => void;
}

interface BumpChartProps {
  season: SeasonData;
  highlightedDrivers: Set<string> | null;
  displayMode: NodeDisplayMode;
  raceTypeFilter: RaceTypeFilter;
  onHover: (info: HoverInfo | null) => void;
  onEventHover: (info: EventHoverInfo | null) => void;
  onSelectDriver: (driverId: string) => void;
}

function getDisplayState(result: RaceResult): DisplayState {
  if (result.status === "DSQ") return "dsq";
  if (result.status === "DNF") return "dnf";
  if (result.status === "DNS") return "dns";
  if (result.position === null) return "bench";
  return "racing";
}

const BumpChart = forwardRef<BumpChartHandle, BumpChartProps>(function BumpChart(
  { season, highlightedDrivers, displayMode, raceTypeFilter, onHover, onEventHover, onSelectDriver },
  ref
) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const currentTransformRef = useRef<ZoomTransform | null>(null);
  const isFirstRenderRef = useRef(true);
  const chartDimsRef = useRef<{ innerWidth: number; innerHeight: number }>({
    innerWidth: 0,
    innerHeight: 0,
  });
  const [dimensions, setDimensions] = useState({ width: 960, height: 600 });

  const onHoverRef = useRef(onHover);
  onHoverRef.current = onHover;
  const onEventHoverRef = useRef(onEventHover);
  onEventHoverRef.current = onEventHover;
  const onSelectDriverRef = useRef(onSelectDriver);
  onSelectDriverRef.current = onSelectDriver;
  const highlightedRef = useRef(highlightedDrivers);
  highlightedRef.current = highlightedDrivers;

  useImperativeHandle(
    ref,
    () => ({
      centerView: () => {
        if (!svgRef.current || !zoomRef.current) return;
        const svg = select(svgRef.current);
        const { innerWidth, innerHeight } = chartDimsRef.current;
        const totalW = innerWidth + MARGIN.left + MARGIN.right;
        const totalH = innerHeight + MARGIN.top + MARGIN.bottom;
        const scaleX = dimensions.width / totalW;
        const scaleY = dimensions.height / totalH;
        const scale = Math.min(scaleX, scaleY, 1) * 0.9;
        const tx = (dimensions.width - innerWidth * scale) / 2;
        const ty = MARGIN.top * scale + 10;
        const fitTransform = zoomIdentity.translate(tx, ty).scale(scale);
        svg
          .transition()
          .duration(500)
          .call(zoomRef.current.transform, fitTransform);
      },
    }),
    [dimensions]
  );

  useEffect(() => {
    if (!containerRef.current) return;
    let rafId: number;
    const observer = new ResizeObserver((entries) => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const { width, height } = entries[0].contentRect;
        setDimensions({ width, height });
      });
    });
    observer.observe(containerRef.current);
    return () => {
      cancelAnimationFrame(rafId);
      observer.disconnect();
    };
  }, []);

  const filteredRaces = useMemo(
    () => season.races.filter((r) => raceTypeFilter.has(r.type)),
    [season.races, raceTypeFilter]
  );
  const filteredRoundsList = useMemo(
    () => filteredRaces.map((r) => r.round),
    [filteredRaces]
  );
  const filteredRounds = useMemo(
    () => new Set(filteredRoundsList),
    [filteredRoundsList]
  );

  // Main D3 rendering
  useEffect(() => {
    if (!svgRef.current) return;
    const svg = select(svgRef.current);
    svg.selectAll("*").remove();

    if (filteredRaces.length === 0) {
      svg
        .append("text")
        .attr("x", dimensions.width / 2)
        .attr("y", dimensions.height / 2)
        .attr("text-anchor", "middle")
        .attr("fill", "#555")
        .attr("font-size", "14px")
        .text("No races match the selected filters");
      return;
    }

    const maxPosition = Math.max(
      ...season.drivers.flatMap((d) =>
        d.results
          .filter((r) => r.position !== null && filteredRounds.has(r.round))
          .map((r) => r.position!)
      ),
      1
    );

    const innerWidth = (filteredRaces.length - 1) * COL_WIDTH;
    const innerHeight = (maxPosition - 1) * ROW_HEIGHT;
    chartDimsRef.current = { innerWidth, innerHeight };

    const xScale = scalePoint<number>()
      .domain(filteredRaces.map((r) => r.round))
      .range([0, Math.max(innerWidth, 0)]);

    const yScale = scaleLinear()
      .domain([1, maxPosition])
      .range([0, innerHeight]);

    // Defs for patterns (driver photos)
    const defs = svg.append("defs");
    if (displayMode === "photo") {
      season.drivers.forEach((driver) => {
        const photoPath = driver.photo;
        const patternId = `photo-${driver.id}`;
        const pattern = defs
          .append("pattern")
          .attr("id", patternId)
          .attr("width", 1)
          .attr("height", 1)
          .attr("patternContentUnits", "objectBoundingBox");

        if (photoPath) {
          pattern
            .append("image")
            .attr("href", photoPath)
            .attr("width", 1)
            .attr("height", 1)
            .attr("preserveAspectRatio", "xMidYMid slice");
        } else {
          // Fallback: colored circle with driver code
          pattern
            .append("rect")
            .attr("width", 1)
            .attr("height", 1)
            .attr("fill", driver.teamColor);
          pattern
            .append("text")
            .attr("x", 0.5)
            .attr("y", 0.62)
            .attr("text-anchor", "middle")
            .attr("fill", "#fff")
            .attr("font-size", "0.4")
            .attr("font-weight", "800")
            .text(driver.id.charAt(0));
        }
      });
    }

    const g = svg.append("g").attr("class", "chart-content");

    // Background columns
    const colHalfWidth = COL_WIDTH / 2;
    filteredRaces.forEach((race) => {
      const x = xScale(race.round)!;
      const colors = RACE_TYPE_COLORS[race.type];
      g.append("rect")
        .attr("x", x - colHalfWidth)
        .attr("y", -MARGIN.top + 10)
        .attr("width", COL_WIDTH)
        .attr("height", innerHeight + MARGIN.top + MARGIN.bottom)
        .attr("fill", colors.bg)
        .attr("opacity", race.type === "race" ? 0.015 : 0.06)
        .attr("rx", 6);
    });

    // Grid lines
    const gridGroup = g.append("g").attr("class", "grid");
    for (let pos = 1; pos <= maxPosition; pos++) {
      gridGroup
        .append("line")
        .attr("x1", -20)
        .attr("x2", innerWidth + 20)
        .attr("y1", yScale(pos))
        .attr("y2", yScale(pos))
        .attr("stroke", "#1a1a1a")
        .attr("stroke-dasharray", "2,6");
    }

    // X-axis labels
    const xAxisGroup = g.append("g").attr("class", "x-axis");
    filteredRaces.forEach((race) => {
      const x = xScale(race.round)!;
      const colors = RACE_TYPE_COLORS[race.type];

      // Wrap each race label in a group for hover handling
      const raceGroup = xAxisGroup
        .append("g")
        .attr("class", "race-label")
        .style("cursor", "pointer");

      // Invisible hit area for easier hovering
      raceGroup
        .append("rect")
        .attr("x", x - 28)
        .attr("y", -58)
        .attr("width", 56)
        .attr("height", 48)
        .attr("fill", "transparent");

      // Hover handlers
      raceGroup.on("mousemove", function (event: MouseEvent) {
        const container = containerRef.current;
        if (!container) return;
        const rect = container.getBoundingClientRect();
        onEventHoverRef.current({
          round: race.round,
          name: race.name,
          type: race.type,
          date: race.date,
          circuit: race.circuit,
          location: race.location,
          x: event.clientX - rect.left,
          y: event.clientY - rect.top,
        });
      });
      raceGroup.on("mouseleave", function () {
        onEventHoverRef.current(null);
      });

      if (race.type === "sprint") {
        const badgeW = 44;
        raceGroup
          .append("rect")
          .attr("x", x - badgeW / 2)
          .attr("y", -48)
          .attr("width", badgeW)
          .attr("height", 16)
          .attr("rx", 3)
          .attr("fill", colors.line)
          .attr("opacity", 0.2);
        raceGroup
          .append("path")
          .attr("d", `M${x},${-50} l4,4 l-4,4 l-4,-4 Z`)
          .attr("fill", colors.line)
          .attr("opacity", 0.7);
        raceGroup
          .append("text")
          .attr("x", x)
          .attr("y", -35)
          .attr("text-anchor", "middle")
          .attr("fill", colors.line)
          .attr("font-size", "8px")
          .attr("font-weight", "800")
          .attr("letter-spacing", "1px")
          .text("SPRINT");
        raceGroup
          .append("text")
          .attr("x", x)
          .attr("y", -18)
          .attr("text-anchor", "middle")
          .attr("fill", colors.line)
          .attr("font-size", "10px")
          .attr("font-weight", "700")
          .text(race.shortName);
      } else if (race.type === "qualifying") {
        const badgeW = 38;
        raceGroup
          .append("rect")
          .attr("x", x - badgeW / 2)
          .attr("y", -48)
          .attr("width", badgeW)
          .attr("height", 16)
          .attr("rx", 3)
          .attr("fill", colors.line)
          .attr("opacity", 0.15);
        raceGroup
          .append("path")
          .attr("d", `M${x},${-51} l4,6 l-8,0 Z`)
          .attr("fill", colors.line)
          .attr("opacity", 0.7);
        raceGroup
          .append("text")
          .attr("x", x)
          .attr("y", -35)
          .attr("text-anchor", "middle")
          .attr("fill", colors.line)
          .attr("font-size", "8px")
          .attr("font-weight", "700")
          .attr("font-style", "italic")
          .attr("letter-spacing", "0.5px")
          .text("QUAL");
        raceGroup
          .append("text")
          .attr("x", x)
          .attr("y", -18)
          .attr("text-anchor", "middle")
          .attr("fill", `${colors.line}CC`)
          .attr("font-size", "10px")
          .attr("font-weight", "600")
          .attr("font-style", "italic")
          .text(race.shortName);
      } else {
        raceGroup
          .append("text")
          .attr("x", x)
          .attr("y", -36)
          .attr("text-anchor", "middle")
          .attr("fill", "#666")
          .attr("font-size", "7px")
          .attr("font-weight", "700")
          .attr("letter-spacing", "1.5px")
          .text("RACE");
        raceGroup
          .append("text")
          .attr("x", x)
          .attr("y", -18)
          .attr("text-anchor", "middle")
          .attr("fill", "#999")
          .attr("font-size", "11px")
          .attr("font-weight", "700")
          .text(race.shortName);
      }
    });

    // Y-axis labels
    const yAxisGroup = g.append("g").attr("class", "y-axis");
    for (let pos = 1; pos <= maxPosition; pos++) {
      yAxisGroup
        .append("rect")
        .attr("x", -42)
        .attr("y", yScale(pos) - 9)
        .attr("width", 24)
        .attr("height", 18)
        .attr("rx", 4)
        .attr(
          "fill",
          pos <= 3 ? "#E10600" : pos <= 10 ? "#2a2a2a" : "#1a1a1a"
        )
        .attr("opacity", pos <= 3 ? 0.3 : 1);

      yAxisGroup
        .append("text")
        .attr("x", -30)
        .attr("y", yScale(pos) + 5)
        .attr("text-anchor", "middle")
        .attr("fill", pos <= 3 ? "#E10600" : "#555")
        .attr("font-size", "11px")
        .attr("font-weight", pos <= 3 ? "800" : "600")
        .text(pos);
    }

    // Line generator — positions are always numeric now, lines bridge
    // across rounds a driver didn't participate in via .defined()
    const lineGenerator = line<RaceResult>()
      .defined((d) => d.position !== null && filteredRounds.has(d.round))
      .x((d) => xScale(d.round)!)
      .y((d) => yScale(d.position!))
      .curve(curveBumpX);

    const driversWithFilteredResults = season.drivers.map((d) => ({
      ...d,
      results: d.results.filter((r) => filteredRounds.has(r.round)),
    }));

    // Driver lines
    g.selectAll<SVGPathElement, Driver>(".driver-line")
      .data(driversWithFilteredResults, (d) => d.id)
      .join("path")
      .attr("class", "driver-line")
      .attr("d", (d) => lineGenerator(d.results))
      .attr("fill", "none")
      .attr("stroke", (d) => d.teamColor)
      .attr("stroke-width", 2.5)
      .attr("stroke-linecap", "round")
      .attr("stroke-opacity", 0.8);

    // Replacement connector lines (dotted)
    if (season.driverReplacements) {
      const replacementGroup = g.append("g").attr("class", "replacement-lines");
      for (const swap of season.driverReplacements) {
        const outDriver = season.drivers.find((d) => d.id === swap.out);
        const inDriver = season.drivers.find((d) => d.id === swap.in);
        if (!outDriver || !inDriver) continue;

        // Find the last round before atRound where outDriver raced
        const outResult = outDriver.results
          .filter((r) => r.position !== null && r.round < swap.atRound && filteredRounds.has(r.round))
          .at(-1);
        // Find the first round >= atRound where inDriver raced
        const inResult = inDriver.results
          .filter((r) => r.position !== null && r.round >= swap.atRound && filteredRounds.has(r.round))
          .at(0);

        if (!outResult || !inResult) continue;

        const x1 = xScale(outResult.round)!;
        const y1 = yScale(outResult.position!);
        const x2 = xScale(inResult.round)!;
        const y2 = yScale(inResult.position!);

        // Use the team color of the outgoing driver
        const color = outDriver.teamColor;

        // Draw a curved dashed connector
        const midX = (x1 + x2) / 2;
        replacementGroup
          .append("path")
          .attr("d", `M${x1},${y1} C${midX},${y1} ${midX},${y2} ${x2},${y2}`)
          .attr("fill", "none")
          .attr("stroke", color)
          .attr("stroke-width", 2)
          .attr("stroke-dasharray", "6,4")
          .attr("stroke-opacity", 0.5)
          .attr("pointer-events", "none")
          .attr("data-out", swap.out)
          .attr("data-in", swap.in);
      }
    }

    // Position nodes — now includes DNF/DSQ (they have numeric positions)
    const dots = season.drivers.flatMap((driver) =>
      driver.results
        .filter((r) => r.position !== null && filteredRounds.has(r.round))
        .map((result) => {
          const race = season.races.find((r) => r.round === result.round);
          return {
            driver,
            result,
            displayState: getDisplayState(result),
            raceType: (race?.type ?? "race") as
              | "race"
              | "sprint"
              | "qualifying",
          };
        })
    );

    const isTouchDevice = "ontouchstart" in window || navigator.maxTouchPoints > 0;
    let longPressTimer: ReturnType<typeof setTimeout> | null = null;
    let longPressFired = false;

    const showTooltip = (
      clientX: number,
      clientY: number,
      d: {
        driver: Driver;
        result: RaceResult;
        displayState: DisplayState;
      }
    ) => {
      if (d.result.position === null) return;
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      const race = season.races.find((r) => r.round === d.result.round);
      onHoverRef.current({
        driverId: d.driver.id,
        driverName: d.driver.name,
        team: d.driver.team,
        round: d.result.round,
        raceName: race?.name ?? "",
        raceType: race?.type ?? "race",
        position: d.result.position,
        displayState: d.displayState,
        points: d.result.points,
        cumulativePoints: d.result.cumulativePoints,
        x,
        y,
      });
    };

    const hideTooltip = () => {
      onHoverRef.current(null);
    };

    const clearLongPress = () => {
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }
    };

    // Shared function to attach all interaction handlers to any node group
    const attachNodeInteraction = (
      nodeGroups: ReturnType<typeof g.selectAll<SVGGElement, (typeof dots)[0]>>,
      scaleUpTransform: (d: (typeof dots)[0]) => string,
      defaultTransform: (d: (typeof dots)[0]) => string,
      scaleElement?: string // e.g. ".node-shape" for dot mode
    ) => {
      // Desktop: hover shows tooltip, mouseleave hides
      nodeGroups
        .on("mouseenter", function (event, d) {
          if (isTouchDevice) return; // skip on touch — handled by long press
          if (scaleElement) {
            select(this)
              .select(scaleElement)
              .transition().duration(100)
              .attr("transform", "scale(1.3)");
          } else {
            select(this)
              .transition().duration(100)
              .attr("transform", scaleUpTransform(d));
          }
          showTooltip(event.clientX, event.clientY, d);
        })
        .on("mouseleave", function (_, d) {
          if (isTouchDevice) return;
          if (scaleElement) {
            select(this)
              .select(scaleElement)
              .transition().duration(100)
              .attr("transform", "scale(1)");
          } else {
            select(this)
              .transition().duration(100)
              .attr("transform", defaultTransform(d));
          }
          hideTooltip();
        })
        .on("click", function (_, d) {
          // On touch devices, tap = select driver (no tooltip)
          // On desktop, click = select driver (tooltip already showing from hover)
          if (isTouchDevice && longPressFired) {
            // Long press just fired — don't also select
            longPressFired = false;
            return;
          }
          onSelectDriverRef.current(d.driver.id);
        });

      // Touch: long press shows tooltip
      if (isTouchDevice) {
        nodeGroups.each(function (d) {
          const el = this as SVGGElement;

          el.addEventListener("touchstart", function (e) {
            longPressFired = false;
            const touch = e.touches[0];
            longPressTimer = setTimeout(() => {
              longPressFired = true;
              showTooltip(touch.clientX, touch.clientY, d);
              // Vibrate if supported
              if (navigator.vibrate) navigator.vibrate(30);
            }, 400);
          }, { passive: true });

          el.addEventListener("touchmove", function () {
            clearLongPress();
          }, { passive: true });

          el.addEventListener("touchend", function () {
            clearLongPress();
            // Dismiss tooltip after a delay if it was shown
            if (longPressFired) {
              setTimeout(() => {
                hideTooltip();
                longPressFired = false;
              }, 1500);
            }
          }, { passive: true });

          el.addEventListener("touchcancel", function () {
            clearLongPress();
            hideTooltip();
          }, { passive: true });
        });
      }
    };

    if (displayMode === "dot") {
      const nodeGroups = g
        .selectAll<SVGGElement, (typeof dots)[0]>(".driver-node")
        .data(dots)
        .join("g")
        .attr("class", "driver-node")
        .attr(
          "transform",
          (d) =>
            `translate(${xScale(d.result.round)!},${yScale(d.result.position!)})`
        )
        .style("cursor", "pointer");

      nodeGroups
        .append("circle")
        .attr("class", "node-shape")
        .attr("r", NODE_RADIUS - 2)
        .attr("fill", (d) => d.driver.teamColor)
        .attr("stroke", "#0a0a0a")
        .attr("stroke-width", 2);

      // DNF/DSQ cross overlay (Red)
      nodeGroups
        .filter((d) => d.displayState === "dnf" || d.displayState === "dsq")
        .each(function () {
          const s = 6;
          const el = select(this);
          el.append("line")
            .attr("x1", -s).attr("y1", -s).attr("x2", s).attr("y2", s)
            .attr("stroke", "#E10600").attr("stroke-width", 2.5)
            .attr("stroke-linecap", "round").attr("pointer-events", "none");
          el.append("line")
            .attr("x1", s).attr("y1", -s).attr("x2", -s).attr("y2", s)
            .attr("stroke", "#E10600").attr("stroke-width", 2.5)
            .attr("stroke-linecap", "round").attr("pointer-events", "none");
        });

      // DNS cross overlay (Black)
      nodeGroups
        .filter((d) => d.displayState === "dns")
        .each(function () {
          const s = 6;
          const el = select(this);
          el.append("line")
            .attr("x1", -s).attr("y1", -s).attr("x2", s).attr("y2", s)
            .attr("stroke", "#000").attr("stroke-width", 2.5)
            .attr("stroke-linecap", "round").attr("pointer-events", "none");
          el.append("line")
            .attr("x1", s).attr("y1", -s).attr("x2", -s).attr("y2", s)
            .attr("stroke", "#000").attr("stroke-width", 2.5)
            .attr("stroke-linecap", "round").attr("pointer-events", "none");
        });

      attachNodeInteraction(
        nodeGroups,
        () => "", // not used — dot uses scaleElement
        (d) => `translate(${xScale(d.result.round)!},${yScale(d.result.position!)})`,
        ".node-shape"
      );
    } else if (displayMode === "code") {
      const nodeGroups = g
        .selectAll<SVGGElement, (typeof dots)[0]>(".driver-node")
        .data(dots)
        .join("g")
        .attr("class", "driver-node")
        .attr(
          "transform",
          (d) =>
            `translate(${xScale(d.result.round)!},${yScale(d.result.position!)})`
        )
        .style("cursor", "pointer");

      nodeGroups
        .append("rect")
        .attr("class", "node-bg")
        .attr("x", -18)
        .attr("y", -11)
        .attr("width", 36)
        .attr("height", 22)
        .attr("rx", 5)
        .attr("fill", (d) => d.driver.teamColor)
        .attr("stroke", "#0a0a0a")
        .attr("stroke-width", 1.5);

      nodeGroups
        .append("text")
        .attr("text-anchor", "middle")
        .attr("y", 4)
        .attr("fill", "#fff")
        .attr("font-size", "10px")
        .attr("font-weight", "800")
        .attr("letter-spacing", "0.5px")
        .text((d) => d.driver.id);

      // DNF/DSQ cross overlay (Red)
      nodeGroups
        .filter((d) => d.displayState === "dnf" || d.displayState === "dsq")
        .each(function () {
          const s = 8;
          const el = select(this);
          el.append("line")
            .attr("x1", -s).attr("y1", -s).attr("x2", s).attr("y2", s)
            .attr("stroke", "#E10600").attr("stroke-width", 2.5)
            .attr("stroke-linecap", "round").attr("pointer-events", "none");
          el.append("line")
            .attr("x1", s).attr("y1", -s).attr("x2", -s).attr("y2", s)
            .attr("stroke", "#E10600").attr("stroke-width", 2.5)
            .attr("stroke-linecap", "round").attr("pointer-events", "none");
        });

      // DNS cross overlay (Black)
      nodeGroups
        .filter((d) => d.displayState === "dns")
        .each(function () {
          const s = 8;
          const el = select(this);
          el.append("line")
            .attr("x1", -s).attr("y1", -s).attr("x2", s).attr("y2", s)
            .attr("stroke", "#000").attr("stroke-width", 2.5)
            .attr("stroke-linecap", "round").attr("pointer-events", "none");
          el.append("line")
            .attr("x1", s).attr("y1", -s).attr("x2", -s).attr("y2", s)
            .attr("stroke", "#000").attr("stroke-width", 2.5)
            .attr("stroke-linecap", "round").attr("pointer-events", "none");
        });

      attachNodeInteraction(
        nodeGroups,
        (d) => `translate(${xScale(d.result.round)!},${yScale(d.result.position!)}) scale(1.2)`,
        (d) => `translate(${xScale(d.result.round)!},${yScale(d.result.position!)})`
      );
    } else {
      // Photo mode
      const nodeGroups = g
        .selectAll<SVGGElement, (typeof dots)[0]>(".driver-node")
        .data(dots)
        .join("g")
        .attr("class", "driver-node")
        .attr(
          "transform",
          (d) =>
            `translate(${xScale(d.result.round)!},${yScale(d.result.position!)})`
        )
        .style("cursor", "pointer");

      nodeGroups
        .append("circle")
        .attr("class", "node-ring")
        .attr("r", PHOTO_RADIUS)
        .attr("fill", "none")
        .attr("stroke", (d) => d.driver.teamColor)
        .attr("stroke-width", 1.5);

      nodeGroups
        .append("circle")
        .attr("class", "node-photo")
        .attr("r", PHOTO_RADIUS - 1.5)
        .attr("fill", (d) => `url(#photo-${d.driver.id})`)
        .attr("stroke", "none");

      // DNF/DSQ cross overlay (Red)
      nodeGroups
        .filter((d) => d.displayState === "dnf" || d.displayState === "dsq")
        .each(function () {
          const s = 9;
          const el = select(this);
          el.append("line")
            .attr("x1", -s).attr("y1", -s).attr("x2", s).attr("y2", s)
            .attr("stroke", "#E10600").attr("stroke-width", 2.5)
            .attr("stroke-linecap", "round").attr("pointer-events", "none");
          el.append("line")
            .attr("x1", s).attr("y1", -s).attr("x2", -s).attr("y2", s)
            .attr("stroke", "#E10600").attr("stroke-width", 2.5)
            .attr("stroke-linecap", "round").attr("pointer-events", "none");
        });

      // DNS cross overlay (Black)
      nodeGroups
        .filter((d) => d.displayState === "dns")
        .each(function () {
          const s = 9;
          const el = select(this);
          el.append("line")
            .attr("x1", -s).attr("y1", -s).attr("x2", s).attr("y2", s)
            .attr("stroke", "#000").attr("stroke-width", 2.5)
            .attr("stroke-linecap", "round").attr("pointer-events", "none");
          el.append("line")
            .attr("x1", s).attr("y1", -s).attr("x2", -s).attr("y2", s)
            .attr("stroke", "#000").attr("stroke-width", 2.5)
            .attr("stroke-linecap", "round").attr("pointer-events", "none");
        });

      attachNodeInteraction(
        nodeGroups,
        (d) => `translate(${xScale(d.result.round)!},${yScale(d.result.position!)}) scale(1.25)`,
        (d) => `translate(${xScale(d.result.round)!},${yScale(d.result.position!)})`
      );
    }

    // Driver end-of-line labels
    g.selectAll<SVGGElement, Driver>(".driver-end-label")
      .data(driversWithFilteredResults)
      .join("g")
      .attr("class", "driver-end-label")
      .each(function (d) {
        const lastResult = d.results
          .filter((r) => r.position !== null)
          .at(-1);
        if (!lastResult) return;
        const gLabel = select(this);
        const lx = xScale(lastResult.round)! + 20;
        const ly = yScale(lastResult.position!);

        gLabel
          .append("text")
          .attr("x", lx)
          .attr("y", ly + 1)
          .attr("fill", d.teamColor)
          .attr("font-size", "10px")
          .attr("font-weight", "700")
          .text(d.id);

        gLabel
          .append("text")
          .attr("x", lx)
          .attr("y", ly + 12)
          .attr("fill", "#555")
          .attr("font-size", "8px")
          .text(`${lastResult.cumulativePoints} pts`);
      });

    // Apply current highlight state immediately
    const hl = highlightedRef.current;
    g.selectAll<SVGPathElement, Driver>(".driver-line")
      .attr("stroke-opacity", (d) =>
        hl === null || hl.has(d.id) ? 0.8 : 0.05
      )
      .attr("stroke-width", (d) =>
        hl !== null && hl.has(d.id) ? 3.5 : 2.5
      );
    g.selectAll<SVGGElement, { driver: Driver }>(".driver-node").attr(
      "opacity",
      (d) => (hl === null || hl.has(d.driver.id) ? 1 : 0.05)
    );
    g.selectAll<SVGGElement, Driver>(".driver-end-label").attr("opacity", (d) =>
      hl === null || hl.has(d.id) ? 1 : 0.05
    );
    g.selectAll(".replacement-lines path").each(function () {
      const el = select(this);
      const outId = el.attr("data-out");
      const inId = el.attr("data-in");
      el.attr(
        "stroke-opacity",
        hl === null || (outId && hl.has(outId)) || (inId && hl.has(inId))
          ? 0.5
          : 0.05
      );
    });

    // Zoom/pan — preserve current transform across re-renders
    const zoomBehavior = zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 3])
      .on("zoom", (event) => {
        currentTransformRef.current = event.transform;
        g.attr("transform", event.transform.toString());
      });

    zoomRef.current = zoomBehavior;
    svg.call(zoomBehavior);

    if (isFirstRenderRef.current && innerWidth > 0) {
      // First render: fit all drivers in view
      const totalW = innerWidth + MARGIN.left + MARGIN.right;
      const totalH = innerHeight + MARGIN.top + MARGIN.bottom;
      const scaleX = dimensions.width / totalW;
      const scaleY = dimensions.height / totalH;
      const scale = Math.min(scaleX, scaleY, 1) * 0.9;
      const tx = (dimensions.width - innerWidth * scale) / 2;
      const ty = MARGIN.top * scale + 10;
      const fitTransform = zoomIdentity.translate(tx, ty).scale(scale);
      currentTransformRef.current = fitTransform;
      svg.call(zoomBehavior.transform, fitTransform);
      isFirstRenderRef.current = false;
    } else if (currentTransformRef.current) {
      // Subsequent renders: restore previous transform
      svg.call(zoomBehavior.transform, currentTransformRef.current);
    } else {
      const fallback = zoomIdentity.translate(MARGIN.left, MARGIN.top);
      currentTransformRef.current = fallback;
      svg.call(zoomBehavior.transform, fallback);
    }

    return () => {
      svg.on(".zoom", null);
    };
  }, [season, dimensions, displayMode, filteredRaces, filteredRounds]);

  // Highlight transitions
  useEffect(() => {
    if (!svgRef.current) return;
    const svg = select(svgRef.current);

    svg
      .selectAll<SVGPathElement, Driver>(".driver-line")
      .transition()
      .duration(300)
      .attr("stroke-opacity", (d) =>
        highlightedDrivers === null || highlightedDrivers.has(d.id)
          ? 0.8
          : 0.05
      )
      .attr("stroke-width", (d) =>
        highlightedDrivers !== null && highlightedDrivers.has(d.id) ? 3.5 : 2.5
      );

    svg
      .selectAll<SVGGElement, { driver: Driver }>(".driver-node")
      .transition()
      .duration(300)
      .attr("opacity", (d) =>
        highlightedDrivers === null || highlightedDrivers.has(d.driver.id)
          ? 1
          : 0.05
      );

    svg
      .selectAll<SVGGElement, Driver>(".driver-end-label")
      .transition()
      .duration(300)
      .attr("opacity", (d) =>
        highlightedDrivers === null || highlightedDrivers.has(d.id) ? 1 : 0.05
      );

    svg.selectAll(".replacement-lines path").each(function () {
      const el = select(this);
      const outId = el.attr("data-out");
      const inId = el.attr("data-in");
      el.transition()
        .duration(300)
        .attr(
          "stroke-opacity",
          highlightedDrivers === null ||
            (outId && highlightedDrivers.has(outId)) ||
            (inId && highlightedDrivers.has(inId))
            ? 0.5
            : 0.05
        );
    });
  }, [highlightedDrivers]);

  return (
    <div ref={containerRef} className="w-full h-full">
      <svg
        ref={svgRef}
        width={dimensions.width}
        height={dimensions.height}
        className="bg-neutral-950"
      />
    </div>
  );
});

export default BumpChart;
