import { Feather } from "@expo/vector-icons";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { marketplaceSearchPath, saveMarketplaceProperty, searchMarketplace, unsaveMarketplaceProperty } from "@/api/marketplace";
import { PersonaSwitcher } from "@/components/persona-switcher";
import { AccountRequiredModal, MarketplaceAccountMenu, MarketplaceEmpty, MarketplaceError, MarketplaceHeader, MarketplaceLoading, PropertyCard } from "@/components/marketplace/marketplace-ui";
import { FilterSheet, SortSheet } from "@/components/marketplace/marketplace-sheets";
import { dedupeProperties, marketplaceDefaults, validatePriceRange } from "@/marketplace/filters";
import { useCustomerSession } from "@/store/auth-flow";
import { colors, radii, sizes, spacing } from "@/theme/tokens";
import type { MarketplaceFilters, MarketplacePropertyCard, MarketplaceSearchResult } from "@/types/marketplace";

export function MarketplaceScreen() {
  const router = useRouter(); const queryClient = useQueryClient();
  const session = useCustomerSession();
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<MarketplaceFilters>(marketplaceDefaults);
  const [draft, setDraft] = useState<MarketplaceFilters>(marketplaceDefaults);
  const [view, setView] = useState<"grid"|"list">("grid");
  const [filtersOpen, setFiltersOpen] = useState(false); const [sortOpen, setSortOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false); const [personaOpen, setPersonaOpen] = useState(false); const [authOpen, setAuthOpen] = useState(false);
  const [filterError, setFilterError] = useState(""); const [actionError, setActionError] = useState("");
  const [savedOverrides, setSavedOverrides] = useState<Record<string,boolean>>({});

  const query = useInfiniteQuery({
    queryKey:["mobile-marketplace",filters,session.isAuthenticated], initialPageParam:1,
    queryFn:({pageParam})=>session.isAuthenticated ? session.authenticatedRequest<MarketplaceSearchResult>(marketplaceSearchPath(filters,pageParam),"GET") : searchMarketplace(filters,pageParam),
    getNextPageParam:(last)=>{const pagination=last.data?.pagination;return pagination&&pagination.page<pagination.total_pages?pagination.page+1:undefined;},
    placeholderData:previous=>previous
  });
  const properties=useMemo(()=>dedupeProperties(query.data?.pages??[]),[query.data?.pages]);
  const total=query.data?.pages[0]?.data?.pagination.total??0;
  const save=useMutation({mutationFn:async(property:MarketplacePropertyCard)=>property.saved?unsaveMarketplaceProperty(session.authenticatedRequest,property.id):saveMarketplaceProperty(session.authenticatedRequest,property.id),onSuccess:async(_,property)=>{setSavedOverrides(current=>({...current,[property.id]:!property.saved}));await queryClient.invalidateQueries({queryKey:["mobile-saved-properties"]});},onError:()=>setActionError("We could not update this saved property. Please try again.")});

  const submitSearch=()=>{const q=search.trim();setSearch(q);setFilters(current=>({...current,q}));};
  const clearSearch=()=>{setSearch("");setFilters(current=>({...current,q:""}));};
  const openFilters=()=>{setDraft(filters);setFilterError("");setFiltersOpen(true);};
  const applyFilters=()=>{const error=validatePriceRange(draft);if(error){setFilterError(error);return;}setFilterError("");setFilters(draft);setFiltersOpen(false);};
  const clearFilters=()=>{const next={...marketplaceDefaults,q:filters.q,sort:filters.sort};setDraft(next);setFilters(next);setFilterError("");};
  const toggleSave=(property:MarketplacePropertyCard)=>{if(!session.isAuthenticated){setAuthOpen(true);return;}if(save.isPending)return;setActionError("");void save.mutateAsync(property);};
  const loadMore=()=>{if(query.hasNextPage&&!query.isFetchingNextPage)void query.fetchNextPage();};
  const header=<View>
    <View style={styles.searchWrap}><Feather name="search" size={21} color={colors.muted}/><TextInput accessibilityLabel="Search an area or property type" value={search} onChangeText={setSearch} onSubmitEditing={submitSearch} returnKeyType="search" placeholder="Search an area or property type" placeholderTextColor={colors.inputPlaceholder} selectionColor={colors.selectionColor} cursorColor={colors.selectionColor} style={styles.search}/>{search?<Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={clearSearch} style={styles.clearSearch}><Feather name="x" size={20} color={colors.muted}/></Pressable>:null}</View>
    <View style={styles.quickFilters}>{[["sliders","Filter by"],[null,"Price"],[null,"Type"],[null,"Beds"]].map(([icon,label])=><Pressable key={label} accessibilityRole="button" accessibilityLabel={`Open ${label} filters`} onPress={openFilters} style={styles.filterPill}>{icon?<Feather name="sliders" size={14} color={colors.ink}/>:null}<Text style={styles.filterPillText}>{label}</Text>{label!=="Filter by"?<Feather name="chevron-down" size={14} color={colors.ink}/>:null}</Pressable>)}</View>
    <View style={styles.resultsHeader}><Text accessibilityLiveRegion="polite" style={styles.count}>{total.toLocaleString("en-NG")} {total===1?"property":"properties"}</Text><View style={styles.resultControls}><Pressable accessibilityRole="button" accessibilityLabel="Open sort options" onPress={()=>setSortOpen(true)} style={styles.sortButton}><Text style={styles.sortText}>Sort: {filters.sort==="DEFAULT"?"Default":"Selected"}</Text><Feather name="chevron-down" size={15} color={colors.ink}/></Pressable><View accessibilityRole="radiogroup" style={styles.viewToggle}><Pressable accessibilityRole="radio" accessibilityLabel="Grid view" accessibilityState={{selected:view==="grid"}} onPress={()=>setView("grid")} style={[styles.viewButton,view==="grid"&&styles.viewButtonSelected]}><Feather name="grid" size={17} color={view==="grid"?colors.white:colors.muted}/></Pressable><Pressable accessibilityRole="radio" accessibilityLabel="List view" accessibilityState={{selected:view==="list"}} onPress={()=>setView("list")} style={[styles.viewButton,view==="list"&&styles.viewButtonSelected]}><Feather name="list" size={18} color={view==="list"?colors.white:colors.muted}/></Pressable></View></View></View>
    {actionError?<Text accessibilityLiveRegion="polite" style={styles.actionError}>{actionError}</Text>:null}
  </View>;
  return <SafeAreaView style={styles.safe} edges={["top","left","right"]}><MarketplaceHeader onMenu={()=>session.isAuthenticated?setAccountOpen(true):setAuthOpen(true)}/><FlatList data={properties} keyExtractor={item=>item.id} ListHeaderComponent={header} renderItem={({item})=>{const property={...item,saved:savedOverrides[item.id]??item.saved};return <PropertyCard property={property} view={view} saving={save.isPending&&save.variables?.id===item.id} onPress={()=>router.push(`/marketplace/${item.id}`)} onToggleSave={()=>toggleSave(property)}/>;}} onEndReached={loadMore} onEndReachedThreshold={.45} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={styles.content} ListEmptyComponent={query.isLoading?<MarketplaceLoading/>:query.isError?<MarketplaceError onRetry={()=>void query.refetch()}/>:<MarketplaceEmpty title="No properties found" copy="Try clearing your search or filters." action="Clear filters and search" onAction={()=>{setSearch("");setFilters(marketplaceDefaults);}}/>} ListFooterComponent={query.isFetchingNextPage?<ActivityIndicator accessibilityLabel="Loading more properties" color={colors.brown} style={styles.footer}/>:null}/>
    <FilterSheet visible={filtersOpen} value={draft} error={filterError} onChange={setDraft} onApply={applyFilters} onClear={clearFilters} onClose={()=>setFiltersOpen(false)}/><SortSheet visible={sortOpen} value={filters.sort} onChange={sort=>setFilters(current=>({...current,sort}))} onClose={()=>setSortOpen(false)}/>
    <AccountRequiredModal visible={authOpen} returnTo="/marketplace" onClose={()=>setAuthOpen(false)}/><MarketplaceAccountMenu visible={accountOpen} onClose={()=>setAccountOpen(false)} onSwitchProfile={()=>setPersonaOpen(true)} logoutPending={session.logoutPending} onLogout={()=>{setAccountOpen(false);void session.logout().finally(()=>router.replace("/login"));}}/><PersonaSwitcher visible={personaOpen} onClose={()=>setPersonaOpen(false)} onNavigate={action=>router.replace(session.routeFromNextAction(action))}/>
  </SafeAreaView>;
}

const styles=StyleSheet.create({safe:{flex:1,backgroundColor:colors.white},content:{paddingBottom:spacing.xxl},searchWrap:{marginHorizontal:spacing.md,marginTop:18,minHeight:58,borderRadius:radii.control,paddingHorizontal:14,flexDirection:"row",alignItems:"center",gap:9,backgroundColor:colors.inputBackground,borderWidth:1,borderColor:colors.inputBorder},search:{flex:1,minWidth:0,height:56,fontSize:15,color:colors.inputText},clearSearch:{width:sizes.touch,height:sizes.touch,alignItems:"center",justifyContent:"center"},quickFilters:{paddingHorizontal:spacing.md,paddingVertical:14,flexDirection:"row",gap:7},filterPill:{minHeight:39,borderWidth:1,borderColor:colors.line,borderRadius:radii.pill,paddingHorizontal:10,flexDirection:"row",alignItems:"center",justifyContent:"center",gap:5,backgroundColor:colors.white},filterPillText:{fontSize:12,fontWeight:"700",color:colors.ink},resultsHeader:{paddingHorizontal:spacing.md,paddingBottom:14,flexDirection:"row",alignItems:"center",justifyContent:"space-between",gap:8},count:{flex:1,fontSize:13,color:colors.muted},resultControls:{flexDirection:"row",alignItems:"center",gap:7},sortButton:{minHeight:39,borderWidth:1,borderColor:colors.line,borderRadius:radii.pill,paddingHorizontal:10,flexDirection:"row",alignItems:"center",gap:5},sortText:{fontSize:11,fontWeight:"700",color:colors.ink},viewToggle:{borderRadius:8,padding:2,flexDirection:"row",backgroundColor:colors.field},viewButton:{width:35,height:35,borderRadius:6,alignItems:"center",justifyContent:"center"},viewButtonSelected:{backgroundColor:colors.ink},actionError:{marginHorizontal:spacing.md,marginBottom:12,borderRadius:radii.control,padding:11,backgroundColor:colors.danger,color:colors.white,fontSize:12},footer:{marginVertical:18}}
);
