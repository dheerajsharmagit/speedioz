import { createFileRoute } from "@tanstack/react-router";
import { RequireRole } from "@/components/rc/RequireRole";
import { RoleNav } from "@/components/rc/RoleNav";
export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin — RIDEHER" }] }),
  component: () => (
    <RequireRole role="ADMIN">
      <AdminPage />
    </RequireRole>
  ),
});
function AdminPage() {
  return (
    <main className="mx-auto flex max-w-4xl flex-col p-8">
      <h1 className="text-3xl font-bold">Operations</h1>
      <section className="mt-6 rounded-2xl border p-6">
        <h2 className="text-lg font-semibold">Live operations unavailable</h2>
        <p className="mt-2 text-muted-foreground">
          Bookings, metrics, captain approvals, and route moderation will appear when the operations
          service is connected.
        </p>
      </section>
      <RoleNav />
    </main>
  );
}
