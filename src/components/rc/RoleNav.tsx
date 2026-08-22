import { Link, useRouterState } from "@tanstack/react-router";
import { storage, authApi } from "@/lib/api";
import { useState, useEffect } from "react";

export function RoleNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [user, setUser] = useState(storage.getUser());

  useEffect(() => {
    // Basic sync
    const interval = setInterval(() => {
      setUser(storage.getUser());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const roles = [
    { to: "/", label: "Home" },
    { to: "/ride", label: "Ride" },
    { to: "/profile", label: "Profile" },
    { to: "/routes", label: "Community" },
    { to: "/settings", label: "Settings" },
    user ? { to: "#logout", label: "Logout", onClick: async () => { await authApi.logout(); window.location.href = "/"; } } : { to: "/auth", label: "Sign in" },
  ] as const;
  return (
    <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2">
      <div className="flex items-center gap-1 rounded-full border border-border bg-card/90 p-1 shadow-xl backdrop-blur">
        {roles.map((r: any) => {
          const active = pathname === r.to;
          if (r.onClick) {
            return (
              <button
                key={r.label}
                onClick={r.onClick}
                className="rounded-full px-3 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-wider transition text-muted-foreground hover:text-foreground cursor-pointer"
              >
                {r.label}
              </button>
            );
          }
          return (
            <Link
              key={r.to}
              to={r.to}
              className={`rounded-full px-3 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-wider transition ${
                active ? "bg-secondary text-secondary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {r.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
