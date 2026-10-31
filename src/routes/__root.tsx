import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { ThemeProvider } from "../lib/theme";
import { storage } from "../lib/api";

const RIDER_IDLE_TIMEOUT_MS = 30 * 60 * 1000;

function accessTokenExpiresAt(token: string | null): number | null {
  if (!token) return null;
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = JSON.parse(atob(normalized)) as { exp?: number };
    return typeof decoded.exp === "number" ? decoded.exp * 1000 : null;
  } catch {
    return null;
  }
}

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Error 404</p>
        <h1 className="mt-4 text-5xl font-extrabold tracking-tight">Lost the route.</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          That page isn&apos;t on any captain&apos;s map.
        </p>
        <Link
          to="/"
          className="mt-8 inline-flex h-12 items-center justify-center rounded-full bg-secondary px-6 text-sm font-semibold text-secondary-foreground transition-transform active:scale-95"
        >
          Back home
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: unknown; reset: () => void }) {
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <p className="font-mono text-xs uppercase tracking-widest text-destructive">Something broke</p>
        <h1 className="mt-4 text-3xl font-extrabold tracking-tight">This page didn&apos;t load</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Try again, or head back to the map.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => { router.invalidate(); reset(); }}
            className="inline-flex h-11 items-center justify-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground transition-transform active:scale-95"
          >
            Try again
          </button>
          <a href="/" className="inline-flex h-11 items-center justify-center rounded-full border border-border px-5 text-sm font-semibold">
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "RIDEHER — Safe Rides. Her Way." },
      { name: "description", content: "Bike & auto ride booking powered by community-verified smart routes. Exclusive for women." },
      { name: "author", content: "RIDEHER" },
      { name: "theme-color", content: "#EC4899" },
      { property: "og:title", content: "RIDEHER — Safe Rides. Her Way." },
      { property: "og:description", content: "Bike & auto ride booking powered by community-verified smart routes. Exclusive for women." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "RIDEHER — Safe Rides. Her Way." },
      { name: "twitter:description", content: "Bike & auto ride booking powered by community-verified smart routes. Exclusive for women." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/6d4929b5-9801-4bfa-a622-9509b1614cd4/id-preview-cff7bfb3--c3563422-65d6-4f86-a941-cb0a025fc1db.lovable.app-1784441257079.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/6d4929b5-9801-4bfa-a622-9509b1614cd4/id-preview-cff7bfb3--c3563422-65d6-4f86-a941-cb0a025fc1db.lovable.app-1784441257079.png" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@500;600&display=swap" },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head><HeadContent /></head>
      <body>{children}<Scripts /></body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();

  useEffect(() => {
    if (!storage.getAccessToken()) return;
    let timeoutId: number | undefined;
    let expiryTimeoutId: number | undefined;
    const signOutForInactivity = () => {
      storage.clearAuth();
      router.navigate({ to: "/auth", search: { mode: "signin" }, replace: true });
    };
    const renewSessionTimer = () => {
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(signOutForInactivity, RIDER_IDLE_TIMEOUT_MS);
    };
    const activityEvents: Array<keyof WindowEventMap> = ["pointerdown", "keydown", "touchstart", "scroll"];
    activityEvents.forEach((event) => window.addEventListener(event, renewSessionTimer, { passive: true }));
    window.addEventListener("focus", renewSessionTimer);
    window.addEventListener("rh:session-expired", signOutForInactivity);

    const expiresAt = accessTokenExpiresAt(storage.getAccessToken());
    if (expiresAt !== null) {
      const remaining = expiresAt - Date.now();
      if (remaining <= 0) {
        signOutForInactivity();
      } else {
        expiryTimeoutId = window.setTimeout(signOutForInactivity, remaining);
      }
    }
    renewSessionTimer();

    return () => {
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
      if (expiryTimeoutId !== undefined) window.clearTimeout(expiryTimeoutId);
      activityEvents.forEach((event) => window.removeEventListener(event, renewSessionTimer));
      window.removeEventListener("focus", renewSessionTimer);
      window.removeEventListener("rh:session-expired", signOutForInactivity);
    };
  }, [router]);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <Outlet />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
