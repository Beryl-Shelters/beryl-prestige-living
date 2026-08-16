import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { useEffect } from "react";
import { initializeCustomerAnalytics } from "@/analytics/customer";
import { AuthFlowProvider, CustomerSessionProvider } from "@/store/auth-flow";
const client=new QueryClient();
export default function Layout(){useEffect(()=>{void initializeCustomerAnalytics();},[]);return <KeyboardProvider><StatusBar style="dark"/><QueryClientProvider client={client}><AuthFlowProvider><CustomerSessionProvider><Stack screenOptions={{headerShown:false,animation:"fade"}}/></CustomerSessionProvider></AuthFlowProvider></QueryClientProvider></KeyboardProvider>}
