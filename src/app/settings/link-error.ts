export function linkErrorMessage(
  error: string | undefined,
  errorDescription: string | undefined,
  providerName: string,
): string | undefined {
  if (!error) return undefined;

  switch (error) {
    case "email_does_not_match":
      return `Your ${providerName} account uses a different email address than this account.`;
    case "account_already_linked_to_different_user":
      return `That ${providerName} account is already connected to a different user.`;
    default:
      return `Could not connect your ${providerName} account: ${errorDescription ?? error}`;
  }
}
