import { PlusJakartaSans_400Regular, PlusJakartaSans_600SemiBold, PlusJakartaSans_700Bold, PlusJakartaSans_800ExtraBold, useFonts } from "@expo-google-fonts/plus-jakarta-sans";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { ActivityIndicator, View } from "react-native";
import { AuthFlowProvider, CustomerSessionProvider } from "@/store/auth-flow";
import { colors } from "@/theme/tokens";
const client=new QueryClient();
export default function Layout(){const[loaded]=useFonts({PlusJakartaSans_400Regular,PlusJakartaSans_600SemiBold,PlusJakartaSans_700Bold,PlusJakartaSans_800ExtraBold});if(!loaded)return <View style={{flex:1,justifyContent:"center"}}><ActivityIndicator color={colors.brown}/></View>;return <KeyboardProvider><StatusBar style="dark"/><QueryClientProvider client={client}><AuthFlowProvider><CustomerSessionProvider><Stack screenOptions={{headerShown:false,animation:"fade"}}/></CustomerSessionProvider></AuthFlowProvider></QueryClientProvider></KeyboardProvider>}
