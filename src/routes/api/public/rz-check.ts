// Temporary diagnostic route — deleted after the checkout check.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/rz-check")({
  server: {
    handlers: {
      GET: () =>
        new Response(
          JSON.stringify({
            configured: Boolean(
              process.env["RAZORPAY_KEY_ID"] && process.env["RAZORPAY_KEY_SECRET"],
            ),
          }),
          { headers: { "Content-Type": "application/json" } },
        ),
    },
  },
});
