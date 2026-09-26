export type InquiryInput={inquiryType:string;name:string;phone:string;email:string;message:string;sourcePage:string};
export async function submitPublicInquiry(input:InquiryInput){const base=process.env.NEXT_PUBLIC_API_BASE_URL;if(!base)throw new Error("Inquiry services are not configured.");
  const response=await fetch(`${base.replace(/\/$/,"")}/api/v1/public/inquiries`,{method:"POST",credentials:"omit",cache:"no-store",headers:{"Content-Type":"application/json"},body:JSON.stringify(input)});const payload=await response.json().catch(()=>null) as {success?:boolean;error?:{message?:string}}|null;
  if(!response.ok||!payload?.success)throw new Error(payload?.error?.message||"Your inquiry could not be submitted. Please try again.");
}
