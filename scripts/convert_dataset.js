const fs = require("fs");
const path = require("path");

// ── Shared mappings ──

const TEAM_NORM = {
  // McLaren variants
  "McLaren Mercedes": { name: "McLaren", id: "mclaren", color: "#FF8000" },
  "McLaren": { name: "McLaren", id: "mclaren", color: "#FF8000" },
  // Red Bull variants
  "Red Bull Racing Honda RBPT": { name: "Red Bull Racing", id: "red-bull", color: "#3671C6" },
  "Red Bull Racing honda RBPT": { name: "Red Bull Racing", id: "red-bull", color: "#3671C6" },
  "Red Bull Racing Red Bull Ford": { name: "Red Bull Racing", id: "red-bull", color: "#3671C6" },
  // Mercedes
  "Mercedes": { name: "Mercedes", id: "mercedes", color: "#27F4D2" },
  // Ferrari
  "Ferrari": { name: "Ferrari", id: "ferrari", color: "#E8002D" },
  // Aston Martin variants
  "Aston Martin Aramco Mercedes": { name: "Aston Martin", id: "aston-martin", color: "#229971" },
  "Aston Martin Honda": { name: "Aston Martin", id: "aston-martin", color: "#229971" },
  // Alpine variants
  "Alpine Renault": { name: "Alpine", id: "alpine", color: "#FF87BC" },
  "Alpine Mercedes": { name: "Alpine", id: "alpine", color: "#FF87BC" },
  // Williams variants
  "Williams Mercedes": { name: "Williams", id: "williams", color: "#1868DB" },
  "Williams": { name: "Williams", id: "williams", color: "#1868DB" },
  // Racing Bulls variants
  "Racing Bulls Honda RBPT": { name: "Racing Bulls", id: "racing-bulls", color: "#6692FF" },
  "Racing bulls Honda RBPT": { name: "Racing Bulls", id: "racing-bulls", color: "#6692FF" },
  "Racing Honda RBPT": { name: "Racing Bulls", id: "racing-bulls", color: "#6692FF" },
  "Racing Bulls Red Bull Ford": { name: "Racing Bulls", id: "racing-bulls", color: "#6692FF" },
  // Sauber / Audi variants
  "Kick Sauber Ferrari": { name: "Sauber", id: "sauber", color: "#52E252" },
  "Kick Sauber": { name: "Sauber", id: "sauber", color: "#52E252" },
  "Audi": { name: "Sauber", id: "sauber", color: "#52E252" },
  // Haas variants
  "Haas Ferrari": { name: "Haas", id: "haas", color: "#B6BABD" },
  "MoneyGram Haas F1 Team": { name: "Haas", id: "haas", color: "#B6BABD" },
  "Haas F1 Team": { name: "Haas", id: "haas", color: "#B6BABD" },
  // Cadillac variants
  "Cadillac F1 Team": { name: "Cadillac", id: "cadillac", color: "#1D1D1B" },
  "Cadillac Ferrari": { name: "Cadillac", id: "cadillac", color: "#1D1D1B" },
};

const DRIVER_CODE = {
  "Lando Norris": "NOR",
  "Max Verstappen": "VER",
  "Oscar Piastri": "PIA",
  "George Russell": "RUS",
  "Charles Leclerc": "LEC",
  "Lewis Hamilton": "HAM",
  "Kimi Antonelli": "ANT",
  "Carlos Sainz": "SAI",
  "Fernando Alonso": "ALO",
  "Lance Stroll": "STR",
  "Pierre Gasly": "GAS",
  "Jack Doohan": "DOO",
  "Yuki Tsunoda": "TSU",
  "Isack Hadjar": "HAD",
  "Nico Hulkenberg": "HUL",
  "Gabriel Bortoleto": "BOR",
  "Alexander Albon": "ALB",
  "Esteban Ocon": "OCO",
  "Oliver Bearman": "BEA",
  "Franco Colapinto": "COL",
  "Liam Lawson": "LAW",
  "Sergio Perez": "PER",
  "Valtteri Bottas": "BOT",
  "Arvid Lindblad": "LIN",
};

const TRACK_SHORT = {
  "Australia": "AUS",
  "China": "CHN",
  "Japan": "JPN",
  "Bahrain": "BHR",
  "Saudi Arabia": "SAU",
  "Miami": "MIA",
  "Emilia-Romagna": "EMI",
  "Monaco": "MON",
  "Spain": "ESP",
  "Canada": "CAN",
  "Austria": "AUT",
  "Great Britain": "GBR",
  "Belgium": "BEL",
  "Hungary": "HUN",
  "Netherlands": "NED",
  "Italy": "ITA",
  "Azerbaijan": "AZE",
  "Singapore": "SGP",
  "United States": "USA",
  "Mexico": "MEX",
  "Brazil": "BRA",
  "Las Vegas": "LVG",
  "Qatar": "QAT",
  "Abu Dhabi": "ABU",
};

const TRACK_FULL_NAME = {
  "Australia": "Australian Grand Prix",
  "China": "Chinese Grand Prix",
  "Japan": "Japanese Grand Prix",
  "Bahrain": "Bahrain Grand Prix",
  "Saudi Arabia": "Saudi Arabian Grand Prix",
  "Miami": "Miami Grand Prix",
  "Emilia-Romagna": "Emilia Romagna Grand Prix",
  "Monaco": "Monaco Grand Prix",
  "Spain": "Spanish Grand Prix",
  "Canada": "Canadian Grand Prix",
  "Austria": "Austrian Grand Prix",
  "Great Britain": "British Grand Prix",
  "Belgium": "Belgian Grand Prix",
  "Hungary": "Hungarian Grand Prix",
  "Netherlands": "Dutch Grand Prix",
  "Italy": "Italian Grand Prix",
  "Azerbaijan": "Azerbaijan Grand Prix",
  "Singapore": "Singapore Grand Prix",
  "United States": "United States Grand Prix",
  "Mexico": "Mexico City Grand Prix",
  "Brazil": "Brazilian Grand Prix",
  "Las Vegas": "Las Vegas Grand Prix",
  "Qatar": "Qatar Grand Prix",
  "Abu Dhabi": "Abu Dhabi Grand Prix",
};

const TRACK_CIRCUIT = {
  "Australia": { circuit: "Albert Park Circuit", location: "Melbourne, Australia" },
  "China": { circuit: "Shanghai International Circuit", location: "Shanghai, China" },
  "Japan": { circuit: "Suzuka International Racing Course", location: "Suzuka, Japan" },
  "Bahrain": { circuit: "Bahrain International Circuit", location: "Sakhir, Bahrain" },
  "Saudi Arabia": { circuit: "Jeddah Corniche Circuit", location: "Jeddah, Saudi Arabia" },
  "Miami": { circuit: "Miami International Autodrome", location: "Miami, USA" },
  "Emilia-Romagna": { circuit: "Autodromo Enzo e Dino Ferrari", location: "Imola, Italy" },
  "Monaco": { circuit: "Circuit de Monaco", location: "Monte Carlo, Monaco" },
  "Spain": { circuit: "Circuit de Barcelona-Catalunya", location: "Barcelona, Spain" },
  "Canada": { circuit: "Circuit Gilles Villeneuve", location: "Montreal, Canada" },
  "Austria": { circuit: "Red Bull Ring", location: "Spielberg, Austria" },
  "Great Britain": { circuit: "Silverstone Circuit", location: "Silverstone, United Kingdom" },
  "Belgium": { circuit: "Circuit de Spa-Francorchamps", location: "Stavelot, Belgium" },
  "Hungary": { circuit: "Hungaroring", location: "Mogyorod, Hungary" },
  "Netherlands": { circuit: "Circuit Zandvoort", location: "Zandvoort, Netherlands" },
  "Italy": { circuit: "Autodromo Nazionale Monza", location: "Monza, Italy" },
  "Azerbaijan": { circuit: "Baku City Circuit", location: "Baku, Azerbaijan" },
  "Singapore": { circuit: "Marina Bay Street Circuit", location: "Singapore" },
  "United States": { circuit: "Circuit of the Americas", location: "Austin, USA" },
  "Mexico": { circuit: "Autodromo Hermanos Rodriguez", location: "Mexico City, Mexico" },
  "Brazil": { circuit: "Autodromo Jose Carlos Pace", location: "Sao Paulo, Brazil" },
  "Las Vegas": { circuit: "Las Vegas Strip Circuit", location: "Las Vegas, USA" },
  "Qatar": { circuit: "Lusail International Circuit", location: "Lusail, Qatar" },
  "Abu Dhabi": { circuit: "Yas Marina Circuit", location: "Abu Dhabi, UAE" },
};

// Approximate 2025 race dates (Sunday for races, Saturday for sprints)
const RACE_DATES_2025 = {
  "Australia": "2025-03-16",
  "China": "2025-03-23",
  "Japan": "2025-04-06",
  "Bahrain": "2025-04-13",
  "Saudi Arabia": "2025-04-20",
  "Miami": "2025-05-04",
  "Emilia-Romagna": "2025-05-18",
  "Monaco": "2025-05-25",
  "Spain": "2025-06-01",
  "Canada": "2025-06-15",
  "Austria": "2025-06-29",
  "Great Britain": "2025-07-06",
  "Belgium": "2025-07-27",
  "Hungary": "2025-08-03",
  "Netherlands": "2025-08-31",
  "Italy": "2025-09-07",
  "Azerbaijan": "2025-09-21",
  "Singapore": "2025-10-05",
  "United States": "2025-10-19",
  "Mexico": "2025-10-26",
  "Brazil": "2025-11-09",
  "Las Vegas": "2025-11-22",
  "Qatar": "2025-11-30",
  "Abu Dhabi": "2025-12-07",
};

const SPRINT_DATES_2025 = {
  "China": "2025-03-22",
  "Miami": "2025-05-03",
  "Belgium": "2025-07-26",
  "United States": "2025-10-18",
  "Brazil": "2025-11-08",
  "Qatar": "2025-11-29",
};

const RACE_DATES_2026 = {
  "Australia": "2026-03-15",
};

// ── CSV parsing ──

function parseCSV(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  const lines = content.split("\n").filter((l) => l.trim());
  const headers = lines[0].split(",");
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(",");
    const row = {};
    headers.forEach((h, idx) => {
      row[h.trim()] = (values[idx] || "").trim();
    });
    rows.push(row);
  }
  return rows;
}

function getTeam(csvTeamName) {
  const t = TEAM_NORM[csvTeamName];
  if (!t) {
    console.warn(`Unknown team: "${csvTeamName}"`);
    return { name: csvTeamName, id: csvTeamName.toLowerCase().replace(/\s+/g, "-"), color: "#888" };
  }
  return t;
}

function getDriverCode(name) {
  const c = DRIVER_CODE[name];
  if (!c) {
    console.warn(`Unknown driver: "${name}"`);
    return name.substring(0, 3).toUpperCase();
  }
  return c;
}

// ── Build season JSON ──

function buildSeason(year, datasetDir) {
  const raceFile = path.join(datasetDir, `Formula1_${year}Season_RaceResults.csv`);
  const qualFile = path.join(datasetDir, `Formula1_${year}Season_QualifyingResults.csv`);
  const sprintFile = path.join(datasetDir, `Formula1_${year}Season_SprintResults.csv`);
  const sprintQualFile = path.join(datasetDir, `Formula1_${year}Season_SprintQualifyingResults.csv`);

  const raceData = parseCSV(raceFile);
  const qualData = fs.existsSync(qualFile) ? parseCSV(qualFile) : [];
  const sprintData = fs.existsSync(sprintFile) ? parseCSV(sprintFile) : [];
  const sprintQualData = fs.existsSync(sprintQualFile) ? parseCSV(sprintQualFile) : [];

  const raceDates = year === 2025 ? RACE_DATES_2025 : RACE_DATES_2026;
  const sprintDates = year === 2025 ? SPRINT_DATES_2025 : {};

  // Figure out race order from the race results CSV
  const raceTrackOrder = [];
  for (const row of raceData) {
    if (!raceTrackOrder.includes(row.Track)) raceTrackOrder.push(row.Track);
  }

  // Figure out sprint tracks
  const sprintTracks = [];
  for (const row of sprintData) {
    if (!sprintTracks.includes(row.Track)) sprintTracks.push(row.Track);
  }

  // Build round numbering:
  // Normal weekend: Qualifying -> Race
  // Sprint weekend: Qualifying -> Sprint Qualifying -> Sprint -> Race
  let round = 0;
  const races = [];
  const roundMap = {}; // track -> { qualRound, sprintQualRound, sprintRound, raceRound }

  // Figure out which tracks have qualifying data
  const qualTracks = [];
  for (const row of qualData) {
    if (!qualTracks.includes(row.Track)) qualTracks.push(row.Track);
  }

  // Figure out which tracks have sprint qualifying data
  const sprintQualTracks = [];
  for (const row of sprintQualData) {
    if (!sprintQualTracks.includes(row.Track)) sprintQualTracks.push(row.Track);
  }

  for (const track of raceTrackOrder) {
    if (!roundMap[track]) roundMap[track] = {};
    const ci = TRACK_CIRCUIT[track];
    const shortCode = TRACK_SHORT[track] || track.substring(0, 3).toUpperCase();
    const fullName = TRACK_FULL_NAME[track] || `${track} Grand Prix`;

    // 1. Qualifying (happens Friday or Saturday)
    if (qualTracks.includes(track)) {
      round++;
      const qualEntry = {
        round,
        name: `${fullName} Qualifying`,
        shortName: `${shortCode}-Q`,
        date: raceDates[track] ? raceDates[track].replace(/-(\d+)$/, (_, d) => `-${String(Number(d) - 1).padStart(2, "0")}`) : "",
        type: "qualifying",
      };
      if (ci) {
        qualEntry.circuit = ci.circuit;
        qualEntry.location = ci.location;
      }
      races.push(qualEntry);
      roundMap[track].qualRound = round;
    }

    // 2. Sprint Qualifying (if sprint weekend)
    if (sprintQualTracks.includes(track)) {
      round++;
      races.push({
        round,
        name: `${fullName} Sprint Qualifying`,
        shortName: `${shortCode}-SQ`,
        date: sprintDates[track] ? sprintDates[track].replace(/-(\d+)$/, (_, d) => `-${String(Number(d) - 1).padStart(2, "0")}`) : "",
        type: "qualifying",
      });
      roundMap[track].sprintQualRound = round;
    }

    // 3. Sprint (if sprint weekend, day before race)
    if (sprintTracks.includes(track)) {
      round++;
      races.push({
        round,
        name: `${fullName} Sprint`,
        shortName: `${shortCode}-S`,
        date: sprintDates[track] || (raceDates[track] ? raceDates[track].replace(/-(\d+)$/, (_, d) => `-${String(Number(d) - 1).padStart(2, "0")}`) : ""),
        type: "sprint",
      });
      roundMap[track].sprintRound = round;
    }

    // 4. Race
    round++;
    const raceEntry = {
      round,
      name: fullName,
      shortName: shortCode,
      date: raceDates[track] || "",
      type: "race",
    };
    if (ci) {
      raceEntry.circuit = ci.circuit;
      raceEntry.location = ci.location;
    }
    races.push(raceEntry);
    roundMap[track].raceRound = round;
  }

  // ── Register drivers (always update to latest team occurrence) ──
  const driverRegistry = {}; // code -> { name, number, team, teamId, teamColor }

  function registerDriver(name, number, csvTeam) {
    const code = getDriverCode(name);
    const team = getTeam(csvTeam);
    // Always update with latest info (handles mid-season team swaps)
    driverRegistry[code] = {
      id: code,
      name,
      number: Number(number),
      team: team.name,
      teamId: team.id,
      teamColor: team.color,
    };
  }

  // Register from race data first, then sprint
  for (const row of raceData) registerDriver(row.Driver, row.No, row.Team);
  for (const row of sprintData) registerDriver(row.Driver, row.No, row.Team);

  // ── Build race details and driver results ──
  const raceDetails = [];
  const driverResults = {}; // code -> [{round, position, points, status, ...}]

  // Helper to init driver results arrays
  for (const code of Object.keys(driverRegistry)) {
    driverResults[code] = [];
  }

  // Process race results
  for (const track of raceTrackOrder) {
    const rd = roundMap[track].raceRound;
    const trackRows = raceData.filter((r) => r.Track === track);

    const raceResultDetails = [];
    let nextDNFPos = trackRows.filter((r) => r.Position !== "NC" && r.Position !== "DQ").length + 1;

    for (const row of trackRows) {
      const code = getDriverCode(row.Driver);
      const isDNF = row.Position === "NC";
      const isDSQ = row.Position === "DQ";
      const position = isDNF || isDSQ ? nextDNFPos++ : Number(row.Position);
      const points = Number(row.Points) || 0;
      const grid = Number(row["Starting Grid"]) || null;
      const laps = Number(row.Laps) || 0;
      const timeRet = row["Time/Retired"] || "";
      const setFL = row["Set Fastest Lap"] === "Yes";
      const flTime = row["Fastest Lap Time"] || "";

      let status;
      if (isDSQ) status = "DSQ";
      else if (isDNF) status = timeRet || "DNF";

      const detail = {
        position,
        driverNumber: Number(row.No),
        driverId: code,
        driver: row.Driver,
        team: getTeam(row.Team).name,
        startingGrid: grid,
        laps,
        time: timeRet,
        points,
      };
      if (setFL) detail.setFastestLap = true;
      if (flTime) detail.fastestLapTime = flTime;
      if (status) detail.status = status;

      raceResultDetails.push(detail);

      // Driver result
      const dResult = {
        round: rd,
        position,
        points,
      };
      if (grid) dResult.grid = grid;
      if (flTime) dResult.fastestLapTime = flTime;
      if (setFL) dResult.setFastestLap = true;
      if (status) dResult.status = status;
      driverResults[code].push(dResult);
    }

    // Qualifying data for this track
    const qualRows = qualData.filter((r) => r.Track === track);
    const qualDetails = qualRows.map((row) => ({
      position: Number(row.Position),
      driverNumber: Number(row.No),
      driverId: getDriverCode(row.Driver),
      driver: row.Driver,
      team: getTeam(row.Team).name,
      q1: row.Q1 || null,
      q2: row.Q2 || null,
      q3: row.Q3 || null,
      laps: Number(row.Laps) || 0,
    }));

    // Add qualifying results as driver data points
    if (roundMap[track].qualRound) {
      for (const row of qualRows) {
        const code = getDriverCode(row.Driver);
        if (!driverResults[code]) continue;
        driverResults[code].push({
          round: roundMap[track].qualRound,
          position: Number(row.Position),
          points: 0,
        });
      }
    }

    const rDetail = { round: rd, raceResults: raceResultDetails };
    if (qualDetails.length > 0) rDetail.qualifyingResults = qualDetails;
    raceDetails.push(rDetail);

    // Add a separate qualifying round detail entry
    if (qualDetails.length > 0 && roundMap[track].qualRound) {
      raceDetails.push({
        round: roundMap[track].qualRound,
        qualifyingResults: qualDetails,
      });
    }
  }

  // Process sprint results
  for (const track of sprintTracks) {
    const spRound = roundMap[track].sprintRound;
    const trackRows = sprintData.filter((r) => r.Track === track);

    const sprintResultDetails = [];
    let nextDNFPos = trackRows.filter((r) => r.Position !== "NC" && r.Position !== "DQ").length + 1;

    for (const row of trackRows) {
      const code = getDriverCode(row.Driver);
      const isDNF = row.Position === "NC";
      const isDSQ = row.Position === "DQ";
      const position = isDNF || isDSQ ? nextDNFPos++ : Number(row.Position);
      const points = Number(row.Points) || 0;
      const grid = Number(row["Starting Grid"]) || null;
      const laps = Number(row.Laps) || 0;
      const timeRet = row["Time/Retired"] || "";

      let status;
      if (isDSQ) status = "DSQ";
      else if (isDNF) status = timeRet || "DNF";

      const detail = {
        position,
        driverNumber: Number(row.No),
        driverId: code,
        driver: row.Driver,
        team: getTeam(row.Team).name,
        startingGrid: grid,
        laps,
        time: timeRet,
        points,
      };
      if (status) detail.status = status;

      sprintResultDetails.push(detail);

      const dResult = {
        round: spRound,
        position,
        points,
      };
      if (status) dResult.status = status;
      driverResults[code].push(dResult);
    }

    // Sprint qualifying
    const sqRows = sprintQualData.filter((r) => r.Track === track);
    const sqDetails = sqRows.map((row) => ({
      position: Number(row.Position),
      driverNumber: Number(row.No),
      driverId: getDriverCode(row.Driver),
      driver: row.Driver,
      team: getTeam(row.Team).name,
      q1: row.Q1 || null,
      q2: row.Q2 || null,
      q3: row.Q3 || null,
      laps: Number(row.Laps) || 0,
    }));

    // Add sprint qualifying results as driver data points
    if (roundMap[track].sprintQualRound) {
      for (const row of sqRows) {
        const code = getDriverCode(row.Driver);
        if (!driverResults[code]) continue;
        driverResults[code].push({
          round: roundMap[track].sprintQualRound,
          position: Number(row.Position),
          points: 0,
        });
      }
    }

    const spDetail = { round: spRound, sprintResults: sprintResultDetails };
    if (sqDetails.length > 0) spDetail.sprintQualifyingResults = sqDetails;
    raceDetails.push(spDetail);

    // Add a separate sprint qualifying round detail entry
    if (sqDetails.length > 0 && roundMap[track].sprintQualRound) {
      raceDetails.push({
        round: roundMap[track].sprintQualRound,
        sprintQualifyingResults: sqDetails,
      });
    }
  }

  // Sort race details by round
  raceDetails.sort((a, b) => a.round - b.round);

  // ── Calculate cumulative points and sort driver results ──
  const drivers = [];
  for (const code of Object.keys(driverRegistry)) {
    const info = driverRegistry[code];
    const results = driverResults[code].sort((a, b) => a.round - b.round);

    let cumPts = 0;
    for (const r of results) {
      cumPts += r.points;
      r.cumulativePoints = cumPts;
    }

    drivers.push({
      ...info,
      results,
    });
  }

  // Sort drivers by final cumulative points (descending)
  drivers.sort((a, b) => {
    const aLast = a.results.length > 0 ? a.results[a.results.length - 1].cumulativePoints : 0;
    const bLast = b.results.length > 0 ? b.results[b.results.length - 1].cumulativePoints : 0;
    return bLast - aLast;
  });

  // ── Build constructors ──
  const teamPoints = {};
  for (const d of drivers) {
    const last = d.results.length > 0 ? d.results[d.results.length - 1].cumulativePoints : 0;
    if (!teamPoints[d.teamId]) teamPoints[d.teamId] = { name: d.team, id: d.teamId, color: d.teamColor, points: 0 };
    teamPoints[d.teamId].points += last;
  }
  const constructors = Object.values(teamPoints).sort((a, b) => b.points - a.points);

  // ── Assemble final JSON ──
  const output = {
    year,
    races,
    raceDetails,
    drivers,
    constructors,
  };

  // Add driver replacements for 2025
  if (year === 2025) {
    // Colapinto starts at Emilia-Romagna qualifying
    const colStartRound = roundMap["Emilia-Romagna"].qualRound || roundMap["Emilia-Romagna"].raceRound;
    output.driverReplacements = [
      { out: "DOO", in: "COL", atRound: colStartRound },
    ];
  }

  return output;
}

// ── Main ──

const datasetDir = path.join(__dirname, "..", "dataset");
const dataDir = path.join(__dirname, "..", "data");

// Build 2025
console.log("Building 2025 season...");
const s2025 = buildSeason(2025, datasetDir);
console.log(`  ${s2025.races.length} events, ${s2025.drivers.length} drivers`);
fs.writeFileSync(path.join(dataDir, "2025.json"), JSON.stringify(s2025, null, 2));
console.log("  Wrote data/2025.json");

// Build 2026
console.log("Building 2026 season...");
const s2026 = buildSeason(2026, datasetDir);
console.log(`  ${s2026.races.length} events, ${s2026.drivers.length} drivers`);
fs.writeFileSync(path.join(dataDir, "2026.json"), JSON.stringify(s2026, null, 2));
console.log("  Wrote data/2026.json");

console.log("Done!");
