import { redirectSignedInAdmin } from "@/lib/server/session";
import { LoginScreen } from "@/components/login-screen";
export default async function LoginPage() { await redirectSignedInAdmin(); return <LoginScreen />; }
