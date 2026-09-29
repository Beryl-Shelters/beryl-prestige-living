import { Stack } from "expo-router";
import { colors } from "@/theme/tokens";
export default function AuthLayout(){return <Stack screenOptions={{headerStyle:{backgroundColor:colors.surface},headerTintColor:colors.text,headerShadowVisible:false,headerBackButtonDisplayMode:"minimal"}}><Stack.Screen name="login" options={{title:"Log in"}}/><Stack.Screen name="register" options={{title:"Create account"}}/><Stack.Screen name="verify-email" options={{title:"Verify email"}}/></Stack>}
