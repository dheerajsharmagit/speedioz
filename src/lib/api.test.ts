import { afterEach, describe, expect, it, vi } from "vitest";

const user = { id: "customer-1", role: "CUSTOMER", name: "Rider" };
function browser() {
  const values = new Map<string, string>([
    ["rh_access_token", "old"],
    ["rh_refresh_token", "refresh"],
    ["rh_user", JSON.stringify(user)],
  ]);
  vi.stubGlobal("window", new EventTarget());
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  });
}
afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});
describe("API authentication", () => {
  it("sends only a Google ID credential to the customer-only endpoint", async () => {
    browser();
    const fetcher = vi.fn(async () =>
      Response.json({ user, tokens: { accessToken: "new", refreshToken: "next" } }),
    );
    vi.stubGlobal("fetch", fetcher);
    const { authApi } = await import("./api");
    await authApi.loginGoogle("google-id-credential");
    expect(fetcher).toHaveBeenCalledOnce();
    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toMatch(/\/auth\/signup\/google$/);
    expect(JSON.parse(init.body as string)).toEqual({ credential: "google-id-credential" });
  });
  it("does not retry invalid Google credentials through other auth endpoints", async () => {
    browser();
    const fetcher = vi.fn(async () =>
      Response.json(
        { code: "GOOGLE_AUTH_FAILED", message: "Invalid Google credential" },
        { status: 401 },
      ),
    );
    vi.stubGlobal("fetch", fetcher);
    const { authApi, storage } = await import("./api");
    storage.clearAuth();
    await expect(authApi.loginGoogle("invalid-token")).rejects.toMatchObject({ status: 401 });
    expect(fetcher).toHaveBeenCalledOnce();
  });
  it("uses the signed-in customer's bearer token to explicitly connect Google", async () => {
    browser();
    const fetcher = vi.fn(async () => Response.json({ data: { linked: true } }));
    vi.stubGlobal("fetch", fetcher);
    const { authApi } = await import("./api");
    await authApi.linkGoogle("verified-google-id");
    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toMatch(/\/auth\/google\/link$/);
    expect(new Headers(init.headers).get("Authorization")).toBe("Bearer old");
    expect(JSON.parse(init.body as string)).toEqual({ credential: "verified-google-id" });
  });
  it("rejects every concurrent request when shared refresh fails", async () => {
    browser();
    let finish!: (response: Response) => void;
    const refresh = new Promise<Response>((resolve) => {
      finish = resolve;
    });
    const fetcher = vi.fn((url: string) =>
      url.endsWith("/auth/refresh")
        ? refresh
        : Promise.resolve(new Response("{}", { status: 401 })),
    );
    vi.stubGlobal("fetch", fetcher);
    const { api, storage } = await import("./api");
    const result = Promise.allSettled([api("/one"), api("/two")]);
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(3));
    finish(new Response("{}", { status: 401 }));
    expect((await result).map((r) => r.status)).toEqual(["rejected", "rejected"]);
    expect(storage.getAccessToken()).toBeNull();
  });
  it("shares one successful refresh and retries both requests", async () => {
    browser();
    const fetcher = vi.fn(async (url: string, init: RequestInit) => {
      if (url.endsWith("/auth/refresh"))
        return Response.json({ user, tokens: { accessToken: "new", refreshToken: "next" } });
      return new Headers(init.headers).get("Authorization") === "Bearer new"
        ? Response.json({ ok: true })
        : new Response("{}", { status: 401 });
    });
    vi.stubGlobal("fetch", fetcher);
    const { api } = await import("./api");
    expect(await Promise.all([api("/one"), api("/two")])).toEqual([{ ok: true }, { ok: true }]);
    expect(fetcher.mock.calls.filter(([url]) => url.endsWith("/auth/refresh"))).toHaveLength(1);
  });
  it("ignores malformed cached profiles", async () => {
    browser();
    localStorage.setItem("rh_user", "broken-json");
    const { storage } = await import("./api");
    expect(storage.getUser()).toBeNull();
  });
});
