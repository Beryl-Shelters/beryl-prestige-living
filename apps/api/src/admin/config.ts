import { z } from "zod";

const origin = z.url().refine(value => new URL(value).origin === value, "Use an origin without a path or trailing slash.");
export const adminConfigSchema = z.object({
  appOrigin: origin,
  resendApiKey: z.string().min(1),
  inviteFrom: z.string().trim().min(3).max(320),
  inviteSeconds: z.coerce.number().int().min(3600).max(604800).default(172800),
  production: z.boolean(),
}).superRefine((value,ctx)=>{if(value.production&&!value.appOrigin.startsWith("https:"))ctx.addIssue({code:"custom",message:"Production Admin origin must use HTTPS."});});
export type AdminConfig=z.infer<typeof adminConfigSchema>;
export function loadAdminConfig(source:NodeJS.ProcessEnv):AdminConfig|undefined{
  if(![source.ADMIN_APP_URL,source.RESEND_API_KEY,source.ADMIN_INVITE_FROM_EMAIL].every(Boolean))return undefined;
  const parsed=adminConfigSchema.safeParse({appOrigin:source.ADMIN_APP_URL,resendApiKey:source.RESEND_API_KEY,inviteFrom:source.ADMIN_INVITE_FROM_EMAIL,inviteSeconds:source.ADMIN_INVITE_EXPIRY_SECONDS||172800,production:source.NODE_ENV==="production"});
  if(!parsed.success)throw new Error("Invalid Admin invitation configuration.");
  return parsed.data;
}
