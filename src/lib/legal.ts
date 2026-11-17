// Public business details only. Keep this file in sync with the captain portal.
const env = import.meta.env ?? {};
export const legalBusiness = {
  name: env.VITE_LEGAL_BUSINESS_NAME || "rideher.in",
  legalName: env.VITE_LEGAL_ENTITY_NAME || "",
  address: env.VITE_LEGAL_BUSINESS_ADDRESS || "",
  email: env.VITE_SUPPORT_EMAIL || "support@rideher.in",
  phone: env.VITE_SUPPORT_PHONE || "",
  hours: env.VITE_SUPPORT_HOURS || "",
  grievanceOfficer: env.VITE_GRIEVANCE_OFFICER_NAME || "",
  grievanceEmail: env.VITE_GRIEVANCE_EMAIL || env.VITE_SUPPORT_EMAIL || "support@rideher.in",
};
export const POLICY_VERSION = "2026-11-17";
export const POLICY_DATE = "17 November 2026";
export type LegalAudience = "customer" | "captain";
export type LegalSection = {
  title: string;
  paragraphs?: string[];
  items?: string[];
  links?: { label: string; href: string }[];
};
export type LegalDocument = {
  slug: string;
  title: string;
  description: string;
  sections: LegalSection[];
};
const link = (label: string, href: string) => ({ label, href });
const support = `mailto:${legalBusiness.email}`;
const grievance = `mailto:${legalBusiness.grievanceEmail}`;
const contactLinks = [
  link("Contact RideHer", "/contact-us"),
  link("Raise a grievance", "/grievance-redressal"),
];

export function legalDocuments(audience: LegalAudience): LegalDocument[] {
  return [
    {
      slug: "about-us",
      title: "About RideHer",
      description: "Ride booking and captain services from rideher.in.",
      sections: [
        {
          title: "Our service",
          paragraphs: [
            `${legalBusiness.name} uses the RideHer brand for its customer and captain ride-booking portals. Customers can request a ride, view available vehicle options, see the quoted fare, and follow the assigned captain during pickup and the trip.`,
            "RideHer is built around women-focused mobility. Booking access is subject to the eligibility checks in the application. Vehicle options, captain availability and permitted services vary by location; a vehicle shown on the website is not a promise that it is available everywhere.",
          ],
        },
        {
          title: "For customers and captains",
          items: [
            "Customers choose pickup and destination, review the fare and payment method, and receive booking and payment records.",
            "Approved captains use a separate portal for ride requests, verification documents, route information, order history and earnings.",
            "Cash collection, wallet payments and supported online payments follow the options shown for the booking. Online checkout uses Razorpay when enabled.",
          ],
        },
        {
          title: "Business and service information",
          paragraphs: [
            "Service availability depends on operating arrangements, local transport requirements and the booking location. No statement on this website represents a government endorsement, nationwide operating licence, guaranteed income or guaranteed ride availability.",
          ],
          links: [
            link("Business contact details", "/contact-us"),
            link("Services & pricing", "/pricing"),
          ],
        },
      ],
    },
    {
      slug: "contact-us",
      title: "Contact us",
      description: "Help with bookings, payments, captain accounts and business inquiries.",
      sections: [
        {
          title: "Customer and captain support",
          paragraphs: [
            `Email ${legalBusiness.email} from the email associated with your account where possible. Include the ride or order reference, travel date, issue and the best way to reach you. For a payment issue, include the amount and payment reference.`,
            "Booking and payment records are available in Your Trips in the customer portal, and All Orders, Earnings and Wallet in the captain portal. Use these records to identify the transaction you need help with.",
          ],
          links: [link("Email support", support)],
        },
        {
          title: "Business details",
          items: [
            `Business / service name: ${legalBusiness.name}`,
            ...(legalBusiness.legalName
              ? [`Legal entity / proprietor: ${legalBusiness.legalName}`]
              : []),
            "Customer website: https://www.rideher.in",
            "Captain website: https://captain.rideher.in",
            `Support email: ${legalBusiness.email}`,
            ...(legalBusiness.address ? [`Business address: ${legalBusiness.address}`] : []),
            ...(legalBusiness.phone ? [`Support phone: ${legalBusiness.phone}`] : []),
            ...(legalBusiness.hours ? [`Support hours: ${legalBusiness.hours}`] : []),
          ],
        },
        {
          title: "Complaints and privacy requests",
          paragraphs: [
            "Use the grievance procedure for unresolved service or payment complaints. For access, correction or deletion of personal information, follow the privacy request instructions.",
          ],
          links: [
            link("Grievance redressal", "/grievance-redressal"),
            link("Privacy policy", "/privacy-policy"),
            link("Account & data deletion", "/account-deletion"),
          ],
        },
        {
          title: "Protect your account",
          paragraphs: [
            "Never send passwords, payment PINs, full card details or login OTPs to support. Share the ride-start OTP only with your assigned captain at pickup. For an immediate threat or accident, contact local emergency services first; an email support request is not emergency dispatch.",
          ],
        },
      ],
    },
    {
      slug: "pricing",
      title: "Services & pricing",
      description: "How a ride is quoted, charged and recorded in Indian rupees.",
      sections: [
        {
          title: "Available services",
          paragraphs: [
            "RideHer offers the vehicle categories enabled for your pickup location, such as bike, auto or cab. Select pickup, destination and a vehicle in the customer portal to see the current fare. There is no single fixed price for all journeys.",
          ],
          links: [link("Get a ride quote", "https://www.rideher.in/ride")],
        },
        {
          title: "What makes up the fare",
          items: [
            "Base fare and distance charges. The bike rate plan uses progressive distance bands: each band's rate applies to kilometres within that band.",
            "Trip time and the platform fee, plus applicable taxes identified in the booking or fare breakdown.",
            "Waiting charges after the plan's free allowance, long-pickup charges beyond its free distance, and applicable night or surge charges.",
            "Discounts or other adjustments only where actually applied to the booking. The rate plan and any applicable rounding determine the payable fare.",
          ],
        },
        {
          title: "Quote and final amount",
          paragraphs: [
            "Prices are in INR (₹). Review the quoted amount and selected payment method before confirming. Where the booking permits reconciliation, final distance, time and applicable extras may affect the final amount. A prepaid online booking follows its recorded payment and fare rules; a displayed estimate is not authority to debit additional money without the required payment flow.",
            "Rate plans may change for future bookings. The saved booking plan and the recorded fare govern that ride. Check the booking and receipt rather than relying on an advertisement, an old screenshot or another customer's fare.",
          ],
        },
        {
          title: "Payment and captain earnings",
          paragraphs: [
            "Customers can choose the payment options enabled for the booking: an adequately funded RideHer wallet, or cash at the end with an online collection option where available. Razorpay top-ups and ride checkout must be confirmed by RideHer before payment is treated as received.",
            "Captain earnings are the recorded fare allocation after applicable platform charges, commission, taxes, refunds or adjustments. A customer fare is not the same as captain take-home earnings. The captain Rate Card and order details show the applicable plan. Bank transfers depend on available verified funds and the transfer process; weekly or instant automatic payouts are not promised.",
          ],
          links: [
            link("Captain rate card (sign-in required)", "https://captain.rideher.in/rate-card"),
            link("Cancellation charges", "/cancellation-policy"),
            link("Refund policy", "/refund-policy"),
          ],
        },
      ],
    },
    {
      slug: "privacy-policy",
      title: "Privacy policy",
      description: "What information RideHer handles, why it is used, and your choices.",
      sections: [
        {
          title: "Scope and contact",
          paragraphs: [
            `This policy covers personal information handled through the RideHer customer and captain portals operated under the ${legalBusiness.name} name, and related booking, payment and support interactions. It applies to customers, captain applicants and captains. Contact ${legalBusiness.email} for privacy requests.`,
            "The information used depends on the features you access and the permissions you allow. This notice describes RideHer's service; a third party's own site or checkout may also provide its privacy notice.",
          ],
        },
        {
          title: "Information you provide",
          items: [
            "Account and profile information such as name, phone number, email, gender, profile photo, saved addresses and account credentials. Google sign-in, when used, provides the verified identity information needed to create or link the account.",
            "Booking information including pickup, destination, trip times, assigned captain, fare, payment method, ride status, ratings and comments.",
            "Captain application information, where requested: driving licence, vehicle registration, insurance, identity documents, photographs and bank or UPI details used for verification and earnings administration.",
            "Support messages, complaints, safety reports and the information you choose to attach. Provide only what is needed to resolve the request.",
          ],
        },
        {
          title: "Location and device information",
          paragraphs: [
            "With device permission, customer location helps set pickup and show location-based availability. An online captain shares location for nearby ride discovery. During an assigned ride, captain GPS is used for approach-to-pickup and trip tracking and may be retained with the trip record.",
            "The booking customer can see their assigned captain's trip location. Unassigned nearby vehicles are shown with approximate positions. Live tracking stops being shared for that booking when it ends; historical trip records may retain the last trip location. A browser may pause updates when suspended or closed.",
            "Technical information such as device identifiers used for sessions, browser information, authentication records, request logs and error information may be processed to run and secure the portals. You can change location permissions in your browser/device settings; refusing location can limit pickup, matching or tracking features.",
          ],
        },
        {
          title: "Why information is used",
          items: [
            "Create and secure accounts, verify captain applications and eligibility, match bookings, operate trips and provide receipts and support.",
            "Calculate fares, verify payments, maintain wallet/earnings records, reconcile refunds and handle payment disputes.",
            "Investigate safety incidents, abuse or fraud; protect users; meet applicable transport, tax, accounting, legal and regulatory obligations.",
            "Maintain service reliability, investigate errors and communicate material service or policy changes.",
          ],
        },
        {
          title: "Sharing and service providers",
          paragraphs: [
            "Customers and assigned captains receive the booking and contact information needed for the trip. Authorised RideHer staff can access relevant records for verification, support, safety and operations. We use providers for hosting, maps/search, identity sign-in, notifications and payments as required by enabled features.",
            "Razorpay and its payment partners handle online payment processing. RideHer receives payment references, verification results and transaction status; do not enter card PINs or UPI PINs into RideHer support messages. Map/search requests can disclose a search query or coordinates to the relevant map provider. Records may be disclosed where required by law or reasonably necessary to address fraud, safety incidents or legal claims.",
            "Provider processing locations may vary. Applicable legal safeguards and provider terms apply to any relevant cross-border processing. We do not sell personal information.",
          ],
          links: [
            link("Razorpay privacy", "https://razorpay.com/privacy/"),
            link("Google privacy", "https://policies.google.com/privacy"),
            link("OpenStreetMap privacy", "https://osmfoundation.org/wiki/Privacy_Policy"),
          ],
        },
        {
          title: "Storage, security and retention",
          paragraphs: [
            "The portals use browser storage for sessions, preferences and ride continuity. Providers may use storage or cookies for their own enabled features. Signing out or clearing browser storage affects the device session; it does not delete server-side trip, verification or payment records.",
            "RideHer uses access controls and authentication measures to protect records. No system can promise absolute security. We retain information for the purposes described above and for applicable accounting, verification, safety, dispute and legal requirements. Retention depends on the record's purpose, outstanding obligations and applicable law. Deletion requests are reviewed against these requirements, including records in backups awaiting their normal retention cycle.",
          ],
        },
        {
          title: "Your choices and requests",
          paragraphs: [
            "You can review or update supported profile fields in the portal and request access, correction, deletion or withdrawal of optional permissions through support. Verification may be needed to protect another person's account. Some requests require closing the account or ending an active ride, and legal retention can limit immediate erasure.",
            "Accounts are intended for adults who can enter into a valid agreement. We do not knowingly invite children to create accounts. If you believe a child's information was supplied without appropriate authority, contact support so it can be investigated. Rights available under applicable Indian law, including data protection provisions when in force, remain available.",
          ],
          links: [link("Request account or data deletion", "/account-deletion"), ...contactLinks],
        },
        {
          title: "Changes",
          paragraphs: [
            "The date on this page identifies this version. Material changes will be published here and, where required, communicated through the service or another appropriate channel. New purposes requiring consent will be addressed under applicable law.",
          ],
        },
      ],
    },
    {
      slug: "terms-and-conditions",
      title: "Terms & conditions",
      description:
        audience === "captain"
          ? "Terms for using the RideHer captain portal and related services."
          : "Terms for accounts, ride bookings and payments on RideHer.",
      sections: [
        {
          title: "The service and these terms",
          paragraphs: [
            `These terms govern use of the RideHer websites and portals under the ${legalBusiness.name} name. Read them with the Privacy, Cancellation, Refund, Service Delivery and Safety policies linked on this site. Captains must also read the Captain Agreement.`,
            "RideHer provides booking and related platform services connecting eligible customers and captains. The transport service, operating responsibilities and any additional commercial agreement remain subject to applicable law and the arrangements for the relevant service/location. Website wording does not replace required transport permissions.",
          ],
        },
        {
          title: "Accounts and eligibility",
          items: [
            "You must be at least 18, able to form a valid agreement, and meet the account and service eligibility requirements shown during registration/booking.",
            "Give accurate information, keep your login credentials secure and notify support of unauthorised use. Do not share an account or impersonate another person.",
            "Captains may operate through the portal only after required approval and with valid documents, vehicle compliance and permissions. Service availability varies by location.",
          ],
        },
        {
          title: "Bookings and conduct",
          paragraphs: [
            "Check pickup, destination, vehicle, fare and payment method before confirming. A search request is not a guaranteed captain assignment. Arrival times and map routes are estimates affected by traffic, connectivity and actual road conditions.",
            "Check the assigned captain and vehicle at pickup and share the ride-start OTP only when you are ready to begin. Follow traffic rules, helmet/seat-belt requirements and the safety guidance. No harassment, discrimination, threats, illegal goods, fraudulent bookings, manipulation of GPS/payments or misuse of another user's information is allowed.",
          ],
          links: [link("Safety & community guidelines", "/safety-guidelines")],
        },
        {
          title: "Prices, payments and tips",
          paragraphs: [
            "Fare components, permitted adjustments and taxes are described on Services & Pricing and in the booking. Pay only through the selected collection method. An online payment is received only after verification; a bank debit or a screenshot alone is not confirmation. Wallet and test-mode transactions follow the status shown in the service.",
            "Any tip is voluntary. Recording a tip alongside a rating does not itself collect money; give a direct tip only if you choose. Cancellation fees and refunds follow the applicable policies, without reducing mandatory legal remedies.",
          ],
          links: [
            link("Services & pricing", "/pricing"),
            link("Cancellation policy", "/cancellation-policy"),
            link("Refund policy", "/refund-policy"),
          ],
        },
        {
          title: "Service access and disputes",
          paragraphs: [
            "Access can be limited for safety, suspected fraud, expired documents, legal requirements or a material breach. Contact support to question an account decision or a disputed charge. Do not use technical workarounds to bypass a restriction.",
            "Please first provide RideHer with the booking/payment facts so an issue can be investigated. Nothing in these terms removes a consumer's statutory rights, available compensation or right to approach a competent consumer forum, court or authority.",
          ],
          links: contactLinks,
        },
        {
          title: "Liability and applicable law",
          paragraphs: [
            "Service interruptions and events outside reasonable control may affect bookings. Responsibility is assessed under the applicable agreement and law. No exclusion in these terms applies where it would unlawfully exclude liability, including liabilities that cannot be excluded for fraud, negligence, injury or consumer protection.",
            "Indian law applies, subject to any mandatory local law. Disputes may be taken to the forum or court with lawful jurisdiction. Changes apply as stated when published and do not retrospectively remove accrued rights or statutory consumer remedies.",
          ],
        },
      ],
    },
    {
      slug: "cancellation-policy",
      title: "Cancellation policy",
      description: "How to cancel a ride and understand any cancellation charge.",
      sections: [
        {
          title: "Before the ride starts",
          paragraphs: [
            "Use the cancellation option in the active booking before the captain starts the trip. Submit the reason and wait for the booking to show cancelled. Closing the page or dismissing a payment window does not cancel a booking.",
            "After a ride starts, pre-trip cancellation is unavailable. For a safety issue or a need to end a trip early, ask the captain to stop safely and contact support. Fare and dispute handling depend on the recorded trip and applicable law.",
          ],
        },
        {
          title: "Customer cancellation charges",
          paragraphs: [
            "A customer-initiated bike cancellation can carry the flat cancellation charge in the rate plan saved with the booking. The current standard bike-plan charge is ₹15. No free grace period, no-show fee or escalating time-based penalty is promised by this policy.",
            "The applicable charge is recorded separately in the booking. A charge marked due is not confirmation that your bank account or wallet has been debited. Ask support if the charge appears incorrect, the vehicle/captain was wrong, or the cancellation was caused by a safety or service problem. Mandatory legal remedies remain available.",
          ],
        },
        {
          title: "Captain, platform and no-captain cancellations",
          paragraphs: [
            "The customer bike-cancellation fee is not applied for a captain/admin-initiated cancellation or when the platform closes a request because no captain accepted it. A pending request can expire without an available captain.",
            "Captains should decline or cancel using the portal and report the actual reason. Repeated misuse or asking a customer to cancel to avoid responsibility may be investigated.",
          ],
        },
        {
          title: "Payments for cancelled rides",
          paragraphs: [
            "A verified prepaid fare for a cancelled, uncompleted ride enters the relevant reversal/refund process. RideHer wallet ride reversals return to the RideHer wallet; provider payments follow the original payment method. An applicable cancellation charge is recorded separately under the booking rules. Bank debit reversals and refund credit can take time.",
          ],
          links: [link("Refund process & timelines", "/refund-policy"), ...contactLinks],
        },
      ],
    },
    {
      slug: "refund-policy",
      title: "Refund policy",
      description: "Eligibility, payment reversals, timelines and refund support.",
      sections: [
        {
          title: "When to request a review",
          items: [
            "A paid ride is cancelled before it is completed or no captain is assigned.",
            "A duplicate or incorrect debit is verified, or the service/fare record does not match what was charged.",
            "A payment was debited but the booking or wallet credit was not confirmed. A failed or pending payment may instead be reversed by the bank/provider.",
            "A completed trip had a material service or safety issue. Support reviews the facts and applicable rights; completion does not remove statutory remedies.",
          ],
        },
        {
          title: "How refunds are handled",
          paragraphs: [
            "Contact support with your ride/payment reference, date, amount and issue. RideHer checks payment capture, booking state and previous refunds before deciding or reconciling the request. An unverified payment, test transaction or amount already refunded cannot be refunded a second time.",
            "Approved online refunds go back through the original payment method. A cancelled wallet-paid ride is reversed to the RideHer wallet. A wallet top-up is separate from the ride: cancelling a ride does not automatically refund an earlier top-up to your bank. Ask support to review an unused/incorrect top-up or wallet balance; verification, settled usage and applicable requirements affect the resolution.",
            "For cash, report the amount actually paid. An online payment gateway cannot directly reverse cash handed to a captain; support will investigate any required cash-related resolution. An applicable cancellation charge is identified separately rather than hidden as an unexplained deduction.",
          ],
        },
        {
          title: "Refund timing",
          paragraphs: [
            "Refund review starts when support has enough booking and payment information. Service grievances are handled under the grievance procedure. Bank-credit timing starts after a refund is approved and initiated, not when an email is first sent.",
            "Razorpay's published normal-refund guidance allows approximately 7–10 working days for the credit, depending on the bank and payment method. Some UPI or wallet-provider reversals arrive earlier. A provider or bank delay can require reconciliation; support can help trace an initiated refund using the available refund/payment reference.",
            "If the credit is missing after the expected window, contact RideHer with the original payment and refund details. Do not pay a fee or reveal a PIN/OTP to receive a refund.",
          ],
          links: [
            link(
              "Razorpay normal-refund guidance",
              "https://razorpay.com/docs/payments/refunds/normal/",
            ),
            ...contactLinks,
          ],
        },
        {
          title: "Disputed transactions",
          paragraphs: [
            "You may raise a genuine payment dispute with your bank/provider and tell RideHer so the same transaction can be traced. This policy does not restrict consumer, banking or other mandatory legal rights. A refund is treated as completed only after the verified payment/reversal record confirms it.",
          ],
        },
      ],
    },
    {
      slug: "shipping-and-delivery",
      title: "Shipping & service delivery",
      description: "RideHer provides local ride services; physical goods are not shipped.",
      sections: [
        {
          title: "What is delivered",
          paragraphs: [
            "RideHer provides ride-booking and related captain platform services, not a physical-goods shop. Courier shipping, package delivery times and return-to-warehouse rules do not apply to a ride booking.",
            "The service is fulfilled at the selected pickup and destination after a captain is assigned and the ride starts. The ride-start OTP helps confirm pickup. A confirmed payment funds the selected service or wallet top-up; it does not guarantee an available captain or immediate pickup.",
          ],
        },
        {
          title: "Availability and timing",
          paragraphs: [
            "Availability depends on supported locations, vehicle types, captain availability, legal operating permissions, traffic, weather and road conditions. The application displays estimates; an ETA is not a guaranteed delivery deadline.",
            "Check the booking status in the portal. If no captain accepts or a trip cannot be fulfilled, use cancellation/support and the refund procedure. If you lose connectivity, check the existing booking before creating another request.",
          ],
        },
        {
          title: "Service or payment not received",
          paragraphs: [
            "For an unsuccessful booking, missing wallet credit, incorrect collection or incomplete trip, contact support with the relevant references. A screenshot alone does not replace payment verification. Refund and grievance procedures apply to verified unfulfilled or disputed services.",
          ],
          links: [link("Refund policy", "/refund-policy"), ...contactLinks],
        },
      ],
    },
    {
      slug: "grievance-redressal",
      title: "Grievance redressal",
      description: "Raise and escalate service, payment, account or privacy complaints.",
      sections: [
        {
          title: "Submit a grievance",
          paragraphs: [
            `Send your complaint to ${legalBusiness.grievanceEmail} with the subject “Grievance — RideHer” and include your registered contact, booking/payment reference, relevant dates, the issue and the resolution requested. Share only necessary evidence; never include a payment PIN, password or login OTP.`,
          ],
          links: [
            link("Email a grievance", `${grievance}?subject=Grievance%20%E2%80%94%20RideHer`),
          ],
        },
        {
          title: "Grievance contact",
          items: [
            ...(legalBusiness.grievanceOfficer
              ? [`Grievance officer: ${legalBusiness.grievanceOfficer}`]
              : []),
            `Grievance email: ${legalBusiness.grievanceEmail}`,
            ...(legalBusiness.address ? [`Correspondence address: ${legalBusiness.address}`] : []),
            ...(legalBusiness.phone ? [`Contact phone: ${legalBusiness.phone}`] : []),
          ],
        },
        {
          title: "Acknowledgement and resolution",
          paragraphs: [
            "RideHer aims to acknowledge a consumer grievance within 48 hours and resolve it within one month of receipt, in line with applicable consumer requirements. A shorter mandatory legal timeframe takes precedence. Keep the original email thread so the complaint and follow-up can be traced.",
            "Investigation may require booking, payment-provider, captain or account information. The response should explain the outcome or further information needed. Bank credit after an approved refund follows the refund policy and provider processing time.",
          ],
        },
        {
          title: "Escalation and your rights",
          paragraphs: [
            "If unresolved, reply to the same thread with “Escalation” in the subject and the earlier complaint date/reference. You may also use the National Consumer Helpline or another competent consumer forum, court or authority. Using this process does not waive any statutory right.",
            "Privacy requests can be made through the privacy contact and applicable legal channels. The effective dates and scope of Indian data-protection provisions must be considered for the particular request. An immediate safety emergency should be reported to local emergency services first.",
          ],
          links: [
            link("National Consumer Helpline", "https://consumerhelpline.gov.in/"),
            link("Privacy & data requests", "/privacy-policy"),
            link("Contact details", "/contact-us"),
          ],
        },
      ],
    },
    {
      slug: "safety-guidelines",
      title: "Safety & community guidelines",
      description: "Practical expectations for respectful and safer rides.",
      sections: [
        {
          title: "At pickup and during the ride",
          items: [
            "Check the assigned captain, vehicle and registration against the booking before boarding. If something does not match, do not start; contact support.",
            "Share the ride-start OTP only with your assigned captain when ready at pickup. A login OTP, payment PIN and ride-start OTP serve different purposes.",
            "Use the required helmet or seat belt, follow lawful passenger limits and do not ask a captain to break traffic rules or take an unsafe route.",
            "Treat everyone respectfully. Harassment, threats, violence, sexual misconduct, intoxicated driving, discrimination and illegal activity are prohibited.",
          ],
        },
        {
          title: "Location, routes and emergencies",
          paragraphs: [
            "GPS, routes and ETAs assist a trip but can be delayed or inaccurate. Captains must follow actual road rules and conditions. Keep the portal open and location enabled when live tracking is needed.",
            "If you face immediate danger or a medical emergency, contact local emergency services and move to safety if possible. Tell RideHer support the ride reference and facts when safe. A support email, a map marker or a trip-sharing feature is not a guarantee of emergency dispatch or continuous monitoring.",
          ],
        },
        {
          title: "Payment and personal information",
          paragraphs: [
            "Use the fare and collection method in the booking. A captain-hosted RideHer payment QR should open the legitimate RideHer payment flow. Check the amount and recipient before authorising any payment. Never scan a QR or enter a PIN merely to receive a refund.",
            "Do not publish another user's phone number, documents, location or personal information. Report suspected fraud, lost property or a safety issue privately with the booking reference. RideHer may restrict access while investigating a serious report, subject to applicable law and review.",
          ],
          links: contactLinks,
        },
      ],
    },
    {
      slug: "captain-agreement",
      title: "Captain agreement",
      description:
        "Platform responsibilities, verification, ride conduct and earnings information.",
      sections: [
        {
          title: "Scope",
          paragraphs: [
            "This agreement covers use of the RideHer captain portal and complements the general Terms & Conditions and any applicable written operating arrangement. Actual legal responsibilities and working status are determined by the relevant arrangement and law; a website label does not override them.",
            "Use of the portal is subject to approval, supported vehicle/service types and local legal requirements. Account verification is not itself a transport licence, insurance policy or guarantee of ride requests or income.",
          ],
        },
        {
          title: "Documents and vehicle responsibilities",
          items: [
            "Provide accurate identity, driving licence, vehicle registration, insurance and other required verification records. Do not upload another person's documents or share your captain account.",
            "Keep required licences, permits, insurance, vehicle fitness and other applicable documents valid. Tell RideHer about material changes, expiry, suspension or safety concerns.",
            "Use the approved vehicle and follow applicable transport, traffic, safety and passenger rules. Required checks remain subject to the operating jurisdiction.",
          ],
        },
        {
          title: "Operating an accepted ride",
          paragraphs: [
            "Review the customer pickup, destination and recorded fare information. Travel safely to pickup, confirm the customer and start only after verifying the ride-start OTP. Mark arrival/completion truthfully. Keep location sharing enabled during the active assignment and avoid using the portal while it would distract from safe driving.",
            "Use the portal to decline or cancel and give the actual reason. Do not manipulate GPS, falsely mark trips completed, demand an unrecorded fare or pressure a customer to cancel to avoid responsibility. Report disputes and safety incidents through support.",
          ],
          links: [
            link("Safety guidelines", "/safety-guidelines"),
            link("Cancellation rules", "/cancellation-policy"),
          ],
        },
        {
          title: "Collection, fees and earnings",
          paragraphs: [
            "The applicable rate card and recorded order settlement determine gross fare, commission, platform amounts, taxes and captain earnings. There is no blanket zero-commission, fixed-income or guaranteed incentive promise in this agreement.",
            "Confirm cash only after receiving it. For online collection, use the RideHer/Razorpay flow and rely on verified payment status, not a screenshot. Wallet/online earnings and cash already collected are treated differently in the ledger; test transactions are not real withdrawable funds.",
            "Transfer requests, adjustments and any refund reversals follow the available earnings and verification/approval process. A transfer request is not a completed bank payout. Raise discrepancies with the order/transaction reference. Taxes and other obligations apply according to law and the relevant arrangement.",
          ],
          links: [
            link("Rate card (captain sign-in)", "https://captain.rideher.in/rate-card"),
            link("Refund policy", "/refund-policy"),
          ],
        },
        {
          title: "Data, account review and ending access",
          paragraphs: [
            "Protect customer contact and trip information and use it only for the legitimate service. The Privacy Policy explains document, account and GPS processing. Access may be restricted for invalid documents, safety, fraud, legal reasons or material breaches, with issues reviewable through support.",
            "You can request account closure. Ending access does not automatically erase required verification, accounting, payment, safety or dispute records, and outstanding lawful obligations remain. These terms preserve remedies that cannot be excluded by applicable law.",
          ],
          links: [
            link("Privacy policy", "/privacy-policy"),
            link("Account closure", "/account-deletion"),
            ...contactLinks,
          ],
        },
      ],
    },
    {
      slug: "account-deletion",
      title: "Account & data deletion",
      description: "How customers and captains can request account closure or a data review.",
      sections: [
        {
          title: "Make a request",
          paragraphs: [
            `Email ${legalBusiness.email} from your registered email with the subject “Account deletion — RideHer”. State whether it is a customer or captain account, provide the registered contact and say whether you want account closure, correction or deletion of particular information. Do not attach identity documents unless support provides an appropriate verification process.`,
            "This is a reviewed support request, not an instant-delete button. RideHer may need to verify account ownership and clarify which account is affected. Never send your password, payment PIN or login OTP.",
          ],
          links: [
            link(
              "Request account deletion",
              `${support}?subject=Account%20deletion%20%E2%80%94%20RideHer`,
            ),
          ],
        },
        {
          title: "Before closing an account",
          paragraphs: [
            "End or resolve an active booking and identify any pending fare, refund, wallet balance, captain earnings or transfer issue. Account closure does not itself refund a wallet top-up, settle a dispute or complete a bank transfer; these require the relevant review and payment process.",
          ],
        },
        {
          title: "Records that may be retained",
          paragraphs: [
            "Required transaction, tax, accounting, verification, fraud, safety, legal-claim and dispute records may need to be retained for their applicable purpose and legal period. Other eligible information can be deleted or de-identified following review. Backup copies may remain until their normal retention cycle, subject to applicable requirements.",
            "Uninstalling the app, logging out or clearing browser storage only affects that device and does not delete server records. Contact the grievance channel if a request remains unresolved.",
          ],
          links: [
            link("Privacy policy", "/privacy-policy"),
            link("Grievance redressal", "/grievance-redressal"),
          ],
        },
      ],
    },
  ];
}

export const LEGAL_PATHS = [
  "/policies",
  ...legalDocuments("customer").map((page) => `/${page.slug}`),
];
export const policyLinks = legalDocuments("customer").map(({ slug, title }) => ({
  href: `/${slug}`,
  label: title,
}));
export function legalHead(slug: string, audience: LegalAudience) {
  const page = legalDocuments(audience).find((page) => page.slug === slug);
  const title = `${page?.title ?? "Policies & support"} — RideHer${audience === "captain" ? " Captain" : ""}`;
  const description =
    page?.description ?? "Read RideHer policies, service information and support contacts.";
  const base = audience === "captain" ? "https://captain.rideher.in" : "https://www.rideher.in";
  return {
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: `${base}/${slug}` }],
  };
}
