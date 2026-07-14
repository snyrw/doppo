"use client";

import { createAuthClient } from "better-auth/react";

const authClient = createAuthClient({});

export const { signIn, signUp, signOut, useSession, requestPasswordReset, resetPassword, updateUser, changeEmail, changePassword, listAccounts, deleteUser } = authClient;
