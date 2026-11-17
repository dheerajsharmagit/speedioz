import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/legal/LegalPage";
import { legalHead } from "@/lib/legal";

export const Route = createFileRoute("/privacy-policy")({
  head: () => legalHead("privacy-policy", "customer"),
  component: () => <LegalPage slug="privacy-policy" audience="customer" />,
});
