import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/legal/LegalPage";
import { legalHead } from "@/lib/legal";

export const Route = createFileRoute("/grievance-redressal")({
  head: () => legalHead("grievance-redressal", "customer"),
  component: () => <LegalPage slug="grievance-redressal" audience="customer" />,
});
