import { NextFunction, Request, Response } from "express";
import { AppError } from "../../utils/AppError";
import * as service from "./admin-marketplace.service";
import { adminMarketplaceQueueSchema } from "./admin-marketplace.validators";

export const list = async (req: Request, res: Response, next: NextFunction) => { try { const parsed = adminMarketplaceQueueSchema.safeParse(req.query); if (!parsed.success) throw new AppError("Invalid review queue filter or pagination", 400, "INVALID_REVIEW_QUEUE_FILTER"); res.json({ success: true, message: "Marketplace review queue fetched successfully", data: await service.listReviewQueue(parsed.data) }); } catch (error) { next(error); } };
export const detail = async (req: Request, res: Response, next: NextFunction) => { try { res.json({ success: true, message: "Marketplace review fetched successfully", data: { review: await service.getReviewDetail(req.params.propertyId) } }); } catch (error) { next(error); } };
export const documentAccess = async (req: Request, res: Response, next: NextFunction) => { try { res.json({ success: true, message: "Secure document access created successfully", data: { access: await service.getDocumentAccess(req.params.propertyId, req.params.documentId) } }); } catch (error) { next(error); } };
export const approve = async (req: Request, res: Response, next: NextFunction) => { try { res.json({ success: true, message: "Marketplace listing approved successfully", data: await service.reviewProperty(req.params.propertyId, req.user!.id, "APPROVE") }); } catch (error) { next(error); } };
export const reject = async (req: Request, res: Response, next: NextFunction) => { try { res.json({ success: true, message: "Marketplace listing rejected successfully", data: await service.reviewProperty(req.params.propertyId, req.user!.id, "REJECT", req.body.reason) }); } catch (error) { next(error); } };
