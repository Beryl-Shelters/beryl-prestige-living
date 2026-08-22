import { Feather, FontAwesome } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { ActivityIndicator, Image, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuthReturn } from "@/store/auth-flow";
import { colors, radii, sizes, spacing } from "@/theme/tokens";
import { formatNaira, humanizeMarketplaceValue } from "@/marketplace/filters";
import type { MarketplacePropertyCard } from "@/types/marketplace";

export function MarketplaceHeader({ onMenu }: { onMenu: () => void }) {
  return <View style={styles.header}>
    <View style={styles.brand}><Image accessibilityLabel="Beryl Shelter" source={require("../../../assets/brand/beryl-shelter-logo.png")} style={styles.logo}/><Text style={styles.brandText}>Beryl Shelter</Text></View>
    <Pressable accessibilityRole="button" accessibilityLabel="Open account and profile menu" hitSlop={10} onPress={onMenu} style={styles.iconButton}><Feather name="menu" size={24} color={colors.ink}/></Pressable>
  </View>;
}

const Fact = ({ icon, value, label }: { icon: "home" | "droplet" | "circle" | "truck"; value: number | null; label: string }) => value === null ? null : <View style={styles.fact}><Feather name={icon} size={12} color={colors.muted}/><Text style={styles.factText}>{value} {label}</Text></View>;

export function PropertyCard({ property, view, saving, onPress, onToggleSave }: { property: MarketplacePropertyCard; view: "grid" | "list"; saving?: boolean; onPress: () => void; onToggleSave: () => void }) {
  const list = view === "list";
  return <Pressable accessibilityRole="button" accessibilityLabel={`Open ${property.title}`} onPress={onPress} style={[styles.card, list && styles.cardList]}>
    <View style={[styles.imageWrap, list && styles.imageWrapList]}>
      {property.coverImage?.url ? <Image source={{ uri: property.coverImage.url }} style={styles.propertyImage} resizeMode="cover"/> : <View style={styles.imagePlaceholder}><Image source={require("../../../assets/brand/beryl-shelter-logo.png")} style={styles.placeholderLogo}/><Text style={styles.placeholderText}>Beryl Marketplace</Text></View>}
      {property.verified ? <View style={[styles.verified, list && styles.verifiedList]}><Feather name="check-circle" size={12} color={colors.success}/><Text style={styles.verifiedText}>VERIFIED</Text></View> : null}
      <Pressable accessibilityRole="button" accessibilityLabel={property.saved ? "Remove from saved properties" : "Save property"} accessibilityState={{ selected: property.saved, disabled: saving }} disabled={saving} hitSlop={8} onPress={(event) => { event.stopPropagation(); onToggleSave(); }} style={[styles.heart, list && styles.heartList]}>{saving ? <ActivityIndicator size="small" color={colors.brown}/> : <FontAwesome name={property.saved ? "heart" : "heart-o"} size={19} color={colors.ink}/>}</Pressable>
      <View style={styles.photoCount}><Feather name="image" size={12} color={colors.white}/><Text style={styles.photoCountText}>{property.photoCount}</Text></View>
    </View>
    <View style={[styles.body, list && styles.bodyList]}>
      <View style={styles.priceLine}><Text style={[styles.price, list && styles.priceList]}>{formatNaira(property.askingPrice)}</Text>{property.negotiable ? <Text style={styles.negotiable}>Negotiable</Text> : null}</View>
      <Text numberOfLines={list ? 2 : 3} style={[styles.title, list && styles.titleList]}>{property.title}</Text>
      <View style={styles.typePill}><Text style={styles.typeText}>{humanizeMarketplaceValue(property.propertyType)}</Text></View>
      <View style={styles.location}><Feather name="map-pin" size={14} color={colors.muted}/><Text style={styles.locationText}>{property.publicLocation}</Text></View>
      <View style={styles.facts}><Fact icon="home" value={property.bedrooms} label="Beds"/><Fact icon="droplet" value={property.bathrooms} label="Baths"/><Fact icon="circle" value={property.toilets} label="Toilets"/><Fact icon="truck" value={property.parkingSpaces} label="Parking"/></View>
    </View>
  </Pressable>;
}

export function AccountRequiredModal({ visible, returnTo, onClose }: { visible: boolean; returnTo: string; onClose: () => void }) {
  const router = useRouter(); const { setReturnTo } = useAuthReturn();
  const go = (path: "/signup" | "/login") => { setReturnTo(returnTo); onClose(); router.push(path); };
  return <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}><SafeAreaView style={styles.modalSafe}><Pressable style={styles.backdrop} onPress={onClose}/><View accessibilityViewIsModal style={styles.authModal}>
    <Pressable accessibilityRole="button" accessibilityLabel="Close account prompt" onPress={onClose} style={styles.modalClose}><Feather name="x" size={24} color={colors.ink}/></Pressable>
    <View style={styles.accountIcon}><Feather name="user" size={34} color={colors.brown}/><Feather name="heart" size={17} color={colors.brown}/></View>
    <Text accessibilityRole="header" style={styles.authTitle}>Set up a free account to continue</Text>
    <Text style={styles.authCopy}>Takes under a minute. We&apos;ll bring you right back here.</Text>
    <View style={styles.benefits}>{[["message-square","Register Interest","Our sales team contacts you about this property."],["map-pin","Get the full address","Shared once we&apos;re in touch, so you can arrange a viewing."],["heart","Save what you like","Keep properties in one place and compare later."]].map(([icon,title,copy])=><View key={title} style={styles.benefit}><Feather name={icon as "heart"} size={19} color={colors.brown}/><View style={styles.benefitBody}><Text style={styles.benefitTitle}>{title}</Text><Text style={styles.benefitCopy}>{copy}</Text></View></View>)}</View>
    <Pressable accessibilityRole="button" onPress={()=>go("/signup")} style={styles.primary}><Text style={styles.primaryText}>Create free account</Text></Pressable>
    <Pressable accessibilityRole="button" onPress={()=>go("/login")} style={styles.loginButton}><Text style={styles.loginText}>I already have an account</Text></Pressable>
  </View></SafeAreaView></Modal>;
}

export function MarketplaceAccountMenu({ visible, onClose, onSwitchProfile, onLogout }: { visible: boolean; onClose: () => void; onSwitchProfile: () => void; onLogout: () => void }) {
  const router = useRouter();
  return <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}><SafeAreaView style={styles.menuSafe}><Pressable style={styles.backdrop} onPress={onClose}/><View accessibilityViewIsModal style={styles.accountMenu}><View style={styles.menuHandle}/><View style={styles.menuHeading}><Text accessibilityRole="header" style={styles.menuTitle}>Account</Text><Pressable accessibilityRole="button" accessibilityLabel="Close account menu" onPress={onClose} style={styles.iconButton}><Feather name="x" size={23} color={colors.ink}/></Pressable></View>
    <Pressable accessibilityRole="button" onPress={()=>{onClose();router.push("/saved");}} style={styles.menuRow}><Feather name="heart" size={20} color={colors.brown}/><Text style={styles.menuLabel}>Saved properties</Text><Feather name="chevron-right" size={19} color={colors.muted}/></Pressable>
    <Pressable accessibilityRole="button" onPress={()=>{onClose();onSwitchProfile();}} style={styles.menuRow}><Feather name="repeat" size={20} color={colors.brown}/><Text style={styles.menuLabel}>Switch profile</Text><Feather name="chevron-right" size={19} color={colors.muted}/></Pressable>
    <Pressable accessibilityRole="button" onPress={onLogout} style={styles.menuRow}><Feather name="log-out" size={20} color={colors.brown}/><Text style={styles.menuLabel}>Log out</Text></Pressable>
  </View></SafeAreaView></Modal>;
}

export function MarketplaceLoading({ label = "Loading properties" }: { label?: string }) { return <View accessibilityLabel={label} style={styles.state}><ActivityIndicator color={colors.brown}/><Text style={styles.stateCopy}>{label}…</Text></View>; }
export function MarketplaceEmpty({ title, copy, action, onAction }: { title: string; copy: string; action?: string; onAction?: () => void }) { return <View style={styles.state}><Feather name="home" size={32} color={colors.brown}/><Text accessibilityRole="header" style={styles.stateTitle}>{title}</Text><Text style={styles.stateCopy}>{copy}</Text>{action&&onAction?<Pressable accessibilityRole="button" onPress={onAction} style={styles.stateButton}><Text style={styles.stateButtonText}>{action}</Text></Pressable>:null}</View>; }
export function MarketplaceError({ onRetry }: { onRetry: () => void }) { return <MarketplaceEmpty title="We could not load properties" copy="Please check your connection and try again." action="Retry" onAction={onRetry}/>; }

const styles=StyleSheet.create({
  header:{minHeight:60,paddingHorizontal:spacing.md,flexDirection:"row",alignItems:"center",justifyContent:"space-between",borderBottomWidth:1,borderBottomColor:colors.line,backgroundColor:colors.white},brand:{flexDirection:"row",alignItems:"center",gap:8},logo:{width:31,height:31,resizeMode:"contain"},brandText:{fontSize:15,fontWeight:"800",color:colors.brown},iconButton:{width:sizes.touch,height:sizes.touch,alignItems:"center",justifyContent:"center"},
  card:{marginHorizontal:spacing.md,marginBottom:24,backgroundColor:colors.white},cardList:{minHeight:174,flexDirection:"row",borderBottomWidth:1,borderBottomColor:colors.line,paddingBottom:16},imageWrap:{height:235,borderRadius:14,overflow:"hidden",backgroundColor:colors.field},imageWrapList:{width:"39%",height:174,borderRadius:10},propertyImage:{width:"100%",height:"100%"},imagePlaceholder:{flex:1,alignItems:"center",justifyContent:"center",backgroundColor:colors.field},placeholderLogo:{width:42,height:42,resizeMode:"contain",opacity:.68},placeholderText:{marginTop:6,fontSize:11,fontWeight:"700",color:colors.muted},verified:{position:"absolute",top:10,left:10,flexDirection:"row",alignItems:"center",gap:4,borderRadius:5,paddingHorizontal:8,paddingVertical:5,backgroundColor:colors.verifiedBackground},verifiedList:{left:48,paddingHorizontal:5},verifiedText:{fontSize:10,fontWeight:"800",color:colors.success},heart:{position:"absolute",top:10,right:10,width:42,height:42,borderRadius:21,alignItems:"center",justifyContent:"center",backgroundColor:colors.white},heartList:{left:8,right:undefined,width:36,height:36,borderRadius:18},photoCount:{position:"absolute",right:9,bottom:9,flexDirection:"row",alignItems:"center",gap:4,borderRadius:4,paddingHorizontal:7,paddingVertical:5,backgroundColor:"rgba(18,18,17,.78)"},photoCountText:{fontSize:10,fontWeight:"800",color:colors.white},body:{paddingTop:12,minWidth:0},bodyList:{flex:1,paddingTop:2,paddingLeft:12,minWidth:0},priceLine:{flexDirection:"row",alignItems:"center",gap:7,flexWrap:"wrap"},price:{fontSize:20,fontWeight:"900",color:colors.ink},priceList:{fontSize:16},negotiable:{fontSize:9,fontWeight:"800",textTransform:"uppercase",color:colors.brown},title:{fontSize:15,lineHeight:21,fontWeight:"800",color:colors.ink,marginTop:5},titleList:{fontSize:13,lineHeight:18},typePill:{alignSelf:"flex-start",maxWidth:"100%",borderWidth:1,borderColor:colors.brown,borderRadius:radii.pill,paddingHorizontal:9,paddingVertical:4,marginTop:8},typeText:{flexShrink:1,fontSize:10,lineHeight:14,color:colors.brown},location:{flexDirection:"row",alignItems:"flex-start",gap:5,marginTop:8,minWidth:0},locationText:{flex:1,minWidth:0,flexShrink:1,fontSize:11,lineHeight:16,color:colors.muted},facts:{flexDirection:"row",flexWrap:"wrap",gap:6,marginTop:9},fact:{flexDirection:"row",alignItems:"center",gap:4,borderRadius:5,paddingHorizontal:7,paddingVertical:5,backgroundColor:colors.field},factText:{fontSize:10,color:colors.muted},
  modalSafe:{flex:1,justifyContent:"center",padding:spacing.md},backdrop:{...StyleSheet.absoluteFill,backgroundColor:colors.overlay},authModal:{borderRadius:20,padding:20,backgroundColor:colors.white},modalClose:{position:"absolute",zIndex:2,top:12,right:12,width:sizes.touch,height:sizes.touch,alignItems:"center",justifyContent:"center"},accountIcon:{alignSelf:"center",marginTop:16,flexDirection:"row",alignItems:"flex-end"},authTitle:{marginTop:16,textAlign:"center",fontSize:21,fontWeight:"900",color:colors.ink},authCopy:{marginTop:6,textAlign:"center",fontSize:13,lineHeight:19,color:colors.muted},benefits:{marginTop:20,borderRadius:14,padding:16,gap:16,backgroundColor:colors.canvas},benefit:{flexDirection:"row",alignItems:"flex-start",gap:12},benefitBody:{flex:1},benefitTitle:{fontSize:13,fontWeight:"800",color:colors.ink},benefitCopy:{marginTop:3,fontSize:12,lineHeight:18,color:colors.muted},primary:{minHeight:sizes.button,borderRadius:radii.pill,paddingHorizontal:24,alignItems:"center",justifyContent:"center",backgroundColor:colors.brown,marginTop:20},primaryText:{color:colors.white,fontSize:15,fontWeight:"800"},loginButton:{minHeight:48,paddingHorizontal:20,alignItems:"center",justifyContent:"center"},loginText:{color:colors.brown,fontWeight:"800"},
  menuSafe:{flex:1,justifyContent:"flex-end"},accountMenu:{borderTopLeftRadius:24,borderTopRightRadius:24,padding:spacing.lg,paddingBottom:spacing.xl,backgroundColor:colors.white},menuHandle:{alignSelf:"center",width:42,height:4,borderRadius:4,backgroundColor:colors.line,marginBottom:14},menuHeading:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",marginBottom:8},menuTitle:{fontSize:22,fontWeight:"900",color:colors.ink},menuRow:{minHeight:58,borderTopWidth:1,borderTopColor:colors.line,flexDirection:"row",alignItems:"center",gap:12},menuLabel:{flex:1,fontSize:15,fontWeight:"700",color:colors.ink},
  state:{minHeight:280,alignItems:"center",justifyContent:"center",padding:spacing.lg},stateTitle:{fontSize:20,fontWeight:"900",color:colors.ink,marginTop:12,textAlign:"center"},stateCopy:{fontSize:13,lineHeight:20,color:colors.muted,marginTop:6,textAlign:"center"},stateButton:{marginTop:16,minHeight:44,borderRadius:radii.pill,paddingHorizontal:24,alignItems:"center",justifyContent:"center",backgroundColor:colors.brown},stateButtonText:{color:colors.white,fontWeight:"800"}
});
