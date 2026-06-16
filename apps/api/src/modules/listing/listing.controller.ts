import { Request, Response, NextFunction } from "express";
import { getAuthUserId } from "../../utils/getAuthUserId";
import {
  archiveListing,
  createListing,
  getListingById,
  getMyListings,
  listListings,
  updateListing,
  updateListingStatus
} from "./listing.service";

export const createListingController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const listing = await createListing(getAuthUserId(req), req.body);

    res.status(201).json({
      success: true,
      message: "Listing created successfully",
      data: { listing }
    });
  } catch (error) {
    next(error);
  }
};

export const listListingsController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const result = await listListings(req.query);

    res.status(200).json({
      success: true,
      message: "Listings fetched successfully",
      data: result
    });
  } catch (error) {
    next(error);
  }
};

export const getMyListingsController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const result = await getMyListings(getAuthUserId(req), req.query);

    res.status(200).json({
      success: true,
      message: "My listings fetched successfully",
      data: result
    });
  } catch (error) {
    next(error);
  }
};

export const getListingByIdController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const listing = await getListingById(req.params.id);

    res.status(200).json({
      success: true,
      message: "Listing fetched successfully",
      data: { listing }
    });
  } catch (error) {
    next(error);
  }
};

export const updateListingController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const listing = await updateListing(
      req.params.id,
      getAuthUserId(req),
      req.body
    );

    res.status(200).json({
      success: true,
      message: "Listing updated successfully",
      data: { listing }
    });
  } catch (error) {
    next(error);
  }
};

export const updateListingStatusController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const listing = await updateListingStatus(
      req.params.id,
      req.body.status
    );

    res.status(200).json({
      success: true,
      message: "Listing status updated successfully",
      data: { listing }
    });
  } catch (error) {
    next(error);
  }
};

export const deleteListingController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const listing = await archiveListing(
      req.params.id,
      getAuthUserId(req)
    );

    res.status(200).json({
      success: true,
      message: "Listing archived successfully",
      data: { listing }
    });
  } catch (error) {
    next(error);
  }
};