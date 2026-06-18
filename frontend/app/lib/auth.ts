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
    sendResetPassword: async ({ user, url }: { user: { email: string }; url: string }) => {
      if (resend && process.env.RESEND_FROM_EMAIL) {
        const { error } = await resend.emails.send({
          from: process.env.RESEND_FROM_EMAIL,
          to: user.email,
          subject: "Reset your Doppo password",
          html: `<p>Click <a href="${url}">here</a> to reset your password. This link expires in 1 hour.</p>`,
        });
        if (error) throw new Error(`Resend error: ${error.message}`);
      } else if (process.env.NODE_ENV === "production") {
        throw new Error("Resend is not configured — RESEND_API_KEY or RESEND_FROM_EMAIL missing");
      } else {
        console.log(`[DEV] Reset password for ${user.email}: ${url}`);
      }
    },
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
  user: {
    changeEmail: {
      enabled: true,
      sendChangeEmailConfirmation: async ({ user, newEmail, url }: { user: { email: string }; newEmail: string; url: string }) => {
        if (resend && process.env.RESEND_FROM_EMAIL) {
          const { error } = await resend.emails.send({
            from: process.env.RESEND_FROM_EMAIL,
            to: user.email,
            subject: "Confirm your new Doppo email",
            html: `<p>Click <a href="${url}">here</a> to change your account email to ${newEmail}. This link expires in 1 hour.</p>`,
          });
          if (error) throw new Error(`Resend error: ${error.message}`);
        } else if (process.env.NODE_ENV === "production") {
          throw new Error("Resend is not configured — RESEND_API_KEY or RESEND_FROM_EMAIL missing");
        } else {
          console.log(`[DEV] Change email for ${user.email} -> ${newEmail}: ${url}`);
        }
      },
    },
  },
  ...(process.env.NODE_ENV === "production" && productionOrigins.length > 0
    ? { trustedOrigins: productionOrigins }
    : {}),
});
