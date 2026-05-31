import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { Resend } from "resend";
import { db } from "../db";
import * as schema from "../schema";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const productionOrigins = process.env.NEXT_PUBLIC_APP_URL
  ? [process.env.NEXT_PUBLIC_APP_URL]
  : [];

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: process.env.NODE_ENV === "production",
  },
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID as string,
      clientSecret: process.env.GITHUB_CLIENT_SECRET as string,
    },
  },
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ["github", "email-password"],
    },
  },
  emailVerification: {
    sendVerificationEmail: async ({ user, url }: { user: { email: string }; url: string }) => {
      if (resend && process.env.RESEND_FROM_EMAIL) {
        const { error } = await resend.emails.send({
          from: process.env.RESEND_FROM_EMAIL,
          to: user.email,
          subject: "Verify your Doppo account",
          html: `<p>Click <a href="${url}">here</a> to verify your email address. This link expires in 24 hours.</p>`,
        });
        if (error) throw new Error(`Resend error: ${error.message}`);
      } else if (process.env.NODE_ENV === "production") {
        throw new Error("Resend is not configured — RESEND_API_KEY or RESEND_FROM_EMAIL missing");
      } else {
        console.log(`[DEV] Verify ${user.email}: ${url}`);
      }
    },
    autoSignInAfterVerification: true,
  },
  ...(process.env.NODE_ENV === "production" && productionOrigins.length > 0
    ? { trustedOrigins: productionOrigins }
    : {}),
});
