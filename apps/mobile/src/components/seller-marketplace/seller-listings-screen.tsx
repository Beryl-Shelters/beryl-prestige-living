import { Feather } from "@expo/vector-icons";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { listSellerProperties } from "@/api/seller-marketplace";
import { MarketplaceAccountMenu } from "@/components/marketplace/marketplace-ui";
import { PersonaSwitcher } from "@/components/persona-switcher";
import { SellerHeader, SellerPage, SellerState } from "@/components/seller-marketplace/seller-ui";
import { formatNaira } from "@/marketplace/filters";
import { sellerRoute, sellerSteps, sellerTabs } from "@/seller-marketplace/helpers";
import { useCustomerSession } from "@/store/auth-flow";
import { colors, radii, spacing } from "@/theme/tokens";
import type { SellerStatus, SellerSummary } from "@/types/seller-marketplace";

const actionLabel = (status: SellerSummary["status"]) => status === "DRAFT" ? "Continue" : status === "REJECTED" ? "Make Changes" : status === "LIVE" ? "View listing" : "View details";
const badgeStyle = (status: SellerSummary["status"]) => status === "LIVE" ? styles.liveBadge : status === "REJECTED" ? styles.rejectedBadge : status === "IN_REVIEW" ? styles.reviewBadge : styles.draftBadge;

export function SellerListingRow({ item, onOpen }: { item: SellerSummary; onOpen: () => void }) {
  const step = Math.max(0, sellerSteps.indexOf(item.currentStep ?? "PROPERTY_INFORMATION"));
  return <View style={styles.card}>
    <View style={styles.cardTop}>
      {item.coverImage?.url ? <Image source={{ uri: item.coverImage.url }} style={styles.thumbnail}/> : <View style={styles.thumbnailFallback}><Feather name="home" size={25} color={colors.brown}/></View>}
      <View style={styles.details}>
        <Text style={[styles.badge, badgeStyle(item.status)]}>{item.status.replace("_", " ")}</Text>
        <Text numberOfLines={2} style={styles.title}>{item.title ?? "Untitled Listing"}</Text>
        {item.askingPrice !== null ? <Text style={styles.price}>{formatNaira(item.askingPrice)}</Text> : null}
        {item.status === "IN_REVIEW" && item.submittedAt ? <Text style={styles.meta}>Submitted {new Date(item.submittedAt).toLocaleDateString()}</Text> : null}
      </View>
    </View>
    {item.status === "DRAFT" ? <View style={styles.progressSection}>
      <Text style={styles.progressText}>Step {step + 1} of 4: {(item.currentStep ?? "PROPERTY_INFORMATION").replaceAll("_", " ")}</Text>
      <View style={styles.progressLine}>{sellerSteps.map((value, index) => <View key={value} style={[styles.segment, index <= step && styles.segmentOn]}/>)}</View>
    </View> : null}
    <Pressable accessibilityRole="button" accessibilityLabel={`${actionLabel(item.status)} ${item.title ?? "listing"}`} onPress={onOpen} style={styles.rowAction}>
      <Text style={styles.rowActionText}>{actionLabel(item.status)}</Text><Feather name="chevron-right" size={18} color={colors.brown}/>
    </Pressable>
  </View>;
}

export function SellerListingsScreen() {
  const router = useRouter();
  const session = useCustomerSession();
  const [status, setStatus] = useState<SellerStatus>("ALL");
  const [accountOpen, setAccountOpen] = useState(false);
  const [personaOpen, setPersonaOpen] = useState(false);
  const query = useInfiniteQuery({ queryKey: ["mobile-seller-listings", status], initialPageParam: 1, enabled: session.isAuthenticated, queryFn: ({ pageParam }) => listSellerProperties(session.authenticatedRequest, status, pageParam), getNextPageParam: last => { const pagination = last.data?.pagination; return pagination && pagination.page < pagination.total_pages ? pagination.page + 1 : undefined; } });
  const data = query.data?.pages[0]?.data;
  const items = useMemo(() => { const map = new Map<string, SellerSummary>(); query.data?.pages.forEach(page => page.data?.items.forEach(item => map.set(item.id, item))); return [...map.values()]; }, [query.data]);
  const logout = async () => { setAccountOpen(false); await session.logout(); router.replace("/login"); };
  return <SellerPage>
    <SellerHeader title="My Listings" action={<Pressable accessibilityRole="button" accessibilityLabel="Open account menu" onPress={() => setAccountOpen(true)} style={styles.accountButton}><Feather name="user" size={21} color={colors.brown}/></Pressable>}/>
    <View style={styles.actionsRow}><Text style={styles.screenCopy}>Manage and continue your property listings.</Text><Pressable accessibilityRole="button" onPress={() => router.push("/seller/listings/new")} style={styles.addButton}><Feather name="plus" size={18} color={colors.white}/><Text style={styles.addText}>List property</Text></Pressable></View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScroll} contentContainerStyle={styles.tabs}>{sellerTabs.map(tab => <Pressable key={tab.status} accessibilityRole="tab" accessibilityLabel={`${tab.label}, ${data?.counts[tab.count] ?? 0}`} accessibilityState={{ selected: status === tab.status }} onPress={() => setStatus(tab.status)} style={[styles.tab, status === tab.status && styles.tabOn]}><Text style={[styles.tabText, status === tab.status && styles.tabTextOn]}>{tab.label} {data?.counts[tab.count] ?? 0}</Text></Pressable>)}</ScrollView>
    <FlatList data={items} keyExtractor={item => item.id} contentContainerStyle={styles.list} renderItem={({ item }) => <SellerListingRow item={item} onOpen={() => router.push(sellerRoute(item.nextAction, item.id))}/>} onEndReached={() => { if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage(); }} onEndReachedThreshold={0.4} ListEmptyComponent={query.isLoading ? <SellerState label="Loading your listings"/> : query.isError ? <SellerState error="We could not load your listings." onRetry={() => void query.refetch()}/> : <SellerState error="No listings in this section."/>} ListFooterComponent={query.isFetchingNextPage ? <ActivityIndicator color={colors.brown}/> : null}/>
    <MarketplaceAccountMenu visible={accountOpen} onClose={() => setAccountOpen(false)} onSwitchProfile={() => setPersonaOpen(true)} onLogout={() => void logout()}/>
    <PersonaSwitcher visible={personaOpen} onClose={() => setPersonaOpen(false)} onNavigate={action => router.replace(session.routeFromNextAction(action))}/>
  </SellerPage>;
}

const styles = StyleSheet.create({
  accountButton: { width: 44, height: 44, borderWidth: 1, borderColor: colors.line, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: colors.white },
  actionsRow: { paddingHorizontal: spacing.md, paddingBottom: 8, flexDirection: "row", alignItems: "center", gap: 10 }, screenCopy: { flex: 1, flexShrink: 1, fontSize: 12, lineHeight: 17, color: colors.muted },
  addButton: { minHeight: 42, paddingHorizontal: 17, borderRadius: radii.pill, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, backgroundColor: colors.brown }, addText: { fontSize: 12, fontWeight: "800", color: colors.white },
  tabsScroll: { flexGrow: 0, flexShrink: 0, height: 58 }, tabs: { minHeight: 58, paddingHorizontal: spacing.md, paddingVertical: 10, alignItems: "center", gap: 7 }, tab: { height: 38, minHeight: 38, paddingHorizontal: 12, borderWidth: 1, borderColor: colors.line, borderRadius: radii.pill, alignItems: "center", justifyContent: "center", backgroundColor: colors.white }, tabOn: { borderColor: colors.brown, backgroundColor: colors.cream }, tabText: { fontSize: 11, fontWeight: "700", color: colors.muted }, tabTextOn: { color: colors.brown },
  list: { padding: spacing.md, paddingTop: 6, paddingBottom: spacing.xxl }, card: { marginBottom: 14, padding: 12, borderWidth: 1, borderColor: colors.line, borderRadius: 16, backgroundColor: colors.white }, cardTop: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  thumbnail: { width: 102, height: 102, borderRadius: 12 }, thumbnailFallback: { width: 102, height: 102, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: colors.field }, details: { flex: 1, minWidth: 0, flexShrink: 1 },
  badge: { alignSelf: "flex-start", maxWidth: "100%", paddingHorizontal: 9, paddingVertical: 4, borderRadius: radii.pill, fontSize: 9, lineHeight: 13, fontWeight: "900" }, liveBadge: { color: colors.success, backgroundColor: colors.verifiedBackground }, rejectedBadge: { color: colors.danger, backgroundColor: "#fde7e9" }, reviewBadge: { color: "#965b0d", backgroundColor: colors.softOrange }, draftBadge: { color: colors.muted, backgroundColor: colors.field },
  title: { marginTop: 7, flexShrink: 1, fontSize: 14, lineHeight: 19, fontWeight: "800", color: colors.ink }, price: { marginTop: 6, fontSize: 15, fontWeight: "900", color: colors.ink }, meta: { marginTop: 5, fontSize: 10, color: colors.muted },
  progressSection: { marginTop: 12, paddingTop: 11, borderTopWidth: 1, borderTopColor: colors.line }, progressText: { fontSize: 10, lineHeight: 14, color: colors.brown }, progressLine: { marginTop: 8, flexDirection: "row", gap: 5 }, segment: { height: 4, flex: 1, borderRadius: 3, backgroundColor: colors.line }, segmentOn: { backgroundColor: colors.brown },
  rowAction: { marginTop: 11, minHeight: 42, paddingHorizontal: 12, borderTopWidth: 1, borderTopColor: colors.line, flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 4 }, rowActionText: { fontSize: 12, fontWeight: "800", color: colors.brown }
});
