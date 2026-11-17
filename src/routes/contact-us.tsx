import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/legal/LegalPage";
import { legalHead } from "@/lib/legal";

export const Route = createFileRoute("/contact-us")({
  head: () => legalHead("contact-us", "customer"),
  component: () => <LegalPage slug="contact-us" audience="customer" />,
});
