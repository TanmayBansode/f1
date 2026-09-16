#!/usr/bin/env node
/**
 * f1-cli.js — cheap local CRUD for data/<year>.json
 *
 * Zero dependencies (plain Node). No AI tokens burned, no browser needed.
 *
 * Usage:
 *   node scripts/f1-cli.js <command> [args] [options]
 *   npm run f1 -- <command> [args] [options]
 *
 * Commands:
 *   list                      List races (rounds)
 *   standings                 Driver standings (final or --after <round>)
 *   show <round>              Show one round (entry + results)
 *   validate                  Check duplicates, gaps, points math (read-only)
 *   dedupe                    Remove duplicate races[] / merge raceDetails[]
 *   add                       Add a new round (quali / sprint / race)
 *   set                       Fix one driver's result in a round
 *   rm <round>                Delete a round + its results
 *   recalc                    Recompute cumulativePoints + constructor totals
 *
 * Global options:
 *   --year <2025|2026>   (default 2026)
 *   --data <path>        override data file path
 *   --dry-run            print what would happen, write nothing
 *   --yes                skip confirmation prompt
 *   --no-backup          skip .bak file on write
 *   -h, --help           help for command
 *
 * Examples:
 *   node scripts/f1-cli.js list --last 8
 *   node scripts/f1-cli.js show 22
 *   node scripts/f1-cli.js standings
 *   node scripts/f1-cli.js validate
 *
 *   # Add British GP race: finishing order = points order, fastest lap bonus to VER
 *   node scripts/f1-cli.js add --gp "Great Britain" --type race --date 2026-07-05 \
 *     --order RUS,VER,ANT,PIA,HAM,HAD,NOR,LEC,LAW,LIN,BOR,SAI,OCO,PER,ALO,HUL,BOT,STR,GAS,COL,ALB,BEA \
 *     --fastest VER --yes
 *
 *   # Add qualifying (no points, order = grid order)
 *   node scripts/f1-cli.js add --gp "Great Britain" --type qualifying --date 2026-07-04 \
 *     --order RUS,LEC,HAM,VER,NOR,PIA --yes
 *
 *   # Mark DNFs/DNSs inside an add (positions still come from --order):
 *   node scripts/f1-cli.js add --gp "Great Britain" --type race --date 2026-07-05 \
 *     --order RUS,VER,ANT --dnf SAI,PER --dns BOT --yes
 *
 *   # Fix a result: Sainz actually P20 DNF in round 22
 *   node scripts/f1-cli.js set --round 22 --driver SAI --pos 20 --status DNF --yes
 *
 *   # Delete a bad round, recompute everything:
 *   node scripts/f1-cli.js rm 22 --yes
 *   node scripts/f1-cli.js recalc --yes
 *   node scripts/f1-cli.js dedupe --dry-run
 */

const fs = require("fs");
const path = require("path");
const readline = require("readline");

// ── Points scales (must match src/lib/f1-driver-registry.ts) ──
const RACE_POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
const SPRINT_POINTS = [8, 7, 6, 5, 4, 3, 2, 1];
const FASTEST_LAP_BONUS = 1;

// ── GP metadata (must match src/lib/f1-transformer.ts) ──
const GP_META = {
  Australia: { circuit: "Albert Park Circuit", location: "Melbourne, Australia" },
  China: { circuit: "Shanghai International Circuit", location: "Shanghai, China" },
  Japan: { circuit: "Suzuka International Racing Course", location: "Suzuka, Japan" },
  Bahrain: { circuit: "Bahrain International Circuit", location: "Sakhir, Bahrain" },
  "Saudi Arabia": { circuit: "Jeddah Corniche Circuit", location: "Jeddah, Saudi Arabia" },
  Miami: { circuit: "Miami International Autodrome", location: "Miami, USA" },
  "Emilia Romagna": { circuit: "Autodromo Enzo e Dino Ferrari", location: "Imola, Italy" },
  Monaco: { circuit: "Circuit de Monaco", location: "Monte Carlo, Monaco" },
  Canada: { circuit: "Circuit Gilles Villeneuve", location: "Montreal, Canada" },
  Spain: { circuit: "Circuit de Barcelona-Catalunya", location: "Barcelona, Spain" },
  Austria: { circuit: "Red Bull Ring", location: "Spielberg, Austria" },
  "Great Britain": { circuit: "Silverstone Circuit", location: "Silverstone, UK" },
  Hungary: { circuit: "Hungaroring", location: "Budapest, Hungary" },
  Belgium: { circuit: "Circuit de Spa-Francorchamps", location: "Spa, Belgium" },
  Netherlands: { circuit: "Circuit Zandvoort", location: "Zandvoort, Netherlands" },
  Italy: { circuit: "Autodromo Nazionale Monza", location: "Monza, Italy" },
  Azerbaijan: { circuit: "Baku City Circuit", location: "Baku, Azerbaijan" },
  Singapore: { circuit: "Marina Bay Street Circuit", location: "Singapore" },
  "United States": { circuit: "Circuit of the Americas", location: "Austin, USA" },
  Mexico: { circuit: "Autodromo Hermanos Rodriguez", location: "Mexico City, Mexico" },
  "Sao Paulo": { circuit: "Autodromo Jose Carlos Pace", location: "São Paulo, Brazil" },
  "Las Vegas": { circuit: "Las Vegas Strip Circuit", location: "Las Vegas, USA" },
  Qatar: { circuit: "Lusail International Circuit", location: "Lusail, Qatar" },
  "Abu Dhabi": { circuit: "Yas Marina Circuit", location: "Abu Dhabi, UAE" },
};

const GP_ABBR = {
  Australia: "AUS", China: "CHN", Japan: "JPN", Bahrain: "BHR",
  "Saudi Arabia": "KSA", Miami: "MIA", "Emilia Romagna": "EMR",
  Monaco: "MON", Canada: "CAN", Spain: "ESP", Austria: "AUT",
  "Great Britain": "GBR", Hungary: "HUN", Belgium: "BEL",
  Netherlands: "NLD", Italy: "ITA", Azerbaijan: "AZE",
  Singapore: "SGP", "United States": "USA", Mexico: "MEX",
  "Sao Paulo": "BRA", "Las Vegas": "LVG", Qatar: "QAT", "Abu Dhabi": "ABD",
};

// ── tiny arg parser ──
function parseArgs(argv) {
  const args = [];
  const opts = {};
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    if (t === "-h" || t === "--help") { opts.help = true; continue; }
    if (t.startsWith("--")) {
      const eq = t.indexOf("=");
      if (eq !== -1) {
        opts[t.slice(2, eq)] = t.slice(eq + 1);
      } else {
        const key = t.slice(2);
        const next = argv[i + 1];
        if (next === undefined || next.startsWith("--")) {
          opts[key] = true; // boolean flag
        } else {
          opts[key] = next;
          i++;
        }
      }
    } else if (t.startsWith("-") && t.length === 2) {
      // single-char alias: -y == --yes
      const key = t.slice(1);
      if (key === "y") opts.yes = true;
      else if (key === "h") opts.help = true;
      else args.push(t);
    } else {
      args.push(t);
    }
  }
  return { args, opts };
}

function toInt(v, name) {
  if (v === undefined || v === true) return undefined;
  const n = Number(v);
  if (!Number.isInteger(n)) throw new Error(`--${name} must be an integer (got "${v}")`);
  return n;
}

function csvList(v) {
  if (!v || v === true) return [];
  return String(v).split(",").map((s) => s.trim().toUpperCase()).filter(Boolean);
}

function resolveDataPath(opts) {
  if (opts.data) return path.resolve(String(opts.data));
  const year = opts.year ? String(opts.year) : "2026";
  return path.join(__dirname, "..", "data", `${year}.json`);
}

function loadSeason(file) {
  const raw = fs.readFileSync(file, "utf-8");
  const json = JSON.parse(raw);
  if (!Array.isArray(json.races) || !Array.isArray(json.raceDetails) || !Array.isArray(json.drivers)) {
    throw new Error(`Bad season file ${file}: expected races[], raceDetails[], drivers[]`);
  }
  json.constructors = json.constructors || [];
  return json;
}

function backupPath(file) {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  return `${file}.bak-${stamp}`;
}

function saveSeason(file, json, opts) {
  if (opts["dry-run"]) {
    console.log("(dry-run) not writing.");
    return null;
  }
  let bak = null;
  if (!opts["no-backup"] && fs.existsSync(file)) {
    bak = backupPath(file);
    fs.copyFileSync(file, bak);
    console.log(`Backup: ${path.basename(bak)}`);
  }
  fs.writeFileSync(file, JSON.stringify(json, null, 2) + "\n");
  console.log(`Wrote ${file}`);
  return bak;
}

async function confirmOrExit(opts, question) {
  if (opts["dry-run"]) return false; // never write on dry-run
  if (opts.yes || opts.y) return true;
  if (!process.stdin.isTTY) {
    console.error('Refusing to write without --yes in non-interactive mode (or use --dry-run).');
    process.exit(1);
  }
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ans = await new Promise((res) => rl.question(`${question} [y/N] `, res));
  rl.close();
  if (String(ans).trim().toLowerCase() !== "y") {
    console.log("Aborted.");
    process.exit(1);
  }
  return true;
}

// ── driver helpers (resolve against the season file itself) ──
function findDriver(season, idOrName) {
  const q = String(idOrName).trim();
  const upper = q.toUpperCase();
  let d = season.drivers.find((x) => x.id.toUpperCase() === upper);
  if (d) return d;
  d = season.drivers.find((x) => x.name.toLowerCase() === q.toLowerCase());
  if (d) return d;
  return null;
}

function prevCumulative(driver) {
  if (!driver.results || driver.results.length === 0) return 0;
  const sorted = [...driver.results].sort((a, b) => a.round - b.round);
  return sorted[sorted.length - 1].cumulativePoints ?? 0;
}

function resolveGpMeta(gpName) {
  if (GP_META[gpName]) return GP_META[gpName];
  const key = Object.keys(GP_META).find(
    (k) => gpName.toLowerCase().includes(k.toLowerCase()) || k.toLowerCase().includes(gpName.toLowerCase())
  );
  return key ? GP_META[key] : { circuit: "Unknown Circuit", location: "Unknown Location" };
}

function resolveGpAbbr(gpName) {
  if (GP_ABBR[gpName]) return GP_ABBR[gpName];
  const key = Object.keys(GP_ABBR).find(
    (k) => gpName.toLowerCase().includes(k.toLowerCase()) || k.toLowerCase().includes(gpName.toLowerCase())
  );
  return key ? GP_ABBR[key] : gpName.slice(0, 3).toUpperCase();
}

function normalizeType(t) {
  const v = String(t || "").toLowerCase();
  if (v === "race") return "race";
  if (v === "qualifying" || v === "quali" || v === "q") return "qualifying";
  if (v === "sprint" || v === "s") return "sprint";
  if (v === "sprint-qualifying" || v === "sq" || v === "sprintqualifying" || v === "sprint_qualifying") return "sprint-qualifying";
  throw new Error(`Unknown --type "${t}" (want race|qualifying|sprint|sprint-qualifying)`);
}

function buildRaceEntry(round, gpName, type, date, meta) {
  const map = {
    race: { suffix: "Grand Prix", shortSuffix: "", raceType: "race" },
    qualifying: { suffix: "Grand Prix Qualifying", shortSuffix: "-Q", raceType: "qualifying" },
    sprint: { suffix: "Grand Prix Sprint", shortSuffix: "-S", raceType: "sprint" },
    "sprint-qualifying": { suffix: "Grand Prix Sprint Qualifying", shortSuffix: "-SQ", raceType: "qualifying" },
  };
  const m = map[type];
  const abbr = resolveGpAbbr(gpName);
  return {
    round,
    name: `${gpName} ${m.suffix}`,
    shortName: `${abbr}${m.shortSuffix}`,
    date: date || new Date().toISOString().slice(0, 10),
    type: m.raceType,
    circuit: meta.circuit,
    location: meta.location,
  };
}

function pointsFor(type, position, isFastest) {
  if (type === "race") {
    const base = position >= 1 && position <= RACE_POINTS.length ? RACE_POINTS[position - 1] : 0;
    return base + (isFastest && position >= 1 && position <= 10 ? FASTEST_LAP_BONUS : 0);
  }
  if (type === "sprint") {
    return position >= 1 && position <= SPRINT_POINTS.length ? SPRINT_POINTS[position - 1] : 0;
  }
  return 0; // qualifying never scores
}

function detailKeyFor(type) {
  if (type === "race") return "raceResults";
  if (type === "sprint") return "sprintResults";
  if (type === "qualifying") return "qualifyingResults";
  return "sprintQualifyingResults"; // sprint-qualifying
}

// Recompute cumulativePoints for every driver (sorted by round) + constructor totals.
// Optionally also recompute points from raceDetails positions (fix-points).
function recalcSeason(season, { fixPoints = false } = {}) {
  if (fixPoints) {
    // Build round -> points map from raceDetails positions
    for (const detail of season.raceDetails) {
      const round = detail.round;
      const entries = [
        ["raceResults", "race"],
        ["sprintResults", "sprint"],
      ];
      for (const [key, type] of entries) {
        if (!Array.isArray(detail[key])) continue;
        // fastest-lap holder: flagged in details OR in driver results (slim rows lack the flag)
        const flagged = detail[key].find((r) => r.setFastestLap)?.driverId
          || season.drivers.find((d) => (d.results.find((x) => x.round === round) || {}).setFastestLap)?.id;
        for (const r of detail[key]) {
          const pts = pointsFor(type, r.position, flagged && r.driverId === flagged);
          r.points = pts;
          const drv = season.drivers.find((d) => d.id === r.driverId);
          if (!drv) continue;
          const res = drv.results.find((x) => x.round === round);
          if (res) res.points = pts;
        }
      }
      // quali types: force 0
      for (const key of ["qualifyingResults", "sprintQualifyingResults"]) {
        if (!Array.isArray(detail[key])) continue;
        for (const r of detail[key]) {
          const drv = season.drivers.find((d) => d.id === r.driverId);
          if (!drv) continue;
          const res = drv.results.find((x) => x.round === round);
          if (res) res.points = 0;
        }
      }
    }
  }

  for (const d of season.drivers) {
    d.results.sort((a, b) => a.round - b.round);
    let cum = 0;
    for (const r of d.results) {
      cum += r.points || 0;
      r.cumulativePoints = cum;
    }
  }
  // Constructors = sum of final cumulative per teamId (using driver's current team)
  const totals = {};
  for (const d of season.drivers) {
    const last = d.results.length ? d.results[d.results.length - 1].cumulativePoints : 0;
    totals[d.teamId] = (totals[d.teamId] || 0) + last;
  }
  for (const c of season.constructors) {
    c.points = totals[c.id] || 0;
  }
  // Sort drivers + constructors like the pipeline does (nice for diffs)
  season.drivers.sort((a, b) => {
    const al = a.results.length ? a.results[a.results.length - 1].cumulativePoints : 0;
    const bl = b.results.length ? b.results[b.results.length - 1].cumulativePoints : 0;
    return bl - al;
  });
  season.constructors.sort((a, b) => b.points - a.points);
}

// ── commands ──

function cmdHelp() {
  console.log(`
f1-cli — local CRUD for data/<year>.json (zero deps)

  node scripts/f1-cli.js <command> [args] [options]
  npm run f1 -- <command> [args] [options]

Commands:
  list [--last N|--all] [--type T]     list rounds
  standings [--after R]                driver standings
  show <round>                         one round + results
  validate                             read-only consistency check
  dedupe [--dry-run] [--yes]           delete dup races[], merge dup details
  add --gp GP --type T --order A,B,..  add a round (see --help under add)
  set --round R --driver ID [...]      fix one result
  rm <round>                           delete a round
  recalc [--fix-points]                recompute cumulative + constructors

Global: --year 2026|2025 (def 2026)  --data <path>  --dry-run  --yes  --no-backup
Run with --help after a command for details, e.g.:
  node scripts/f1-cli.js add --help
`);
}

function cmdList(season, opts) {
  let races = [...season.races].sort((a, b) => a.round - b.round);
  if (opts.type) races = races.filter((r) => r.type === opts.type);
  if (!opts.all) {
    const n = toInt(opts.last, "last") || 10;
    races = races.slice(-n);
  }
  console.log(`Season ${season.year}: ${season.races.length} races[] entries, ${season.raceDetails.length} details, ${season.drivers.length} drivers`);
  console.log("round  short   type        date        name");
  console.log("-----  ------  ----------  ----------  --------------------------------");
  for (const r of races) {
    console.log(
      `${String(r.round).padEnd(6)}${String(r.shortName || "").padEnd(8)}${String(r.type || "").padEnd(12)}${String(r.date || "").padEnd(12)}${r.name}`
    );
  }
}

function cmdStandings(season, opts) {
  const after = toInt(opts.after, "after");
  const rows = season.drivers.map((d) => {
    let pts = 0;
    let pos = null;
    const sorted = [...d.results].sort((a, b) => a.round - b.round);
    for (const r of sorted) {
      if (after !== undefined && r.round > after) break;
      pts = r.cumulativePoints;
      pos = r.position;
    }
    return { id: d.id, name: d.name, team: d.team, pts, pos };
  }).sort((a, b) => b.pts - a.pts);
  console.log(`Driver standings ${after !== undefined ? `(after round ${after})` : "(final)"} — ${season.year}`);
  console.log("pos  id   pts   lastPos  driver (team)");
  rows.forEach((r, i) => {
    console.log(`${String(i + 1).padEnd(5)}${r.id.padEnd(5)}${String(r.pts).padEnd(6)}${String(r.pos ?? "-").padEnd(9)}${r.name} (${r.team})`);
  });
}

function cmdShow(season, args) {
  const round = Number(args[0]);
  if (!Number.isInteger(round)) throw new Error("show needs a round number: show <round>");
  const entries = season.races.filter((r) => r.round === round);
  if (entries.length === 0) {
    console.log(`Round ${round}: no races[] entry.`);
  } else {
    for (const e of entries) {
      console.log(`R${e.round} ${e.name} [${e.shortName}] (${e.type}) ${e.date}`);
      if (e.circuit) console.log(`  ${e.circuit} — ${e.location || ""}`);
    }
    if (entries.length > 1) console.log(`  ⚠ ${entries.length} duplicate races[] entries for this round (run validate/dedupe)`);
  }
  const detail = season.raceDetails.find((d) => d.round === round);
  if (!detail) {
    console.log(`Round ${round}: no raceDetails entry.`);
    return;
  }
  for (const [key, label] of [["raceResults", "Race"], ["sprintResults", "Sprint"], ["qualifyingResults", "Qualifying"], ["sprintQualifyingResults", "Sprint Qualifying"]]) {
    const rows = detail[key];
    if (!Array.isArray(rows)) continue;
    console.log(`\n${label} (${rows.length}):`);
    const sorted = [...rows].sort((a, b) => a.position - b.position);
    const nameOf = (r) => r.driver || (findDriver(season, r.driverId) || {}).name || r.driverId;
    const teamOf = (r) => r.team || (findDriver(season, r.driverId) || {}).team || "?";
    for (const r of sorted.slice(0, 12)) {
      const extra = r.status ? ` [${r.status}]` : "";
      const pts = r.points !== undefined ? ` ${r.points}pts` : "";
      const time = r.time ? ` ${r.time}` : r.q3 || r.q2 || r.q1 ? ` ${r.q3 || r.q2 || r.q1}` : "";
      console.log(`  P${r.position} ${r.driverId} ${nameOf(r)} (${teamOf(r)})${time}${pts}${extra}`);
    }
    if (sorted.length > 12) {
      console.log(`  ... +${sorted.length - 12} more (DNF/backmarkers):`);
      for (const r of sorted.slice(12)) {
        console.log(`  P${r.position} ${r.driverId} ${nameOf(r)}${r.status ? ` [${r.status}]` : ""} ${r.points ? `${r.points}pts` : ""}`);
      }
    }
  }
}

function cmdValidate(season) {
  const errors = [];
  const warnings = [];
  const races = season.races;
  const details = season.raceDetails;

  // 1. duplicate races[] (same round)
  const byRound = {};
  for (const r of races) {
    byRound[r.round] = byRound[r.round] || [];
    byRound[r.round].push(r);
  }
  for (const [round, list] of Object.entries(byRound)) {
    if (list.length > 1) {
      const names = [...new Set(list.map((r) => `${r.name} [${r.type}]`))].join(" / ");
      errors.push(`races[] round ${round} appears ${list.length}x (dup): ${names}`);
    }
  }

  // 2. gaps in rounds
  const uniqRounds = [...new Set(races.map((r) => r.round))].sort((a, b) => a - b);
  if (uniqRounds.length) {
    for (let r = uniqRounds[0]; r <= uniqRounds[uniqRounds.length - 1]; r++) {
      if (!byRound[r]) warnings.push(`races[] missing round ${r} (gap)`);
    }
  }

  // 3. duplicate raceDetails rounds
  const detByRound = {};
  for (const d of details) {
    detByRound[d.round] = detByRound[d.round] || [];
    detByRound[d.round].push(d);
  }
  for (const [round, list] of Object.entries(detByRound)) {
    if (list.length > 1) errors.push(`raceDetails[] round ${round} appears ${list.length}x`);
  }

  // 4. details without races entry and vice versa
  for (const d of details) {
    if (!byRound[d.round]) warnings.push(`raceDetails round ${d.round} has no races[] entry`);
  }
  for (const r of uniqRounds) {
    if (!detByRound[r]) warnings.push(`races[] round ${r} (${(byRound[r][0] || {}).name}) has no raceDetails entry`);
  }

  // 5. per-driver checks: cumulative math + unknown ids + orphan results
  const detailDriverIds = new Set();
  for (const d of details) {
    for (const k of ["raceResults", "sprintResults", "qualifyingResults", "sprintQualifyingResults"]) {
      for (const row of d[k] || []) detailDriverIds.add(row.driverId);
    }
  }
  for (const drv of season.drivers) {
    const sorted = [...drv.results].sort((a, b) => a.round - b.round);
    let cum = 0;
    const seen = new Set();
    for (const res of sorted) {
      if (seen.has(res.round)) errors.push(`driver ${drv.id} has 2 results for round ${res.round}`);
      seen.add(res.round);
      cum += res.points || 0;
      if (res.cumulativePoints !== cum) {
        errors.push(`driver ${drv.id} round ${res.round}: cumulative ${res.cumulativePoints} != recomputed ${cum}`);
      }
      if (!detByRound[res.round] && !byRound[res.round]) {
        warnings.push(`driver ${drv.id} result round ${res.round} has no race/detail entry`);
      }
    }
    if (!detailDriverIds.has(drv.id)) warnings.push(`driver ${drv.id} never appears in raceDetails`);
  }

  // 6. constructor totals
  const totals = {};
  for (const d of season.drivers) {
    const last = d.results.length ? [...d.results].sort((a, b) => a.round - b.round).pop().cumulativePoints : 0;
    totals[d.teamId] = (totals[d.teamId] || 0) + last;
  }
  for (const c of season.constructors) {
    if (c.points !== (totals[c.id] || 0)) {
      errors.push(`constructor ${c.id}: stored ${c.points} != recomputed ${totals[c.id] || 0} from drivers`);
    }
  }

  // 7. points scale sanity for race/sprint details
  for (const d of details) {
    for (const [key, scale, label] of [["raceResults", RACE_POINTS, "race"], ["sprintResults", SPRINT_POINTS, "sprint"]]) {
      const rows = d[key];
      if (!Array.isArray(rows)) continue;
      // positions must be unique 1..N
      const seen = new Set();
      for (const row of rows) {
        if (seen.has(row.position)) warnings.push(`round ${d.round} ${label}: duplicate position P${row.position} (${row.driverId})`);
        seen.add(row.position);
      }
      for (const row of rows) {
        const expectBase = row.position >= 1 && row.position <= scale.length ? scale[row.position - 1] : 0;
        // allow +1 fastest-lap bonus in races
        const ok = row.points === expectBase || (label === "race" && row.points === expectBase + 1);
        if (!ok) warnings.push(`round ${d.round} ${label} ${row.driverId} P${row.position}: ${row.points}pts (expected ${expectBase}${label === "race" ? " or +1 FL" : ""})`);
      }
    }
  }

  if (errors.length === 0 && warnings.length === 0) {
    console.log("validate: OK — no errors, no warnings.");
    return true;
  }
  for (const e of errors) console.log(`ERROR: ${e}`);
  for (const w of warnings) console.log(`WARN:  ${w}`);
  console.log(`\nvalidate: ${errors.length} error(s), ${warnings.length} warning(s).`);
  return errors.length === 0;
}

function cmdDedupe(season, opts) {
  // races[]: keep first occurrence of each round
  const seen = new Set();
  const before = season.races.length;
  const dupes = [];
  season.races = season.races.filter((r) => {
    if (seen.has(r.round)) { dupes.push(r); return false; }
    seen.add(r.round);
    return true;
  });
  season.races.sort((a, b) => a.round - b.round);

  // raceDetails[]: merge entries with same round
  const merged = new Map();
  let mergedCount = 0;
  for (const d of season.raceDetails) {
    if (!merged.has(d.round)) { merged.set(d.round, { ...d }); continue; }
    mergedCount++;
    const cur = merged.get(d.round);
    for (const k of ["raceResults", "sprintResults", "qualifyingResults", "sprintQualifyingResults"]) {
      if (Array.isArray(d[k]) && !Array.isArray(cur[k])) cur[k] = d[k];
    }
  }
  season.raceDetails = [...merged.values()].sort((a, b) => a.round - b.round);

  console.log(`dedupe: races ${before} -> ${season.races.length} (removed ${dupes.length})`);
  if (dupes.length) for (const d of dupes) console.log(`  removed R${d.round} ${d.name} [${d.type}]`);
  console.log(`dedupe: merged ${mergedCount} duplicate raceDetails entries`);
  if (dupes.length === 0 && mergedCount === 0) console.log("Nothing to do.");
  return { removed: dupes.length, merged: mergedCount };
}

async function cmdAdd(season, file, opts) {
  if (opts.help) {
    console.log(`
add — append one round (qualifying, sprint, sprint-qualifying, or race)

Required:
  --gp <name>            e.g. "Great Britain" (matched fuzzily to known GPs)
  --type <T>             race | qualifying | sprint | sprint-qualifying
  --order ID,ID,...      finishing order, P1 first (driver IDs as in the JSON)

Optional:
  --date YYYY-MM-DD      (default: today)
  --round N              (default: max round + 1; errors if taken)
  --dnf ID,ID,...        mark as DNF (keeps position from --order)
  --dns ID,ID,...        mark as DNS
  --dsq ID,ID,...        mark as DSQ
  --fastest ID           fastest-lap bonus (+1 if race P1-P10)
  --year N / --data P / --dry-run / --yes / --no-backup

Notes:
  - race/sprint points are computed from position (no need to type them).
  - qualifying / sprint-qualifying always score 0.
  - teams/numbers are pulled from the driver's current record.
`);
    return;
  }
  const gpRaw = opts.gp;
  const typeRaw = opts.type;
  if (!gpRaw || gpRaw === true) throw new Error("add needs --gp \"<name>\"  (e.g. --gp \"Great Britain\")");
  if (!typeRaw || typeRaw === true) throw new Error("add needs --type race|qualifying|sprint|sprint-qualifying");
  const type = normalizeType(typeRaw);
  const order = csvList(opts.order);
  if (order.length === 0) throw new Error("add needs --order ID,ID,...  (P1 first, e.g. --order RUS,VER,ANT)");

  // fuzzy GP match to canonical name
  const gpName = Object.keys(GP_META).find(
    (k) => k.toLowerCase() === String(gpRaw).toLowerCase()
  ) || Object.keys(GP_META).find(
    (k) => String(gpRaw).toLowerCase().includes(k.toLowerCase()) || k.toLowerCase().includes(String(gpRaw).toLowerCase())
  ) || String(gpRaw);
  const meta = resolveGpMeta(gpName);

  const existing = new Set(season.races.map((r) => r.round));
  let round = toInt(opts.round, "round");
  if (round === undefined) {
    round = existing.size ? Math.max(...existing) + 1 : 1;
  }
  if (existing.has(round)) throw new Error(`Round ${round} already exists (use --round N or delete it first).`);

  const dnf = new Set(csvList(opts.dnf));
  const dns = new Set(csvList(opts.dns));
  const dsq = new Set(csvList(opts.dsq));
  const fastest = opts.fastest && opts.fastest !== true ? String(opts.fastest).toUpperCase() : null;

  // resolve + validate drivers
  const seenDrivers = new Set();
  for (const id of order) {
    if (seenDrivers.has(id)) throw new Error(`Duplicate driver ${id} in --order`);
    seenDrivers.add(id);
    if (!findDriver(season, id)) {
      const known = season.drivers.map((d) => d.id).join(",");
      throw new Error(`Unknown driver "${id}". Known: ${known}`);
    }
  }
  for (const id of [...dnf, ...dns, ...dsq]) {
    if (!seenDrivers.has(id)) throw new Error(`--dnf/--dns/--dsq "${id}" is not in --order (add it to --order at its classified position)`);
  }
  if (fastest && !seenDrivers.has(fastest)) throw new Error(`--fastest ${fastest} is not in --order`);

  const date = opts.date && opts.date !== true ? String(opts.date) : new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(`--date must be YYYY-MM-DD (got "${date}")`);

  // build entries
  const raceEntry = buildRaceEntry(round, gpName, type, date, meta);
  const key = detailKeyFor(type);
  const rows = order.map((id, i) => {
    const pos = i + 1;
    const drv = findDriver(season, id);
    const status = dsq.has(id) ? "DSQ" : dns.has(id) ? "DNS" : dnf.has(id) ? "DNF" : undefined;
    const pts = pointsFor(type, pos, fastest === id);
    if (type === "race" || type === "sprint") {
      const row = {
        position: pos, driverNumber: drv.number, driverId: drv.id, driver: drv.name,
        team: drv.team, startingGrid: null, laps: 0, time: status || "", points: pts,
      };
      if (fastest === id && type === "race") { row.setFastestLap = true; }
      if (status) row.status = status;
      return row;
    }
    return {
      position: pos, driverNumber: drv.number, driverId: drv.id, driver: drv.name,
      team: drv.team, q1: null, q2: null, q3: null, laps: 0,
    };
  });

  console.log(`Will add R${round} ${raceEntry.name} [${raceEntry.shortName}] (${raceEntry.type}) ${raceEntry.date}`);
  console.log(`  ${raceEntry.circuit} — ${raceEntry.location}`);
  console.log(`  ${type} order: ${order.slice(0, 10).join(",")}${order.length > 10 ? ` +${order.length - 10} more` : ""}`);
  const scorers = rows.filter((r) => r.points > 0);
  if (scorers.length) console.log(`  points: ${scorers.map((r) => `${r.driverId}+${r.points}`).join(" ")}`);
  else console.log(`  points: none (qualifying)`);
  if (dnf.size) console.log(`  DNF: ${[...dnf].join(",")}`);
  if (dns.size) console.log(`  DNS: ${[...dns].join(",")}`);
  if (dsq.size) console.log(`  DSQ: ${[...dsq].join(",")}`);

  const ok = await confirmOrExit(opts, `Append round ${round} to ${path.basename(file)}?`);
  if (!ok) return;

  season.races.push(raceEntry);
  season.races.sort((a, b) => a.round - b.round);
  season.raceDetails.push({ round, [key]: rows });
  season.raceDetails.sort((a, b) => a.round - b.round);

  // driver results
  for (const row of rows) {
    const drv = findDriver(season, row.driverId);
    const prev = prevCumulative(drv);
    const entry = { round, position: row.position, points: row.points || 0, cumulativePoints: prev + (row.points || 0) };
    if (type === "race" && row.setFastestLap) entry.setFastestLap = true;
    if (row.status) entry.status = row.status;
    drv.results = drv.results.filter((r) => r.round !== round);
    drv.results.push(entry);
    drv.results.sort((a, b) => a.round - b.round);
  }
  // constructors
  const perTeam = {};
  for (const row of rows) {
    const drv = findDriver(season, row.driverId);
    perTeam[drv.teamId] = (perTeam[drv.teamId] || 0) + (row.points || 0);
  }
  for (const c of season.constructors) {
    if (perTeam[c.id]) c.points += perTeam[c.id];
  }

  // Recompute all cumulativePoints + totals from stored points.
  // Required when inserting mid-sequence (--round < max); no-op for pure appends.
  recalcSeason(season);

  saveSeason(file, season, opts);
  console.log(`Added round ${round}. Run validate to double-check.`);
}

async function cmdSet(season, file, opts) {
  if (opts.help) {
    console.log(`
set — fix one driver's result in a round (updates raceDetails + drivers[] + constructors)

Required: --round N --driver ID
Any of:   --pos N  --points N  --status DNF|DNS|DSQ|OK  --grid N  --fastest / --no-fastest

  --status OK (or NONE) clears the status flag.
  If --pos is given without --points, points are recomputed from position.
  Everything else is recalculated automatically (cumulative + constructors)
  unless --no-recalc is passed.
`);
    return;
  }
  const round = toInt(opts.round, "round");
  const driverQ = opts.driver;
  if (round === undefined) throw new Error("set needs --round N");
  if (!driverQ || driverQ === true) throw new Error("set needs --driver ID");
  const drv = findDriver(season, driverQ);
  if (!drv) throw new Error(`Unknown driver "${driverQ}"`);

  const detail = season.raceDetails.find((d) => d.round === round);
  if (!detail) throw new Error(`No raceDetails for round ${round}`);
  const res = drv.results.find((r) => r.round === round);
  if (!res) throw new Error(`Driver ${drv.id} has no result for round ${round}`);

  // find the detail row (whichever array holds this driver)
  let rowKey = null;
  let row = null;
  for (const k of ["raceResults", "sprintResults", "qualifyingResults", "sprintQualifyingResults"]) {
    const arr = detail[k];
    if (!Array.isArray(arr)) continue;
    const found = arr.find((r) => r.driverId === drv.id);
    if (found) { rowKey = k; row = found; break; }
  }
  if (!row) throw new Error(`Driver ${drv.id} not found in raceDetails round ${round} (driver results exist but details don't — check file)`);

  const roundType = rowKey === "raceResults" ? "race" : rowKey === "sprintResults" ? "sprint" : "qualifying";
  const newPos = opts.pos !== undefined ? toInt(opts.pos, "pos") : undefined;
  let newPts = opts.points !== undefined ? toInt(opts.points, "points") : undefined;
  const gridRaw = opts.grid !== undefined ? toInt(opts.grid, "grid") : undefined;

  let statusRaw = opts.status;
  let newStatus = undefined; // undefined = leave, null = clear, string = set
  if (statusRaw !== undefined) {
    const s = String(statusRaw).toUpperCase();
    if (["OK", "NONE", "CLEAR", "FINISHED", "-"].includes(s)) newStatus = null;
    else if (["DNF", "DNS", "DSQ"].includes(s)) newStatus = s;
    else throw new Error(`--status must be DNF|DNS|DSQ|OK (got "${statusRaw}")`);
  }

  if (newPos === undefined && newPts === undefined && newStatus === undefined && gridRaw === undefined && opts.fastest === undefined && opts["no-fastest"] === undefined) {
    throw new Error("Nothing to change — pass at least one of --pos / --points / --status / --grid / --fastest");
  }
  if (newPos !== undefined && (newPos < 1 || newPos > 40)) throw new Error(`--pos out of range (got ${newPos})`);

  // auto-recompute points from position when pos changes but points not given
  if (newPos !== undefined && newPts === undefined) {
    const isFast = opts.fastest ? true : opts["no-fastest"] ? false : !!row.setFastestLap;
    const effDriver = drv.id;
    newPts = pointsFor(roundType, newPos, isFast && effDriver === drv.id);
  }

  console.log(`Round ${round} ${drv.id}: P${res.position} ${res.points}pts${res.status ? ` [${res.status}]` : ""}  ->  ` +
    `P${newPos !== undefined ? newPos : res.position} ${newPts !== undefined ? newPts : res.points}pts` +
    `${newStatus === null ? " [clear status]" : newStatus ? ` [${newStatus}]` : res.status ? ` [${res.status}]` : ""}`);

  const ok = await confirmOrExit(opts, `Apply fix to ${path.basename(file)}?`);
  if (!ok) return;

  if (newPos !== undefined) { res.position = newPos; row.position = newPos; }
  if (newPts !== undefined) { res.points = newPts; if (row.points !== undefined) row.points = newPts; }
  if (newStatus !== undefined) {
    if (newStatus === null) { delete res.status; delete row.status; if (row.time === res.status) row.time = ""; }
    else {
      res.status = newStatus; row.status = newStatus;
      if (row.time !== undefined) row.time = newStatus;
    }
  }
  if (gridRaw !== undefined) {
    if (gridRaw === 0) { delete res.grid; row.startingGrid = null; }
    else { res.grid = gridRaw; row.startingGrid = gridRaw; }
  }
  if (opts.fastest) { res.setFastestLap = true; row.setFastestLap = true; }
  if (opts["no-fastest"]) { delete res.setFastestLap; delete row.setFastestLap; }

  if (!opts["no-recalc"]) recalcSeason(season);
  saveSeason(file, season, opts);
  console.log("Fixed. Cumulative + constructors recalculated.");
}

async function cmdRm(season, file, args, opts) {
  const round = Number(args[0] ?? opts.round);
  if (!Number.isInteger(round)) throw new Error("rm needs a round: rm <round>");
  const raceHits = season.races.filter((r) => r.round === round);
  const detHit = season.raceDetails.find((d) => d.round === round);
  if (!raceHits.length && !detHit) throw new Error(`Round ${round} not found.`);
  console.log(`Will delete round ${round}:`);
  for (const r of raceHits) console.log(`  races[]: ${r.name} [${r.type}]`);
  if (detHit) {
    const keys = ["raceResults", "sprintResults", "qualifyingResults", "sprintQualifyingResults"].filter((k) => Array.isArray(detHit[k]));
    console.log(`  raceDetails: ${keys.join(" + ") || "(empty)"}`);
  }
  const touched = season.drivers.filter((d) => d.results.some((x) => x.round === round)).length;
  console.log(`  driver results: ${touched} drivers — cumulative + constructors will be recalculated`);

  const ok = await confirmOrExit(opts, `Delete round ${round}?`);
  if (!ok) return;
  season.races = season.races.filter((r) => r.round !== round);
  season.raceDetails = season.raceDetails.filter((d) => d.round !== round);
  for (const d of season.drivers) d.results = d.results.filter((x) => x.round !== round);
  recalcSeason(season);
  saveSeason(file, season, opts);
  console.log(`Removed round ${round}.`);
}

async function cmdRecalc(season, file, opts) {
  if (opts.help) {
    console.log(`
recalc — recompute cumulativePoints (drivers) + points (constructors) from stored points.

  --fix-points   also recompute each result's points from raceDetails positions
                 (race 25-18-… / sprint 8-7-… / quali 0, +1 fastest-lap bonus).
                 Use after hand-edits that broke the math.
`);
    return;
  }
  const fix = !!opts["fix-points"];
  // preview diff
  const before = JSON.stringify({ d: season.drivers.map((d) => [d.id, d.results.map((r) => r.cumulativePoints)]), c: season.constructors });
  recalcSeason(season, { fixPoints: fix });
  const after = JSON.stringify({ d: season.drivers.map((d) => [d.id, d.results.map((r) => r.cumulativePoints)]), c: season.constructors });
  if (before === after) {
    console.log("recalc: already consistent, nothing would change.");
    return;
  }
  console.log(`recalc: cumulative/constructors WOULD change${fix ? " (incl. --fix-points)" : ""}.`);
  const ok = await confirmOrExit(opts, "Apply recalculation?");
  if (!ok) return;
  saveSeason(file, season, opts);
}

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const { args, opts } = parseArgs(rest);

  if (!cmd || opts.help && !["add", "set", "recalc"].includes(cmd)) {
    cmdHelp();
    if (cmd && !["add", "set", "recalc", undefined].includes(cmd)) { /* fallthrough */ }
    if (!cmd) return;
    if (opts.help) return;
  }

  const mutating = ["add", "set", "rm", "remove", "delete", "recalc", "dedupe"].includes(cmd);
  const file = resolveDataPath(opts);
  if (!fs.existsSync(file)) {
    console.error(`Data file not found: ${file}  (use --year 2025|2026 or --data <path>)`);
    process.exit(2);
  }
  let season;
  try {
    season = loadSeason(file);
  } catch (e) {
    console.error(`Failed to read ${file}: ${e.message}`);
    process.exit(2);
  }

  try {
    switch (cmd) {
      case "list":
      case "ls":
        cmdList(season, opts);
        break;
      case "standings":
      case "drivers":
        cmdStandings(season, opts);
        break;
      case "show":
        cmdShow(season, args);
        break;
      case "validate":
      case "check":
        process.exitCode = cmdValidate(season) ? 0 : 1;
        break;
      case "dedupe": {
        const before = JSON.stringify(season);
        const res = cmdDedupe(season, opts);
        if (JSON.stringify(season) === before) break;
        const ok = await confirmOrExit(opts, "Apply dedupe?");
        if (!ok) break;
        saveSeason(file, season, opts);
        void res;
        break;
      }
      case "add":
        await cmdAdd(season, file, opts);
        break;
      case "set":
      case "fix":
        await cmdSet(season, file, opts);
        break;
      case "rm":
      case "remove":
      case "delete":
        await cmdRm(season, file, args, opts);
        break;
      case "recalc":
        await cmdRecalc(season, file, opts);
        break;
      case "help":
      case "--help":
      case "-h":
        cmdHelp();
        break;
      default:
        console.error(`Unknown command "${cmd}".`);
        cmdHelp();
        process.exit(2);
    }
    void mutating;
  } catch (e) {
    console.error(`Error: ${e.message}`);
    process.exit(2);
  }
}

main();
