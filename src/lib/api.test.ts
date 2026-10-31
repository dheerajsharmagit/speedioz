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
