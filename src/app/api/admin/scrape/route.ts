import { NextRequest, NextResponse } from "next/server";
import { detectTypeFromUrl, extractGpName, parseF1Html } from "@/lib/f1-scraper";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { url, pastedHtml, typeOverride } = body as {
      url?: string;
      pastedHtml?: string;
      typeOverride?: string;
    };

    if (!url && !pastedHtml) {
      return NextResponse.json({ error: "Provide either url or pastedHtml" }, { status: 400 });
    }

    // Determine result type
    const urlStr = url || "";
    const detectedType = typeOverride || (url ? detectTypeFromUrl(urlStr) : null);
    if (!detectedType) {
      return NextResponse.json(
        { error: "Could not detect result type from URL. Provide typeOverride: race | qualifying | sprint | sprint-qualifying" },
        { status: 400 }
      );
    }

    const gpName = extractGpName(urlStr) || "Unknown";
    let html = pastedHtml || "";

    // Try fetching if no HTML pasted
    if (!html && url) {
      // Strategy 1: Plain fetch (works if F1 has SSR for this page)
      try {
        html = await fetchWithPlainHttp(url);
      } catch {
        html = "";
      }

      // Strategy 2: Puppeteer headless browser
      if (!html || !html.includes("<table")) {
        try {
          html = await fetchWithPuppeteer(url);
        } catch (puppeteerErr) {
          console.error("Puppeteer failed:", puppeteerErr);
          return NextResponse.json(
            {
              error: "Failed to fetch page. The F1 website requires JavaScript rendering. Please use the 'Paste HTML' option instead.",
              needsPaste: true,
              url,
            },
            { status: 422 }
          );
        }
      }
    }

    if (!html) {
      return NextResponse.json({ error: "No HTML to parse" }, { status: 400 });
    }

    // Parse the table
    const result = parseF1Html(html, detectedType as Parameters<typeof parseF1Html>[1], gpName);

    return NextResponse.json({
      success: true,
      type: detectedType,
      gpName,
      rowCount: result.rows.length,
      unknownDrivers: result.unknownDrivers,
      parseWarnings: result.parseWarnings,
      rows: result.rows,
    });
  } catch (err) {
    console.error("Scrape error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}

async function fetchWithPlainHttp(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "en-US,en;q=0.9",
    },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

async function fetchWithPuppeteer(url: string): Promise<string> {
  // Dynamically import puppeteer to keep it out of production builds
  const puppeteer = await import("puppeteer");
  const browser = await puppeteer.default.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
    ],
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    );

    await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });

    // Wait for the results table to appear
    try {
      await page.waitForSelector("table", { timeout: 10000 });
    } catch {
      // Table may not exist, proceed anyway
    }

    const html = await page.content();
    return html;
  } finally {
    await browser.close();
  }
}
