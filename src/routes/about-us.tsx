import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/legal/LegalPage";
import { legalHead } from "@/lib/legal";

export const Route = createFileRoute("/about-us")({
  head: () => legalHead("about-us", "customer"),
  component: () => <LegalPage slug="about-us" audience="customer" />,
});
