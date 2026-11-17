import {
  legalBusiness,
  legalDocuments,
  POLICY_DATE,
  policyLinks,
  type LegalAudience,
} from "@/lib/legal";

export function PolicyLinks({ compact = false }: { compact?: boolean }) {
  const links = compact
    ? policyLinks.filter((link) =>
        [
          "/privacy-policy",
          "/terms-and-conditions",
          "/cancellation-policy",
          "/refund-policy",
          "/contact-us",
        ].includes(link.href),
      )
    : policyLinks;
  return (
    <nav
      aria-label="RideHer policies"
      className={`flex min-w-0 flex-wrap gap-x-5 gap-y-3 text-xs leading-relaxed ${compact ? "justify-center" : ""}`}
    >
      {links.map((link) => (
        <a
          key={link.href}
          href={link.href}
          className="break-words text-muted-foreground underline-offset-4 hover:text-primary hover:underline focus-visible:underline"
        >
          {link.label}
        </a>
      ))}
      <a href="/policies" className="font-semibold text-primary underline-offset-4 hover:underline">
        All policies & support
      </a>
    </nav>
  );
}

export function LegalConsent({ action = "continuing" }: { action?: string }) {
  return (
    <p className="text-xs leading-relaxed text-muted-foreground">
      By {action}, you agree to the{" "}
      <a
        href="/terms-and-conditions"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Terms & Conditions (opens in a new tab)"
        className="font-semibold text-primary underline underline-offset-2"
      >
        Terms & Conditions
      </a>{" "}
      and acknowledge the{" "}
      <a
        href="/privacy-policy"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Privacy Policy (opens in a new tab)"
        className="font-semibold text-primary underline underline-offset-2"
      >
        Privacy Policy
      </a>
      .{" "}
      <a
        href="/cancellation-policy"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Cancellation policy (opens in a new tab)"
        className="text-primary underline underline-offset-2"
      >
        Cancellation
      </a>{" "}
      and{" "}
      <a
        href="/refund-policy"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Refund policy (opens in a new tab)"
        className="text-primary underline underline-offset-2"
      >
        refund rules
      </a>{" "}
      apply to bookings and payments.
    </p>
  );
}

export function LegalPage({ slug, audience }: { slug: string; audience: LegalAudience }) {
  const documents = legalDocuments(audience);
  const page = documents.find((page) => page.slug === slug);
  const hub = slug === "policies";
  return (
    <div className="flex min-h-dvh min-w-0 flex-col bg-background text-foreground">
      <a href="#policy-content" className="sr-only focus:not-sr-only focus:p-3">
        Skip to content
      </a>
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-5 sm:px-6">
          <a href="/" className="text-lg font-extrabold tracking-tight">
            RIDE<span className="text-primary">HER</span>
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              {audience === "captain" ? "Captain" : "Ride services"}
            </span>
          </a>
          <nav
            aria-label="Policy navigation"
            className="flex flex-wrap gap-x-4 gap-y-2 text-sm font-semibold"
          >
            <a href="/policies" className="hover:text-primary">
              Policies
            </a>
            <a href="/contact-us" className="hover:text-primary">
              Contact
            </a>
            <a
              href={
                audience === "captain" ? "https://www.rideher.in" : "https://captain.rideher.in"
              }
              className="text-primary"
            >
              {audience === "captain" ? "Customer portal" : "Captain portal"}
            </a>
          </nav>
        </div>
      </header>
      <main
        id="policy-content"
        className="mx-auto w-full min-w-0 max-w-5xl flex-1 px-4 py-8 sm:px-6 sm:py-12"
      >
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">
            {legalBusiness.name} ·{" "}
            {audience === "captain" ? "Captain information" : "Customer information"}
          </p>
          <h1 className="mt-3 break-words text-3xl font-extrabold tracking-tight sm:text-4xl">
            {hub ? "Policies & support" : (page?.title ?? "Policies & support")}
          </h1>
          <p className="mt-3 text-base leading-relaxed text-muted-foreground">
            {hub
              ? "Clear information about RideHer services, payments, personal information and the standards expected on every ride."
              : page?.description}
          </p>
          <p className="mt-4 text-xs text-muted-foreground">
            Last updated: <time dateTime="2026-11-17">{POLICY_DATE}</time>
          </p>
        </div>
        {hub ? (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {documents.map((document) => (
              <a
                key={document.slug}
                href={`/${document.slug}`}
                className="min-w-0 rounded-2xl border border-border bg-card p-5 transition hover:border-primary/50 focus-visible:outline-2 focus-visible:outline-primary"
              >
                <h2 className="text-lg font-bold">
                  {document.title}
                  <span aria-hidden="true" className="ml-2 text-primary">
                    ↗
                  </span>
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {document.description}
                </p>
              </a>
            ))}
          </div>
        ) : (
          page && (
            <div className="mt-8 grid min-w-0 items-start gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
              <nav
                aria-label="On this page"
                className="min-w-0 rounded-2xl border border-border bg-card p-4"
              >
                <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  On this page
                </h2>
                <ol className="mt-3 space-y-2 text-sm">
                  {page.sections.map((section, index) => (
                    <li key={section.title}>
                      <a
                        href={`#section-${index + 1}`}
                        className="block break-words rounded-md py-1 text-muted-foreground hover:text-primary"
                      >
                        {index + 1}. {section.title}
                      </a>
                    </li>
                  ))}
                </ol>
              </nav>
              <article className="min-w-0 space-y-8 rounded-3xl border border-border bg-card p-5 sm:p-8">
                {page.sections.map((section, index) => (
                  <section
                    key={section.title}
                    id={`section-${index + 1}`}
                    className="min-w-0 scroll-mt-5"
                  >
                    <h2 className="break-words text-lg font-bold tracking-tight">
                      {index + 1}. {section.title}
                    </h2>
                    {section.paragraphs?.map((paragraph) => (
                      <p
                        key={paragraph}
                        className="mt-3 break-words text-sm leading-7 text-muted-foreground"
                      >
                        {paragraph}
                      </p>
                    ))}
                    {section.items && (
                      <ul className="mt-3 list-disc space-y-3 pl-5 text-sm leading-7 text-muted-foreground">
                        {section.items.map((item) => (
                          <li key={item} className="break-words pl-1">
                            {item}
                          </li>
                        ))}
                      </ul>
                    )}
                    {section.links && (
                      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-3 text-sm font-semibold">
                        {section.links.map((link) => (
                          <a
                            key={link.href}
                            href={link.href}
                            className="break-words text-primary underline underline-offset-4"
                          >
                            {link.label}
                          </a>
                        ))}
                      </div>
                    )}
                  </section>
                ))}
              </article>
            </div>
          )
        )}
        <aside className="mt-8 flex min-w-0 flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-card p-5">
          <div className="min-w-0">
            <h2 className="font-bold">Need help with a ride or payment?</h2>
            <p className="mt-1 break-words text-sm text-muted-foreground">
              Include your ride or payment reference so we can find the right record.
            </p>
          </div>
          <a
            href={`mailto:${legalBusiness.email}`}
            className="break-all text-sm font-semibold text-primary underline underline-offset-4"
          >
            {legalBusiness.email}
          </a>
        </aside>
      </main>
      <footer className="border-t border-border bg-card px-4 py-7 sm:px-6">
        <div className="mx-auto max-w-5xl">
          <PolicyLinks />
          <p className="mt-6 text-xs text-muted-foreground">
            © 2026 {legalBusiness.name}. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
