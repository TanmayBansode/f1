"use client";

import {
  useRef,
  useEffect,
  useState,
  useMemo,
  useImperativeHandle,
  forwardRef,
} from "react";
import { select, type Selection } from "d3-selection";
import { scalePoint, scaleLinear } from "d3-scale";
import { line, curveBumpX } from "d3-shape";
import { zoom, zoomIdentity, type ZoomBehavior, type ZoomTransform } from "d3-zoom";
import "d3-transition";
import type {
  SeasonData,
  Driver,
  RaceResult,
  RaceType,
  HoverInfo,
  EventHoverInfo,
  NodeDisplayMode,
  RaceTypeFilter,
  DisplayState,
  ChartMode,
} from "@/lib/types";

const MARGIN = { top: 60, right: 80, bottom: 30, left: 50 };
const ROW_HEIGHT = 36;
const COL_WIDTH = 110;
const NODE_RADIUS = 14;
const PHOTO_RADIUS = 18;

/** Breathing room (screen px) between the fitted chart and the viewport edge. */
const VIEW_PAD = 12;
/** Distance (screen px) the sticky axes keep from the viewport edge. */
const STICKY_INSET = 6;
/** Below this zoom level labels get hard to read, so "fit" prefers fitting the height instead. */
const MIN_READABLE_SCALE = 0.6;
const MAX_SCALE = 3;
const BG_COLOR = "#0a0a0a";

// Local-coordinate extents of the axis decorations (used for sticky positioning).
const Y_LABEL_LEFT = -42;
const Y_LABEL_RIGHT = -18;
const HEADER_TOP = -58;
const HEADER_BOTTOM = -10;

const RACE_TYPE_COLORS = {
  race: { bg: "#ffffff", line: "#555" },
  sprint: { bg: "#FF8C00", line: "#FF8C00" },
  qualifying: { bg: "#9B59B6", line: "#9B59B6" },
};

const NODE_STYLE: Record<NodeDisplayMode, { cross: number; hoverScale: number; labelOffset: number }> = {
  dot: { cross: 6, hoverScale: 1.3, labelOffset: 18 },
  code: { cross: 8, hoverScale: 1.2, labelOffset: 24 },
  photo: { cross: 9, hoverScale: 1.25, labelOffset: 26 },
};

export interface BumpChartHandle {
  /** Animate back to the auto-fit view (and keep auto-fitting until the user pans/zooms). */
  centerView: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
}

interface BumpChartProps {
  season: SeasonData;
  highlightedDrivers: Set<string> | null;
  displayMode: NodeDisplayMode;
  raceTypeFilter: RaceTypeFilter;
  chartMode: ChartMode;
  onHover: (info: HoverInfo | null) => void;
  onEventHover: (info: EventHoverInfo | null) => void;
  onSelectDriver: (driverId: string) => void;
}

interface Dot {
  driver: Driver;
  result: RaceResult;
  yPos: number;
  displayState: DisplayState;
}

/** Layout of the last rendered chart, in local (un-zoomed) coordinates. */
interface ChartGeometry {
  innerWidth: number;
  innerHeight: number;
  rounds: number[];
  roundX: Map<number, number>;
}

type SvgSel = Selection<SVGSVGElement, unknown, null, undefined>;

function getDisplayState(result: RaceResult): DisplayState {
  if (result.status === "DSQ") return "dsq";
  if (result.status === "DNF") return "dnf";
  if (result.status === "DNS") return "dns";
  if (result.position === null) return "bench";
  return "racing";
}

// ── Viewport math ───────────────────────────────────────────────────────────

function contentSize(geom: ChartGeometry) {
  return {
    w: geom.innerWidth + MARGIN.left + MARGIN.right,
    h: geom.innerHeight + MARGIN.top + MARGIN.bottom,
  };
}

function fitAllScale(geom: ChartGeometry, width: number, height: number) {
  const { w, h } = contentSize(geom);
  return Math.min(
    Math.max(width - VIEW_PAD * 2, 1) / w,
    Math.max(height - VIEW_PAD * 2, 1) / h,
    1
  );
}

/**
 * The default view. Shows the whole season when that stays readable; otherwise
 * fits every driver vertically and right-aligns so the most recent rounds are
 * visible (the rest is one scroll/drag away).
 */
function computeFit(geom: ChartGeometry, width: number, height: number): ZoomTransform {
  const { w, h } = contentSize(geom);
  const availW = Math.max(width - VIEW_PAD * 2, 1);
  const availH = Math.max(height - VIEW_PAD * 2, 1);
  const fitAll = fitAllScale(geom, width, height);
  const fitHeight = Math.min(availH / h, 1);
  const k = fitAll >= Math.min(fitHeight, MIN_READABLE_SCALE) ? fitAll : fitHeight;

  const scaledW = w * k;
  const tx =
    scaledW <= availW + 0.5
      ? (width - scaledW) / 2 + MARGIN.left * k
      : width - VIEW_PAD - (geom.innerWidth + MARGIN.right) * k;
  const ty = VIEW_PAD + MARGIN.top * k;
  return zoomIdentity.translate(tx, ty).scale(k);
}

/**
 * Keeps the chart on screen. Content larger than the viewport can be panned
 * until its edge meets the viewport edge; smaller content can move around but
 * never leave the viewport. This is what makes a "black screen" impossible.
 */
function clampTransform(
  t: ZoomTransform,
  geom: ChartGeometry,
  width: number,
  height: number
): ZoomTransform {
  const k = t.k;
  const clampAxis = (v: number, lo: number, hi: number, size: number) => {
    const a = VIEW_PAD - lo * k; // leading edge pinned to the start
    const b = size - VIEW_PAD - hi * k; // trailing edge pinned to the end
    return Math.min(Math.max(v, Math.min(a, b)), Math.max(a, b));
  };
  const x = clampAxis(t.x, -MARGIN.left, geom.innerWidth + MARGIN.right, width);
  const y = clampAxis(t.y, -MARGIN.top, geom.innerHeight + MARGIN.bottom, height);
  return x === t.x && y === t.y ? t : zoomIdentity.translate(x, y).scale(k);
}

/**
 * When columns are added/removed (filters, chart mode) keep the round that was
 * in the middle of the screen in the middle of the screen, so the chart does
 * not appear to jump around.
 */
function anchorTransform(
  prev: ZoomTransform,
  prevGeom: ChartGeometry | null,
  nextGeom: ChartGeometry,
  width: number
): ZoomTransform {
  if (!prevGeom || prevGeom.rounds.length === 0 || nextGeom.rounds.length === 0) {
    return prev;
  }
  const centerLocal = (width / 2 - prev.x) / prev.k;

  let anchor = prevGeom.rounds[0];
  let best = Infinity;
  for (const r of prevGeom.rounds) {
    const dist = Math.abs(prevGeom.roundX.get(r)! - centerLocal);
    if (dist < best) {
      best = dist;
      anchor = r;
    }
  }
  const offset = centerLocal - prevGeom.roundX.get(anchor)!;

  let target = nextGeom.rounds[0];
  best = Infinity;
  for (const r of nextGeom.rounds) {
    const dist = Math.abs(r - anchor);
    if (dist < best) {
      best = dist;
      target = r;
    }
  }
  const nextCenterLocal = nextGeom.roundX.get(target)! + offset;
  return zoomIdentity
    .translate(width / 2 - nextCenterLocal * prev.k, prev.y)
    .scale(prev.k);
}

// ── Highlight helpers (shared by the render pass and the highlight effect) ──

const isOn = (hl: Set<string> | null, id: string) => hl === null || hl.has(id);
const lineOpacity = (hl: Set<string> | null, id: string) => (isOn(hl, id) ? 0.8 : 0.05);
const lineWidth = (hl: Set<string> | null, id: string) =>
  hl !== null && hl.has(id) ? 3.5 : 2.5;
const fadeOpacity = (hl: Set<string> | null, id: string) => (isOn(hl, id) ? 1 : 0.05);
const replacementOpacity = (hl: Set<string> | null, el: SVGPathElement) => {
  const outId = el.getAttribute("data-out");
  const inId = el.getAttribute("data-in");
  return hl === null || (outId && hl.has(outId)) || (inId && hl.has(inId)) ? 0.5 : 0.05;
};

const BumpChart = forwardRef<BumpChartHandle, BumpChartProps>(function BumpChart(
  { season, highlightedDrivers, displayMode, raceTypeFilter, chartMode, onHover, onEventHover, onSelectDriver },
  ref
) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const transformRef = useRef<ZoomTransform | null>(null);
  const geomRef = useRef<ChartGeometry | null>(null);
  /** True until the user pans/zooms manually — while true, layout changes re-fit the chart. */
  const autoFitRef = useRef(true);
  const renderedSeasonRef = useRef<SeasonData | null>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const dimsRef = useRef(dimensions);
  dimsRef.current = dimensions;
  const hasSize = dimensions.width > 0 && dimensions.height > 0;

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
        const svgEl = svgRef.current;
        const zoomB = zoomRef.current;
        const geom = geomRef.current;
        if (!svgEl || !zoomB || !geom) return;
        const { width, height } = dimsRef.current;
        autoFitRef.current = true;
        const fit = clampTransform(computeFit(geom, width, height), geom, width, height);
        select(svgEl).interrupt().transition().duration(500).call(zoomB.transform, fit);
      },
      zoomIn: () => zoomBy(1.35),
      zoomOut: () => zoomBy(1 / 1.35),
    }),
    []
  );

  function zoomBy(factor: number) {
    const svgEl = svgRef.current;
    const zoomB = zoomRef.current;
    if (!svgEl || !zoomB || !geomRef.current) return;
    autoFitRef.current = false;
    select(svgEl).interrupt().transition().duration(250).call(zoomB.scaleBy, factor);
  }

  // Track the container size. The SVG content is NOT rebuilt on resize — only
  // the zoom transform is updated (see the effect further below).
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setDimensions((prev) =>
        prev.width === width && prev.height === height ? prev : { width, height }
      );
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // In championship mode, only show race+sprint; otherwise use the raceTypeFilter
  const effectiveFilter = useMemo(
    () =>
      chartMode === "championship"
        ? new Set<RaceType>(["race", "sprint"])
        : raceTypeFilter,
    [chartMode, raceTypeFilter]
  );

  const filteredRaces = useMemo(
    () => season.races.filter((r) => effectiveFilter.has(r.type)),
    [season.races, effectiveFilter]
  );
  const filteredRounds = useMemo(
    () => new Set(filteredRaces.map((r) => r.round)),
    [filteredRaces]
  );

  // Championship rank map: Map<round, Map<driverId, rank>>.
  // Only drivers who have taken part by that round are ranked; ties are broken
  // by count-back on Grand Prix finishes (most wins, then most P2s, ...).
  const championshipRankMap = useMemo(() => {
    if (chartMode !== "championship") return null;
    const raceTypeByRound = new Map(filteredRaces.map((r) => [r.round, r.type]));
    const standings = season.drivers.map((d, idx) => ({
      id: d.id,
      idx,
      byRound: new Map(
        d.results.filter((r) => raceTypeByRound.has(r.round)).map((r) => [r.round, r])
      ),
      pts: 0,
      started: false,
      finishes: [] as number[],
    }));
    const countBack = (a: (typeof standings)[0], b: (typeof standings)[0]) => {
      const len = Math.max(a.finishes.length, b.finishes.length);
      for (let p = 1; p < len; p++) {
        const diff = (b.finishes[p] ?? 0) - (a.finishes[p] ?? 0);
        if (diff !== 0) return diff;
      }
      return 0;
    };

    const map = new Map<number, Map<string, number>>();
    for (const race of filteredRaces) {
      for (const s of standings) {
        const r = s.byRound.get(race.round);
        if (!r) continue;
        s.started = true;
        s.pts += r.points;
        if (race.type === "race" && r.position !== null) {
          s.finishes[r.position] = (s.finishes[r.position] ?? 0) + 1;
        }
      }
      const ranked = standings
        .filter((s) => s.started)
        .sort((a, b) => b.pts - a.pts || countBack(a, b) || a.idx - b.idx);
      map.set(race.round, new Map(ranked.map((s, i) => [s.id, i + 1])));
    }
    return map;
  }, [chartMode, filteredRaces, season.drivers]);

  // Main D3 rendering — rebuilds the chart when data / display options change.
  useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl || !hasSize) return;
    const svg: SvgSel = select(svgEl);
    svg.interrupt();
    svg.selectAll("*").remove();
    onHoverRef.current(null);
    onEventHoverRef.current(null);

    if (filteredRaces.length === 0) {
      geomRef.current = null;
      svg
        .append("text")
        .attr("x", "50%")
        .attr("y", "50%")
        .attr("text-anchor", "middle")
        .attr("fill", "#555")
        .attr("font-size", "14px")
        .text("No sessions match the selected filters");
      return;
    }

    const { width, height } = dimsRef.current;
    const raceByRound = new Map(season.races.map((r) => [r.round, r]));

    const maxPosition =
      chartMode === "championship"
        ? Math.max(1, ...Array.from(championshipRankMap?.values() ?? [], (m) => m.size))
        : Math.max(
            1,
            ...season.drivers.flatMap((d) =>
              d.results
                .filter((r) => r.position !== null && filteredRounds.has(r.round))
                .map((r) => r.position!)
            )
          );

    const innerWidth = (filteredRaces.length - 1) * COL_WIDTH;
    const innerHeight = (maxPosition - 1) * ROW_HEIGHT;

    const xScale = scalePoint<number>()
      .domain(filteredRaces.map((r) => r.round))
      .range([0, Math.max(innerWidth, 0)]);

    const yScale = scaleLinear()
      .domain([1, maxPosition])
      .range([0, innerHeight]);

    const geom: ChartGeometry = {
      innerWidth,
      innerHeight,
      rounds: filteredRaces.map((r) => r.round),
      roundX: new Map(filteredRaces.map((r) => [r.round, xScale(r.round)!])),
    };
    const prevGeom = geomRef.current;
    geomRef.current = geom;

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

    // Layer order: zoomable content → sticky backdrops → sticky race header →
    // sticky position axis → corner mask.
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

    const lineGenerator = line<RaceResult & { _driverId: string }>()
      .defined((d) => {
        if (chartMode === "championship") {
          return championshipRankMap?.get(d.round)?.has(d._driverId) ?? false;
        }
        return d.position !== null;
      })
      .x((d) => xScale(d.round)!)
      .y((d) => {
        if (chartMode === "championship") {
          const rank = championshipRankMap?.get(d.round)?.get(d._driverId);
          return rank !== undefined ? yScale(rank) : 0;
        }
        return yScale(d.position!);
      })
      .curve(curveBumpX);

    const driversWithFilteredResults = season.drivers.map((d) => ({
      ...d,
      results: d.results
        .filter((r) => filteredRounds.has(r.round))
        .map((r) => ({ ...r, _driverId: d.id })),
    }));

    const hl = highlightedRef.current;

    // Driver lines
    g.selectAll<SVGPathElement, (typeof driversWithFilteredResults)[0]>(".driver-line")
      .data(driversWithFilteredResults, (d) => d.id)
      .join("path")
      .attr("class", "driver-line")
      .attr("d", (d) => lineGenerator(d.results))
      .attr("fill", "none")
      .attr("stroke", (d) => d.teamColor)
      .attr("stroke-linecap", "round")
      .attr("stroke-width", (d) => lineWidth(hl, d.id))
      .attr("stroke-opacity", (d) => lineOpacity(hl, d.id));

    // Replacement connector lines (dotted). Only meaningful when the y-axis is
    // the session result, so they are hidden in championship mode.
    if (season.driverReplacements && chartMode === "race") {
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
        const midX = (x1 + x2) / 2;
        const path = replacementGroup
          .append("path")
          .attr("d", `M${x1},${y1} C${midX},${y1} ${midX},${y2} ${x2},${y2}`)
          .attr("fill", "none")
          .attr("stroke", outDriver.teamColor)
          .attr("stroke-width", 2)
          .attr("stroke-dasharray", "6,4")
          .attr("pointer-events", "none")
          .attr("data-out", swap.out)
          .attr("data-in", swap.in);
        path.attr("stroke-opacity", replacementOpacity(hl, path.node()!));
      }
    }

    // Position nodes
    const dots: Dot[] = season.drivers.flatMap((driver) =>
      driver.results
        .filter((r) => filteredRounds.has(r.round))
        .flatMap((result) => {
          const yPos =
            chartMode === "championship"
              ? championshipRankMap?.get(result.round)?.get(driver.id) ?? null
              : result.position;
          if (yPos === null) return [];
          return [{ driver, result, yPos, displayState: getDisplayState(result) }];
        })
    );

    const isTouchDevice = "ontouchstart" in window || navigator.maxTouchPoints > 0;
    let longPressTimer: ReturnType<typeof setTimeout> | null = null;
    let longPressFired = false;

    const showTooltip = (clientX: number, clientY: number, d: Dot) => {
      if (d.result.position === null) return;
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const race = raceByRound.get(d.result.round);
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
        x: clientX - rect.left,
        y: clientY - rect.top,
        containerWidth: rect.width,
        containerHeight: rect.height,
      });
    };

    const hideTooltip = () => onHoverRef.current(null);

    const clearLongPress = () => {
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }
    };

    const nodeStyle = NODE_STYLE[displayMode];
    const nodeGroups = g
      .selectAll<SVGGElement, Dot>(".driver-node")
      .data(dots)
      .join("g")
      .attr("class", "driver-node")
      .attr("transform", (d) => `translate(${xScale(d.result.round)!},${yScale(d.yPos)})`)
      .attr("opacity", (d) => fadeOpacity(hl, d.driver.id))
      .style("cursor", "pointer");

    // Shapes live in an inner group so hover can scale them without touching
    // the outer translate (and without fighting the highlight transition).
    const inner = nodeGroups.append("g").attr("class", "node-inner");

    if (displayMode === "dot") {
      inner
        .append("circle")
        .attr("r", NODE_RADIUS - 2)
        .attr("fill", (d) => d.driver.teamColor)
        .attr("stroke", BG_COLOR)
        .attr("stroke-width", 2);
    } else if (displayMode === "code") {
      inner
        .append("rect")
        .attr("x", -18)
        .attr("y", -11)
        .attr("width", 36)
        .attr("height", 22)
        .attr("rx", 5)
        .attr("fill", (d) => d.driver.teamColor)
        .attr("stroke", BG_COLOR)
        .attr("stroke-width", 1.5);
      inner
        .append("text")
        .attr("text-anchor", "middle")
        .attr("y", 4)
        .attr("fill", "#fff")
        .attr("font-size", "10px")
        .attr("font-weight", "800")
        .attr("letter-spacing", "0.5px")
        .text((d) => d.driver.id);
    } else {
      inner
        .append("circle")
        .attr("r", PHOTO_RADIUS)
        .attr("fill", "none")
        .attr("stroke", (d) => d.driver.teamColor)
        .attr("stroke-width", 1.5);
      inner
        .append("circle")
        .attr("r", PHOTO_RADIUS - 1.5)
        .attr("fill", (d) => `url(#photo-${d.driver.id})`)
        .attr("stroke", "none");
    }

    // DNF/DSQ cross (red) and DNS cross (black)
    inner
      .filter((d) => d.displayState === "dnf" || d.displayState === "dsq" || d.displayState === "dns")
      .each(function (d) {
        const s = nodeStyle.cross;
        const color = d.displayState === "dns" ? "#000" : "#E10600";
        const el = select(this);
        for (const [x1, y1, x2, y2] of [[-s, -s, s, s], [s, -s, -s, s]]) {
          el.append("line")
            .attr("x1", x1).attr("y1", y1).attr("x2", x2).attr("y2", y2)
            .attr("stroke", color).attr("stroke-width", 2.5)
            .attr("stroke-linecap", "round").attr("pointer-events", "none");
        }
      });

    // Desktop: hover shows tooltip, mouseleave hides
    nodeGroups
      .on("mouseenter", function (event: MouseEvent, d) {
        if (isTouchDevice) return; // skip on touch — handled by long press
        select(this)
          .select(".node-inner")
          .interrupt("hover")
          .transition("hover")
          .duration(100)
          .attr("transform", `scale(${nodeStyle.hoverScale})`);
        showTooltip(event.clientX, event.clientY, d);
      })
      .on("mouseleave", function () {
        if (isTouchDevice) return;
        select(this)
          .select(".node-inner")
          .interrupt("hover")
          .transition("hover")
          .duration(100)
          .attr("transform", "scale(1)");
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

    // Driver end-of-line labels
    g.selectAll<SVGGElement, (typeof driversWithFilteredResults)[0]>(".driver-end-label")
      .data(driversWithFilteredResults)
      .join("g")
      .attr("class", "driver-end-label")
      .attr("opacity", (d) => fadeOpacity(hl, d.id))
      .attr("pointer-events", "none")
      .each(function (d) {
        const lastResult = d.results
          .filter((r) => {
            if (chartMode === "championship") {
              return championshipRankMap?.get(r.round)?.has(d.id) ?? false;
            }
            return r.position !== null;
          })
          .at(-1);
        if (!lastResult) return;
        const yVal =
          chartMode === "championship"
            ? championshipRankMap?.get(lastResult.round)?.get(d.id) ?? null
            : lastResult.position;
        if (yVal === null) return;
        const lx = xScale(lastResult.round)! + nodeStyle.labelOffset;
        const ly = yScale(yVal);
        const gLabel = select(this);

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

    // ── Sticky backdrops (screen space) ──
    const backdrop = svg.append("g").attr("class", "sticky-backdrop");
    const topBand = backdrop.append("rect").attr("fill", BG_COLOR).attr("fill-opacity", 0.94);
    const topEdge = backdrop.append("line").attr("stroke", "#222").attr("x1", 0);
    const leftStrip = backdrop.append("rect").attr("fill", BG_COLOR).attr("fill-opacity", 0.94);
    const leftEdge = backdrop.append("line").attr("stroke", "#222").attr("y1", 0);

    // ── Race header (x-axis): follows horizontal pan, sticks to the top ──
    const xAxisGroup = svg.append("g").attr("class", "x-axis");
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
        .attr("y", HEADER_TOP)
        .attr("width", 56)
        .attr("height", HEADER_BOTTOM - HEADER_TOP)
        .attr("fill", "transparent");

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
          containerWidth: rect.width,
          containerHeight: rect.height,
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
          .attr("fill", "#bbb")
          .attr("font-size", "11px")
          .attr("font-weight", "700")
          .text(race.shortName);
      }
    });

    // ── Position axis (y-axis): follows vertical pan, sticks to the left ──
    const yAxisGroup = svg.append("g").attr("class", "y-axis").attr("pointer-events", "none");
    for (let pos = 1; pos <= maxPosition; pos++) {
      yAxisGroup
        .append("rect")
        .attr("x", Y_LABEL_LEFT)
        .attr("y", yScale(pos) - 9)
        .attr("width", Y_LABEL_RIGHT - Y_LABEL_LEFT)
        .attr("height", 18)
        .attr("rx", 4)
        .attr("fill", pos <= 3 ? "#3a0d0b" : pos <= 10 ? "#2a2a2a" : "#1a1a1a");

      yAxisGroup
        .append("text")
        .attr("x", (Y_LABEL_LEFT + Y_LABEL_RIGHT) / 2)
        .attr("y", yScale(pos) + 4)
        .attr("text-anchor", "middle")
        .attr("fill", pos <= 3 ? "#ff4d42" : pos <= 10 ? "#9a9a9a" : "#5a5a5a")
        .attr("font-size", "11px")
        .attr("font-weight", pos <= 3 ? "800" : "600")
        .text(pos);
    }

    // Masks race labels that slide under the sticky position axis.
    const corner = svg.append("rect").attr("fill", BG_COLOR);

    const applyView = (t: ZoomTransform) => {
      const { width: W, height: H } = dimsRef.current;
      const k = t.k;
      g.attr("transform", t.toString());

      const yAxisX = Math.max(t.x, STICKY_INSET - Y_LABEL_LEFT * k);
      const headerY = Math.max(t.y, STICKY_INSET - HEADER_TOP * k);
      const yStuck = yAxisX > t.x + 0.5;
      const headerStuck = headerY > t.y + 0.5;

      xAxisGroup.attr("transform", `translate(${t.x},${headerY}) scale(${k})`);
      yAxisGroup.attr("transform", `translate(${yAxisX},${t.y}) scale(${k})`);

      const stripW = Math.max(yAxisX + (Y_LABEL_RIGHT + 6) * k, 0);
      const bandH = Math.max(headerY + HEADER_BOTTOM * k, 0);

      topBand
        .attr("display", headerStuck ? null : "none")
        .attr("width", W)
        .attr("height", bandH);
      topEdge
        .attr("display", headerStuck ? null : "none")
        .attr("x2", W)
        .attr("y1", bandH)
        .attr("y2", bandH);
      leftStrip
        .attr("display", yStuck ? null : "none")
        .attr("width", stripW)
        .attr("height", H);
      leftEdge
        .attr("display", yStuck ? null : "none")
        .attr("x1", stripW)
        .attr("x2", stripW)
        .attr("y2", H);
      corner
        .attr("display", yStuck ? null : "none")
        .attr("width", stripW)
        .attr("height", bandH);
    };

    const hideTooltips = () => {
      onHoverRef.current(null);
      onEventHoverRef.current(null);
    };

    // Zoom/pan. Plain wheel / trackpad scroll pans; Ctrl/⌘ + wheel or pinch zooms.
    const zoomBehavior = zoom<SVGSVGElement, unknown>()
      .scaleExtent([Math.min(0.2, fitAllScale(geom, width, height) * 0.9), MAX_SCALE])
      .extent([
        [0, 0],
        [width, height],
      ])
      .constrain((t) => {
        const current = geomRef.current;
        if (!current) return t;
        return clampTransform(t, current, dimsRef.current.width, dimsRef.current.height);
      })
      .filter((event: Event) => {
        if (event.type === "wheel") {
          const we = event as WheelEvent;
          return we.ctrlKey || we.metaKey;
        }
        const me = event as MouseEvent;
        return !me.ctrlKey && !me.button;
      })
      .wheelDelta((event: WheelEvent) => {
        const delta =
          -event.deltaY *
          (event.deltaMode === 1 ? 0.05 : event.deltaMode ? 1 : 0.002) *
          (event.ctrlKey ? 10 : 1);
        return Math.max(-0.5, Math.min(0.5, delta));
      })
      .on("start", (event) => {
        if (event.sourceEvent) hideTooltips();
      })
      .on("zoom", (event) => {
        transformRef.current = event.transform;
        if (event.sourceEvent) autoFitRef.current = false;
        applyView(event.transform);
      });

    zoomRef.current = zoomBehavior;
    svg.call(zoomBehavior).on("dblclick.zoom", null);

    svg.on(
      "wheel.pan",
      (event: WheelEvent) => {
        if (event.ctrlKey || event.metaKey) return; // handled by d3-zoom
        const current = geomRef.current;
        const t = transformRef.current;
        if (!current || !t) return;
        event.preventDefault();
        const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? dimsRef.current.height : 1;
        let dx = event.deltaX * unit;
        let dy = event.deltaY * unit;
        if (event.shiftKey && dx === 0) {
          dx = dy;
          dy = 0;
        }
        // When every row is already visible, a vertical wheel scrolls the season horizontally.
        const fitsVertically = contentSize(current).h * t.k <= dimsRef.current.height - VIEW_PAD * 2 + 1;
        if (fitsVertically && Math.abs(dy) > Math.abs(dx)) {
          dx = dy;
          dy = 0;
        }
        autoFitRef.current = false;
        hideTooltips();
        svg.interrupt();
        svg.call(zoomBehavior.translateBy, -dx / t.k, -dy / t.k);
      },
      { passive: false }
    );

    // Decide where the camera goes after the rebuild.
    const seasonChanged = renderedSeasonRef.current !== season;
    renderedSeasonRef.current = season;
    let target: ZoomTransform;
    if (seasonChanged || autoFitRef.current || !transformRef.current) {
      autoFitRef.current = true;
      target = computeFit(geom, width, height);
    } else {
      target = anchorTransform(transformRef.current, prevGeom, geom, width);
    }
    svg.call(zoomBehavior.transform, clampTransform(target, geom, width, height));

    return () => {
      clearLongPress();
      svg.interrupt();
      svg.on(".zoom", null).on("wheel.pan", null);
    };
  }, [season, hasSize, displayMode, filteredRaces, filteredRounds, chartMode, championshipRankMap]);

  // Container resized (window resize, driver panel / bottom bar toggled):
  // only move the camera — never rebuild the chart.
  useEffect(() => {
    const svgEl = svgRef.current;
    const zoomB = zoomRef.current;
    const geom = geomRef.current;
    const { width, height } = dimensions;
    if (!svgEl || !zoomB || !geom || !width || !height) return;
    zoomB.scaleExtent([Math.min(0.2, fitAllScale(geom, width, height) * 0.9), MAX_SCALE]);
    const base =
      autoFitRef.current || !transformRef.current
        ? computeFit(geom, width, height)
        : transformRef.current;
    const svg = select(svgEl);
    svg.interrupt();
    svg.call(zoomB.transform, clampTransform(base, geom, width, height));
  }, [dimensions]);

  // Highlight transitions
  useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl) return;
    const svg = select(svgEl);
    const hl = highlightedDrivers;

    svg
      .selectAll<SVGPathElement, Driver>(".driver-line")
      .transition("highlight")
      .duration(300)
      .attr("stroke-opacity", (d) => lineOpacity(hl, d.id))
      .attr("stroke-width", (d) => lineWidth(hl, d.id));

    svg
      .selectAll<SVGGElement, Dot>(".driver-node")
      .transition("highlight")
      .duration(300)
      .attr("opacity", (d) => fadeOpacity(hl, d.driver.id));

    svg
      .selectAll<SVGGElement, Driver>(".driver-end-label")
      .transition("highlight")
      .duration(300)
      .attr("opacity", (d) => fadeOpacity(hl, d.id));

    svg.selectAll<SVGPathElement, unknown>(".replacement-lines path").each(function () {
      select(this)
        .transition("highlight")
        .duration(300)
        .attr("stroke-opacity", replacementOpacity(hl, this));
    });
  }, [highlightedDrivers]);

  return (
    <div ref={containerRef} className="w-full h-full">
      <svg
        ref={svgRef}
        width={dimensions.width}
        height={dimensions.height}
        className="block bg-neutral-950 touch-none"
        role="img"
        aria-label={`Bump chart of ${season.year} ${chartMode === "championship" ? "championship" : "session"} positions`}
      />
    </div>
  );
});

export default BumpChart;
