/**
 * Safe dummy environment variables for tests.
 * These are NOT real credentials — they only prevent code that reads
 * process.env from throwing during test runs.
 */

process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "test-publishable-key";
process.env.SUPABASE_SECRET_KEY = "test-secret-key";
process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = "test-vapid-public-key";
process.env.STRIPE_SECRET_KEY = "sk_test_fake";
process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_fake";

// Stripe price IDs used by getStripePriceId()
process.env.STRIPE_PRICE_ESSENTIAL = "price_test_essential";
process.env.STRIPE_PRICE_ALL_IN = "price_test_all_in";
process.env.STRIPE_PRICE_POLLS = "price_test_polls";
process.env.STRIPE_PRICE_FEEDBACK = "price_test_feedback";
process.env.STRIPE_PRICE_SPONSOR_LEADS = "price_test_sponsor_leads";
process.env.STRIPE_PRICE_PASSPORT = "price_test_passport";
process.env.STRIPE_PRICE_DOMAIN = "price_test_domain";
process.env.STRIPE_PRICE_EXTRA_ADMINS = "price_test_extra_admins";
