import { router } from "expo-router";
import { Button, Card, Screen, ScreenState, SectionHeading } from "./ui";

export function FeaturePlaceholder({title,description,phase,authenticated=false}:{title:string;description:string;phase:string;authenticated?:boolean}){
  return <Screen><SectionHeading title={title} description={description}/><Card><ScreenState title={`${phase} feature`} message={authenticated?"This authenticated destination is wired into the Mobile navigation and will consume the existing V2 API in its implementation phase.":"This destination is part of the approved Mobile parity plan and will be connected to the existing V2 API in its implementation phase."} action={<Button label="Back" variant="secondary" onPress={()=>router.back()}/>}/></Card></Screen>;
}
