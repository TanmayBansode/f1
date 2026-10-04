"use client";

import { useMemo, memo, useState } from "react";
import Image from "next/image";
import type { SeasonData } from "@/lib/types";
import { useIsMobile } from "@/lib/use-is-mobile";

interface DriverPanelProps {
  season: SeasonData;
  highlightedDrivers: Set<string> | null;
  onToggleDriver: (driverId: string) => void;
  onClearHighlight?: () => void;
  isOpen: boolean;
  onToggle: () => void;
}

interface DriverWithStats {
  id: string;
  name: string;
  number: number;
  teamColor: string;
  photo?: string;
  totalPoints: number;
  bestPos: number | null;
}

interface TeamGroup {
  teamId: string;
  name: string;
  color: string;
  drivers: DriverWithStats[];
}

export default memo(function DriverPanel({
  season,
  highlightedDrivers,
  onToggleDriver,
  onClearHighlight,
  isOpen,
  onToggle,
}: DriverPanelProps) {
  const isMobile = useIsMobile(640);
  const [search, setSearch] = useState("");

  const teamGroups = useMemo(() => {
    const groups = new Map<string, TeamGroup>();
    for (const driver of season.drivers) {
      let group = groups.get(driver.teamId);
      if (!group) {
        group = {
          teamId: driver.teamId,
          name: driver.team,
          color: driver.teamColor,
          drivers: [],
        };
        groups.set(driver.teamId, group);
      }
      const lastRes = driver.results.filter((r) => r.position !== null).at(-1);
      const totalPoints = lastRes?.cumulativePoints ?? 0;
      const validPositions = driver.results
        .filter((r) => r.position !== null)
        .map((r) => r.position!);
      const bestPos = validPositions.length > 0 ? Math.min(...validPositions) : null;

      group.drivers.push({
        id: driver.id,
        name: driver.name,
        number: driver.number,
        teamColor: driver.teamColor,
        photo: driver.photo,
        totalPoints,
        bestPos,
      });
    }
    return Array.from(groups.values());
  }, [season]);

  const filteredGroups = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return teamGroups;
    return teamGroups
      .map((group) => {
        const matchingDrivers = group.drivers.filter(
          (d) =>
            d.id.toLowerCase().includes(q) ||
            d.name.toLowerCase().includes(q) ||
            String(d.number).includes(q) ||
            group.name.toLowerCase().includes(q)
        );
        return {
          ...group,
          drivers: matchingDrivers,
        };
      })
      .filter((group) => group.drivers.length > 0);
  }, [teamGroups, search]);

  const isSelected = (driverId: string) =>
    highlightedDrivers !== null && highlightedDrivers.has(driverId);

  const isActive = (driverId: string) =>
    highlightedDrivers === null || highlightedDrivers.has(driverId);

  const selectedCount = highlightedDrivers ? highlightedDrivers.size : 0;
  const panelWidth = isMobile ? 240 : 270;

  return (
    <div
      className="flex-none h-full transition-all duration-300 ease-in-out overflow-hidden"
      style={{ width: isOpen ? panelWidth : 0 }}
    >
      <div
        className="h-full flex flex-col bg-[#0d0d0d]/95 backdrop-blur-xl border-l border-neutral-800/50"
        style={{ width: panelWidth }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 sm:px-4 py-2.5 sm:py-3 border-b border-neutral-800/40 flex-none">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400">
              Drivers
            </span>
            {selectedCount > 0 && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-[#E10600]/20 text-[#E10600] border border-[#E10600]/40">
                {selectedCount} selected
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {selectedCount > 0 && onClearHighlight && (
              <button
                onClick={onClearHighlight}
                className="text-[9px] font-bold text-neutral-400 hover:text-white px-1.5 py-0.5 rounded hover:bg-neutral-800 transition-colors uppercase tracking-wider"
                title="Clear selected drivers"
              >
                Clear
              </button>
            )}
            <button
              onClick={onToggle}
              className="w-7 h-7 sm:w-6 sm:h-6 rounded-md flex items-center justify-center text-neutral-500 hover:text-white hover:bg-neutral-800 transition-all duration-150"
              title="Hide driver panel"
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
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          </div>
        </div>

        {/* Search bar */}
        <div className="px-2.5 pt-2 pb-1.5 flex-none">
          <div className="relative flex items-center">
            <svg
              className="absolute left-2.5 text-neutral-500 pointer-events-none"
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Find driver or team..."
              className="w-full bg-neutral-900/80 border border-neutral-800/80 rounded-lg pl-7 pr-7 py-1 text-[11px] text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-600 transition-colors"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2 text-neutral-500 hover:text-white text-xs"
                title="Clear search"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Driver list */}
        <div
          className="flex-1 overflow-y-auto driver-panel-scroll px-1.5 sm:px-2 py-1"
          style={{ WebkitOverflowScrolling: "touch", touchAction: "pan-y" }}
        >
          {filteredGroups.length === 0 ? (
            <div className="py-8 text-center text-neutral-500 text-xs">
              No matching drivers found
            </div>
          ) : (
            filteredGroups.map((group) => (
              <div key={group.teamId} className="mb-2 sm:mb-2.5">
                {/* Team header */}
                <div className="flex items-center gap-1.5 px-1.5 py-0.5 mb-0.5">
                  <div
                    className="w-1 h-2.5 rounded-full flex-none"
                    style={{ backgroundColor: group.color }}
                  />
                  <span
                    className="text-[9px] font-bold uppercase tracking-wider truncate flex-1"
                    style={{ color: `${group.color}CC` }}
                  >
                    {group.name}
                  </span>
                </div>

                {/* Drivers */}
                <div className="flex flex-col gap-0.5">
                  {group.drivers.map((driver) => {
                    const selected = isSelected(driver.id);
                    const active = isActive(driver.id);

                    return (
                      <button
                        key={driver.id}
                        onClick={() => onToggleDriver(driver.id)}
                        className="driver-row flex items-center gap-2 px-1.5 sm:px-2 py-1.5 rounded-lg cursor-pointer group text-left w-full transition-all duration-150"
                        style={{
                          backgroundColor: selected
                            ? `${driver.teamColor}22`
                            : "transparent",
                          borderLeft: `3px solid ${selected ? driver.teamColor : "transparent"}`,
                          opacity: active ? 1 : 0.35,
                        }}
                      >
                        {/* Photo / Fallback */}
                        <div
                          className="w-6 h-6 sm:w-7 sm:h-7 rounded-full flex-none overflow-hidden flex items-center justify-center border"
                          style={{
                            borderColor: selected
                              ? driver.teamColor
                              : `${driver.teamColor}50`,
                          }}
                        >
                          {driver.photo ? (
                            <Image
                              src={driver.photo}
                              alt={driver.id}
                              width={28}
                              height={28}
                              className="w-full h-full object-cover"
                              unoptimized
                            />
                          ) : (
                            <span
                              className="text-[7px] sm:text-[8px] font-black"
                              style={{ color: driver.teamColor }}
                            >
                              {driver.id}
                            </span>
                          )}
                        </div>

                        {/* Name + Number */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span
                              className="text-[11px] font-bold truncate"
                              style={{
                                color: active ? "#fff" : "#777",
                              }}
                            >
                              {driver.id}
                            </span>
                            <span className="text-[9px] text-neutral-500 font-medium">
                              #{driver.number}
                            </span>
                          </div>
                          <div
                            className="text-[9px] font-medium truncate"
                            style={{
                              color: active ? `${driver.teamColor}CC` : "#555",
                            }}
                          >
                            {driver.name.split(" ").slice(1).join(" ") || driver.name}
                          </div>
                        </div>

                        {/* Points badge */}
                        <div className="flex-none text-right pl-1">
                          <span className="text-[10px] font-bold text-white block leading-tight">
                            {driver.totalPoints}
                          </span>
                          <span className="text-[7px] text-neutral-500 uppercase tracking-tighter block">
                            pts
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
});
