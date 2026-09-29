import { Stack } from "expo-router";
import { colors } from "@/theme/tokens";
export default function PropertiesLayout(){return <Stack screenOptions={{headerStyle:{backgroundColor:colors.surface},headerTintColor:colors.text,headerShadowVisible:false,headerBackButtonDisplayMode:"minimal"}}><Stack.Screen name="index" options={{headerShown:false}}/><Stack.Screen name="[propertyCode]" options={{title:"Property Details"}}/></Stack>}
