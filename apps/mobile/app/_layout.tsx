import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "@/providers/auth-provider";
import { colors } from "@/theme/tokens";

export default function RootLayout(){return <SafeAreaProvider><AuthProvider><StatusBar style="dark"/><Stack screenOptions={{headerStyle:{backgroundColor:colors.surface},headerTintColor:colors.text,headerShadowVisible:false,contentStyle:{backgroundColor:colors.background},headerBackButtonDisplayMode:"minimal"}}><Stack.Screen name="(tabs)" options={{headerShown:false}}/><Stack.Screen name="(auth)" options={{headerShown:false}}/><Stack.Screen name="dashboard" options={{headerShown:false}}/><Stack.Screen name="referrals/[referralCode]" options={{title:"Referral"}}/><Stack.Screen name="support" options={{title:"Support"}}/><Stack.Screen name="+not-found" options={{title:"Not Found"}}/></Stack></AuthProvider></SafeAreaProvider>}
