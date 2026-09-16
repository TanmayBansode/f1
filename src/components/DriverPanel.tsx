"use client";

import { useMemo, memo, useEffect, useState } from "react";
import Image from "next/image";
import type { SeasonData } from "@/lib/types";

interface DriverPanelProps {
  season: SeasonData;
  highlightedDrivers: Set<string> | null;
  onToggleDriver: (driverId: string) => void;
  isOpen: boolean;
  onToggle: () => void;
}

interface TeamGroup {
  teamId: string;
  name: string;
  color: string;
  drivers: { id: string; name: string; number: number; teamColor: string; photo?: string }[];
}

function useIsMobile(breakpoint = 640) {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < breakpoint);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, [breakpoint]);
  return isMobile;
}

export default memo(function DriverPanel({
  season,
  highlightedDrivers,
  onToggleDriver,
  isOpen,
  onToggle,
}: DriverPanelProps) {
  const isMobile = useIsMobile();

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
      group.drivers.push({
        id: driver.id,
        name: driver.name,
        number: driver.number,
        teamColor: driver.teamColor,
        photo: driver.photo,
      });
    }
    return Array.from(groups.values());
  }, [season]);

  const isSelected = (driverId: string) =>
    highlightedDrivers !== null && highlightedDrivers.has(driverId);

  const isActive = (driverId: string) =>
    highlightedDrivers === null || highlightedDrivers.has(driverId);

  const panelWidth = isMobile ? 220 : 256;

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
        <div className="flex items-center justify-between px-3 sm:px-4 py-2.5 sm:py-3 border-b border-neutral-800/40">
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">
            Drivers
          </span>
          <button
            onClick={onToggle}
            className="w-7 h-7 sm:w-6 sm:h-6 rounded-md flex items-center justify-center text-neutral-600 hover:text-white hover:bg-neutral-800 transition-all duration-150"
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

        {/* Driver list */}
        <div
          className="flex-1 overflow-y-auto driver-panel-scroll px-1.5 sm:px-2 py-1.5 sm:py-2"
          style={{ WebkitOverflowScrolling: "touch", touchAction: "pan-y" }}
        >
          {teamGroups.map((group) => (
            <div key={group.teamId} className="mb-2 sm:mb-3">
              {/* Team header */}
              <div className="flex items-center gap-1.5 sm:gap-2 px-1.5 sm:px-2 mb-1 sm:mb-1.5">
                <div
                  className="w-0.5 h-3 rounded-full"
                  style={{ backgroundColor: group.color }}
                />
                <span
                  className="text-[8px] sm:text-[9px] font-bold uppercase tracking-wider"
                  style={{ color: `${group.color}AA` }}
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
                      className="driver-row flex items-center gap-2 sm:gap-2.5 px-1.5 sm:px-2 py-1.5 sm:py-1.5 rounded-lg cursor-pointer group"
                      style={{
                        backgroundColor: selected
                          ? `${driver.teamColor}18`
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
                            : `${driver.teamColor}40`,
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
                      <div className="flex-1 flex items-center gap-1.5 sm:gap-2 min-w-0">
                        <span
                          className="text-[11px] sm:text-xs font-bold truncate"
                          style={{
                            color: active ? "#fff" : "#666",
                          }}
                        >
                          {driver.id}
                        </span>
                        <span className="text-[9px] sm:text-[10px] text-neutral-600 font-medium">
                          #{driver.number}
                        </span>
                      </div>

                      {/* Full name on right, truncated — hidden on mobile */}
                      <span
                        className="hidden sm:inline text-[9px] font-medium truncate max-w-[80px] text-right"
                        style={{
                          color: active ? `${driver.teamColor}90` : "#444",
                        }}
                      >
                        {driver.name.split(" ").pop()}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});
