"use client";

import { useState, useCallback, useRef, useEffect, lazy, Suspense } from "react";
import { defaultSeason, loadSeason, getSeasonSync, manifest } from "../../data";
import type { SeasonData } from "@/lib/types";
import type { BumpChartHandle } from "./BumpChart";
import BottomBar from "./BottomBar";
import DriverPanel from "./DriverPanel";
import { DriverTooltip, EventTooltip } from "./Tooltip";
import type { HoverInfo, EventHoverInfo, NodeDisplayMode, RaceType, RaceTypeFilter } from "@/lib/types";

const BumpChart = lazy(() => import("./BumpChart"));

const ALL_RACE_TYPES: RaceTypeFilter = new Set<RaceType>([
  "race",
  "sprint",
  "qualifying",
]);

function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const check = () => {
      clearTimeout(timer);
      timer = setTimeout(() => setIsMobile(window.innerWidth < breakpoint), 150);
    };
    setIsMobile(window.innerWidth < breakpoint);
    window.addEventListener("resize", check);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", check);
    };
  }, [breakpoint]);
  return isMobile;
}

export default function BumpChartPage() {
  const chartRef = useRef<BumpChartHandle>(null);
  const isMobile = useIsMobile();
  const [activeSeason, setActiveSeason] = useState(manifest.defaultYear);
  const [highlightedDrivers, setHighlightedDrivers] = useState<Set<
    string
  > | null>(null);
  const [hoveredNode, setHoveredNode] = useState<HoverInfo | null>(null);
  const [hoveredEvent, setHoveredEvent] = useState<EventHoverInfo | null>(null);
  const [displayMode, setDisplayMode] = useState<NodeDisplayMode>("code");
  const [raceTypeFilter, setRaceTypeFilter] =
    useState<RaceTypeFilter>(ALL_RACE_TYPES);
  const [driverPanelOpen, setDriverPanelOpen] = useState(false);
  const [bottomBarOpen, setBottomBarOpen] = useState(true);
  const [seasonData, setSeasonData] = useState<SeasonData>(defaultSeason);

  // Load season data on demand
  useEffect(() => {
    const cached = getSeasonSync(activeSeason);
    if (cached) {
      setSeasonData(cached);
      return;
    }
    loadSeason(activeSeason).then(setSeasonData);
  }, [activeSeason]);

  // Open driver panel by default on desktop only
  const initializedRef = useRef(false);
  useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true;
      if (!isMobile) setDriverPanelOpen(true);
    }
  }, [isMobile]);

  const handleSelectSeason = useCallback((year: number) => {
    setActiveSeason(year);
    setHighlightedDrivers(null);
  }, []);

  const handleToggleDriver = useCallback((driverId: string) => {
    setHighlightedDrivers((prev) => {
      if (prev === null) {
        return new Set([driverId]);
      }
      const next = new Set(prev);
      if (next.has(driverId)) {
        next.delete(driverId);
        return next.size === 0 ? null : next;
      }
      next.add(driverId);
      return next;
    });
  }, []);

  const handleToggleTeam = useCallback(
    (teamId: string) => {
      const teamDriverIds = seasonData.drivers
        .filter((d) => d.teamId === teamId)
        .map((d) => d.id);

      setHighlightedDrivers((prev) => {
        if (prev === null) {
          return new Set(teamDriverIds);
        }
        const allSelected = teamDriverIds.every((id) => prev.has(id));
        const next = new Set(prev);
        if (allSelected) {
          teamDriverIds.forEach((id) => next.delete(id));
          return next.size === 0 ? null : next;
        }
        teamDriverIds.forEach((id) => next.add(id));
        return next;
      });
    },
    [seasonData]
  );

  const handleToggleRaceType = useCallback((type: RaceType) => {
    setRaceTypeFilter((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        if (next.size <= 1) return prev;
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  }, []);

  const handleReset = useCallback(() => {
    setHighlightedDrivers(null);
    setRaceTypeFilter(ALL_RACE_TYPES);
  }, []);

  const handleCenterView = useCallback(() => {
    chartRef.current?.centerView();
  }, []);

  return (
    <div className="h-dvh flex flex-col bg-neutral-950 text-white">
      {/* Header bar */}
      <div className="flex-none flex items-center justify-between px-3 sm:px-5 py-2 sm:py-2.5 border-b border-neutral-800/50 bg-[#0d0d0d]">
        <div className="flex items-center gap-2">
          <a
            href="https://www.formula1.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-lg sm:text-xl font-black tracking-tighter text-[#E10600] hover:text-[#ff1a0e] transition-colors"
          >
            F1
          </a>
          <div className="w-px h-5 bg-neutral-800" />
          <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-[0.2em]">
            Standings Tracker
          </span>
          <span className="text-[10px] text-neutral-700 font-medium ml-1">
            {activeSeason}
          </span>
        </div>
        <div className="hidden sm:flex items-center gap-1.5 text-[10px] text-neutral-600">
          <span>made with</span>
          <span className="font-bold text-neutral-400">Claude</span>
          <span>by</span>
          <a
            href="https://github.com/TanmayBansode"
            target="_blank"
            rel="noopener noreferrer"
            className="font-bold text-neutral-400 hover:text-white transition-colors"
          >
            TannyBans
          </a>
        </div>
      </div>

      {/* Main area: chart + driver panel */}
      <div className="flex-1 flex flex-row overflow-hidden relative">
        {/* Chart container */}
        <div className="flex-1 overflow-hidden relative">
          <Suspense fallback={<div className="w-full h-full bg-neutral-950 flex items-center justify-center"><span className="text-neutral-600 text-sm">Loading chart...</span></div>}>
            <BumpChart
              ref={chartRef}
              season={seasonData}
              highlightedDrivers={highlightedDrivers}
              displayMode={displayMode}
              raceTypeFilter={raceTypeFilter}
              onHover={setHoveredNode}
              onEventHover={setHoveredEvent}
              onSelectDriver={handleToggleDriver}
            />
          </Suspense>
          {hoveredNode && (
            <DriverTooltip info={hoveredNode} season={seasonData} />
          )}
          {hoveredEvent && <EventTooltip info={hoveredEvent} />}

          {/* Driver panel toggle (when panel is hidden) */}
          {!driverPanelOpen && (
            <button
              onClick={() => setDriverPanelOpen(true)}
              className="absolute right-0 top-1/2 -translate-y-1/2 z-30 w-6 h-16 rounded-l-lg bg-neutral-900/90 backdrop-blur border border-r-0 border-neutral-700/50 hover:bg-neutral-800 hover:w-7 transition-all duration-200 flex items-center justify-center text-neutral-500 hover:text-white"
              title="Show driver panel"
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
          )}

          {/* Bottom bar toggle (when bar is hidden) */}
          {!bottomBarOpen && (
            <button
              onClick={() => setBottomBarOpen(true)}
              className="absolute bottom-0 left-1/2 -translate-x-1/2 z-30 h-6 w-16 rounded-t-lg bg-neutral-900/90 backdrop-blur border border-b-0 border-neutral-700/50 hover:bg-neutral-800 hover:h-7 transition-all duration-200 flex items-center justify-center text-neutral-500 hover:text-white"
              title="Show controls"
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M18 15l-6-6-6 6" />
              </svg>
            </button>
          )}
        </div>

        {/* Driver panel - overlay on mobile, sidebar on desktop */}
        {isMobile ? (
          <>
            {/* Backdrop */}
            {driverPanelOpen && (
              <div
                className="absolute inset-0 bg-black/50 z-40"
                onClick={() => setDriverPanelOpen(false)}
              />
            )}
            <div
              className="absolute top-0 right-0 h-full z-50 transition-transform duration-300 ease-in-out"
              style={{
                transform: driverPanelOpen
                  ? "translateX(0)"
                  : "translateX(100%)",
              }}
            >
              <DriverPanel
                season={seasonData}
                highlightedDrivers={highlightedDrivers}
                onToggleDriver={handleToggleDriver}
                isOpen={true}
                onToggle={() => setDriverPanelOpen(false)}
              />
            </div>
          </>
        ) : (
          <DriverPanel
            season={seasonData}
            highlightedDrivers={highlightedDrivers}
            onToggleDriver={handleToggleDriver}
            isOpen={driverPanelOpen}
            onToggle={() => setDriverPanelOpen((p) => !p)}
          />
        )}
      </div>

      {/* Bottom bar (collapsible) */}
      <div
        className={`flex-none transition-all duration-300 ease-in-out overflow-hidden ${
          bottomBarOpen ? "max-h-40" : "max-h-0"
        }`}
      >
        <BottomBar
          season={seasonData}
          availableYears={manifest.years}
          activeSeason={activeSeason}
          highlightedDrivers={highlightedDrivers}
          displayMode={displayMode}
          raceTypeFilter={raceTypeFilter}
          onSelectSeason={handleSelectSeason}
          onToggleTeam={handleToggleTeam}
          onSetDisplayMode={setDisplayMode}
          onToggleRaceType={handleToggleRaceType}
          onReset={handleReset}
          onCenterView={handleCenterView}
          onToggle={() => setBottomBarOpen((p) => !p)}
        />
      </div>
    </div>
  );
}
