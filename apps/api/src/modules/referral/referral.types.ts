export type ReferralPurpose = "BUYING" | "SELLING";
export type ReferralContactMethod = "WHATSAPP" | "CALL" | "EMAIL";
export type ReferralLifecycle = "NEW" | "CONTACTED" | "IN_PROGRESS" | "COMPLETED" | "LOST";
export type ReferralPaymentStatus = "NOT_ELIGIBLE" | "OUTSTANDING" | "PAID";

export type ReferralIdentity = {
  id: string;
  customerUserId: string | null;
  fullName: string;
  phone: string | null;
  referralCode: string;
};

export const referralStatusLabel = (status: ReferralLifecycle) => ({
  NEW: "New",
  CONTACTED: "In Progress",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
  LOST: "Didn't proceed"
})[status];
