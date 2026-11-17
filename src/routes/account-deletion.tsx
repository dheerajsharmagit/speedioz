import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/legal/LegalPage";
import { legalHead } from "@/lib/legal";

export const Route = createFileRoute("/account-deletion")({
  head: () => legalHead("account-deletion", "customer"),
  component: () => <LegalPage slug="account-deletion" audience="customer" />,
});
