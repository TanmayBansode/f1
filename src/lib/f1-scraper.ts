// F1 HTML scraper — parses race tables from the official F1 website
// Works on both server-fetched HTML and manually pasted HTML source

import { resolveDriverId, DRIVERS } from "./f1-driver-registry";

export type ResultType = "race" | "qualifying" | "sprint" | "sprint-qualifying";

export interface RawDriverRow {
  position: number | null; // null for DNS/DNF out-of-position
  driverNumber: number | null;
  driverName: string;
  driverId: string | null; // resolved, null if unknown
  team: string;
  // Race / Sprint specific
  laps?: number;
  timeOrStatus?: string; // "1:23:06.801" | "+2.974" | "DNF" | "DNS" | "+1 lap"
  points?: number;
  fastestLap?: string | null;
  setFastestLap?: boolean;
  // Qualifying specific
  q1?: string | null;
  q2?: string | null;
  q3?: string | null;
  startingGrid?: number | null;
}

export interface ScrapeResult {
  type: ResultType;
  gpName: string;
  rows: RawDriverRow[];
  unknownDrivers: string[]; // names we couldn't resolve
  parseWarnings: string[];
}

/** Detect result type from F1 URL */
export function detectTypeFromUrl(url: string): ResultType | null {
  if (url.includes("sprint-qualifying")) return "sprint-qualifying";
  if (url.includes("sprint-result")) return "sprint";
  if (url.includes("qualifying")) return "qualifying";
  if (url.includes("race-result")) return "race";
  return null;
}

/** Extract GP name from F1 URL */
export function extractGpName(url: string): string {
  // e.g. /races/1280/china/race-result → "China"
  const match = url.match(/\/races\/\d+\/([^/]+)\//);
  if (match) {
    return match[1]
      .split("-")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  }
  return "Unknown";
}

/** Parse the F1 results table from raw HTML */
export function parseF1Html(html: string, type: ResultType, gpName: string): ScrapeResult {
  const unknownDrivers: string[] = [];
  const parseWarnings: string[] = [];

  // Extract table rows — F1 uses <tr> elements with <td> cells
  const tableMatch = html.match(/<table[^>]*>([\s\S]*?)<\/table>/gi);
  if (!tableMatch || tableMatch.length === 0) {
    return { type, gpName, rows: [], unknownDrivers: ["No table found"], parseWarnings: ["Could not find data table in HTML"] };
  }

  // Find the largest table (most likely the results table)
  const targetTable = tableMatch.reduce((a, b) => (a.length > b.length ? a : b));

  // Extract all rows
  const rowMatches = targetTable.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi) || [];

  const rows: RawDriverRow[] = [];

  for (const row of rowMatches) {
    // Skip header rows
    if (row.includes("<th") || row.includes("thead")) continue;

    const cells = extractCells(row);
    if (cells.length < 4) continue;

    // Skip rows that look like headers or section dividers
    if (cells[0].toLowerCase().includes("pos") || cells[0].toLowerCase().includes("driver")) continue;

    let parsed: RawDriverRow | null = null;

    try {
      if (type === "race" || type === "sprint") {
        parsed = parseRaceRow(cells, type);
      } else {
        parsed = parseQualifyingRow(cells);
      }
    } catch {
      parseWarnings.push(`Skipped row: ${cells.slice(0, 3).join(" | ")}`);
      continue;
    }

    if (!parsed) continue;

    // Resolve driver ID — try multiple strategies
    if (parsed.driverName) {
      const { cleanName, codeHint } = extractDriverNameAndCode(parsed.driverName);
      parsed.driverName = cleanName;

      // Strategy 1: use the 3-letter code hint directly (F1 site appends it)
      if (codeHint) {
        const byCode = resolveDriverId(codeHint.toUpperCase());
        if (byCode) {
          parsed.driverId = byCode;
        }
      }

      // Strategy 2: exact/variant name match
      if (!parsed.driverId) {
        const byName = resolveDriverId(cleanName);
        if (byName) parsed.driverId = byName;
      }

      // Strategy 3: fuzzy match — find closest driver name
      if (!parsed.driverId) {
        const fuzzy = fuzzyResolveDriver(cleanName);
        if (fuzzy) {
          parsed.driverId = fuzzy;
          parseWarnings.push(`Fuzzy matched "${cleanName}" → ${fuzzy}`);
        }
      }

      if (!parsed.driverId) {
        unknownDrivers.push(parsed.driverName);
        parseWarnings.push(`Unknown driver: "${parsed.driverName}" (code hint: ${codeHint || "none"})`);
      }
    }

    rows.push(parsed);
  }

  return { type, gpName, rows, unknownDrivers, parseWarnings };
}

/** Strip HTML tags and decode entities */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/** Extract td cell text content from a <tr> */
function extractCells(row: string): string[] {
  const tdMatches = row.match(/<td[^>]*>([\s\S]*?)<\/td>/gi) || [];
  return tdMatches.map((td) => stripHtml(td));
}

/** Parse a race or sprint row */
function parseRaceRow(cells: string[], type: ResultType): RawDriverRow | null {
  // F1 table columns for race: Pos | No | Driver | Car | Laps | Time/Retired | Pts
  // Some rows have a "fastest lap" indicator embedded
  if (cells.length < 5) return null;

  const posStr = cells[0].trim();
  const position = parsePositionNumber(posStr);

  const numStr = cells[1].trim();
  const driverNumber = parseInt(numStr) || null;

  // Driver name — column 2
  const rawDriver = cells[2].trim();
  const driverName = cleanDriverName(rawDriver);

  const team = cells[3].trim();
  const laps = parseInt(cells[4]) || 0;
  const timeOrStatus = cells[5]?.trim() || "";
  const pointsStr = cells[6]?.trim() || "0";
  const points = parseInt(pointsStr) || 0;

  // Sometimes there's a fastest lap column (column 7 or embedded)
  const fastestLap = cells[7]?.trim() || null;

  return {
    position,
    driverNumber,
    driverName,
    driverId: null,
    team,
    laps,
    timeOrStatus: normalizeTime(timeOrStatus),
    points,
    fastestLap: fastestLap || null,
    setFastestLap: false,
  };
}

/** Parse a qualifying or sprint-qualifying row */
function parseQualifyingRow(cells: string[]): RawDriverRow | null {
  // F1 qualifying columns: Pos | No | Driver | Car | Q1 | Q2 | Q3 | Laps
  // Sprint qualifying: Pos | No | Driver | Car | Q1 | Laps
  if (cells.length < 5) return null;

  const position = parsePositionNumber(cells[0].trim());
  const driverNumber = parseInt(cells[1]) || null;
  const rawDriver = cells[2].trim();
  const driverName = cleanDriverName(rawDriver);
  const team = cells[3].trim();

  const isSprintQual = cells.length <= 6;

  if (isSprintQual) {
    const q1 = normalizeTime(cells[4]?.trim() || "") || null;
    const laps = parseInt(cells[5]) || 0;
    return { position, driverNumber, driverName, driverId: null, team, q1, q2: null, q3: null, laps };
  } else {
    const q1 = normalizeTime(cells[4]?.trim() || "") || null;
    const q2 = normalizeTime(cells[5]?.trim() || "") || null;
    const q3 = normalizeTime(cells[6]?.trim() || "") || null;
    const laps = parseInt(cells[7]) || 0;
    return { position, driverNumber, driverName, driverId: null, team, q1, q2, q3, laps };
  }
}

function parsePositionNumber(str: string): number | null {
  const n = parseInt(str.replace(/[^0-9]/g, ""));
  return isNaN(n) ? null : n;
}

/**
 * The F1 website renders driver names as "First Last ABC" where ABC is the
 * official 3-letter code. Detect and split that pattern.
 * Examples:
 *   "Franco Colapinto Col" → { cleanName: "Franco Colapinto", codeHint: "COL" }
 *   "Carlos Sainz Sai"    → { cleanName: "Carlos Sainz", codeHint: "SAI" }
 *   "George Russell"      → { cleanName: "George Russell", codeHint: null }
 */
function extractDriverNameAndCode(raw: string): { cleanName: string; codeHint: string | null } {
  const parts = raw.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return { cleanName: raw.trim(), codeHint: null };

  const lastWord = parts[parts.length - 1];
  // A code hint is 2–4 letters, mixed-case or all caps, typically 3 chars
  const isCodeLike = /^[A-Za-z]{2,4}$/.test(lastWord);

  if (isCodeLike && parts.length >= 3) {
    // Strip the code from the name and title-case the remaining parts
    const nameParts = parts.slice(0, -1).map(titleCaseWord);
    return { cleanName: nameParts.join(" "), codeHint: lastWord.toUpperCase() };
  }

  // No code appended — just title-case the whole thing
  return { cleanName: parts.map(titleCaseWord).join(" "), codeHint: null };
}

function titleCaseWord(word: string): string {
  if (!word) return word;
  // If ALL CAPS and more than 2 chars, convert to title case (e.g. RUSSELL → Russell)
  if (word === word.toUpperCase() && word.length > 2) {
    return word.charAt(0) + word.slice(1).toLowerCase();
  }
  // If all lowercase and more than 2 chars, capitalize first letter (e.g. russell → Russell)
  if (word === word.toLowerCase() && word.length > 2) {
    return word.charAt(0).toUpperCase() + word.slice(1);
  }
  return word;
}

/**
 * Fuzzy driver name resolver using simple token overlap.
 * Returns the driverId of the closest matching driver, or null.
 */
function fuzzyResolveDriver(name: string): string | null {
  const normalized = name.toLowerCase().trim();
  let bestScore = 0;
  let bestId: string | null = null;

  for (const driver of DRIVERS) {
    const driverNorm = driver.name.toLowerCase();
    // Token overlap: how many space-separated tokens match
    const nameTokens = normalized.split(/\s+/);
    const driverTokens = driverNorm.split(/\s+/);
    const overlap = nameTokens.filter((t) =>
      driverTokens.some((dt) => dt.startsWith(t) || t.startsWith(dt))
    ).length;
    // Also give credit for substring containment
    const contains = driverNorm.includes(normalized) || normalized.includes(driverNorm) ? 2 : 0;
    const score = overlap + contains;

    if (score > bestScore && score >= 1) {
      bestScore = score;
      bestId = driver.id;
    }
  }

  // Only return if reasonably confident (at least one strong token match)
  return bestScore >= 2 ? bestId : null;
}

function cleanDriverName(raw: string): string {
  // Delegate to extractDriverNameAndCode for consistent handling
  return extractDriverNameAndCode(raw).cleanName;
}

function normalizeTime(t: string): string {
  if (!t || t === "–" || t === "-" || t === "—") return "";
  return t;
}
