import { router } from "expo-router";
import { Button, Screen, ScreenState } from "@/components/ui";
export default function NotFound(){return <Screen><ScreenState title="Page not found" message="The destination may have moved or the link is incomplete." action={<Button label="Go home" onPress={()=>router.replace("/")}/>}/></Screen>}
