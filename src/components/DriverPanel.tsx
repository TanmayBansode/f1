"use client";

import { useMemo, memo } from "react";
import Image from "next/image";
import type { SeasonData } from "@/lib/types";
import { DRIVER_PHOTO_MAP } from "@/lib/driverPhotos";

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
  drivers: { id: string; name: string; number: number; teamColor: string }[];
}

export default memo(function DriverPanel({
  season,
  highlightedDrivers,
  onToggleDriver,
  isOpen,
  onToggle,
}: DriverPanelProps) {
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
      });
    }
    return Array.from(groups.values());
  }, [season]);

  const isSelected = (driverId: string) =>
    highlightedDrivers !== null && highlightedDrivers.has(driverId);

  const isActive = (driverId: string) =>
    highlightedDrivers === null || highlightedDrivers.has(driverId);

  return (
    <div
      className="flex-none transition-all duration-300 ease-in-out overflow-hidden"
      style={{ width: isOpen ? 256 : 0 }}
    >
      <div className="w-64 h-full flex flex-col bg-[#0d0d0d]/95 backdrop-blur-xl border-l border-neutral-800/50">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800/40">
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">
            Drivers
          </span>
          <button
            onClick={onToggle}
            className="w-6 h-6 rounded-md flex items-center justify-center text-neutral-600 hover:text-white hover:bg-neutral-800 transition-all duration-150"
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
        <div className="flex-1 overflow-y-auto driver-panel-scroll px-2 py-2">
          {teamGroups.map((group) => (
            <div key={group.teamId} className="mb-3">
              {/* Team header */}
              <div className="flex items-center gap-2 px-2 mb-1.5">
                <div
                  className="w-0.5 h-3 rounded-full"
                  style={{ backgroundColor: group.color }}
                />
                <span
                  className="text-[9px] font-bold uppercase tracking-wider"
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
                  const photo = DRIVER_PHOTO_MAP[driver.id];

                  return (
                    <button
                      key={driver.id}
                      onClick={() => onToggleDriver(driver.id)}
                      className="driver-row flex items-center gap-2.5 px-2 py-1.5 rounded-lg cursor-pointer group"
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
                        className="w-7 h-7 rounded-full flex-none overflow-hidden flex items-center justify-center border"
                        style={{
                          borderColor: selected
                            ? driver.teamColor
                            : `${driver.teamColor}40`,
                        }}
                      >
                        {photo ? (
                          <Image
                            src={`/drivers/${photo}`}
                            alt={driver.id}
                            width={28}
                            height={28}
                            className="w-full h-full object-cover"
                            unoptimized
                          />
                        ) : (
                          <span
                            className="text-[8px] font-black"
                            style={{ color: driver.teamColor }}
                          >
                            {driver.id}
                          </span>
                        )}
                      </div>

                      {/* Name + Number */}
                      <div className="flex-1 flex items-center gap-2 min-w-0">
                        <span
                          className="text-xs font-bold truncate"
                          style={{
                            color: active ? "#fff" : "#666",
                          }}
                        >
                          {driver.id}
                        </span>
                        <span className="text-[10px] text-neutral-600 font-medium">
                          #{driver.number}
                        </span>
                      </div>

                      {/* Full name on right, truncated */}
                      <span
                        className="text-[9px] font-medium truncate max-w-[80px] text-right"
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
