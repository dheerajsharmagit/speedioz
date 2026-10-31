import { afterEach, expect, it, vi } from "vitest";
import { proxy } from "./backend-proxy.server";
afterEach(() => vi.unstubAllGlobals());
it("preserves booking identity and authorization through the proxy", async () => {
  const fetcher = vi.fn(async () => Response.json({ id: "ride-1" }));
  vi.stubGlobal("fetch", fetcher);
  const response = await proxy({
    request: new Request("https://app.test/api/public/rh/rides/request", {
      method: "POST",
      headers: {
        Authorization: "Bearer rider",
        "Idempotency-Key": "booking-1",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ vehicleType: "BIKE" }),
    }),
    params: { _splat: "rides/request" },
  });
  const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
  expect(url).toBe("https://api.rideher.in/api/v1/rides/request");
  expect(new Headers(init.headers).get("idempotency-key")).toBe("booking-1");
  expect(new Headers(init.headers).get("authorization")).toBe("Bearer rider");
  expect(init.body).toBe(JSON.stringify({ vehicleType: "BIKE" }));
  expect(await response.json()).toEqual({ id: "ride-1" });
});

it("forwards empty success responses without converting them to proxy errors", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(null, { status: 204 })),
  );
  const response = await proxy({
    request: new Request("https://app.test/api/public/rh/users/me/saved-places/place", {
      method: "DELETE",
    }),
    params: { _splat: "users/me/saved-places/place" },
  });
  expect(response.status).toBe(204);
  expect(await response.text()).toBe("");
  expect(response.headers.get("cache-control")).toBe("no-store");
});
