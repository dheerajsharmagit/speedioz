import { afterEach, describe, expect, it, vi } from "vitest";

function browser() {
  const scripts = new Map<string, any>();
  const append = vi.fn((node: any) => scripts.set(node.id, node));
  const google: any = { maps: { existing: true } };
  vi.stubGlobal("window", { google });
  vi.stubGlobal("document", {
    getElementById: (id: string) => scripts.get(id),
    createElement: () =>
      Object.assign(new EventTarget(), {
        id: "",
        src: "",
        remove() {
          scripts.delete(this.id);
        },
      }),
    head: { appendChild: append },
  });
  return { scripts, append, google, sdk: { initialize: vi.fn(), renderButton: vi.fn() } };
}
afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
  vi.useRealTimers();
});

describe("Google Identity browser loader", () => {
  it("stays browser-only during server rendering", async () => {
    const { loadGoogleIdentity } = await import("./google-identity");
    await expect(loadGoogleIdentity()).rejects.toThrow(/browser/);
  });
  it("shares a single script request and preserves the existing Maps namespace", async () => {
    const state = browser();
    const { loadGoogleIdentity } = await import("./google-identity");
    const first = loadGoogleIdentity(),
      second = loadGoogleIdentity();
    expect(first).toBe(second);
    expect(state.append).toHaveBeenCalledOnce();
    state.google.accounts = { id: state.sdk };
    state.scripts.get("rideher-google-identity").dispatchEvent(new Event("load"));
    expect(await first).toBe(state.sdk);
    expect(state.google.maps).toEqual({ existing: true });
    expect(await loadGoogleIdentity()).toBe(state.sdk);
    expect(state.append).toHaveBeenCalledOnce();
  });
  it("can retry after a network error instead of caching a failed script forever", async () => {
    const state = browser();
    const { loadGoogleIdentity } = await import("./google-identity");
    const failed = loadGoogleIdentity();
    const failure = expect(failed).rejects.toThrow(/could not load/);
    state.scripts.get("rideher-google-identity").dispatchEvent(new Event("error"));
    await failure;
    const retry = loadGoogleIdentity();
    state.google.accounts = { id: state.sdk };
    state.scripts.get("rideher-google-identity").dispatchEvent(new Event("load"));
    expect(await retry).toBe(state.sdk);
    expect(state.append).toHaveBeenCalledTimes(2);
  });
  it("ends a stalled load and allows a later retry", async () => {
    vi.useFakeTimers();
    const state = browser();
    const { loadGoogleIdentity } = await import("./google-identity");
    const failed = loadGoogleIdentity();
    const failure = expect(failed).rejects.toThrow(/could not load/);
    await vi.advanceTimersByTimeAsync(15000);
    await failure;
    expect(state.scripts.size).toBe(0);
  });
});
