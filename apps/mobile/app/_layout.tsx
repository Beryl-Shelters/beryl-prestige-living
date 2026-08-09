import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { AuthFlowProvider, CustomerSessionProvider } from "@/store/auth-flow";
const client=new QueryClient();
export default function Layout(){return <KeyboardProvider><StatusBar style="dark"/><QueryClientProvider client={client}><AuthFlowProvider><CustomerSessionProvider><Stack screenOptions={{headerShown:false,animation:"fade"}}/></CustomerSessionProvider></AuthFlowProvider></QueryClientProvider></KeyboardProvider>}
