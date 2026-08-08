import { router } from "expo-router";
import { Text } from "react-native";
import { Heading, PrimaryButton, Screen } from "@/components/ui";
export default function BuyerPlaceholder(){return <Screen><Heading title="You&apos;re verified" copy="Buyer onboarding continues here."/><Text>We&apos;ll help you find a home you can trust.</Text><PrimaryButton title="Continue later" onPress={()=>router.replace("/signup")}/></Screen>;}
