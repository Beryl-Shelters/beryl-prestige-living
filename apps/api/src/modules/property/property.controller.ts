import { Request, Response, NextFunction } from "express";
import { AppError } from "../../utils/AppError";
import {
  archiveProperty,
  createProperty,
  getPropertyById,
  listProperties,
  updateProperty
} from "./property.service";
import {
  deletePropertyImage,
  uploadPropertyImages
} from "./property.service";
import {
  saveProperty,
  unsaveProperty,
  getMySavedProperties
} from "./property.service";

export const getAuthUserId = (req: Request): string => {
  if (!req.user?.id) {
    throw new AppError("Authentication required", 401);
  }

  return getAuthUserId(req);
};

export const createPropertyController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const property = await createProperty(getAuthUserId(req), req.body);

    res.status(201).json({
      success: true,
      message: "Property created successfully",
      data: { property }
    });
  } catch (error) {
    next(error);
  }
};

export const listPropertiesController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const result = await listProperties(req.query);

    res.status(200).json({
      success: true,
      message: "Properties fetched successfully",
      data: result
    });
  } catch (error) {
    next(error);
  }
};

export const getPropertyController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const property = await getPropertyById(req.params.id);

    res.status(200).json({
      success: true,
      message: "Property fetched successfully",
      data: { property }
    });
  } catch (error) {
    next(error);
  }
};

export const updatePropertyController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const property = await updateProperty(
      req.params.id,
      getAuthUserId(req),
      req.body
    );

    res.status(200).json({
      success: true,
      message: "Property updated successfully",
      data: { property }
    });
  } catch (error) {
    next(error);
  }
};

export const deletePropertyController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const property = await archiveProperty(req.params.id, getAuthUserId(req));

    res.status(200).json({
      success: true,
      message: "Property archived successfully",
      data: { property }
    });
  } catch (error) {
    next(error);
  }
};

export const uploadPropertyImagesController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const images = await uploadPropertyImages(
      req.params.id,
      getAuthUserId(req),
      req.files as Express.Multer.File[]
    );

    res.status(201).json({
      success: true,
      message: "Property images uploaded successfully",
      data: { images }
    });
  } catch (error) {
    next(error);
  }
};

export const deletePropertyImageController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    await deletePropertyImage(req.params.imageId, getAuthUserId(req));

    res.status(200).json({
      success: true,
      message: "Property image deleted successfully"
    });
  } catch (error) {
    next(error);
  }
};

export const savePropertyController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const savedProperty = await saveProperty(
      req.params.id,
      getAuthUserId(req)
    );

    res.status(201).json({
      success: true,
      message: "Property saved successfully",
      data: { saved_property: savedProperty }
    });
  } catch (error) {
    next(error);
  }
};

export const unsavePropertyController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    await unsaveProperty(req.params.id, getAuthUserId(req));

    res.status(200).json({
      success: true,
      message: "Property removed from saved properties successfully"
    });
  } catch (error) {
    next(error);
  }
};

export const getMySavedPropertiesController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const result = await getMySavedProperties(
      getAuthUserId(req),
      req.query
    );

    res.status(200).json({
      success: true,
      message: "Saved properties fetched successfully",
      data: result
    });
  } catch (error) {
    next(error);
  }
};