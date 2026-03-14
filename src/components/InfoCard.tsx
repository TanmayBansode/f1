"use client";

import Image from "next/image";
import type { Driver, SeasonData } from "@/lib/types";

const DRIVER_PHOTO_MAP: Record<string, string | null> = {
  VER: "ver.png", NOR: "nor.png", LEC: "lec.png", HAM: "ham.png",
  PIA: "pia.png", RUS: "rus.png", ANT: "ant.png", SAI: "sai.png",
  ALO: "alo.png", STR: "str.png", GAS: "gas.png", DOO: null,
  TSU: null, HAD: "had.png", HUL: "hul.png", BOR: "bor.png",
  ALB: "alb.png", PER: "per.png", BEA: "bea.png", OCO: null,
  COL: "col.png", LAW: "law.png", BOT: null, LIN: null,
};

const TEAM_LOGO_MAP: Record<string, string> = {
  "red-bull": "/teams/red-bull.png",
  mclaren: "/teams/mclaren.png",
  ferrari: "/teams/ferrari.png",
  mercedes: "/teams/mercedes.png",
  "aston-martin": "/teams/aston-martin.png",
  alpine: "/teams/alpine.png",
  williams: "/teams/williams.png",
  "racing-bulls": "/teams/racing-bulls.png",
  sauber: "/teams/audi.png",
  haas: "/teams/haas.png",
  cadillac: "/teams/cadillac.png",
};

export type InfoCardData =
  | { type: "driver"; driverId: string }
  | { type: "team"; teamId: string }
  | null;

interface InfoCardProps {
  data: InfoCardData;
  season: SeasonData;
  onClose: () => void;
}

export default function InfoCard({ data, season, onClose }: InfoCardProps) {
  if (!data) return null;

  if (data.type === "driver") {
    const driver = season.drivers.find((d) => d.id === data.driverId);
    if (!driver) return null;
    return <DriverCard driver={driver} onClose={onClose} />;
  }

  const teamDrivers = season.drivers.filter((d) => d.teamId === data.teamId);
  if (teamDrivers.length === 0) return null;
  return (
    <TeamCard
      teamId={data.teamId}
      teamName={teamDrivers[0].team}
      teamColor={teamDrivers[0].teamColor}
      drivers={teamDrivers}
      onClose={onClose}
    />
  );
}

function DriverCard({
  driver,
  onClose,
}: {
  driver: Driver;
  onClose: () => void;
}) {
  const photo = DRIVER_PHOTO_MAP[driver.id];
  const lastResult = driver.results.filter((r) => r.position !== null).at(-1);
  const bestPos = Math.min(
    ...driver.results.filter((r) => r.position !== null).map((r) => r.position!)
  );
  const totalPoints = lastResult?.cumulativePoints ?? 0;

  return (
    <div className="absolute right-4 top-4 w-56 bg-neutral-900/95 backdrop-blur-md border border-neutral-800 rounded-xl overflow-hidden shadow-2xl z-40 animate-in slide-in-from-right">
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-2 right-2 w-5 h-5 rounded-full bg-neutral-800 hover:bg-neutral-700 flex items-center justify-center text-neutral-500 hover:text-white text-[10px] z-10 transition-colors"
      >
        x
      </button>

      {/* Driver photo/header */}
      <div
        className="relative h-28 flex items-end justify-center"
        style={{
          background: `linear-gradient(135deg, ${driver.teamColor}40, ${driver.teamColor}10)`,
        }}
      >
        {photo ? (
          <Image
            src={`/drivers/${photo}`}
            alt={driver.name}
            width={90}
            height={90}
            className="object-cover rounded-full border-2 absolute bottom-[-20px]"
            style={{ borderColor: driver.teamColor }}
            unoptimized
          />
        ) : (
          <div
            className="w-[90px] h-[90px] rounded-full flex items-center justify-center text-2xl font-black text-white absolute bottom-[-20px] border-2"
            style={{
              backgroundColor: driver.teamColor,
              borderColor: driver.teamColor,
            }}
          >
            {driver.id}
          </div>
        )}
        {/* Number badge */}
        <div
          className="absolute top-3 left-3 text-3xl font-black opacity-30"
          style={{ color: driver.teamColor }}
        >
          {driver.number}
        </div>
      </div>

      {/* Info */}
      <div className="pt-7 pb-4 px-4 text-center">
        <div className="text-white font-bold text-sm">{driver.name}</div>
        <div
          className="text-[10px] font-semibold mt-0.5"
          style={{ color: driver.teamColor }}
        >
          {driver.team}
        </div>

        {/* Stats row */}
        <div className="flex items-center justify-around mt-3 pt-3 border-t border-neutral-800/60">
          <div className="text-center">
            <div className="text-white font-bold text-sm">{totalPoints}</div>
            <div className="text-neutral-500 text-[8px] font-semibold uppercase tracking-wider">
              Points
            </div>
          </div>
          <div className="text-center">
            <div className="text-white font-bold text-sm">
              P{lastResult?.position ?? "-"}
            </div>
            <div className="text-neutral-500 text-[8px] font-semibold uppercase tracking-wider">
              Latest
            </div>
          </div>
          <div className="text-center">
            <div className="text-white font-bold text-sm">P{bestPos}</div>
            <div className="text-neutral-500 text-[8px] font-semibold uppercase tracking-wider">
              Best
            </div>
          </div>
        </div>

        {/* Recent results */}
        <div className="mt-3 pt-2 border-t border-neutral-800/60">
          <div className="text-neutral-500 text-[8px] font-semibold uppercase tracking-wider mb-1.5">
            Recent Results
          </div>
          <div className="flex items-center justify-center gap-1">
            {driver.results
              .filter((r) => r.position !== null)
              .slice(-6)
              .map((r) => (
                <span
                  key={r.round}
                  className="w-7 h-6 rounded text-[9px] font-bold flex items-center justify-center"
                  style={{
                    backgroundColor:
                      r.position! <= 3
                        ? `${driver.teamColor}30`
                        : "#1a1a1a",
                    color:
                      r.position! <= 3 ? driver.teamColor : "#777",
                  }}
                >
                  {r.position}
                </span>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function TeamCard({
  teamId,
  teamName,
  teamColor,
  drivers,
  onClose,
}: {
  teamId: string;
  teamName: string;
  teamColor: string;
  drivers: Driver[];
  onClose: () => void;
}) {
  const logo = TEAM_LOGO_MAP[teamId];
  const totalPoints = drivers.reduce((sum, d) => {
    const last = d.results.filter((r) => r.position !== null).at(-1);
    return sum + (last?.cumulativePoints ?? 0);
  }, 0);

  return (
    <div className="absolute right-4 top-4 w-56 bg-neutral-900/95 backdrop-blur-md border border-neutral-800 rounded-xl overflow-hidden shadow-2xl z-40">
      <button
        onClick={onClose}
        className="absolute top-2 right-2 w-5 h-5 rounded-full bg-neutral-800 hover:bg-neutral-700 flex items-center justify-center text-neutral-500 hover:text-white text-[10px] z-10 transition-colors"
      >
        x
      </button>

      {/* Team header */}
      <div
        className="h-20 flex items-center justify-center"
        style={{
          background: `linear-gradient(135deg, ${teamColor}30, ${teamColor}08)`,
        }}
      >
        {logo ? (
          <Image
            src={logo}
            alt={teamName}
            width={60}
            height={40}
            className="object-contain"
            unoptimized
          />
        ) : (
          <div
            className="text-2xl font-black"
            style={{ color: teamColor }}
          >
            {teamName}
          </div>
        )}
      </div>

      <div className="px-4 pb-4 pt-2">
        <div className="text-center">
          <div className="text-white font-bold text-sm">{teamName}</div>
          <div
            className="text-xs font-bold mt-0.5"
            style={{ color: teamColor }}
          >
            {totalPoints} pts
          </div>
        </div>

        {/* Drivers in team */}
        <div className="mt-3 pt-3 border-t border-neutral-800/60 space-y-2">
          {drivers.map((driver) => {
            const photo = DRIVER_PHOTO_MAP[driver.id];
            const lastResult = driver.results
              .filter((r) => r.position !== null)
              .at(-1);
            return (
              <div
                key={driver.id}
                className="flex items-center gap-2.5 p-1.5 rounded-lg bg-neutral-800/30"
              >
                {photo ? (
                  <Image
                    src={`/drivers/${photo}`}
                    alt={driver.name}
                    width={32}
                    height={32}
                    className="rounded-full object-cover border"
                    style={{ borderColor: teamColor }}
                    unoptimized
                  />
                ) : (
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-black text-white border"
                    style={{
                      backgroundColor: teamColor,
                      borderColor: teamColor,
                    }}
                  >
                    {driver.id}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-white text-[11px] font-semibold truncate">
                    {driver.name}
                  </div>
                  <div className="text-neutral-500 text-[9px]">
                    #{driver.number}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-white text-[11px] font-bold">
                    {lastResult?.cumulativePoints ?? 0}
                  </div>
                  <div className="text-neutral-600 text-[8px]">pts</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
