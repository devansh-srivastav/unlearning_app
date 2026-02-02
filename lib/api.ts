function normalizeUrl(url: string): string {
  return url.trim().replace(/\/$/, "");
}

function getExplicitBaseUrl(): string | null {
  const explicit = process.env.NEXT_PUBLIC_API_BASE_URL;
  return explicit && explicit.trim() ? normalizeUrl(explicit) : null;
}

async function getApiBaseUrl(opts?: { forceRefresh?: boolean }): Promise<string> {
  const explicit = getExplicitBaseUrl();
  if (explicit) return explicit;

  const qs = opts?.forceRefresh ? "?force=1" : "";
  const res = await fetch(`/api/api-url${qs}`, { cache: "no-store" });
  if (!res.ok) throw new Error("API_UNAVAILABLE");
  const data = (await res.json()) as { api_url?: string };
  if (!data.api_url) throw new Error("API_UNAVAILABLE");
  return normalizeUrl(data.api_url);
}

async function fetchApi(path: string, init?: RequestInit): Promise<Response> {
  const tryOnce = async (forceRefresh: boolean) => {
    const base = await getApiBaseUrl({ forceRefresh });
    return await fetch(`${base}${path}`, init);
  };

  // Silent retries. Only fail after multiple attempts.
  const MAX_ATTEMPTS = 3;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const forceRefresh = attempt > 1; // refresh only after first failure
    try {
      const res = await tryOnce(forceRefresh);
      // If tunnel URL is stale, we often see 404/502/503 from the edge.
      if (res.status === 404 || res.status === 502 || res.status === 503) {
        if (attempt < MAX_ATTEMPTS) continue;
      }
      return res;
    } catch {
      if (attempt === MAX_ATTEMPTS) throw new Error("API_UNAVAILABLE");
    }
  }

  throw new Error("API_UNAVAILABLE");
}

export interface ModelInfo {
  display_name: string;
  category: string;
  raw_name: string;
}

export interface GenerateImageRequest {
  model_name: string;
  prompt: string;
  steps: number;
  cfg_text: number;
  seed: number;
  H: number;
  W: number;
  ddim_eta: number;
}

export interface GenerateImageResponse {
  image_url: string;
  prompt: string;
}

export async function getAvailableModels(): Promise<ModelInfo[]> {
  const response = await fetchApi(`/api/models`);
  if (!response.ok) {
    throw new Error('Failed to fetch models');
  }
  return response.json();
}

export async function generateImage(
  request: GenerateImageRequest
): Promise<GenerateImageResponse> {
  const response = await fetchApi(`/api/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    // Try to parse backend error, but keep it generic if unavailable
    try {
      const error = await response.json();
      throw new Error(error?.detail || 'Failed to generate image');
    } catch {
      throw new Error('Failed to generate image');
    }
  }

  return response.json();
}
