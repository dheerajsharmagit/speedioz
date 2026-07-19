import { createFileRoute } from "@tanstack/react-router";
import { RoleNav } from "@/components/rc/RoleNav";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin — RideConnect AI" },
      { name: "description", content: "Fleet, bookings, and community route moderation dashboard." },
    ],
  }),
  component: AdminPage,
});

const bookings = [
  { id: "#RC-48291", cust: "Anita R.", cap: "Rahul S.", route: "HSR → Koramangala", fare: "₹68", status: "Completed", community: true },
  { id: "#RC-48290", cust: "Vikram S.", cap: "Priya M.", route: "Airport → Whitefield", fare: "₹412", status: "In progress" },
  { id: "#RC-48289", cust: "Deepa K.", cap: "Anil K.", route: "MG Road → BTM", fare: "₹95", status: "Completed", community: true },
  { id: "#RC-48288", cust: "Rohan P.", cap: "—", route: "Hebbal → Yeshwanthpur", fare: "₹120", status: "Cancelled" },
];

const pendingRoutes = [
  { name: "MG Rd → Cubbon Park via Kasturba", captain: "Rahul S.", trips: 8, target: 10, saved: "6 min" },
  { name: "Silk Board → HSR via service road", captain: "Priya M.", trips: 9, target: 10, saved: "11 min" },
  { name: "Airport → Hebbal via Trumpet exit B", captain: "Anil K.", trips: 4, target: 10, saved: "4 min" },
];

function AdminPage() {
  return (
    <div className="min-h-screen bg-background pb-24 text-foreground">
      <RoleNav />
      <div className="mx-auto max-w-6xl px-6 pt-8">
        <header className="pb-8">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Operations</p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight md:text-4xl">Bangalore · Live</h1>
        </header>

        <div className="grid gap-4 md:grid-cols-4">
          <Kpi label="Bookings today" value="18,402" delta="+12%" />
          <Kpi label="Revenue" value="₹8.4L" delta="+9%" />
          <Kpi label="Online captains" value="3,214 / 4,102" delta="78%" />
          <Kpi label="Cancellation" value="2.1%" delta="-0.4%" positive />
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-[2fr_1fr]">
          <section className="rounded-3xl border border-border bg-card p-6">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-lg font-extrabold">Recent bookings</h2>
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Last 15 minutes</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    <th className="pb-3 font-medium">ID</th>
                    <th className="pb-3 font-medium">Customer</th>
                    <th className="pb-3 font-medium">Captain</th>
                    <th className="pb-3 font-medium">Route</th>
                    <th className="pb-3 font-medium">Fare</th>
                    <th className="pb-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {bookings.map((b) => (
                    <tr key={b.id} className="text-xs">
                      <td className="py-3 font-mono">{b.id}</td>
                      <td className="py-3 font-semibold">{b.cust}</td>
                      <td className="py-3">{b.cap}</td>
                      <td className="py-3 text-muted-foreground">
                        {b.route}
                        {b.community && (
                          <span className="ml-2 rounded bg-primary/30 px-1.5 py-0.5 font-mono text-[9px] font-bold text-secondary">
                            COMM
                          </span>
                        )}
                      </td>
                      <td className="py-3 font-semibold">{b.fare}</td>
                      <td className="py-3">
                        <span
                          className={`rounded-full px-2 py-1 font-mono text-[9px] font-bold uppercase ${
                            b.status === "Completed"
                              ? "bg-accent/15 text-accent"
                              : b.status === "In progress"
                              ? "bg-primary/30 text-secondary"
                              : "bg-destructive/15 text-destructive"
                          }`}
                        >
                          {b.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-3xl border border-border bg-card p-6">
            <h2 className="mb-1 text-lg font-extrabold">Pending routes</h2>
            <p className="mb-6 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Awaiting verification</p>
            <div className="space-y-4">
              {pendingRoutes.map((r) => (
                <div key={r.name} className="rounded-2xl border border-border p-4">
                  <p className="text-sm font-semibold">{r.name}</p>
                  <p className="mt-1 font-mono text-[10px] uppercase text-muted-foreground">by {r.captain} · saves {r.saved}</p>
                  <div className="mt-3">
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div className="h-full bg-primary" style={{ width: `${(r.trips / r.target) * 100}%` }} />
                    </div>
                    <p className="mt-1 font-mono text-[10px] uppercase text-muted-foreground">{r.trips}/{r.target} successful trips</p>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button className="flex-1 rounded-full bg-secondary py-2 text-xs font-bold text-secondary-foreground">Approve</button>
                    <button className="flex-1 rounded-full border border-border py-2 text-xs font-bold">Reject</button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value, delta, positive }: { label: string; value: string; delta: string; positive?: boolean }) {
  const isDown = delta.startsWith("-");
  const good = positive ? true : !isDown;
  return (
    <div className="rounded-3xl border border-border bg-card p-6">
      <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="mt-3 text-3xl font-extrabold">{value}</p>
      <p className={`mt-1 text-xs font-semibold ${good ? "text-accent" : "text-destructive"}`}>{delta}</p>
    </div>
  );
}
