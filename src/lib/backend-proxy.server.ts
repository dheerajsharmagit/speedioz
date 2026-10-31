// The RIDEHER backend (api.rideher.in) does not send CORS headers, so browsers
// block direct calls from this app. We proxy them server-side instead. The
// caller's own bearer token is forwarded unchanged — the backend still performs
// all authentication and authorization; this route grants no extra access.
const UPSTREAM = "https://api.rideher.in/api/v1";

export async function proxy({
  request,
  params,
}: {
  request: Request;
  params: Record<string, string>;
}) {
  const rest = params["_splat"] ?? "";
  const url = new URL(request.url);
  const target = `${UPSTREAM}/${rest}${url.search}`;

  const headers = new Headers();
  const auth = request.headers.get("authorization");
  if (auth) headers.set("authorization", auth);
  const ct = request.headers.get("content-type");
  if (ct) headers.set("content-type", ct);
  headers.set("accept", "application/json");
  const idempotencyKey = request.headers.get("idempotency-key");
  if (idempotencyKey) headers.set("idempotency-key", idempotencyKey);

  const hasBody = request.method !== "GET" && request.method !== "HEAD";

  try {
    const upstream = await fetch(target, {
      method: request.method,
      headers,
      body: hasBody ? await request.text() : undefined,
    });
    const body = await upstream.text();
    return new Response([204, 205, 304].includes(upstream.status) ? null : body, {
      status: upstream.status,
      headers: {
        "content-type": upstream.headers.get("content-type") ?? "application/json",
        "cache-control": "no-store",
      },
    });
  } catch (e) {
    console.error("RIDEHER proxy failed", target, e);
    return new Response(
      JSON.stringify({
        code: "UPSTREAM_UNAVAILABLE",
        message: "Unable to reach the RIDEHER server. Please try again.",
        requestId: "proxy",
      }),
      { status: 502, headers: { "content-type": "application/json" } },
    );
  }
}
