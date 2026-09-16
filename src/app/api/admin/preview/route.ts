import { NextRequest, NextResponse } from "next/server";
import { transform, applyToJson } from "@/lib/f1-transformer";
import type { F1SeasonData, TransformOverrides } from "@/lib/f1-transformer";
import type { ScrapeResult } from "@/lib/f1-scraper";
import fs from "fs";
import path from "path";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { scrapeResult, overrides } = body as {
      scrapeResult: ScrapeResult;
      overrides: TransformOverrides;
    };

    if (!scrapeResult) {
      return NextResponse.json({ error: "scrapeResult is required" }, { status: 400 });
    }

    // Load the current 2026.json from disk (dev server has file access)
    const jsonPath = path.join(process.cwd(), "data", "2026.json");
    let currentJson: F1SeasonData;
    try {
      const raw = fs.readFileSync(jsonPath, "utf-8");
      currentJson = JSON.parse(raw);
    } catch {
      return NextResponse.json({ error: "Could not read data/2026.json from disk" }, { status: 500 });
    }

    // Run the transformation
    const result = transform(scrapeResult, currentJson, overrides || {});

    // Build a preview of the final JSON (don't save yet — user confirms first)
    const updatedJson = result.validationErrors.length === 0
      ? applyToJson(currentJson, result)
      : null;

    return NextResponse.json({
      success: true,
      validationErrors: result.validationErrors,
      warnings: result.warnings,
      raceEntry: result.raceEntry,
      raceDetailUpdate: result.raceDetailUpdate,
      driverUpdates: result.driverUpdates,
      constructorUpdates: result.constructorUpdates,
      computedPoints: result.computedPoints,
      updatedJson, // null if validation failed
      currentRoundCount: currentJson.races.length,
      newRoundNumber: result.raceEntry.round,
    });
  } catch (err) {
    console.error("Preview error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
