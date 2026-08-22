import { Redirect, Slot } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { useCustomerSession } from "@/store/auth-flow";
import { colors } from "@/theme/tokens";
export default function SellerLayout(){const session=useCustomerSession();if(session.isHydrating)return <View style={{flex:1,alignItems:"center",justifyContent:"center"}}><ActivityIndicator color={colors.brown}/></View>;if(!session.isAuthenticated)return <Redirect href="/login"/>;return <Slot/>}
