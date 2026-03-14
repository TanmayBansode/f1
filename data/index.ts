import season2026 from "./2026.json";
import type { SeasonData, SeasonManifest } from "@/lib/types";

const AVAILABLE_YEARS = [2026, 2025];
const DEFAULT_YEAR = 2026;

const seasonCache: Record<number, SeasonData> = {
  2026: season2026 as unknown as SeasonData,
};

const seasonLoaders: Record<number, () => Promise<SeasonData>> = {
  2025: () =>
    import("./2025.json").then((m) => m.default as unknown as SeasonData),
};

export async function loadSeason(year: number): Promise<SeasonData> {
  if (seasonCache[year]) return seasonCache[year];
  const loader = seasonLoaders[year];
  if (!loader) throw new Error(`No data for season ${year}`);
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
