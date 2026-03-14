export interface Race {
  round: number;
  name: string;
  shortName: string;
  date: string;
  type: "race" | "sprint" | "qualifying";
  circuit?: string;
  location?: string;
}

export interface RaceResult {
  round: number;
  position: number | null;
  points: number;
  cumulativePoints: number;
  status?: string;
}

export interface Driver {
  id: string;
  name: string;
  team: string;
  teamId: string;
  teamColor: string;
  number: number;
  photo?: string;
  results: RaceResult[];
}

export interface TeamMeta {
  id: string;
  name: string;
  color: string;
  abbr: string;
  logo: string;
}

export interface DriverReplacement {
  out: string;
  in: string;
  atRound: number;
}

export interface SeasonData {
  year: number;
  races: Race[];
  drivers: Driver[];
  teams?: TeamMeta[];
  driverReplacements?: DriverReplacement[];
}

export interface SeasonManifest {
  years: number[];
  defaultYear: number;
}

export type DisplayState = "racing" | "dnf" | "dsq" | "bench" | "dns";

export interface HoverInfo {
  driverId: string;
  driverName: string;
  team: string;
  round: number;
  raceName: string;
  raceType: "race" | "sprint" | "qualifying";
  position: number | null;
  displayState: DisplayState;
  points: number;
  cumulativePoints: number;
  x: number;
  y: number;
}

export type NodeDisplayMode = "photo" | "code" | "dot";

export type RaceType = "race" | "sprint" | "qualifying";

export type RaceTypeFilter = Set<RaceType>;

export interface EventHoverInfo {
  round: number;
  name: string;
  type: "race" | "sprint" | "qualifying";
  date: string;
  circuit?: string;
  location?: string;
  x: number;
  y: number;
}
