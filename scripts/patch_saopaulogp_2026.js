#!/usr/bin/env node
/**
 * patch_saopaulogp_2026.js
 * Patches rounds 43 (qualifying) and 44 (race) for the
 * 2026 São Paulo Grand Prix with real lap times and grid positions.
 */
const fs = require("fs");
const path = require("path");

const FILE = path.join(__dirname, "..", "data", "2026.json");
const data = JSON.parse(fs.readFileSync(FILE, "utf-8"));

// ─── Qualifying lap times (round 43) ───────────────────────────────────────
const QUALI_TIMES = {
  NOR: { q1: "1:30.939", q2: "1:29.207", q3: "1:27.470" },
  RUS: { q1: "1:31.206", q2: "1:26.745", q3: "1:27.674" },
  ANT: { q1: "1:32.229", q2: "1:29.302", q3: "1:28.095" },
  LEC: { q1: "1:32.121", q2: "1:28.082", q3: "1:28.289" },
  LAW: { q1: "1:32.085", q2: "1:27.049", q3: "1:28.321" },
  HUL: { q1: "1:31.693", q2: "1:28.361", q3: "1:28.668" },
  HAD: { q1: "1:32.059", q2: "1:27.218", q3: "1:28.763" },
  BEA: { q1: "1:33.030", q2: "1:29.130", q3: "1:29.831" },
  ALO: { q1: "1:32.092", q2: "1:29.072", q3: "1:30.311" },
  ALB: { q1: "1:33.150", q2: "1:28.918", q3: "1:30.456" },
  HAM: { q1: "1:31.666", q2: "1:30.001", q3: null },
  PIA: { q1: "1:32.251", q2: "1:30.369", q3: null },
  CAM: { q1: "1:32.809", q2: "1:31.515", q3: null },
  LIN: { q1: "1:32.306", q2: "1:31.687", q3: null },
  SAI: { q1: "1:32.350", q2: null,        q3: null },
  VER: { q1: "1:32.412", q2: null,        q3: null },
  COL: { q1: "1:32.540", q2: null,        q3: null },
  GAS: { q1: "1:32.611", q2: null,        q3: null },
  STR: { q1: "1:32.890", q2: null,        q3: null },
  BOT: { q1: "1:33.015", q2: null,        q3: null },
  PER: { q1: "1:33.420", q2: null,        q3: null },
  BOR: { q1: "1:35.804", q2: null,        q3: null },
};

// ─── Race results (round 44) ────────────────────────────────────────────────
const RACE_DATA = [
  { id: "NOR", grid: 1,  laps: 71, time: "1:35:23.504", points: 25, fastestLapTime: null },
  { id: "VER", grid: 21, laps: 71, time: "+14.602",     points: 18, fastestLapTime: null },
  { id: "HAD", grid: 5,  laps: 71, time: "+24.485",     points: 15, fastestLapTime: null },
  { id: "RUS", grid: 7,  laps: 71, time: "+33.991",     points: 12, fastestLapTime: null },
  { id: "ANT", grid: 2,  laps: 71, time: "+41.017",     points: 11, fastestLapTime: "1:12.689", setFastestLap: true },
  { id: "PIA", grid: 10, laps: 71, time: "+56.475",     points: 8,  fastestLapTime: null },
  { id: "LAW", grid: 3,  laps: 71, time: "+1:15.402",   points: 6,  fastestLapTime: null },
  { id: "LEC", grid: 13, laps: 71, time: "+1:18.586",   points: 4,  fastestLapTime: null },
  { id: "HAM", grid: 20, laps: 70, time: "+1 lap",      points: 2,  fastestLapTime: null },
  { id: "HUL", grid: 4,  laps: 70, time: "+1 lap",      points: 1,  fastestLapTime: null },
  { id: "LIN", grid: 18, laps: 70, time: "+1 lap",      points: 0,  fastestLapTime: null },
  { id: "ALO", grid: 8,  laps: 70, time: "+1 lap",      points: 0,  fastestLapTime: null },
  { id: "COL", grid: 14, laps: 70, time: "+1 lap",      points: 0,  fastestLapTime: null },
  { id: "GAS", grid: 15, laps: 70, time: "+1 lap",      points: 0,  fastestLapTime: null },
  { id: "ALB", grid: 9,  laps: 70, time: "+1 lap",      points: 0,  fastestLapTime: null },
  { id: "BOR", grid: 19, laps: 70, time: "+1 lap",      points: 0,  fastestLapTime: null },
  { id: "BEA", grid: 6,  laps: 70, time: "+1 lap",      points: 0,  fastestLapTime: null },
  { id: "PER", grid: 22, laps: 69, time: "+2 laps",     points: 0,  fastestLapTime: null },
  { id: "SAI", grid: 12, laps: 69, time: "+2 laps",     points: 0,  fastestLapTime: null },
  { id: "CAM", grid: 11, laps: 69, time: "+2 laps",     points: 0,  fastestLapTime: null },
  { id: "STR", grid: 16, laps: 30, time: "DNF",         points: 0,  fastestLapTime: null, status: "DNF" },
  { id: "BOT", grid: 17, laps: 0,  time: "DNS",         points: 0,  fastestLapTime: null, status: "DNS" },
];

// ─── Patch round 43 qualifying ──────────────────────────────────────────────
const r43 = data.raceDetails.find(r => r.round === 43);
if (!r43) { console.error("Round 43 not found!"); process.exit(1); }

r43.qualifyingResults.forEach(entry => {
  const t = QUALI_TIMES[entry.driverId];
  if (!t) { console.warn(`No quali time for ${entry.driverId}`); return; }
  entry.q1 = t.q1 ?? null;
  entry.q2 = t.q2 ?? null;
  entry.q3 = t.q3 ?? null;
  entry.laps = t.q3 !== null ? 20 : (t.q2 !== null ? 14 : 7);
});

console.log("✓ Patched round 43 qualifying times");

// ─── Patch round 44 race ────────────────────────────────────────────────────
const r44 = data.raceDetails.find(r => r.round === 44);
if (!r44) { console.error("Round 44 not found!"); process.exit(1); }

r44.raceResults.forEach(entry => {
  const d = RACE_DATA.find(x => x.id === entry.driverId);
  if (!d) { console.warn(`No race data for ${entry.driverId}`); return; }
  entry.startingGrid = d.grid;
  entry.laps = d.laps;
  entry.time = d.time;
  if (d.fastestLapTime) entry.fastestLapTime = d.fastestLapTime;
  if (d.setFastestLap) entry.setFastestLap = true;
  if (d.status) entry.status = d.status;
});

// Also add qualifying results to round 44
r44.qualifyingResults = r43.qualifyingResults;

console.log("✓ Patched round 44 race data");

// ─── Write ───────────────────────────────────────────────────────────────────
fs.writeFileSync(FILE, JSON.stringify(data, null, 2) + "\n");
console.log(`Wrote ${FILE}`);
