"use client";

import { memo } from "react";
import Image from "next/image";
import type { HoverInfo, EventHoverInfo, SeasonData } from "@/lib/types";

const TYPE_COLORS = {
  race: "#888",
  sprint: "#FF8C00",
  qualifying: "#9B59B6",
};

const TYPE_LABELS = {
  race: "RACE",
  sprint: "SPRINT",
  qualifying: "QUALIFYING",
};

interface DriverTooltipProps {
  info: HoverInfo;
  season: SeasonData;
}

export const DriverTooltip = memo(function DriverTooltip({ info, season }: DriverTooltipProps) {
  const driver = season.drivers.find((d) => d.id === info.driverId);
  const photo = driver?.photo;
  const teamColor = driver?.teamColor ?? "#888";

  const lastResult = driver?.results.filter((r) => r.position !== null).at(-1);
  const bestPos = driver
    ? Math.min(
        ...driver.results
          .filter((r) => r.position !== null)
          .map((r) => r.position!)
      )
    : null;

  // Viewport-aware positioning
  const isMobileView = typeof window !== "undefined" && window.innerWidth < 640;
  const tooltipW = isMobileView ? 190 : 220;
  const tooltipH = 180;
  let left = info.x + 16;
  let top = info.y - 10;

  // Check if tooltip would overflow right edge (use parent container width estimate)
  if (typeof window !== "undefined") {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (left + tooltipW > vw - 12) {
      left = info.x - tooltipW - 10;
    }
    if (left < 4) left = 4;
    // Vertical bounds
    if (top + tooltipH / 2 > vh - 16) {
      top = vh - tooltipH - 16;
    }
    if (top - tooltipH / 2 < 8) {
      top = tooltipH / 2 + 8;
    }
  }

  return (
    <div
      className="absolute pointer-events-none z-50 bg-neutral-900/95 backdrop-blur-md border border-neutral-700/80 rounded-xl shadow-2xl overflow-hidden"
      style={{
        left,
        top,
        transform: "translateY(-50%)",
        width: tooltipW,
      }}
    >
      {/* Header with photo */}
      <div
        className="flex items-center gap-2.5 px-3 py-2.5"
        style={{
          background: `linear-gradient(135deg, ${teamColor}25, ${teamColor}08)`,
        }}
      >
        <div
          className="w-9 h-9 rounded-full flex-none overflow-hidden border-2 flex items-center justify-center"
          style={{ borderColor: teamColor }}
        >
          {photo ? (
            <Image
              src={photo}
              alt={info.driverId}
              width={36}
              height={36}
              className="w-full h-full object-cover"
              unoptimized
            />
          ) : (
            <span
              className="text-[9px] font-black"
              style={{ color: teamColor }}
            >
              {info.driverId}
            </span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-white text-sm truncate">
              {info.driverName}
            </span>
          </div>
          <div
            className="text-[10px] font-semibold"
            style={{ color: teamColor }}
          >
            {info.team}
          </div>
        </div>
      </div>

      {/* Race info */}
      <div className="px-3 py-2 border-t border-neutral-800/50">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-neutral-400 text-[11px]">{info.raceName}</span>
          <span
            className="text-[8px] font-bold px-1.5 py-0.5 rounded"
            style={{
              backgroundColor: `${TYPE_COLORS[info.raceType]}20`,
              color: TYPE_COLORS[info.raceType],
            }}
          >
            {TYPE_LABELS[info.raceType]}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-white font-bold text-lg">
            {info.position !== null ? `P${info.position}` : "—"}
          </span>
          {(info.displayState === "dnf" || info.displayState === "dsq" || info.displayState === "dns") && (
            <span
              className="text-[9px] font-bold px-1.5 py-0.5 rounded"
              style={{ 
                backgroundColor: info.displayState === "dns" ? "#00000040" : "#E1060025", 
                color: info.displayState === "dns" ? "#888" : "#E10600",
                border: info.displayState === "dns" ? "1px solid #ffffff10" : "none"
              }}
            >
              {info.displayState === "dsq" ? "DSQ" : info.displayState === "dnf" ? "DNF" : "DNS"}
            </span>
          )}
          <div className="flex-1" />
          <div className="text-right">
            <span className="text-white font-bold text-xs">
              {info.points}
            </span>
            <span className="text-neutral-500 text-[10px] ml-0.5">pts</span>
          </div>
        </div>
      </div>

      {/* Season stats */}
      {driver && (
        <div className="flex items-center justify-around px-3 py-2 border-t border-neutral-800/50 bg-neutral-950/30">
          <div className="text-center">
            <div className="text-white font-bold text-[11px]">
              {lastResult?.cumulativePoints ?? 0}
            </div>
            <div className="text-neutral-600 text-[7px] font-semibold uppercase">
              Total
            </div>
          </div>
          <div className="w-px h-5 bg-neutral-800/50" />
          <div className="text-center">
            <div className="text-white font-bold text-[11px]">
              P{lastResult?.position ?? "-"}
            </div>
            <div className="text-neutral-600 text-[7px] font-semibold uppercase">
              Latest
            </div>
          </div>
          <div className="w-px h-5 bg-neutral-800/50" />
          <div className="text-center">
            <div className="text-white font-bold text-[11px]">
              {bestPos !== null ? `P${bestPos}` : "-"}
            </div>
            <div className="text-neutral-600 text-[7px] font-semibold uppercase">
              Best
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

interface EventTooltipProps {
  info: EventHoverInfo;
}

export const EventTooltip = memo(function EventTooltip({ info }: EventTooltipProps) {
  const left = info.x + 16;
  const top = info.y + 12;
  const color = TYPE_COLORS[info.type];

  const formattedDate = info.date
    ? new Date(info.date + "T00:00:00").toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "";

  return (
    <div
      className="absolute pointer-events-none z-50 bg-neutral-900/95 backdrop-blur-md border border-neutral-700/80 rounded-lg shadow-2xl"
      style={{
        left,
        top,
        minWidth: 180,
      }}
    >
      <div className="px-3 py-2.5">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-white font-bold text-xs">{info.name}</span>
          <span
            className="text-[7px] font-bold px-1.5 py-0.5 rounded"
            style={{
              backgroundColor: `${color}20`,
              color,
            }}
          >
            {TYPE_LABELS[info.type]}
          </span>
        </div>
        {info.circuit && (
          <div className="text-neutral-400 text-[10px]">{info.circuit}</div>
        )}
        {info.location && (
          <div className="text-neutral-500 text-[9px] mt-0.5">
            {info.location}
          </div>
        )}
        {formattedDate && (
          <div className="text-neutral-600 text-[9px] mt-1 font-medium">
            {formattedDate}
          </div>
        )}
      </div>
    </div>
  );
});
