# Public RideHer policy pages

The customer and captain portals each expose the same 13 public routes:

`/policies`, `/about-us`, `/contact-us`, `/pricing`, `/privacy-policy`,
`/terms-and-conditions`, `/cancellation-policy`, `/refund-policy`,
`/shipping-and-delivery`, `/grievance-redressal`, `/safety-guidelines`,
`/captain-agreement`, `/account-deletion`.

The copy is original RideHer content, informed by the topic coverage of Rapido's
public terms/privacy pages and the references below. No Rapido entity name,
office address, contact, licence, insurance promise or operating entitlement is
adopted. The owner requested `rideher.in` as the public business name. Existing
`support@rideher.in` is used as the support and interim grievance email.

## Business details still needed

Before submitting for payment-provider review or representing these pages as
legally complete, supply and verify the real entity/proprietor name, business
postal address, support phone, named grievance officer/contact and monitored
support hours. A website domain is not proof of a legal entity or an operating
licence. Missing details are omitted, not replaced with another business's data.

Public configuration is available in both deployment environments:

- `VITE_LEGAL_BUSINESS_NAME` (defaults to `rideher.in`)
- `VITE_LEGAL_ENTITY_NAME`
- `VITE_LEGAL_BUSINESS_ADDRESS`
- `VITE_SUPPORT_EMAIL` (defaults to the existing portal support email)
- `VITE_SUPPORT_PHONE`
- `VITE_SUPPORT_HOURS`
- `VITE_GRIEVANCE_OFFICER_NAME`
- `VITE_GRIEVANCE_EMAIL` (defaults to support)

These are public display values, not secrets. Rebuild/publish each portal after
changing them. Keep `src/lib/legal.ts` and
`src/components/legal/LegalPage.tsx` synchronized between the two repositories.
The policy version/effective date is 17 November 2026; review and update the date
when adopting a material change.

## Fit with the service

- Pricing is variable by route/vehicle and must be quoted before booking; this
  page does not invent fixed ride prices or claim a statutory tax rate.
- The current standard bike plan records a ₹15 customer cancellation charge,
  separately from refund/reversal. Review policy copy if that plan changes.
- Online funds require verification. Wallet ride reversals and refunds of an
  original wallet top-up are different processes. Cash cannot be reversed by a
  gateway. Normal Razorpay refund timing is described as roughly 7–10 working
  days after initiation, consistent with the current reference below.
- Grievance acknowledgement/resolution targets require an actual staffed process.
  Deletion and privacy requests use support; no automated erasure or legal
  retention schedule is fabricated by adding a page.
- Captain transfer requests are not guaranteed automatic weekly bank payouts.
- A service-delivery policy explains that rides are not physical goods shipments.

Razorpay also requests business/KYC information, a sample invoice and, where
needed, a reviewer test account. Supply those directly through its Dashboard, not
in public source code. Page publication alone does not grant payment approval,
transport/aggregator authorisation, insurance cover or complete legal compliance.
Operating-state requirements, the applicable data-protection commencement
schedule, records/retention practices, tax/invoicing and contractual arrangements
need review against the actual business. Preserve mandatory consumer rights.

## Publication and checks

Publish both existing portal projects after syncing these changes. No backend
environment change or database migration is required for these policy pages.
The captain session gate explicitly permits every policy route anonymously.
Existing rating/backend changes in the workspace are a separate deployment.

After publication, open each URL in a signed-out/private window, including the
captain URLs. Confirm readable server-rendered page titles/content, contact
links, footer/settings/signup/checkout links and mobile scrolling. Both public
sitemaps list the pages. The customer bottom navigation remains in flow.

## References checked on 17 November 2026

- [Razorpay business website details](https://razorpay.com/docs/payments/dashboard/account-settings/business-website-details/): requested website pages, sample invoice and reviewer access.
- [Razorpay normal refunds](https://razorpay.com/docs/payments/refunds/normal/): original-payment-method refund process and approximate banking times.
- [Rapido customer terms](https://www.rapido.bike/CustomerTermsOnly) and [privacy policy](https://www.rapido.bike/Privacy): structural reference only; their commercial/legal details do not describe RideHer.
- [Ministry of Consumer Affairs, Lok Sabha response dated 18 March 2026](https://fcainfoweb.nic.in/PMS/writereaddata/2026_LS_B_361.pdf): consumer grievance contacts and redressal framework.
- [DPDP Rules 2025, official Gazette](https://www.meity.gov.in/static/uploads/2025/11/53450e6e5dc0bfa85ebd78686cadad39.pdf): phased commencement; do not describe all provisions as already effective.
- [MoRTH Motor Vehicle Aggregator Guidelines 2025](https://morth.nic.in/sites/default/files/circulars_document/MV-Aggregators-Guidelines-2025%20-%20English%20and%20Hindi.pdf): transport/aggregator requirements need a separate operating-jurisdiction review.
