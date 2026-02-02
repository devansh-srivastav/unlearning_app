import { NextRequest, NextResponse } from "next/server";

type JsonBinV3Response = {
  record?: {
    api_url?: string;
  };
};

declare global {
  // eslint-disable-next-line no-var
  var __unlearnCanvasApiUrlCache:
    | {
        value: string | null;
        fetchedAtMs: number;
        inFlight: Promise<string> | null;
        lastAttemptAtMs: number;
      }
    | undefined;
}

function getCache() {
  if (!globalThis.__unlearnCanvasApiUrlCache) {
    globalThis.__unlearnCanvasApiUrlCache = {
      value: null,
      fetchedAtMs: 0,
      inFlight: null,
      lastAttemptAtMs: 0,
    };
  }
  return globalThis.__unlearnCanvasApiUrlCache;
}

const TTL_MS = 10 * 60_000; // 10 minutes: reuse across all clients
const MIN_JSONBIN_CALL_INTERVAL_MS = 30_000; // protect JSONBin from bursts

function normalizeUrl(url: string) {
  return url.trim().replace(/\/$/, "");
}

async function fetchFromJsonBin(binId: string, masterKey: string): Promise<string> {
  const res = await fetch(`https://api.jsonbin.io/v3/b/${binId}/latest`, {
    headers: { "X-Master-Key": masterKey },
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`JSONBIN_FETCH_FAILED:${res.status}:${text}`);
  }

  const data = (await res.json()) as JsonBinV3Response;
  const apiUrl = data?.record?.api_url;
  if (!apiUrl || typeof apiUrl !== "string") {
    throw new Error("JSONBIN_API_URL_MISSING");
  }
  return normalizeUrl(apiUrl);
}

export async function GET(req: NextRequest) {
  const binId = process.env.JSONBIN_BIN_ID;
  const masterKey = process.env.JSONBIN_MASTER_KEY;

  if (!binId || !masterKey) {
    return NextResponse.json(
      {
        error:
          "JSONBin is not configured. Set JSONBIN_BIN_ID and JSONBIN_MASTER_KEY.",
      },
      { status: 500 },
    );
  }

  const cache = getCache();
  const now = Date.now();
  const force = req.nextUrl.searchParams.get("force") === "1";

  // Serve cached value if still fresh and not forcing refresh
  if (!force && cache.value && now - cache.fetchedAtMs < TTL_MS) {
    return NextResponse.json({ api_url: cache.value });
  }

  // Deduplicate concurrent refreshes
  if (cache.inFlight) {
    try {
      const url = await cache.inFlight;
      return NextResponse.json({ api_url: url });
    } catch (e: any) {
      return NextResponse.json({ error: e?.message || "Failed to refresh api_url" }, { status: 502 });
    }
  }

  // Rate-limit JSONBin calls even if many clients force refresh at once
  const canAttempt =
    force || now - cache.lastAttemptAtMs > MIN_JSONBIN_CALL_INTERVAL_MS;
  if (!canAttempt && cache.value) {
    return NextResponse.json({ api_url: cache.value });
  }

  cache.lastAttemptAtMs = now;
  cache.inFlight = fetchFromJsonBin(binId, masterKey)
    .then((url) => {
      cache.value = url;
      cache.fetchedAtMs = Date.now();
      return url;
    })
    .finally(() => {
      cache.inFlight = null;
    });

  try {
    const url = await cache.inFlight;
    return NextResponse.json({ api_url: url });
  } catch (e: any) {
    // If refresh failed but we have an older value, keep serving it
    if (cache.value) {
      return NextResponse.json({ api_url: cache.value });
    }
    return NextResponse.json(
      { error: e?.message || "Failed to resolve api_url" },
      { status: 502 },
    );
  }
}

