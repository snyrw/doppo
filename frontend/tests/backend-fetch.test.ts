import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { backendFetch, BackendFetchError } from "../app/lib/api-helpers";

// undici surfaces a dropped keep-alive socket as `TypeError: fetch failed`.
const socketError = () => new TypeError("fetch failed");
const okResponse = () => ({ ok: true, json: async () => ({}) }) as unknown as Response;

describe("backendFetch", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_URL = "https://backend.test";
    process.env.BACKEND_API_SECRET = "sekret";
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.BACKEND_API_SECRET;
  });

  it("retries once on a transient network failure when retry:true, then succeeds", async () => {
    const fetch = vi.fn().mockRejectedValueOnce(socketError()).mockResolvedValueOnce(okResponse());
    vi.stubGlobal("fetch", fetch);

    const res = await backendFetch("/api/job/x", { retry: true });

    expect(res.ok).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("does NOT retry when retry is unset (default) and throws BackendFetchError", async () => {
    const fetch = vi.fn().mockRejectedValue(socketError());
    vi.stubGlobal("fetch", fetch);

    await expect(backendFetch("/api/job/spawn-lens", { method: "POST" })).rejects.toBeInstanceOf(
      BackendFetchError
    );
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("throws BackendFetchError after exhausting the single retry", async () => {
    const fetch = vi.fn().mockRejectedValue(socketError());
    vi.stubGlobal("fetch", fetch);

    await expect(backendFetch("/api/job/x", { retry: true })).rejects.toBeInstanceOf(BackendFetchError);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("does not retry on an HTTP error status — that is a normal Response, not a network failure", async () => {
    const errResponse = { ok: false, status: 500, json: async () => ({}) } as unknown as Response;
    const fetch = vi.fn().mockResolvedValue(errResponse);
    vi.stubGlobal("fetch", fetch);

    const res = await backendFetch("/api/validate-model", { retry: true });

    expect(res.ok).toBe(false);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("attaches the bearer secret and resolves the full backend URL", async () => {
    const fetch = vi.fn().mockResolvedValue(okResponse());
    vi.stubGlobal("fetch", fetch);

    await backendFetch("/api/tokenize", { method: "POST" });

    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe("https://backend.test/api/tokenize");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer sekret");
  });
});
