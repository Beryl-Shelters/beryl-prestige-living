import cloudinary from "../config/cloudinary";
import streamifier from "streamifier";

export type CloudinaryUploadResult = {
  secure_url: string;
  public_id: string;
};

export type CloudinaryDocumentUploadResult = {
  public_id: string;
  resource_type: "raw";
};

export const uploadImageWithPublicId = (
  buffer: Buffer,
  folder: string
): Promise<CloudinaryUploadResult> => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "image"
      },
      (error, result) => {
        if (error) {
          reject(error);
          return;
        }

        if (!result) {
          reject(new Error("Cloudinary upload failed"));
          return;
        }

        resolve({
          secure_url: result.secure_url,
          public_id: result.public_id
        });
      }
    );

    streamifier.createReadStream(buffer).pipe(stream);
  });
};

export const uploadImage = async (
  buffer: Buffer,
  folder: string
): Promise<string> => {
  const result = await uploadImageWithPublicId(buffer, folder);
  return result.secure_url;
};

export const deleteImageFromCloudinary = async (
  publicId: string
): Promise<void> => {
  await cloudinary.uploader.destroy(publicId);
};

export const uploadPropertyDocument = (
  buffer: Buffer,
  folder: string
): Promise<CloudinaryDocumentUploadResult> => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "raw",
        type: "authenticated"
      },
      (error, result) => {
        if (error) {
          reject(error);
          return;
        }

        if (!result) {
          reject(new Error("Cloudinary document upload failed"));
          return;
        }

        resolve({ public_id: result.public_id, resource_type: "raw" });
      }
    );

    streamifier.createReadStream(buffer).pipe(stream);
  });
};

export const deletePropertyDocument = async (
  publicId: string
): Promise<"deleted" | "not_found"> => {
  const result = await cloudinary.uploader.destroy(publicId, {
    resource_type: "raw",
    type: "authenticated",
    invalidate: true
  });

  return result.result === "not found" ? "not_found" : "deleted";
};
