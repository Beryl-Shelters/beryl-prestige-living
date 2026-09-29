import { Stack } from "expo-router";
import { colors } from "@/theme/tokens";
export default function ReferralsLayout(){return <Stack screenOptions={{headerStyle:{backgroundColor:colors.surface},headerTintColor:colors.text,headerShadowVisible:false,headerBackButtonDisplayMode:"minimal"}}><Stack.Screen name="index" options={{title:"Referrals"}}/><Stack.Screen name="withdraw" options={{title:"Withdraw Earnings"}}/></Stack>}
