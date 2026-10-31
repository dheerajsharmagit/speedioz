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
- Online payments (ride fare UPI/Card step and wallet top-up) go through Razorpay Checkout in test mode. `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` live as project secrets — read them only inside `src/lib/razorpay.functions.ts` handlers; never hardcode them or move them client-side.
- Payment success is trusted only after server-side verification in `confirmRazorpayPayment`: HMAC signature check plus a Razorpay API lookup confirming `captured`/`authorized` and matching amount.
