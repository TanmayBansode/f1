"use client";

import { useState, useCallback, useRef, useEffect, lazy, Suspense } from "react";
import Image from "next/image";
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
      {/* Navbar */}
      <div className="flex-none relative z-10">
        <div
          className="flex items-center justify-between sm:justify-between px-3 sm:px-5 py-2 sm:py-2.5"
          style={{
            background: "linear-gradient(180deg, #111111f0, #0d0d0dee)",
            backdropFilter: "blur(12px)",
          }}
        >
          {/* Left: Brand - Centered on mobile */}
          <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto justify-center sm:justify-start translate-x-3 sm:translate-x-0">
            <a
              href="https://www.podiums.dev"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:opacity-80 transition-opacity flex-none"
            >
              <Image
                src="/f1logo.png"
                alt="F1"
                width={48}
                height={20}
                className="h-4 sm:h-5 w-auto"
                unoptimized
              />
            </a>
            <div className="w-px h-4 sm:h-5 bg-neutral-700/50" />
            <div className="flex items-baseline gap-1.5">
              <span className="text-[13px] sm:text-[18px] font-extrabold text-neutral-400 uppercase tracking-[0.12em] sm:tracking-[0.18em]">
                Podiums
              </span>
              <span
                className="text-[9px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                style={{
                  background: "#E1060018",
                  color: "#E10600",
                  border: "1px solid #E1060030",
                }}
              >
                {activeSeason}
              </span>
            </div>
          </div>

          {/* Right: Credits + GitHub - Hidden on extreme small to allow centering brand */}
          <div className="hidden sm:flex items-center gap-2 sm:gap-3">
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
            <a
              href="https://github.com/TanmayBansode/f1"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-full bg-neutral-800/50 border border-neutral-700/30 text-neutral-500 hover:text-white hover:border-neutral-500/50 transition-all duration-200 text-[10px] sm:text-[11px] font-semibold"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
              </svg>
              <span>Star</span>
            </a>
          </div>
        </div>
        {/* Bottom glow */}
        <div
          className="absolute bottom-0 left-0 right-0 h-px"
          style={{
            background: "linear-gradient(90deg, transparent, #E1060025, #E1060040, #E1060025, transparent)",
          }}
        />
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
              className="absolute right-0 top-1/2 -translate-y-1/2 z-30 w-8 sm:w-6 h-20 sm:h-16 rounded-l-lg bg-neutral-900/90 backdrop-blur border border-r-0 border-neutral-700/50 hover:bg-neutral-800 hover:w-9 sm:hover:w-7 transition-all duration-200 flex items-center justify-center text-neutral-500 hover:text-white"
              title="Show driver panel"
            >
              <svg
                width="14"
                height="14"
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
              className="absolute bottom-0 left-1/2 -translate-x-1/2 z-30 h-8 sm:h-6 w-20 sm:w-16 rounded-t-lg bg-neutral-900/90 backdrop-blur border border-b-0 border-neutral-700/50 hover:bg-neutral-800 hover:h-9 sm:hover:h-7 transition-all duration-200 flex items-center justify-center text-neutral-500 hover:text-white"
              title="Show controls"
            >
              <svg
                width="14"
                height="14"
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
