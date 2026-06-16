import { Router } from "express";
import healthRoutes from "./health.routes";
import authRoutes from "../modules/auth/auth.routes";
import profileRoutes from "../modules/profile/profile.routes";
import propertyRoutes from "../modules/property/property.routes";
import analyticsRoutes from "../modules/analytics/analytics.routes";
import referralRoutes from "../modules/referral/referral.routes";
import inquiryRoutes from "../modules/inquiry/inquiry.routes";
import supportRoutes from "../modules/support/support.routes";
import listingRoutes from "../modules/listing/listing.routes";
import reportRoutes from "../modules/report/report.routes";
import mandateRoutes from "../modules/mandate/mandate.routes";
import transactionRoutes from "../modules/transaction/transaction.routes";
import notificationRoutes from "../modules/notification/notification.routes";
import adminRoutes from "../modules/admin/admin.routes";
import dashboardRoutes from "../modules/dashboard/dashboard.routes";


const router = Router();

router.use("/health", healthRoutes);
router.use("/auth", authRoutes);
router.use("/profiles", profileRoutes);
router.use("/properties", propertyRoutes);
router.use("/analytics", analyticsRoutes);
router.use("/referrals", referralRoutes);
router.use("/inquiries", inquiryRoutes);
router.use("/support", supportRoutes);
router.use("/listings", listingRoutes);
router.use("/reports", reportRoutes);
router.use("/mandates", mandateRoutes);
router.use("/transactions", transactionRoutes);
router.use("/notifications", notificationRoutes);
router.use("/admin", adminRoutes);
router.use("/dashboard", dashboardRoutes);

export default router;