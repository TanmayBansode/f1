// Driver registry — maps F1 website display names → internal IDs + metadata
// Also covers common name variants the F1 site uses

export interface DriverInfo {
  id: string; // 3-letter code e.g. "RUS"
  name: string; // canonical name
  number: number;
  team: string; // display name
  teamId: string;
  teamColor: string;
  photo: string;
}

export interface TeamInfo {
  id: string;
  name: string;
  color: string;
  abbr: string;
  logo: string;
}

// Canonical driver registry for 2026 season
export const DRIVERS: DriverInfo[] = [
  { id: "RUS", name: "George Russell", number: 63, team: "Mercedes", teamId: "mercedes", teamColor: "#27F4D2", photo: "/drivers/rus.png" },
  { id: "ANT", name: "Kimi Antonelli", number: 12, team: "Mercedes", teamId: "mercedes", teamColor: "#27F4D2", photo: "/drivers/ant.png" },
  { id: "LEC", name: "Charles Leclerc", number: 16, team: "Ferrari", teamId: "ferrari", teamColor: "#E8002D", photo: "/drivers/lec.png" },
  { id: "HAM", name: "Lewis Hamilton", number: 44, team: "Ferrari", teamId: "ferrari", teamColor: "#E8002D", photo: "/drivers/ham.png" },
  { id: "NOR", name: "Lando Norris", number: 1, team: "McLaren", teamId: "mclaren", teamColor: "#FF8000", photo: "/drivers/nor.png" },
  { id: "PIA", name: "Oscar Piastri", number: 81, team: "McLaren", teamId: "mclaren", teamColor: "#FF8000", photo: "/drivers/pia.png" },
  { id: "VER", name: "Max Verstappen", number: 3, team: "Red Bull Racing", teamId: "red-bull", teamColor: "#3671C6", photo: "/drivers/ver.png" },
  { id: "HAD", name: "Isack Hadjar", number: 6, team: "Red Bull Racing", teamId: "red-bull", teamColor: "#3671C6", photo: "/drivers/had.png" },
  { id: "BEA", name: "Oliver Bearman", number: 87, team: "Haas", teamId: "haas", teamColor: "#B6BABD", photo: "/drivers/bea.png" },
  { id: "OCO", name: "Esteban Ocon", number: 31, team: "Haas", teamId: "haas", teamColor: "#B6BABD", photo: "/drivers/oco.png" },
  { id: "LAW", name: "Liam Lawson", number: 30, team: "Racing Bulls", teamId: "racing-bulls", teamColor: "#6692FF", photo: "/drivers/law.png" },
  { id: "LIN", name: "Arvid Lindblad", number: 41, team: "Racing Bulls", teamId: "racing-bulls", teamColor: "#6692FF", photo: "/drivers/lin.png" },
  { id: "BOR", name: "Gabriel Bortoleto", number: 5, team: "Sauber", teamId: "sauber", teamColor: "#52E252", photo: "/drivers/bor.png" },
  { id: "HUL", name: "Nico Hulkenberg", number: 27, team: "Sauber", teamId: "sauber", teamColor: "#52E252", photo: "/drivers/hul.png" },
  { id: "GAS", name: "Pierre Gasly", number: 10, team: "Alpine", teamId: "alpine", teamColor: "#FF87BC", photo: "/drivers/gas.png" },
  { id: "COL", name: "Franco Colapinto", number: 43, team: "Alpine", teamId: "alpine", teamColor: "#FF87BC", photo: "/drivers/col.png" },
  { id: "SAI", name: "Carlos Sainz", number: 55, team: "Williams", teamId: "williams", teamColor: "#1868DB", photo: "/drivers/sai.png" },
  { id: "ALB", name: "Alexander Albon", number: 23, team: "Williams", teamId: "williams", teamColor: "#1868DB", photo: "/drivers/alb.png" },
  { id: "ALO", name: "Fernando Alonso", number: 14, team: "Aston Martin", teamId: "aston-martin", teamColor: "#229971", photo: "/drivers/alo.png" },
  { id: "STR", name: "Lance Stroll", number: 18, team: "Aston Martin", teamId: "aston-martin", teamColor: "#229971", photo: "/drivers/str.png" },
  { id: "PER", name: "Sergio Perez", number: 11, team: "Cadillac", teamId: "cadillac", teamColor: "#1D1D1B", photo: "/drivers/per.png" },
  { id: "BOT", name: "Valtteri Bottas", number: 77, team: "Cadillac", teamId: "cadillac", teamColor: "#1D1D1B", photo: "/drivers/bot.png" },
];

// All known name variants the F1 website may use → driverId
const NAME_VARIANTS: Record<string, string> = {
  // Canonical
  "George Russell": "RUS",
  "Kimi Antonelli": "ANT",
  "A. Antonelli": "ANT",
  "Charles Leclerc": "LEC",
  "Lewis Hamilton": "HAM",
  "Lando Norris": "NOR",
  "Oscar Piastri": "PIA",
  "Max Verstappen": "VER",
  "Isack Hadjar": "HAD",
  "Oliver Bearman": "BEA",
  "Esteban Ocon": "OCO",
  "Liam Lawson": "LAW",
  "Arvid Lindblad": "LIN",
  "Gabriel Bortoleto": "BOR",
  "Nico Hülkenberg": "HUL",
  "Nico Hulkenberg": "HUL",
  "Pierre Gasly": "GAS",
  "Franco Colapinto": "COL",
  "Carlos Sainz": "SAI",
  "Carlos Sainz Jr.": "SAI",
  "Carlos Sainz Jr": "SAI",
  "Alexander Albon": "ALB",
  "Fernando Alonso": "ALO",
  "Lance Stroll": "STR",
  "Sergio Pérez": "PER",
  "Sergio Perez": "PER",
  "Valtteri Bottas": "BOT",
  // Abbreviated (F1 site sometimes uses "G. Russell" etc)
  "G. Russell": "RUS",
  "K. Antonelli": "ANT",
  "C. Leclerc": "LEC",
  "L. Hamilton": "HAM",
  "L. Norris": "NOR",
  "O. Piastri": "PIA",
  "M. Verstappen": "VER",
  "I. Hadjar": "HAD",
  "O. Bearman": "BEA",
  "E. Ocon": "OCO",
  "L. Lawson": "LAW",
  "A. Lindblad": "LIN",
  "G. Bortoleto": "BOR",
  "N. Hülkenberg": "HUL",
  "N. Hulkenberg": "HUL",
  "P. Gasly": "GAS",
  "F. Colapinto": "COL",
  "C. Sainz": "SAI",
  "A. Albon": "ALB",
  "F. Alonso": "ALO",
  "L. Stroll": "STR",
  "S. Pérez": "PER",
  "S. Perez": "PER",
  "V. Bottas": "BOT",
};

export function resolveDriverId(name: string): string | null {
  const trimmed = name.trim();

  // Direct match by driverId code (e.g. "COL", "SAI", "RUS")
  const byId = DRIVERS.find((d) => d.id === trimmed.toUpperCase());
  if (byId) return byId.id;

  // Name variant map
  if (NAME_VARIANTS[trimmed]) return NAME_VARIANTS[trimmed];

  // Case-insensitive fallback
  const lower = trimmed.toLowerCase();
  const found = Object.entries(NAME_VARIANTS).find(
    ([k]) => k.toLowerCase() === lower
  );
  return found ? found[1] : null;
}

export function getDriverById(id: string): DriverInfo | undefined {
  return DRIVERS.find((d) => d.id === id);
}

export function getDriverByNumber(num: number): DriverInfo | undefined {
  return DRIVERS.find((d) => d.number === num);
}

export const TEAMS: TeamInfo[] = [
  { id: "mercedes", name: "Mercedes", color: "#27F4D2", abbr: "MER", logo: "/teams/mercedes.png" },
  { id: "ferrari", name: "Ferrari", color: "#E8002D", abbr: "FER", logo: "/teams/ferrari.png" },
  { id: "mclaren", name: "McLaren", color: "#FF8000", abbr: "MCL", logo: "/teams/mclaren.png" },
  { id: "red-bull", name: "Red Bull Racing", color: "#3671C6", abbr: "RBR", logo: "/teams/red-bull.png" },
  { id: "haas", name: "Haas", color: "#B6BABD", abbr: "HAS", logo: "/teams/haas.png" },
  { id: "racing-bulls", name: "Racing Bulls", color: "#6692FF", abbr: "RCB", logo: "/teams/racing-bulls.png" },
  { id: "sauber", name: "Audi", color: "#52E252", abbr: "SAU", logo: "/teams/audi.png" },
  { id: "alpine", name: "Alpine", color: "#FF87BC", abbr: "ALP", logo: "/teams/alpine.png" },
  { id: "williams", name: "Williams", color: "#1868DB", abbr: "WIL", logo: "/teams/williams.png" },
  { id: "cadillac", name: "Cadillac", color: "#1D1D1B", abbr: "CAD", logo: "/teams/cadillac.png" },
  { id: "aston-martin", name: "Aston Martin", color: "#229971", abbr: "AMR", logo: "/teams/aston-martin.png" },
];

// F1 points scales
export const RACE_POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
export const SPRINT_POINTS = [8, 7, 6, 5, 4, 3, 2, 1];
export const FASTEST_LAP_BONUS = 1;
