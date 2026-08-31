import { NextFunction, Request, Response } from "express";
import { z } from "zod";
import { AppError } from "../../utils/AppError";
import { searchNigeriaLocations } from "./location.service";

const querySchema = z.object({
  q: z.string().trim().min(2).max(80),
}).strict();

export const search = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = querySchema.safeParse(req.query);
    if (!parsed.success) {
      throw new AppError("Enter at least two characters to search", 400, "INVALID_LOCATION_QUERY");
    }
    const locations = await searchNigeriaLocations(parsed.data.q);
    res.json({
      success: true,
      message: "Nigeria locations fetched successfully",
      data: { locations },
    });
  } catch (error) {
    next(error);
  }
};
