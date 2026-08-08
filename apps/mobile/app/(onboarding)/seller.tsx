import { router } from "expo-router";
import { Text } from "react-native";
import { Heading, PrimaryButton, Screen } from "@/components/ui";
export default function SellerPlaceholder(){return <Screen><Heading title="You&apos;re verified" copy="Seller onboarding continues here."/><Text>We&apos;ll help you list your property with confidence.</Text><PrimaryButton title="Continue later" onPress={()=>router.replace("/signup")}/></Screen>;}
