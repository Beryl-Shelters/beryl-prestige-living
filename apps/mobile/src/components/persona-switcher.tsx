import { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { customerPersonaForAnalytics, prepareMobileOnboardingAnalytics, trackCustomerEvent } from "@/analytics/customer";
import { FormError, PrimaryButton } from "@/components/ui";
import { useCustomerSession } from "@/store/auth-flow";
import { colors, radii, spacing } from "@/theme/tokens";
import type { NextAction, Persona } from "@/types/auth";

const label = (type: Persona["type"]) => type === "BUYER" ? "Buyer" : "Seller / Developer";
const message = (code?: string) => ({ PERSONA_ALREADY_ACTIVE: "This profile is already active.", PERSONA_NOT_ACTIVATED: "Activate this profile before switching.", INVALID_PERSONA_TYPE: "This profile is not available.", ACCOUNT_VERIFICATION_REQUIRED: "Verify your email before continuing.", ACCOUNT_SUSPENDED: "This account is suspended.", ACCOUNT_LOCKED: "This account is locked.", ONBOARDING_UNAVAILABLE: "Persona updates are temporarily unavailable." }[code ?? ""] ?? "Unable to update your profile.");

export function PersonaSwitcher({ visible, onClose, onNavigate }: { visible: boolean; onClose: () => void; onNavigate: (action: NextAction) => void }) {
  const { personas, activePersona, fetchPersonas, activatePersona, switchPersona, refreshOnboardingStatus } = useCustomerSession();
  const [busy, setBusy] = useState<Persona["type"] | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { if (visible) { setError(""); void fetchPersonas().catch(() => setError("Unable to load profiles.")); } }, [visible]);
  const act = async (persona: Persona) => {
    if (busy || persona.type === activePersona) return;
    setBusy(persona.type);
    setError("");
    try {
      const activating = !persona.activated;
      if (activating) void trackCustomerEvent("Persona Activation Started", { target_persona: customerPersonaForAnalytics(persona.type) });
      const result = activating ? await activatePersona(persona.type) : await switchPersona(persona.type);
      if (activating && (result.nextAction === "COMPLETE_BUYER_ONBOARDING" || result.nextAction === "COMPLETE_SELLER_ONBOARDING")) prepareMobileOnboardingAnalytics("persona_activation");
      const canonical = await refreshOnboardingStatus();
      const nextAction = canonical?.nextAction ?? result.nextAction;
      onClose();
      onNavigate(nextAction);
    } catch (caught) {
      setError(message((caught as { code?: string }).code));
    } finally {
      setBusy(null);
    }
  };
  return <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
    <SafeAreaView style={styles.modalSafe} edges={["top", "left", "right", "bottom"]}>
      <Pressable accessibilityRole="button" accessibilityLabel="Close profile switcher" style={styles.backdrop} onPress={onClose}/>
      <View accessibilityViewIsModal style={styles.sheet}>
        <View style={styles.handle}/>
        <View style={styles.heading}><Text accessibilityRole="header" style={styles.title}>Switch profile</Text><Pressable accessibilityRole="button" accessibilityLabel="Close profile switcher" hitSlop={12} onPress={onClose}><Text style={styles.close}>×</Text></Pressable></View>
        <Text style={styles.copy}>Choose how you want to use Beryl Shelter.</Text>
        <View style={styles.cards}>{personas.map(persona => { const active = persona.type === activePersona; const activated = persona.activated !== false; return <View key={persona.type} style={[styles.card, active && styles.cardActive]}><View style={styles.cardCopy}><Text style={styles.name}>{label(persona.type)}</Text><Text style={styles.detail}>{active ? "Active profile" : activated ? "Ready to switch" : "Set up this profile"}</Text></View>{active ? <Text accessibilityLabel="Current active profile" style={styles.active}>✓ Active</Text> : <View style={styles.buttonWrap}><PrimaryButton title={busy === persona.type ? "Please wait…" : activated ? "Switch" : "Activate"} disabled={Boolean(busy)} onPress={() => void act(persona)}/></View>}</View>; })}</View>
        <FormError>{error}</FormError>
      </View>
    </SafeAreaView>
  </Modal>;
}

const styles = StyleSheet.create({
  modalSafe: { flex: 1, justifyContent: "flex-end" },
  backdrop: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(0,0,0,.38)" },
  sheet: { width: "100%", maxHeight: "85%", backgroundColor: colors.canvas, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: spacing.lg, paddingBottom: spacing.lg },
  handle: { alignSelf: "center", height: 4, width: 42, borderRadius: 4, backgroundColor: colors.line, marginBottom: 18 },
  heading: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, title: { fontSize: 23, fontWeight: "800", color: colors.ink }, close: { fontSize: 30, color: colors.ink, lineHeight: 30 }, copy: { fontSize: 14, color: colors.muted, marginTop: 7, marginBottom: 18 }, cards: { gap: 10 }, card: { minHeight: 84, borderWidth: 1, borderColor: colors.line, borderRadius: radii.control, padding: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }, cardActive: { borderColor: colors.brown, backgroundColor: colors.cream }, cardCopy: { flex: 1, minWidth: 0 }, name: { fontSize: 15, fontWeight: "800", color: colors.ink }, detail: { fontSize: 12, color: colors.muted, marginTop: 4 }, active: { color: colors.success, fontSize: 12, fontWeight: "800" }, buttonWrap: { minWidth: 112, maxWidth: 132 }
});
