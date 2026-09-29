import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { AppIcon } from "@/components/app-icon";
import { Button, TextField } from "@/components/ui";
import { formatMoneyInput } from "@/lib/money";
import { nigerianStates, propertyFacilities, propertySubtypes } from "@/lib/property-taxonomy";
import { emptyPropertyFilters, type PropertyFilters } from "@/lib/property-types";
import { colors, radius, spacing, typography } from "@/theme/tokens";

function Choice({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="radio" accessibilityState={{ checked: selected }} onPress={onPress} style={[styles.choice, selected && styles.choiceSelected]}><Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>{label}</Text></Pressable>;
}
function ChoiceGroup({ label, values, value, onChange }: { label: string; values: readonly string[]; value: string; onChange: (value: string) => void }) {
  return <View style={styles.group}><Text style={styles.label}>{label}</Text><View style={styles.choices}><Choice label="Any" selected={!value} onPress={() => onChange("")}/>{values.map(item => <Choice key={item} label={item} selected={value === item} onPress={() => onChange(value === item ? "" : item)}/>)}</View></View>;
}

export function PropertyFilterSheet({ visible, draft, setDraft, onClose, onApply, onClear }: {
  visible: boolean;
  draft: PropertyFilters;
  setDraft: (value: PropertyFilters) => void;
  onClose: () => void;
  onApply: () => void;
  onClear: () => void;
}) {
  const update = <K extends keyof PropertyFilters>(key: K, value: PropertyFilters[K]) => setDraft({ ...draft, [key]: value });
  return <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
    <View style={styles.backdrop}><View accessibilityViewIsModal accessibilityLabel="Property filters" style={styles.sheet}>
      <View style={styles.header}><View><Text accessibilityRole="header" style={styles.title}>Filter properties</Text><Text style={styles.help}>Filters are applied to all public listings.</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Close property filters" hitSlop={8} onPress={onClose} style={styles.close}><AppIcon name="close" size={24} color={colors.text}/></Pressable></View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ChoiceGroup label="Property type" values={["Residential", "Commercial"]} value={draft.propertyType} onChange={value => update("propertyType", value)}/>
        <ChoiceGroup label="Property subtype" values={propertySubtypes} value={draft.propertySubtype} onChange={value => update("propertySubtype", value)}/>
        <ChoiceGroup label="State" values={nigerianStates} value={draft.state} onChange={value => update("state", value)}/>
        <TextField label="City" maxLength={100} value={draft.city} onChangeText={value => update("city", value)} placeholder="Enter exact city"/>
        <TextField label="Maximum budget (NGN)" keyboardType="decimal-pad" value={draft.maxPrice} onChangeText={value => { const formatted = formatMoneyInput(value); if (formatted !== null) update("maxPrice", formatted); }} placeholder="e.g. 50,000,000"/>
        <ChoiceGroup label="Bedrooms" values={["1","2","3","4","5","6","7+"]} value={draft.bedrooms} onChange={value => update("bedrooms", value)}/>
        <ChoiceGroup label="Bathrooms" values={["1","2","3","4","5","6","7+"]} value={draft.bathrooms} onChange={value => update("bathrooms", value)}/>
        <ChoiceGroup label="Convenience" values={propertyFacilities} value={draft.facility} onChange={value => update("facility", value)}/>
        <ChoiceGroup label="Sort" values={["latest","oldest","price_asc","price_desc"]} value={draft.sort} onChange={value => update("sort", (value || "latest") as PropertyFilters["sort"])}/>
      </ScrollView>
      <View style={styles.actions}><Button label="Clear filters" variant="secondary" onPress={() => { setDraft(emptyPropertyFilters); onClear(); }}/><Button label="Apply filters" onPress={onApply}/></View>
    </View></View>
  </Modal>;
}

const styles = StyleSheet.create({
  backdrop:{flex:1,justifyContent:"flex-end",backgroundColor:colors.overlay},sheet:{maxHeight:"92%",backgroundColor:colors.background,borderTopLeftRadius:radius.lg,borderTopRightRadius:radius.lg,overflow:"hidden"},header:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",padding:spacing.lg,borderBottomWidth:1,borderBottomColor:colors.border},title:{...typography.heading,color:colors.text},help:{...typography.caption,color:colors.textMuted},close:{width:44,height:44,alignItems:"center",justifyContent:"center"},content:{padding:spacing.lg,gap:spacing.xl},group:{gap:spacing.sm},label:{...typography.label,color:colors.text},choices:{flexDirection:"row",flexWrap:"wrap",gap:spacing.sm},choice:{minHeight:42,justifyContent:"center",paddingHorizontal:spacing.md,borderRadius:radius.pill,borderWidth:1,borderColor:colors.border,backgroundColor:colors.surface},choiceSelected:{backgroundColor:colors.action,borderColor:colors.action},choiceText:{...typography.caption,color:colors.text,fontWeight:"600"},choiceTextSelected:{color:colors.actionText},actions:{padding:spacing.lg,gap:spacing.sm,borderTopWidth:1,borderTopColor:colors.border,backgroundColor:colors.surface},
});
