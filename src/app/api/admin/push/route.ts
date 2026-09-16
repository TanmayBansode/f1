import { NextRequest, NextResponse } from "next/server";
import { pushUpdatedJson, validateToken } from "@/lib/github-client";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { updatedJson, githubToken, commitMessage } = body as {
      updatedJson: object;
      githubToken: string;
      commitMessage: string;
    };

    if (!updatedJson) {
      return NextResponse.json({ error: "updatedJson is required" }, { status: 400 });
    }
    if (!githubToken) {
      return NextResponse.json({ error: "githubToken is required" }, { status: 400 });
    }
    if (!commitMessage) {
      return NextResponse.json({ error: "commitMessage is required" }, { status: 400 });
    }

    // Validate token first
    const tokenCheck = await validateToken(githubToken);
    if (!tokenCheck.valid) {
      return NextResponse.json(
        { error: `GitHub token invalid: ${tokenCheck.error}` },
        { status: 401 }
      );
    }

    // Push to GitHub
    const result = await pushUpdatedJson(githubToken, updatedJson, commitMessage);
    
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      commitUrl: result.commitUrl,
      commitSha: result.commitSha,
      pushedBy: tokenCheck.user,
    });
  } catch (err) {
    console.error("Push error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}

// Token validation endpoint (GET)
export async function GET(req: NextRequest) {
  const token = req.headers.get("x-github-token") || "";
  if (!token) {
    return NextResponse.json({ valid: false, error: "No token provided" });
  }
  const result = await validateToken(token);
  return NextResponse.json(result);
}
