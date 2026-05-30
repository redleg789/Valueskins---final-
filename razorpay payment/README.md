Razorpay Test Environment

What this setup includes
- A test checkout page at `http://localhost:3000/razorpay-test`
- API endpoints at `/api/razorpay-test/config`, `/api/razorpay-test/create-order`, and `/api/razorpay-test/verify`
- Signature verification using the existing Razorpay helper in `marketplace/src/lib/razorpay.ts`
- A fake business settlement bank profile exposed at `/api/razorpay-test/business-bank`
- Paid event ticket purchases now use Razorpay order creation + payment verification before a ticket is issued
- Every paid ticket sale records a 2% platform fee as ValueSkins revenue

What is already configured
- Test key id: `rzp_test_SsPlKVWGuc1wcY`
- Fake business bank label: `valueskins-test-settlement`

What you still need
- Add your Razorpay test secret as `RAZORPAY_KEY_SECRET` in `marketplace/.env.local`

Recommended env values in `marketplace/.env.local`
```env
RAZORPAY_KEY_ID=rzp_test_SsPlKVWGuc1wcY
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_test_SsPlKVWGuc1wcY
RAZORPAY_KEY_SECRET=your_test_secret_here
RAZORPAY_BUSINESS_ACCOUNT_HOLDER=ValueSkins Test Business
RAZORPAY_BUSINESS_BANK_NAME=Razorpay Test Bank
RAZORPAY_BUSINESS_ACCOUNT_NUMBER=7000001234567890
RAZORPAY_BUSINESS_IFSC=HDFC000TEST
RAZORPAY_BUSINESS_BRANCH=Bengaluru Sandbox Branch
RAZORPAY_BUSINESS_ACCOUNT_TYPE=current
RAZORPAY_BUSINESS_CONTACT_EMAIL=finance+test@valueskins.com
RAZORPAY_BUSINESS_CONTACT_PHONE=9999999999
RAZORPAY_BUSINESS_ACCOUNT_LABEL=valueskins-test-settlement
```

How to test
1. Start the app with `npm run dev --prefix marketplace`
2. Open `http://localhost:3000/razorpay-test`
3. Confirm the setup status shows both key id and secret, and that the business bank is present
4. Visit `http://localhost:3000/events`, open a paid event, and start checkout from the ticket panel
5. Complete the payment with Razorpay test credentials
6. Confirm the issued ticket only appears after payment verification succeeds
7. Confirm the sale stores a 2% platform fee and a 98% net amount on the ticket record

Important note
- The key id alone is not enough to create orders server-side. The test secret is required for order creation and signature verification.
- The fake bank in this repo is a test-mode settlement profile for the app; linking a real Razorpay settlement account still has to be done in the Razorpay dashboard.
