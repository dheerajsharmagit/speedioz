import { createFileRoute } from "@tanstack/react-router";

import { proxy } from "@/lib/backend-proxy.server";

export const Route = createFileRoute("/api/public/rh/$")({
  server: {
    handlers: {
      GET: proxy,
      POST: proxy,
      PUT: proxy,
      PATCH: proxy,
      DELETE: proxy,
    },
  },
});
