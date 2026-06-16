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


export default router;