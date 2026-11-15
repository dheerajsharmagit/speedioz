import { describe, expect, it } from "vitest";
import { googleSignInHeaders } from "./google-headers";

describe("Google popup response policy", () => {
  it("allows popup communication on customer sign-in and linking HTML without losing existing headers", async () => {
    for (const page of ["auth", "profile"]) {
      const response = googleSignInHeaders(
        new Request(`https://www.rideher.in/${page}`),
        new Response("<html>Sign in</html>", {
          headers: {
            "content-type": "text/html",
            "x-app-header": "keep",
            "cross-origin-opener-policy": "same-origin",
          },
        }),
      );
      expect(response.headers.get("cross-origin-opener-policy")).toBe("same-origin-allow-popups");
      expect(response.headers.get("x-app-header")).toBe("keep");
      expect(await response.text()).toBe("<html>Sign in</html>");
    }
  });
  it("leaves API and other page policies intact", () => {
    const response = new Response("{}", { headers: { "content-type": "application/json" } });
    expect(googleSignInHeaders(new Request("https://www.rideher.in/auth"), response)).toBe(
      response,
    );
    const page = new Response("Ride", {
      headers: { "content-type": "text/html", "cross-origin-opener-policy": "same-origin" },
    });
    expect(googleSignInHeaders(new Request("https://www.rideher.in/ride"), page)).toBe(page);
  });
});
