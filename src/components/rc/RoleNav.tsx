import { Link, useRouterState } from "@tanstack/react-router";

const roles = [
  { to: "/", label: "Home" },
  { to: "/ride", label: "Customer" },
  { to: "/captain", label: "Captain" },
  { to: "/admin", label: "Admin" },
  { to: "/routes", label: "Community" },
] as const;

export function RoleNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2">
      <div className="flex items-center gap-1 rounded-full border border-border bg-card/90 p-1 shadow-xl backdrop-blur">
        {roles.map((r) => {
          const active = pathname === r.to;
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
