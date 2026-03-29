// GitHub REST API client for reading/writing the data file

const REPO_OWNER = "TanmayBansode";
const REPO_NAME = "f1";
const DATA_FILE_PATH = "data/2026.json";
const GITHUB_API_BASE = "https://api.github.com";

export interface GitHubFile {
  sha: string;
  content: string; // base64
  encoding: string;
  size: number;
}

export interface PushResult {
  success: boolean;
  commitUrl?: string;
  commitSha?: string;
  error?: string;
}

async function githubFetch(
  path: string,
  token: string,
  options: RequestInit = {}
): Promise<Response> {
  const url = `${GITHUB_API_BASE}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  return res;
}

export async function getFileSHA(token: string): Promise<{ sha: string; content: string }> {
  const res = await githubFetch(
    `/repos/${REPO_OWNER}/${REPO_NAME}/contents/${DATA_FILE_PATH}`,
    token
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`GitHub API error ${res.status}: ${err.message || res.statusText}`);
  }
  const data: GitHubFile = await res.json();
  return { sha: data.sha, content: data.content };
}

export async function pushUpdatedJson(
  token: string,
  updatedJson: object,
  commitMessage: string
): Promise<PushResult> {
  try {
    // 1. Get current SHA
    const { sha } = await getFileSHA(token);

    // 2. Encode new content to base64
    const jsonStr = JSON.stringify(updatedJson, null, 2);
    const base64Content = Buffer.from(jsonStr, "utf-8").toString("base64");

    // 3. PUT updated file
    const res = await githubFetch(
      `/repos/${REPO_OWNER}/${REPO_NAME}/contents/${DATA_FILE_PATH}`,
      token,
      {
        method: "PUT",
        body: JSON.stringify({
          message: commitMessage,
          content: base64Content,
          sha,
          committer: {
            name: "F1 Admin Panel",
            email: "admin@f1-tracker.local",
          },
        }),
      }
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return {
        success: false,
        error: `GitHub API error ${res.status}: ${err.message || res.statusText}`,
      };
    }

    const result = await res.json();
    return {
      success: true,
      commitUrl: result.commit?.html_url,
      commitSha: result.commit?.sha,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

export async function validateToken(token: string): Promise<{ valid: boolean; user?: string; error?: string }> {
  try {
    const res = await githubFetch("/user", token);
    if (!res.ok) return { valid: false, error: `Invalid token (${res.status})` };
    const data = await res.json();
    return { valid: true, user: data.login };
  } catch {
    return { valid: false, error: "Network error" };
  }
}
