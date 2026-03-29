/**
 * MotoGP data loader — scalable for any future season.
 *
 * To add a new year:
 *   1. Drop the JSON file at data/motogp/{year}.json
 *   2. Add the year to AVAILABLE_YEARS and seasonLoaders below.
 */
import season2024 from "./2024.json";
import type { SeasonData, SeasonManifest } from "@/lib/types";

const AVAILABLE_YEARS = [2024, 2023, 2022];
const DEFAULT_YEAR = 2024;

const seasonCache: Record<number, SeasonData> = {
  2024: season2024 as unknown as SeasonData,
};

/**
 * Lazy loaders — only 2024 is bundled eagerly; 2023 / 2022 are split-loaded.
 * Add new seasons here using the same pattern.
 */
const seasonLoaders: Record<number, () => Promise<SeasonData>> = {
  2023: () => import("./2023.json").then((m) => m.default as unknown as SeasonData),
  2022: () => import("./2022.json").then((m) => m.default as unknown as SeasonData),
};

export async function loadSeason(year: number): Promise<SeasonData> {
  if (seasonCache[year]) return seasonCache[year];
  const loader = seasonLoaders[year];
  if (!loader) throw new Error(`No MotoGP data for season ${year}`);
  const data = await loader();
  seasonCache[year] = data;
  return data;
}

export function getSeasonSync(year: number): SeasonData | undefined {
  return seasonCache[year];
}

export const manifest: SeasonManifest = {
  years: AVAILABLE_YEARS,
  defaultYear: DEFAULT_YEAR,
};

export const defaultSeason: SeasonData = seasonCache[DEFAULT_YEAR];
