import { redirectSignedInAdmin } from "@/lib/server/session";
import { VerifyOtpScreen } from "@/components/verify-otp-screen";
export default async function VerifyOtpPage() { await redirectSignedInAdmin(); return <VerifyOtpScreen />; }
