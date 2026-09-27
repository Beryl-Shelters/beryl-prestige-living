import { z } from "zod";
import { passwordSchema } from "../auth/validation.js";

export const adminDepartments=["TECH","MANAGEMENT"] as const;
export const adminRoles=["ADMIN","SUPER_ADMIN"] as const;
export type AdminDepartment=typeof adminDepartments[number];
export type AdminRole=typeof adminRoles[number];
export const inviteAdminSchema=z.object({fullName:z.string().trim().min(2).max(160),email:z.string().trim().toLowerCase().max(254).pipe(z.email()),phoneNumber:z.string().trim().min(5).max(25),department:z.enum(adminDepartments),role:z.enum(adminRoles)}).strict();
export type InviteAdminInput=z.infer<typeof inviteAdminSchema>&{phone:string};
export const adminLoginSchema=z.object({email:z.string().trim().toLowerCase().max(254).pipe(z.email()),password:z.string().min(1).max(128)}).strict();
export const invitationTokenSchema=z.object({token:z.string().regex(/^[A-Za-z0-9_-]{43}$/)}).strict();
export const acceptInvitationSchema=z.object({token:z.string().regex(/^[A-Za-z0-9_-]{43}$/),password:passwordSchema,confirmPassword:z.string()}).strict().refine(value=>value.password===value.confirmPassword,{path:["confirmPassword"],message:"Passwords do not match."});
