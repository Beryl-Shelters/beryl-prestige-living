import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { useRouter } from "expo-router";
import { useCustomerSession } from "@/store/auth-flow";
import { colors } from "@/theme/tokens";

export default function Index(){const router=useRouter();const session=useCustomerSession();useEffect(()=>{if(session.isHydrating)return;if(!session.isAuthenticated){router.replace("/signup");return;}void session.restoreSession().then(status=>router.replace(status?session.routeFromNextAction(status.nextAction):"/signup"));},[session.isHydrating,session.isAuthenticated]);return <View style={{flex:1,justifyContent:"center"}}><ActivityIndicator color={colors.brown}/></View>;}
