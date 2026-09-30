import { Ionicons } from "@expo/vector-icons";
import { Platform, Text, type ColorValue } from "react-native";

export type AppIconName = keyof typeof Ionicons.glyphMap;
const symbols: Partial<Record<AppIconName,string>> = {
  "home-outline":"⌂",home:"⌂","search-outline":"⌕",search:"⌕","add-circle-outline":"＋","add-circle":"＋",
  "calculator-outline":"▦",calculator:"▦","person-outline":"♙",person:"♙","share-social-outline":"↗",
  heart:"♥","heart-outline":"♡","image-outline":"▧","location-outline":"⌖","bed-outline":"▱",
  "water-outline":"♧","car-outline":"▣","resize-outline":"◇",checkmark:"✓","checkmark-circle":"✓",
  "information-circle-outline":"ⓘ","arrow-forward":"→","grid-outline":"▦","list-outline":"☷",
  "analytics-outline":"⌁","chatbubble-ellipses-outline":"◌","settings-outline":"⚙","bookmark-outline":"▤",
  "people-outline":"♙","wallet-outline":"▭","shield-checkmark-outline":"✓","help-circle-outline":"?",
  "chevron-forward":"›","options-outline":"☷",close:"×","git-compare-outline":"⇄",
  "menu-outline":"☰","arrow-back":"←","eye-outline":"👁","eye-off-outline":"Ø","log-out-outline":"🚪",
};

export function AppIcon({name,size=20,color="#21170E"}:{name:AppIconName;size?:number;color?:ColorValue}){
  if(Platform.OS!=="web")return <Ionicons accessibilityElementsHidden importantForAccessibility="no-hide-descendants" name={name} size={size} color={color}/>;
  return <Text accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{fontSize:size,lineHeight:size,color}}>{symbols[name]??"•"}</Text>;
}
