"use client";

import { useMemo, useState, memo } from "react";
import Image from "next/image";
import type {
  SeasonData,
  NodeDisplayMode,
  RaceType,
  RaceTypeFilter,
  ChartMode,
} from "@/lib/types";
import { useIsMobile } from "@/lib/use-is-mobile";

const RACE_TYPE_CONFIG: {
  type: RaceType;
  label: string;
  fullName: string;
  color: string;
}[] = [
  { type: "race", label: "R", fullName: "Race", color: "#888" },
  { type: "sprint", label: "S", fullName: "Sprint", color: "#FF8C00" },
  { type: "qualifying", label: "Q", fullName: "Qualifying", color: "#9B59B6" },
];

interface BottomBarProps {
  season: SeasonData;
  availableYears: number[];
  activeSeason: number;
  highlightedDrivers: Set<string> | null;
  displayMode: NodeDisplayMode;
  raceTypeFilter: RaceTypeFilter;
  chartMode?: ChartMode;
  onSelectSeason: (year: number) => void;
  onToggleTeam: (teamId: string) => void;
  onSetDisplayMode: (mode: NodeDisplayMode) => void;
  onToggleRaceType: (type: RaceType) => void;
  onReset: () => void;
  onCenterView: () => void;
  onToggle: () => void;
}

export default memo(function BottomBar({
  season,
  availableYears,
  activeSeason,
  highlightedDrivers,
  displayMode,
  raceTypeFilter,
  chartMode = "race",
  onSelectSeason,
  onToggleTeam,
  onSetDisplayMode,
  onToggleRaceType,
  onReset,
  onCenterView,
  onToggle,
}: BottomBarProps) {
  const [teamShowLogo, setTeamShowLogo] = useState(true);
  const isMobile = useIsMobile(640);

  const teams = useMemo(() => {
    if (season.teams && season.teams.length > 0) {
      return season.teams;
    }
    // Fallback if teams data is missing
    const seen = new Map<
      string,
      { id: string; name: string; color: string; abbr: string; logo: string }
    >();
    for (const driver of season.drivers) {
      if (!seen.has(driver.teamId)) {
        seen.set(driver.teamId, {
          id: driver.teamId,
          name: driver.team,
          color: driver.teamColor,
          abbr: driver.team.slice(0, 3).toUpperCase(),
          logo: "",
        });
      }
    }
    return Array.from(seen.values());
  }, [season]);

  const teamMetaMap = useMemo(() => {
    const map = new Map<string, (typeof teams)[0]>();
    teams.forEach((t) => map.set(t.id, t));
    return map;
  }, [teams]);

  const isTeamFullySelected = (teamId: string) => {
    if (!highlightedDrivers) return false;
    const teamDriverIds = season.drivers
      .filter((d) => d.teamId === teamId)
      .map((d) => d.id);
    return teamDriverIds.every((id) => highlightedDrivers.has(id));
  };

  const isTeamPartiallySelected = (teamId: string) => {
    if (!highlightedDrivers) return false;
    const teamDriverIds = season.drivers
      .filter((d) => d.teamId === teamId)
      .map((d) => d.id);
    return teamDriverIds.some((id) => highlightedDrivers.has(id));
  };

  const displayModes: {
    mode: NodeDisplayMode;
    label: string;
    icon: string;
  }[] = [
    { mode: "dot", label: "Dots", icon: "●" },
    { mode: "code", label: "Codes", icon: "ABC" },
    { mode: "photo", label: "Photos", icon: "IMG" },
  ];

  /* ── MOBILE LAYOUT ── */
  if (isMobile) {
    return (
      <div className="mobile-bottom-bar relative z-40">
        {/* Glow effect on top edge */}
        <div
          className="absolute -top-px left-0 right-0 h-px"
          style={{
            background:
              "linear-gradient(90deg, transparent, #E1060040, #E1060060, #E1060040, transparent)",
          }}
        />
        <div
          className="absolute -top-8 left-0 right-0 h-8 pointer-events-none"
          style={{
            background: "linear-gradient(to top, #0a0a0a, transparent)",
          }}
        />

        <div
          className="backdrop-blur-xl border-t border-neutral-700/30"
          style={{
            background: "linear-gradient(180deg, #111111ee, #0a0a0af5)",
          }}
        >
          {/* Row 1: Controls — neatly grouped, scrollable */}
          <div
            className="flex items-center gap-2 px-3 pt-2.5 pb-2 overflow-x-auto no-scrollbar"
            style={{ touchAction: "pan-x" }}
          >
            {/* Collapse chevron */}
            <button
              onClick={onToggle}
              className="flex-none w-8 h-8 rounded-full flex items-center justify-center text-neutral-500 active:text-white active:bg-neutral-700/50 transition-all duration-150"
              title="Hide controls"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>

            {/* Season pill */}
            <div className="relative flex-none">
              <select
                value={activeSeason}
                onChange={(e) => onSelectSeason(Number(e.target.value))}
                className="bg-neutral-800/80 border border-neutral-700/50 rounded-full pl-3 pr-7 py-1.5 text-xs font-bold text-white cursor-pointer transition-colors focus:outline-none focus:border-[#E10600]/80 appearance-none"
              >
                {availableYears.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
              <svg
                className="w-3 h-3 text-neutral-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
              </svg>
            </div>

            {/* Separator dot */}
            <div className="w-1 h-1 rounded-full bg-neutral-700 flex-none" />

            {/* Race type filter pills */}
            <div className="flex items-center gap-1 flex-none">
              {RACE_TYPE_CONFIG.map(({ type, label, color }) => {
                const isQualiInChampionship = chartMode === "championship" && type === "qualifying";
                const active = raceTypeFilter.has(type) && !isQualiInChampionship;
                return (
                  <button
                    key={type}
                    onClick={() => {
                      if (isQualiInChampionship) return;
                      onToggleRaceType(type);
                    }}
                    title={isQualiInChampionship ? "Qualifying is excluded from championship standings" : label}
                    className="flex-none flex items-center gap-1 px-2.5 py-1.5 rounded-full transition-all duration-150"
                    style={{
                      backgroundColor: isQualiInChampionship
                        ? "rgba(255,255,255,0.02)"
                        : active
                          ? `${color}18`
                          : "rgba(255,255,255,0.03)",
                      border: `1px solid ${
                        isQualiInChampionship
                          ? "rgba(255,255,255,0.04)"
                          : active
                            ? `${color}50`
                            : "rgba(255,255,255,0.06)"
                      }`,
                      opacity: isQualiInChampionship ? 0.35 : 1,
                      cursor: isQualiInChampionship ? "not-allowed" : "pointer",
                    }}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{
                        backgroundColor: color,
                        opacity: active ? 1 : 0.25,
                      }}
                    />
                    <span
                      className="text-[10px] font-bold"
                      style={{ color: active ? color : "#555" }}
                    >
                      {label}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="flex-1" />

            {/* Display mode capsule */}
            <div className="flex items-center bg-neutral-800/40 rounded-full p-0.5 flex-none border border-neutral-700/30">
              {displayModes.map(({ mode, icon }) => (
                <button
                  key={mode}
                  onClick={() => onSetDisplayMode(mode)}
                  className="px-2 py-1 rounded-full text-[10px] font-bold transition-all duration-150"
                  style={{
                    backgroundColor: displayMode === mode ? "#E10600" : "transparent",
                    color: displayMode === mode ? "#fff" : "#555",
                    boxShadow: displayMode === mode ? "0 2px 8px #E1060040" : "none",
                  }}
                >
                  {icon}
                </button>
              ))}
            </div>

            {/* Action buttons */}
            <button
              onClick={onCenterView}
              className="flex-none w-8 h-8 rounded-full bg-neutral-800/40 active:bg-neutral-700/60 text-neutral-400 active:text-white transition-all duration-150 border border-neutral-700/30 text-sm flex items-center justify-center"
              title="Fit all drivers in view"
            >
              ⊞
            </button>

            <button
              onClick={onReset}
              className="flex-none px-2.5 py-1.5 rounded-full bg-neutral-800/40 active:bg-[#E10600]/20 text-neutral-400 active:text-[#E10600] text-[9px] font-bold transition-all duration-150 border border-neutral-700/30 active:border-[#E10600]/40 uppercase tracking-wider"
            >
              RST
            </button>
          </div>

          {/* Separator line */}
          <div
            className="h-px mx-3"
            style={{
              background: "linear-gradient(90deg, transparent, #333, transparent)",
            }}
          />

          {/* Row 2: Teams strip */}
          <div className="relative">
            {/* Right fade hint */}
            <div
              className="absolute right-0 top-0 bottom-0 w-8 z-10 pointer-events-none"
              style={{
                background: "linear-gradient(to left, #0a0a0af0, transparent)",
              }}
            />

            <div
              className="flex items-center gap-2 pl-3 pr-6 py-2 overflow-x-auto no-scrollbar"
              style={{ touchAction: "pan-x" }}
            >
              <span className="text-neutral-500 text-[8px] font-black uppercase tracking-[0.2em] flex-none mr-0.5">
                Teams
              </span>
              {teams.map((team) => {
                const full = isTeamFullySelected(team.id);
                const partial = isTeamPartiallySelected(team.id);
                const display = teamMetaMap.get(team.id) || {
                  abbr: team.name.slice(0, 3).toUpperCase(),
                  logo: "",
                };
                return (
                  <button
                    key={team.id}
                    onClick={() => onToggleTeam(team.id)}
                    className="team-btn flex-none flex items-center justify-center rounded-lg transition-all duration-150 overflow-hidden"
                    style={{
                      backgroundColor: full ? `${team.color}15` : "rgba(255,255,255,0.02)",
                      border: `1.5px solid ${
                        full
                          ? `${team.color}70`
                          : partial
                            ? `${team.color}35`
                            : "rgba(255,255,255,0.06)"
                      }`,
                      padding: "3px",
                      width: 40,
                      height: 28,
                      opacity: full || partial || !highlightedDrivers ? 1 : 0.4,
                    }}
                  >
                    {display.logo ? (
                      <Image
                        src={display.logo}
                        alt={display.abbr}
                        width={36}
                        height={22}
                        className="object-cover w-full h-full"
                        style={{
                          filter:
                            full || partial || !highlightedDrivers
                              ? "none"
                              : "grayscale(1) brightness(0.4)",
                        }}
                        unoptimized
                      />
                    ) : (
                      <span
                        className="text-[8px] font-bold tracking-wider"
                        style={{
                          color: full
                            ? team.color
                            : partial
                              ? `${team.color}AA`
                              : "#555",
                        }}
                      >
                        {display.abbr}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ── DESKTOP LAYOUT ── */
  return (
    <div className="bg-[#0d0d0d] border-t border-neutral-800/60 z-40">
      <div className="flex items-center gap-2 sm:gap-3 px-2 sm:px-4 py-2 sm:py-2.5">
        {/* === Left: Controls === */}
        <div className="flex items-center gap-1.5 sm:gap-2 flex-none">
          {/* Collapse toggle */}
          <button
            onClick={onToggle}
            className="flex-none w-6 h-6 rounded-md flex items-center justify-center text-neutral-500 hover:text-white hover:bg-neutral-800 transition-all duration-150"
            title="Hide controls"
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
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>

          {/* Season dropdown with chevron */}
          <div className="relative flex-none">
            <select
              value={activeSeason}
              onChange={(e) => onSelectSeason(Number(e.target.value))}
              className="bg-neutral-900 border border-neutral-800 hover:border-neutral-600 rounded-lg pl-2.5 pr-6 py-1 text-xs font-semibold text-white cursor-pointer transition-colors focus:outline-none focus:border-[#E10600] appearance-none"
            >
              {availableYears.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
            <svg
              className="w-3 h-3 text-neutral-500 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
            </svg>
          </div>

          <div className="w-px h-6 bg-neutral-800/60 flex-none" />

          {/* Race type filters */}
          <div className="flex items-center gap-1 flex-none">
            {RACE_TYPE_CONFIG.map(({ type, label, fullName, color }) => {
              const isQualiInChampionship = chartMode === "championship" && type === "qualifying";
              const active = raceTypeFilter.has(type) && !isQualiInChampionship;
              return (
                <button
                  key={type}
                  onClick={() => {
                    if (isQualiInChampionship) return;
                    onToggleRaceType(type);
                  }}
                  title={
                    isQualiInChampionship
                      ? "Qualifying is excluded from championship standings"
                      : `Toggle ${fullName}`
                  }
                  className="flex-none flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-all duration-150"
                  style={{
                    backgroundColor: isQualiInChampionship
                      ? "transparent"
                      : active
                        ? `${color}15`
                        : "transparent",
                    border: `1px solid ${
                      isQualiInChampionship
                        ? "#1c1c1c"
                        : active
                          ? `${color}60`
                          : "#222"
                    }`,
                    opacity: isQualiInChampionship ? 0.35 : 1,
                    cursor: isQualiInChampionship ? "not-allowed" : "pointer",
                  }}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{
                      backgroundColor: color,
                      opacity: active ? 1 : 0.2,
                    }}
                  />
                  <span
                    className="text-[10px] sm:text-[11px] font-bold"
                    style={{ color: active ? color : "#555" }}
                  >
                    {label}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="w-px h-6 bg-neutral-800/60 flex-none" />

          {/* Display mode */}
          <div className="flex items-center bg-neutral-900/80 rounded-lg p-0.5 flex-none border border-neutral-800/60">
            {displayModes.map(({ mode, icon, label }) => (
              <button
                key={mode}
                onClick={() => onSetDisplayMode(mode)}
                title={`Display mode: ${label}`}
                className="px-2.5 py-0.5 rounded-md text-[10px] sm:text-[11px] font-bold transition-all duration-150"
                style={{
                  backgroundColor:
                    displayMode === mode ? "#E10600" : "transparent",
                  color: displayMode === mode ? "#fff" : "#555",
                }}
              >
                {icon}
              </button>
            ))}
          </div>

          <div className="w-px h-6 bg-neutral-800/60 flex-none" />

          {/* Center + Reset */}
          <button
            onClick={onCenterView}
            className="flex-none px-2.5 py-1 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 transition-all duration-150 border border-neutral-800/60 text-xs"
            title="Fit all drivers in view"
          >
            ⊞ Fit
          </button>
          <button
            onClick={onReset}
            className="flex-none px-2.5 py-1 rounded-lg bg-neutral-900 hover:bg-[#E10600]/20 text-neutral-400 hover:text-[#E10600] text-[10px] sm:text-[11px] font-bold transition-all duration-150 border border-neutral-800/60 hover:border-[#E10600]/40 uppercase tracking-wider"
            title="Reset filters and driver selection"
          >
            Reset
          </button>
        </div>

        {/* Divider between controls and teams */}
        <div className="w-px h-7 bg-neutral-800 flex-none" />

        {/* === Right: Teams === */}
        <div className="flex-1 flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-1 flex-none mr-1">
            <span className="text-neutral-500 text-[8px] sm:text-[9px] font-black uppercase tracking-[0.2em]">
              Teams
            </span>
            <button
              onClick={() => setTeamShowLogo((p) => !p)}
              className="text-[7px] sm:text-[8px] px-1 sm:px-1.5 py-0.5 rounded bg-neutral-900 text-neutral-500 hover:text-neutral-300 border border-neutral-800 transition-colors"
              title={teamShowLogo ? "Show abbreviations" : "Show logos"}
            >
              {teamShowLogo ? "IMG" : "TXT"}
            </button>
          </div>
          {teams.map((team) => {
            const full = isTeamFullySelected(team.id);
            const partial = isTeamPartiallySelected(team.id);
            const display = teamMetaMap.get(team.id) || {
              abbr: team.name.slice(0, 3).toUpperCase(),
              logo: "",
            };
            return (
              <button
                key={team.id}
                onClick={() => onToggleTeam(team.id)}
                className="team-btn flex-none flex items-center justify-center rounded-lg transition-all duration-150 overflow-hidden"
                style={{
                  backgroundColor: full ? `${team.color}15` : "transparent",
                  border: `1.5px solid ${
                    full
                      ? `${team.color}80`
                      : partial
                        ? `${team.color}40`
                        : "#222"
                  }`,
                  padding: teamShowLogo ? "3px" : "4px 10px",
                  width: teamShowLogo ? 50 : "auto",
                  height: teamShowLogo ? 32 : "auto",
                  opacity: full || partial || !highlightedDrivers ? 1 : 0.45,
                }}
              >
                {teamShowLogo && display.logo ? (
                  <Image
                    src={display.logo}
                    alt={display.abbr}
                    width={48}
                    height={30}
                    className="object-cover w-full h-full"
                    style={{
                      filter:
                        full || partial || !highlightedDrivers
                          ? "none"
                          : "grayscale(1) brightness(0.5)",
                    }}
                    unoptimized
                  />
                ) : (
                  <span
                    className="text-[10px] sm:text-xs font-bold tracking-wider"
                    style={{
                      color: full
                        ? team.color
                        : partial
                          ? `${team.color}AA`
                          : "#555",
                    }}
                  >
                    {display.abbr}
                  </span>
                )}
              </button>
            );
          })}

          <div className="flex-1" />
        </div>
      </div>
    </div>
  );
});
