"use client";

import { useMemo, useState, memo } from "react";
import Image from "next/image";
import type {
  SeasonData,
  NodeDisplayMode,
  RaceType,
  RaceTypeFilter,
} from "@/lib/types";

const TEAM_DISPLAY: Record<
  string,
  { abbr: string; logo: string }
> = {
  "red-bull": { abbr: "RBR", logo: "/teams/red-bull.png" },
  mclaren: { abbr: "MCL", logo: "/teams/mclaren.png" },
  ferrari: { abbr: "FER", logo: "/teams/ferrari.png" },
  mercedes: { abbr: "MER", logo: "/teams/mercedes.png" },
  "aston-martin": { abbr: "AMR", logo: "/teams/aston-martin.png" },
  alpine: { abbr: "ALP", logo: "/teams/alpine.png" },
  williams: { abbr: "WIL", logo: "/teams/williams.png" },
  "racing-bulls": { abbr: "RCB", logo: "/teams/racing-bulls.png" },
  sauber: { abbr: "SAU", logo: "/teams/audi.png" },
  haas: { abbr: "HAS", logo: "/teams/haas.png" },
  cadillac: { abbr: "CAD", logo: "/teams/cadillac.png" },
};

const RACE_TYPE_CONFIG: {
  type: RaceType;
  label: string;
  color: string;
}[] = [
  { type: "race", label: "R", color: "#888" },
  { type: "sprint", label: "S", color: "#FF8C00" },
  { type: "qualifying", label: "Q", color: "#9B59B6" },
];

interface BottomBarProps {
  season: SeasonData;
  availableYears: number[];
  activeSeason: number;
  highlightedDrivers: Set<string> | null;
  displayMode: NodeDisplayMode;
  raceTypeFilter: RaceTypeFilter;
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
  onSelectSeason,
  onToggleTeam,
  onSetDisplayMode,
  onToggleRaceType,
  onReset,
  onCenterView,
  onToggle,
}: BottomBarProps) {
  const [teamShowLogo, setTeamShowLogo] = useState(true);

  const teams = useMemo(() => {
    const seen = new Map<
      string,
      { teamId: string; name: string; color: string }
    >();
    for (const driver of season.drivers) {
      if (!seen.has(driver.teamId)) {
        seen.set(driver.teamId, {
          teamId: driver.teamId,
          name: driver.team,
          color: driver.teamColor,
        });
      }
    }
    return Array.from(seen.values());
  }, [season]);

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
    icon: string;
  }[] = [
    { mode: "dot", icon: "●" },
    { mode: "code", icon: "ABC" },
    { mode: "photo", icon: "IMG" },
  ];

  return (
    <div className="bg-[#0d0d0d] border-t border-neutral-800/40 z-40">
      <div className="flex items-center gap-2 sm:gap-3 px-2 sm:px-4 py-2 sm:py-3">
        {/* === Left: Controls === */}
        <div className="flex items-center gap-1.5 sm:gap-2 flex-none">
          {/* Collapse toggle */}
          <button
            onClick={onToggle}
            className="flex-none w-6 h-6 rounded-md flex items-center justify-center text-neutral-600 hover:text-white hover:bg-neutral-800 transition-all duration-150"
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

          {/* Season */}
          <select
            value={activeSeason}
            onChange={(e) => onSelectSeason(Number(e.target.value))}
            className="bg-neutral-900 border border-neutral-800 rounded-lg px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm text-white cursor-pointer hover:border-neutral-600 transition-colors focus:outline-none focus:border-[#E10600] flex-none appearance-none"
          >
            {availableYears.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>

          <div className="w-px h-6 sm:h-8 bg-neutral-800/50 flex-none" />

          {/* Race type filters */}
          <div className="flex items-center gap-1 sm:gap-1.5 flex-none">
            {RACE_TYPE_CONFIG.map(({ type, label, color }) => {
              const active = raceTypeFilter.has(type);
              return (
                <button
                  key={type}
                  onClick={() => onToggleRaceType(type)}
                  className="flex-none flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg transition-all duration-150"
                  style={{
                    backgroundColor: active ? `${color}12` : "transparent",
                    border: `1px solid ${active ? `${color}60` : "#222"}`,
                  }}
                >
                  <span
                    className="w-1.5 sm:w-2 h-1.5 sm:h-2 rounded-full"
                    style={{
                      backgroundColor: color,
                      opacity: active ? 1 : 0.2,
                    }}
                  />
                  <span
                    className="text-[10px] sm:text-[11px] font-bold"
                    style={{ color: active ? color : "#444" }}
                  >
                    {label}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="w-px h-6 sm:h-8 bg-neutral-800/50 flex-none" />

          {/* Display mode */}
          <div className="flex items-center bg-neutral-900/80 rounded-lg p-0.5 flex-none border border-neutral-800/50">
            {displayModes.map(({ mode, icon }) => (
              <button
                key={mode}
                onClick={() => onSetDisplayMode(mode)}
                className="px-2 sm:px-3 py-1 rounded-md text-[10px] sm:text-[11px] font-bold transition-all duration-150"
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

          <div className="w-px h-6 sm:h-8 bg-neutral-800/50 flex-none" />

          {/* Center + Reset */}
          <button
            onClick={onCenterView}
            className="flex-none px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-500 hover:text-neutral-300 transition-all duration-150 border border-neutral-800/50 text-xs sm:text-sm"
            title="Fit all drivers in view"
          >
            ⊞
          </button>
          <button
            onClick={onReset}
            className="flex-none px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg bg-neutral-900 hover:bg-[#E10600]/20 text-neutral-500 hover:text-[#E10600] text-[10px] sm:text-[11px] font-bold transition-all duration-150 border border-neutral-800/50 hover:border-[#E10600]/40 uppercase tracking-wider"
          >
            Reset
          </button>
        </div>

        {/* Divider between controls and teams */}
        <div className="w-px h-8 sm:h-10 bg-neutral-700/50 flex-none" />

        {/* === Right: Teams === */}
        <div className="flex-1 flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-1 flex-none mr-1">
            <span className="text-neutral-600 text-[8px] sm:text-[9px] font-black uppercase tracking-[0.2em]">
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
            const full = isTeamFullySelected(team.teamId);
            const partial = isTeamPartiallySelected(team.teamId);
            const display = TEAM_DISPLAY[team.teamId] || {
              abbr: team.name.slice(0, 3).toUpperCase(),
              logo: "",
            };
            return (
              <button
                key={team.teamId}
                onClick={() => onToggleTeam(team.teamId)}
                className="team-btn flex-none flex items-center justify-center rounded-lg transition-all duration-150 overflow-hidden"
                style={{
                  backgroundColor: full ? `${team.color}15` : "transparent",
                  border: `1.5px solid ${full ? `${team.color}80` : partial ? `${team.color}40` : "#222"}`,
                  padding: teamShowLogo ? "3px" : "5px 12px",
                  width: teamShowLogo ? 52 : "auto",
                  height: teamShowLogo ? 34 : "auto",
                  opacity: full || partial || !highlightedDrivers ? 1 : 0.5,
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

          {/* Contribute - hidden on mobile */}
          <a
            href="https://github.com/TanmayBansode/f1"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:flex flex-none px-2.5 py-1 rounded-md bg-neutral-900/80 border border-neutral-800/50 text-neutral-600 hover:text-white hover:border-neutral-600 hover:bg-neutral-800/90 transition-all duration-200 text-[9px] font-semibold tracking-wider uppercase"
          >
            Contribute
          </a>
        </div>
      </div>
    </div>
  );
});
