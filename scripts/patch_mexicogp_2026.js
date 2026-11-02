#!/usr/bin/env node
/**
 * patch_mexicogp_2026.js
 * Patches rounds 41 (qualifying) and 42 (race) for the
 * 2026 Mexico City Grand Prix with real lap times and grid positions.
 */
const fs = require("fs");
const path = require("path");

const FILE = path.join(__dirname, "..", "data", "2026.json");
const data = JSON.parse(fs.readFileSync(FILE, "utf-8"));

// ─── Qualifying lap times (round 41) ───────────────────────────────────────
const QUALI_TIMES = {
  HAM: { q1: "1:17.341", q2: "1:16.953", q3: "1:16.514" },
  RUS: { q1: "1:17.659", q2: "1:17.027", q3: "1:16.523" },
  LEC: { q1: "1:17.506", q2: "1:16.944", q3: "1:16.633" },
  VER: { q1: "1:17.942", q2: "1:16.876", q3: "1:16.692" },
  ANT: { q1: "1:17.918", q2: "1:17.133", q3: "1:16.707" },
  NOR: { q1: "1:17.733", q2: "1:16.728", q3: "1:16.824" },
  HAD: { q1: "1:17.385", q2: "1:17.047", q3: "1:16.900" },
  LIN: { q1: "1:18.210", q2: "1:17.135", q3: "1:17.117" },
  GAS: { q1: "1:18.194", q2: "1:17.278", q3: "1:17.153" },
  HUL: { q1: "1:17.868", q2: "1:17.306", q3: null },
  COL: { q1: "1:18.517", q2: "1:17.640", q3: null },
  PIA: { q1: "1:17.659", q2: "1:17.646", q3: null },
  BOR: { q1: "1:17.727", q2: "1:17.680", q3: null },
  BEA: { q1: "1:18.083", q2: "1:18.083", q3: null },
  SAI: { q1: "1:18.521", q2: "1:18.885", q3: null },
  ALB: { q1: "1:18.630", q2: null,        q3: null },
  ALO: { q1: "1:18.908", q2: null,        q3: null },
  HIR: { q1: "1:18.958", q2: null,        q3: null },
  STR: { q1: "1:19.072", q2: null,        q3: null },
  PER: { q1: "1:19.105", q2: null,        q3: null },
  BOT: { q1: "1:19.852", q2: null,        q3: null },
  LAW: { q1: "1:18.097", q2: "1:17.207", q3: null },
};

// ─── Race results (round 42) ────────────────────────────────────────────────
const RACE_DATA = [
  { id: "VER", grid: 5,  laps: 71, time: "2:20:28.772", points: 25, fastestLapTime: null },
  { id: "HAM", grid: 1,  laps: 71, time: "+0.799",      points: 19, fastestLapTime: "1:19.268", setFastestLap: true },
  { id: "ANT", grid: 4,  laps: 71, time: "+4.006",      points: 15, fastestLapTime: null },
  { id: "LEC", grid: 3,  laps: 71, time: "+10.707",     points: 12, fastestLapTime: null },
  { id: "NOR", grid: 6,  laps: 71, time: "+11.778",     points: 10, fastestLapTime: null },
  { id: "RUS", grid: 2,  laps: 71, time: "+12.263",     points: 8,  fastestLapTime: null },
  { id: "LAW", grid: 22, laps: 71, time: "+20.899",     points: 6,  fastestLapTime: null },
  { id: "BOR", grid: 13, laps: 71, time: "+22.041",     points: 4,  fastestLapTime: null },
  { id: "HAD", grid: 7,  laps: 71, time: "+22.503",     points: 2,  fastestLapTime: null },
  { id: "HIR", grid: 18, laps: 71, time: "+25.373",     points: 1,  fastestLapTime: null },
  { id: "ALB", grid: 16, laps: 71, time: "+27.562",     points: 0,  fastestLapTime: null },
  { id: "SAI", grid: 15, laps: 71, time: "+28.638",     points: 0,  fastestLapTime: null },
  { id: "PIA", grid: 12, laps: 71, time: "+29.475",     points: 0,  fastestLapTime: null },
  { id: "HUL", grid: 10, laps: 71, time: "+29.977",     points: 0,  fastestLapTime: null },
  { id: "COL", grid: 11, laps: 71, time: "+30.204",     points: 0,  fastestLapTime: null },
  { id: "PER", grid: 20, laps: 71, time: "+30.695",     points: 0,  fastestLapTime: null },
  { id: "GAS", grid: 9,  laps: 71, time: "+51.483",     points: 0,  fastestLapTime: null },
  { id: "LIN", grid: 8,  laps: 58, time: "DNF",         points: 0,  fastestLapTime: null, status: "DNF" },
  { id: "BEA", grid: 14, laps: 47, time: "DNF",         points: 0,  fastestLapTime: null, status: "DNF" },
  { id: "BOT", grid: 21, laps: 42, time: "DNF",         points: 0,  fastestLapTime: null, status: "DNF" },
  { id: "STR", grid: 19, laps: 5,  time: "DNF",         points: 0,  fastestLapTime: null, status: "DNF" },
  { id: "ALO", grid: 17, laps: 5,  time: "DNF",         points: 0,  fastestLapTime: null, status: "DNF" },
];

// ─── Patch round 41 qualifying ──────────────────────────────────────────────
const r41 = data.raceDetails.find(r => r.round === 41);
if (!r41) { console.error("Round 41 not found!"); process.exit(1); }

r41.qualifyingResults.forEach(entry => {
  const t = QUALI_TIMES[entry.driverId];
  if (!t) { console.warn(`No quali time for ${entry.driverId}`); return; }
  entry.q1 = t.q1 ?? null;
  entry.q2 = t.q2 ?? null;
  entry.q3 = t.q3 ?? null;
  entry.laps = t.q3 !== null ? 18 : (t.q2 !== null ? 12 : 6);
});

console.log("✓ Patched round 41 qualifying times");

// ─── Patch round 42 race ────────────────────────────────────────────────────
const r42 = data.raceDetails.find(r => r.round === 42);
if (!r42) { console.error("Round 42 not found!"); process.exit(1); }

r42.raceResults.forEach(entry => {
  const d = RACE_DATA.find(x => x.id === entry.driverId);
  if (!d) { console.warn(`No race data for ${entry.driverId}`); return; }
  entry.startingGrid = d.grid;
  entry.laps = d.laps;
  entry.time = d.time;
  if (d.fastestLapTime) entry.fastestLapTime = d.fastestLapTime;
  if (d.setFastestLap) entry.setFastestLap = true;
  if (d.status) entry.status = d.status;
});

// Also add qualifying results to round 42
r42.qualifyingResults = r41.qualifyingResults;

console.log("✓ Patched round 42 race data");

// ─── Write ───────────────────────────────────────────────────────────────────
fs.writeFileSync(FILE, JSON.stringify(data, null, 2) + "\n");
console.log(`Wrote ${FILE}`);
