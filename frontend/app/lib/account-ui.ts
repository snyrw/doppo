/** BetterAuth labels the email/password account `providerId: "credential"`. */
export function shouldShowPasswordChange(accounts: { providerId: string }[]): boolean {
  return accounts.some((a) => a.providerId === "credential");
}
