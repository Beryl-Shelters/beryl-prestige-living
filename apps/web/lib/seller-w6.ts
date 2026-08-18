export const reopenErrorMessage = (code?: string) => {
  switch (code) {
    case "LISTING_NOT_REJECTED": return "Only rejected listings can be reopened for changes.";
    case "LISTING_ALREADY_REOPENED": return "This listing has already been reopened for changes.";
    case "LISTING_REOPEN_FAILED": return "We could not reopen this listing. Please try again.";
    default: return "We could not reopen this listing. Please try again.";
  }
};
