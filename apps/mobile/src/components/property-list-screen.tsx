import { useCallback, useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Button, LoadingState, ScreenState } from "@/components/ui";
import { PropertyCard } from "@/components/property-card";
import { AppIcon } from "@/components/app-icon";
import { PropertyFilterSheet } from "@/components/property-filter-sheet";
import { friendlyError } from "@/lib/api-error";
import { propertiesApi, propertyQuery } from "@/lib/properties-api";
import { emptyPropertyFilters, type PropertyFilters, type PublicProperty } from "@/lib/property-types";
import { useAuth } from "@/providers/auth-provider";
import { usePropertyState } from "@/providers/property-state-provider";
import { colors, radius, spacing, typography } from "@/theme/tokens";

const filterCount = (filters: PropertyFilters) => Object.entries(filters).filter(([key, value]) => key !== "sort" && Boolean(value)).length + Number(filters.sort !== "latest");

export function PropertyListScreen() {
  const params = useLocalSearchParams<{ q?: string; ref?: string }>();
  const initialSearch = typeof params.q === "string" ? params.q : "";
  const referralCode = typeof params.ref === "string" ? params.ref : undefined;
  const { status } = useAuth();
  const { savedCodes, refreshSaved, setSaved } = usePropertyState();
  const [draftSearch, setDraftSearch] = useState(initialSearch);
  const [search, setSearch] = useState(initialSearch);
  const [filters, setFilters] = useState<PropertyFilters>(emptyPropertyFilters);
  const [draftFilters, setDraftFilters] = useState<PropertyFilters>(emptyPropertyFilters);
  const [items, setItems] = useState<PublicProperty[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [saving, setSaving] = useState("");
  const [requestVersion, setRequestVersion] = useState(0);
  const key = useMemo(() => propertyQuery(search, filters, page).toString(), [search, filters, page]);

  const load = useCallback(async () => {
    try {
      const result = await propertiesApi.list(new URLSearchParams(key));
      setItems(current => page === 1 ? result.items : [...current.filter(item => !result.items.some(next => next.code === item.code)), ...result.items]);
      setTotalPages(result.totalPages); setTotal(result.total);
    } catch (failure) { setError(friendlyError(failure)); if (page === 1) setItems([]); }
    finally { setLoading(false); setLoadingMore(false); setRefreshing(false); }
  }, [key, page]);
  useEffect(() => { queueMicrotask(() => void load()); }, [load, requestVersion]);
  useEffect(() => { if (status === "signedIn" && items.length) queueMicrotask(() => void refreshSaved(items.map(item => item.code)).catch(() => {})); }, [status, items, refreshSaved]);

  function applySearch() { setLoading(true); setError(""); setPage(1); setSearch(draftSearch.trim()); void propertiesApi.recordSearch().catch(() => {}); }
  function applyFilters() { setLoading(true); setError(""); setPage(1); setFilters(draftFilters); setFilterOpen(false); void propertiesApi.recordSearch().catch(() => {}); }
  function clearFilters() { setLoading(true); setError(""); setPage(1); setFilters(emptyPropertyFilters); setDraftFilters(emptyPropertyFilters); setFilterOpen(false); }
  async function toggleSaved(property: PublicProperty) {
    if (status !== "signedIn") { router.push({ pathname: "/(auth)/login", params: { next: `/properties/${encodeURIComponent(property.code)}${referralCode ? `?ref=${encodeURIComponent(referralCode)}` : ""}` } }); return; }
    if (saving) return; setSaving(property.code);
    try { if (savedCodes.has(property.code)) { await propertiesApi.unsave(property.code); setSaved(property.code, false); } else { await propertiesApi.save(property.code); setSaved(property.code, true); } }
    catch (failure) { setError(friendlyError(failure)); }
    finally { setSaving(""); }
  }
  const count = filterCount(filters);
  const header = (
    <View style={styles.header}>
      <Text accessibilityRole="header" style={styles.title}>Properties</Text>
      <Text style={styles.subtitle}>Only currently listed Beryl Shelter properties are shown.</Text>
      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <AppIcon name="search" size={20} color={colors.textMuted}/>
          <TextInput accessibilityLabel="Search properties" returnKeyType="search" value={draftSearch} onChangeText={setDraftSearch} onSubmitEditing={applySearch} placeholder="Title, code, state or city" placeholderTextColor={colors.textMuted} style={styles.searchInput}/>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Search properties" onPress={applySearch} style={styles.searchButton}>
          <AppIcon name="arrow-forward" size={22} color={colors.actionText}/>
        </Pressable>
      </View>
      <View style={styles.toolbar}>
        <Text style={styles.count}>{loading ? "Finding properties…" : `${total} ${total === 1 ? "property" : "properties"}`}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={`Open property filters${count ? `, ${count} active` : ""}`} onPress={() => { setDraftFilters(filters); setFilterOpen(true); }} style={styles.filterButton}>
          <AppIcon name="options-outline" size={20} color={colors.brandDark}/>
          <Text style={styles.filterText}>Filters{count ? ` (${count})` : ""}</Text>
        </Pressable>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Request Buy Assistance" onPress={() => router.push("/buy-assistance")} style={styles.buyAssistanceBanner}>
        <AppIcon name="compass-outline" size={16} color={colors.brandDark} />
        <Text style={styles.buyAssistanceBannerText}>Looking for specific property criteria? Request Buy Assistance</Text>
      </Pressable>
    </View>
  );
  return <View style={styles.screen}><FlatList data={items} keyExtractor={item => item.code} renderItem={({ item }) => <PropertyCard property={item} referralCode={referralCode} saved={savedCodes.has(item.code)} saving={saving === item.code} onToggleSaved={() => void toggleSaved(item)}/>} contentContainerStyle={styles.content} ListHeaderComponent={header} ListEmptyComponent={loading ? <LoadingState label="Loading available properties"/> : error ? <ScreenState title="Properties unavailable" message={error} action={<Button label="Try again" onPress={() => { setLoading(true); setError(""); setRequestVersion(value => value + 1); }}/>} /> : <ScreenState title="No matching properties" message="Try a different search or clear the active filters." action={<Button label="Clear filters" variant="secondary" onPress={clearFilters}/>} />} ListFooterComponent={items.length ? <View style={styles.footer}>{error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}{page < totalPages ? <Button label="Load more properties" loading={loadingMore} onPress={() => { setLoadingMore(true); setPage(value => value + 1); }}/> : <Text style={styles.end}>You’ve reached the end of the available listings.</Text>}</View> : null} ItemSeparatorComponent={() => <View style={styles.separator}/>} refreshControl={<RefreshControl refreshing={refreshing} tintColor={colors.brandDark} onRefresh={() => { setRefreshing(true); setPage(1); setRequestVersion(value => value + 1); }}/>} keyboardShouldPersistTaps="handled"/>
    <PropertyFilterSheet visible={filterOpen} draft={draftFilters} setDraft={setDraftFilters} onClose={() => setFilterOpen(false)} onApply={applyFilters} onClear={clearFilters}/>
  </View>;
}

const styles = StyleSheet.create({
  screen:{flex:1,backgroundColor:colors.background},
  content:{padding:spacing.lg,paddingBottom:spacing.xxl,flexGrow:1},
  header:{gap:spacing.md,marginBottom:spacing.lg},
  title:{...typography.display,color:colors.text},
  subtitle:{...typography.body,color:colors.textMuted},
  searchRow:{flexDirection:"row",gap:spacing.sm},
  searchBox:{flex:1,minHeight:50,flexDirection:"row",alignItems:"center",gap:spacing.sm,paddingHorizontal:spacing.md,borderRadius:radius.md,borderWidth:1,borderColor:colors.border,backgroundColor:colors.surface},
  searchInput:{...typography.body,color:colors.text,flex:1,minWidth:0},
  searchButton:{width:50,minHeight:50,alignItems:"center",justifyContent:"center",borderRadius:radius.md,backgroundColor:colors.action},
  toolbar:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",gap:spacing.sm},
  count:{...typography.label,color:colors.text},
  filterButton:{minHeight:44,flexDirection:"row",alignItems:"center",gap:spacing.xs,paddingHorizontal:spacing.md,borderRadius:radius.pill,borderWidth:1,borderColor:colors.border,backgroundColor:colors.surface},
  filterText:{...typography.label,color:colors.brandDark},
  buyAssistanceBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  buyAssistanceBannerText: { ...typography.caption, color: colors.brandDark, fontWeight: "600", flex: 1 },
  separator:{height:spacing.lg},
  footer:{gap:spacing.md,paddingTop:spacing.lg},
  error:{...typography.caption,color:colors.danger,textAlign:"center"},
  end:{...typography.caption,color:colors.textMuted,textAlign:"center"},
});
