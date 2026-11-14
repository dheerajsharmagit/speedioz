<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Razorpay payments
- Online ride payments use the Razorpay order returned by the authenticated Express backend. `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` belong only in the backend environment; never hardcode secrets or move them client-side.
- Payment success is trusted only after backend signature, order ownership, amount/currency and capture verification. An authorised but uncaptured payment is pending. Customer RPCs delegate to the backend and do not create independent orders or trust client fares. Test mode must be visible in checkout.

## Bottom navigation (RoleNav)
- The bottom menu (`src/components/rc/RoleNav.tsx`) must stay in normal document flow — never `fixed` or `sticky`. Fixed/sticky bars slide over page CTAs; the user explicitly rejected floating. The nav renders as the LAST child of each page, and each page root is a `flex flex-col` container (so `mt-auto` rests the bar at the screen bottom on short pages). Do not add reserve-padding hacks (`pb-[calc(var(--rc-nav-h...))`) — they were removed with the spacer.
