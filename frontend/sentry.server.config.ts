import * as Sentry from "@sentry/nextjs";

// No DSN → SDK disabled (safe in local dev). Errors only; tracing off to keep
// quota usage near zero at launch.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0,
});
