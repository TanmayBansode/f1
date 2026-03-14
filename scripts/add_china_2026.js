const fs = require("fs");
const path = require("path");

const DRIVER_CODE = {
  "George Russell": "RUS", "Kimi Antonelli": "ANT", "Lando Norris": "NOR",
  "Lewis Hamilton": "HAM", "Oscar Piastri": "PIA", "Charles Leclerc": "LEC",
  "Pierre Gasly": "GAS", "Max Verstappen": "VER", "Oliver Bearman": "BEA",
  "Isack Hadjar": "HAD", "Nico Hulkenberg": "HUL", "Esteban Ocon": "OCO",
  "Liam Lawson": "LAW", "Gabriel Bortoleto": "BOR", "Arvid Lindblad": "LIN",
  "Franco Colapinto": "COL", "Carlos Sainz": "SAI", "Fernando Alonso": "ALO",
  "Lance Stroll": "STR", "Valtteri Bottas": "BOT", "Sergio Perez": "PER",
  "Alexander Albon": "ALB",
};

const TEAM_NORM = {
  "Mercedes": "Mercedes",
  "McLaren": "McLaren",
  "Ferrari": "Ferrari",
  "Red Bull Racing": "Red Bull Racing",
  "Alpine": "Alpine",
  "Haas F1 Team": "Haas",
  "Audi": "Sauber",
  "Racing Bulls": "Racing Bulls",
  "Williams": "Williams",
  "Aston Martin": "Aston Martin",
  "Cadillac": "Cadillac",
};

const raw = fs.readFileSync(path.join(__dirname, "..", "dataset", "new.txt"), "utf8");

// Split into 3 sections
const sections = raw.split(/Sprint\s*:\s*\n|race qualifying\s*:\s*\n/i);

function parseQualSection(text) {
  // Format: Pos\tNo\tDriver\tTeam\tTime with multi-line driver entries
  const lines = text.trim().split("\n").filter(l => l.trim());
  // Skip header
  const results = [];
  let i = 0;
  if (lines[i] && lines[i].startsWith("Pos.")) i++;

  while (i < lines.length) {
    const firstLine = lines[i].trim();
    // Check if line starts with a number (position)
    const posMatch = firstLine.match(/^(\d+)\t(\d+)/);
    if (!posMatch) { i++; continue; }

    const position = Number(posMatch[1]);
    const driverNo = Number(posMatch[2]);

    // Next non-empty line is driver name
    i++;
    while (i < lines.length && !lines[i].trim()) i++;
    const driverName = lines[i]?.trim();
    i++;

    // Next non-empty line is team + time
    while (i < lines.length && !lines[i].trim()) i++;
    const teamLine = lines[i]?.trim() || "";
    i++;

    // Parse team and time - tab separated
    const parts = teamLine.split("\t");
    const team = parts[0];
    const time = parts[1] || null;

    results.push({
      position,
      driverNumber: driverNo,
      driverId: DRIVER_CODE[driverName] || driverName.substring(0,3).toUpperCase(),
      driver: driverName,
      team: TEAM_NORM[team] || team,
      time,
    });
  }
  return results;
}

function parseSprintSection(text) {
  const lines = text.trim().split("\n").filter(l => l.trim());
  const results = [];
  let i = 0;
  if (lines[i] && lines[i].startsWith("Pos.")) i++;

  while (i < lines.length) {
    const firstLine = lines[i].trim();
    const posMatch = firstLine.match(/^(NC|\d+)\t(\d+)/);
    if (!posMatch) { i++; continue; }

    const posStr = posMatch[1];
    const driverNo = Number(posMatch[2]);

    // Driver name
    i++;
    while (i < lines.length && !lines[i].trim()) i++;
    const driverName = lines[i]?.trim();
    i++;

    // Team + laps + time + pts
    while (i < lines.length && !lines[i].trim()) i++;
    const teamLine = lines[i]?.trim() || "";
    i++;

    const parts = teamLine.split("\t");
    const team = parts[0];
    const laps = Number(parts[1]) || 0;
    const timeRet = (parts[2] || "").replace(/s$/, "");
    const points = Number(parts[3]) || 0;

    const isDNF = posStr === "NC";

    results.push({
      posStr,
      isDNF,
      driverNumber: driverNo,
      driverId: DRIVER_CODE[driverName] || driverName.substring(0,3).toUpperCase(),
      driver: driverName,
      team: TEAM_NORM[team] || team,
      laps,
      time: timeRet,
      points,
    });
  }
  return results;
}

// Parse all 3 sections
const sprintQualResults = parseQualSection(sections[0]);
const sprintResults = parseSprintSection(sections[1]);
const raceQualResults = parseQualSection(sections[2]);

console.log("Sprint Qualifying:", sprintQualResults.length, "entries");
console.log("Sprint:", sprintResults.length, "entries");
console.log("Race Qualifying:", raceQualResults.length, "entries");

// Load existing 2026.json
const dataPath = path.join(__dirname, "..", "data", "2026.json");
const data = JSON.parse(fs.readFileSync(dataPath, "utf8"));

// Current max round
const maxRound = Math.max(...data.races.map(r => r.round));
console.log("Current max round:", maxRound);

// China GP rounds: SQ (round 3), Sprint (round 4), Q (round 5)
// Race (round 6) will be added later when results come in
const sqRound = maxRound + 1;   // 3
const spRound = maxRound + 2;   // 4
const qRound = maxRound + 3;    // 5

// Add races
data.races.push(
  {
    round: sqRound,
    name: "Chinese Grand Prix Sprint Qualifying",
    shortName: "CHN-SQ",
    date: "2026-03-21",
    type: "qualifying",
    circuit: "Shanghai International Circuit",
    location: "Shanghai, China",
  },
  {
    round: spRound,
    name: "Chinese Grand Prix Sprint",
    shortName: "CHN-S",
    date: "2026-03-22",
    type: "sprint",
    circuit: "Shanghai International Circuit",
    location: "Shanghai, China",
  },
  {
    round: qRound,
    name: "Chinese Grand Prix Qualifying",
    shortName: "CHN-Q",
    date: "2026-03-22",
    type: "qualifying",
    circuit: "Shanghai International Circuit",
    location: "Shanghai, China",
  }
);

// Build raceDetails for sprint qualifying
const sqDetails = sprintQualResults.map(r => ({
  position: r.position,
  driverNumber: r.driverNumber,
  driverId: r.driverId,
  driver: r.driver,
  team: r.team,
  q1: r.time,
  q2: null,
  q3: null,
  laps: 0,
}));

// Build raceDetails for sprint
let nextDNFPos = sprintResults.filter(r => !r.isDNF).length + 1;
const spDetails = sprintResults.map(r => {
  const position = r.isDNF ? nextDNFPos++ : Number(r.posStr);
  const entry = {
    position,
    driverNumber: r.driverNumber,
    driverId: r.driverId,
    driver: r.driver,
    team: r.team,
    startingGrid: null,
    laps: r.laps,
    time: r.time,
    points: r.points,
  };
  if (r.isDNF) entry.status = "DNF";
  return entry;
});

// Build raceDetails for race qualifying
const rqDetails = raceQualResults.map(r => ({
  position: r.position,
  driverNumber: r.driverNumber,
  driverId: r.driverId,
  driver: r.driver,
  team: r.team,
  q1: r.time,
  q2: null,
  q3: null,
  laps: 0,
}));

data.raceDetails.push(
  { round: sqRound, sprintQualifyingResults: sqDetails },
  { round: spRound, sprintResults: spDetails },
  { round: qRound, qualifyingResults: rqDetails }
);

// Add driver results
for (const driver of data.drivers) {
  // Sprint qualifying result
  const sqResult = sprintQualResults.find(r => r.driverId === driver.id);
  if (sqResult) {
    driver.results.push({
      round: sqRound,
      position: sqResult.position,
      points: 0,
      cumulativePoints: driver.results.length > 0
        ? driver.results[driver.results.length - 1].cumulativePoints
        : 0,
    });
  }

  // Sprint result
  const spResult = spDetails.find(r => r.driverId === driver.id);
  if (spResult) {
    const prevCum = driver.results.length > 0
      ? driver.results[driver.results.length - 1].cumulativePoints
      : 0;
    const entry = {
      round: spRound,
      position: spResult.position,
      points: spResult.points,
      cumulativePoints: prevCum + spResult.points,
    };
    if (spResult.status) entry.status = spResult.status;
    driver.results.push(entry);
  }

  // Race qualifying result
  const rqResult = raceQualResults.find(r => r.driverId === driver.id);
  if (rqResult) {
    driver.results.push({
      round: qRound,
      position: rqResult.position,
      points: 0,
      cumulativePoints: driver.results.length > 0
        ? driver.results[driver.results.length - 1].cumulativePoints
        : 0,
    });
  }
}

// Re-sort drivers by cumulative points
data.drivers.sort((a, b) => {
  const aLast = a.results.length > 0 ? a.results[a.results.length - 1].cumulativePoints : 0;
  const bLast = b.results.length > 0 ? b.results[b.results.length - 1].cumulativePoints : 0;
  return bLast - aLast;
});

// Rebuild constructors
const teamPoints = {};
for (const d of data.drivers) {
  const last = d.results.length > 0 ? d.results[d.results.length - 1].cumulativePoints : 0;
  if (!teamPoints[d.teamId]) teamPoints[d.teamId] = { name: d.team, id: d.teamId, color: d.teamColor, points: 0 };
  teamPoints[d.teamId].points += last;
}
data.constructors = Object.values(teamPoints).sort((a, b) => b.points - a.points);

fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
console.log("Updated 2026.json with China GP data");
console.log("Rounds:", data.races.map(r => "R" + r.round + " " + r.shortName).join(", "));
