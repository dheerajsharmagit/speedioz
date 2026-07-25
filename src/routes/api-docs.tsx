import { createFileRoute } from "@tanstack/react-router";
import { RoleNav } from "@/components/rc/RoleNav";
import { useEffect } from "react";

export const Route = createFileRoute("/api-docs")({
  head: () => ({
    meta: [
      { title: "API Reference — RIDEHER Backend" },
      { name: "description", content: "OpenAPI 3.1 reference for the RIDEHER backend: server functions and Lovable Cloud Data API endpoints powering rides, locations, and community routes." },
      { property: "og:title", content: "RIDEHER API Reference" },
      { property: "og:description", content: "OpenAPI spec and endpoint reference for the RIDEHER backend." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ApiDocsPage,
});

const REDOC_SRC = "https://cdn.redoc.ly/redoc/latest/bundles/redoc.standalone.js";

function ApiDocsPage() {
  useEffect(() => {
    if (document.querySelector(`script[src="${REDOC_SRC}"]`)) {
      // @ts-expect-error redoc global
      window.Redoc?.init?.("/openapi.json", { theme: { colors: { primary: { main: "#DB2777" } }, typography: { fontFamily: "inherit" } }, hideDownloadButton: false, expandResponses: "200,201", scrollYOffset: 0 }, document.getElementById("redoc-container"));
      return;
    }
    const s = document.createElement("script");
    s.src = REDOC_SRC;
    s.async = true;
    s.onload = () => {
      // @ts-expect-error redoc global
      window.Redoc?.init?.("/openapi.json", { theme: { colors: { primary: { main: "#DB2777" } }, typography: { fontFamily: "inherit" } }, hideDownloadButton: false, expandResponses: "200,201", scrollYOffset: 0 }, document.getElementById("redoc-container"));
    };
    document.body.appendChild(s);
  }, []);

  return (
    <div className="min-h-screen bg-background pb-32">
      <div className="mx-auto max-w-6xl px-6 pt-10">
        <div className="flex items-baseline justify-between gap-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Developer</p>
            <h1 className="mt-1 text-4xl font-extrabold tracking-tight">API Reference</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              The endpoints the RIDEHER frontend talks to — the <code className="font-mono text-xs">computeRoute</code> server function plus the Lovable Cloud Data API tables (<code className="font-mono text-xs">rides</code>, <code className="font-mono text-xs">ride_locations</code>, <code className="font-mono text-xs">community_routes</code>). All ride tables are RLS-scoped to the participants.
            </p>
          </div>
          <a
            href="/openapi.json"
            className="rounded-full border border-border bg-card px-4 py-2 font-mono text-[10px] uppercase tracking-widest text-foreground hover:border-primary"
            download
          >
            Download OpenAPI
          </a>
        </div>

        <div id="redoc-container" className="mt-10 rounded-2xl border border-border bg-card p-2 min-h-[600px]" />
        <noscript>
          <p className="mt-4 text-sm text-muted-foreground">
            Enable JavaScript to render the interactive reference, or fetch <a className="underline" href="/openapi.json">/openapi.json</a> directly.
          </p>
        </noscript>
      </div>
      <RoleNav />
    </div>
  );
}
