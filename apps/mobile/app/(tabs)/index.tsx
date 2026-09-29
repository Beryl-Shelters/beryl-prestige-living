import { router } from "expo-router";
import { Button, Card, Screen, SectionHeading, uiStyles } from "@/components/ui";
import { StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing } from "@/theme/tokens";

export default function HomeScreen(){return <Screen><View style={styles.hero}><Text style={uiStyles.display}>Find a place that fits your future.</Text><Text style={uiStyles.muted}>Discover verified Beryl Shelter properties or start listing your own.</Text><View style={uiStyles.stack}><Button label="Browse properties" onPress={()=>router.push("/properties")}/><Button label="List a property" variant="secondary" onPress={()=>router.push("/list")}/></View></View><SectionHeading title="Built for every next step" description="Search, save, compare and manage your property journey from one customer account."/><Card><Text style={uiStyles.title}>Mobile foundation ready</Text><Text style={uiStyles.muted}>Live property content will be connected in Phase 2. No sample listings are shown.</Text></Card></Screen>}
const styles=StyleSheet.create({hero:{backgroundColor:colors.surfaceMuted,borderRadius:radius.lg,padding:spacing.xl,gap:spacing.lg}});
