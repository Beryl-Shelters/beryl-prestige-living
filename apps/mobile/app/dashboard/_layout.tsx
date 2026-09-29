import { Redirect, Stack } from "expo-router";
import { LoadingState, Screen } from "@/components/ui";
import { useAuth } from "@/providers/auth-provider";
import { colors } from "@/theme/tokens";
export default function DashboardLayout(){const {status}=useAuth();if(status==="loading"||status==="unavailable")return <Screen><LoadingState label="Checking your account"/></Screen>;if(status!=="signedIn")return <Redirect href="/(auth)/login"/>;return <Stack screenOptions={{headerStyle:{backgroundColor:colors.surface},headerTintColor:colors.text,headerShadowVisible:false,headerBackButtonDisplayMode:"minimal"}}><Stack.Screen name="index" options={{title:"Dashboard"}}/><Stack.Screen name="[feature]" options={{title:"Account"}}/><Stack.Screen name="referrals" options={{headerShown:false}}/></Stack>}
