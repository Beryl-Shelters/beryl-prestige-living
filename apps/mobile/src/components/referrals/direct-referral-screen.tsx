import { Feather } from "@expo/vector-icons";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { requestReferralTracking, submitDirectReferral } from "@/api/referrals";
import { CopyReferralLink, ReferralAlert, ReferralBack, ReferralButton, ReferralChoice, ReferralPage } from "@/components/referrals/referral-ui";
import { referralErrorMessage, referralRoutes } from "@/referrals/helpers";
import { referralQueryKeys } from "@/referrals/query-keys";
import { guestReferrerSchema, referredPersonSchema } from "@/referrals/schemas";
import { useCustomerSession } from "@/store/auth-flow";
import { useReferralFlow } from "@/store/referral-flow";
import { colors, radii, sizes, spacing } from "@/theme/tokens";
import type { DirectReferralRequest, DirectReferralResult, ReferralContactMethod, ReferralPurpose } from "@/types/referrals";
import { normalizeNigerianPhone } from "@/utils/phone";

type Errors = Partial<Record<"referrerName" | "referrerPhone" | "referredName" | "contact" | "consent", string>>;

export function DirectReferralScreen() {
  const router = useRouter(); const queryClient = useQueryClient();
  const session = useCustomerSession(); const { setTrackingIdentity } = useReferralFlow();
  const [referrerName, setReferrerName] = useState(""); const [referrerPhone, setReferrerPhone] = useState("");
  const [referredName, setReferredName] = useState(""); const [contact, setContact] = useState("");
  const [contactMethod, setContactMethod] = useState<ReferralContactMethod>("WHATSAPP"); const [purpose, setPurpose] = useState<ReferralPurpose>("BUYING");
  const [notes, setNotes] = useState(""); const [privateDisclosure, setPrivateDisclosure] = useState(false); const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<Errors>({}); const [globalError, setGlobalError] = useState(""); const [result, setResult] = useState<DirectReferralResult | null>(null);

  const submit = useMutation({ retry: false, mutationFn: (payload: DirectReferralRequest) => submitDirectReferral(payload, session.accessToken), onSuccess: async (response) => { if (!response.data) return; setResult(response.data); await Promise.all([queryClient.invalidateQueries({ queryKey: referralQueryKeys.all }), queryClient.invalidateQueries({ queryKey: referralQueryKeys.context(session.isAuthenticated) })]); }, onError: (error: { code?: string }) => setGlobalError(referralErrorMessage(error.code)) });
  const tracking = useMutation({ retry: false, mutationFn: ({ fullName, phone }: { fullName: string; phone: string }) => requestReferralTracking(fullName, phone), onSuccess: () => { const identity = { fullName: referrerName.trim(), phone: normalizeNigerianPhone(referrerPhone) }; setTrackingIdentity(identity); router.push(referralRoutes.tracking); }, onError: (error: { code?: string }) => setGlobalError(referralErrorMessage(error.code)) });

  const validate = () => {
    const next: Errors = {};
    const guest = session.isAuthenticated ? null : guestReferrerSchema.safeParse({ fullName: referrerName, phone: referrerPhone });
    const referred = referredPersonSchema.safeParse({ fullName: referredName, contactMethod, contact });
    if (guest && !guest.success) guest.error.issues.forEach((issue) => { next[issue.path[0] === "phone" ? "referrerPhone" : "referrerName"] = issue.message; });
    if (!referred.success) referred.error.issues.forEach((issue) => { next[issue.path[0] === "contact" ? "contact" : "referredName"] = issue.message; });
    if (!consent) next.consent = "Confirm that you have permission to share these details";
    setErrors(next);
    if (Object.keys(next).length || !referred.success || (guest && !guest.success)) return null;
    return {
      ...(!session.isAuthenticated && guest?.success ? { referrer: guest.data } : {}),
      referred: { fullName: referred.data.fullName, contactMethod, ...(contactMethod === "EMAIL" ? { email: referred.data.contact.toLowerCase() } : { phone: normalizeNigerianPhone(referred.data.contact) }) },
      purpose, notes: notes.trim() || undefined, privateReferrerDisclosure: privateDisclosure, consent: true as const
    };
  };
  const submitForm = () => { setGlobalError(""); const payload = validate(); if (payload && !submit.isPending) submit.mutate(payload); };

  if (result) return <ReferralPage background={colors.white}>
    <View style={styles.success}>
      <View style={styles.successIcon}><Feather name="check" size={30} color={colors.white}/></View><Text accessibilityRole="header" style={styles.successTitle}>Referral submitted</Text>
      <Text style={styles.successCopy}>We&apos;ll reach out to <Text style={styles.bold}>{result.referral.referredFirstName}</Text> and take it from there, then you earn a commission when the deal is completed.</Text>
      <CopyReferralLink compact value={result.referrer.referralLink}/>
      <View style={styles.successCard}><Text style={styles.successCardTitle}>Meanwhile, track your referral</Text>{result.nextAction === "OPEN_REFERRAL_DASHBOARD" ? <ReferralButton outline label="Go to dashboard" onPress={() => router.replace(referralRoutes.dashboard)}/> : <ReferralButton outline icon="message-circle" label="Send code on WhatsApp" loading={tracking.isPending} onPress={() => tracking.mutate({ fullName: referrerName.trim(), phone: normalizeNigerianPhone(referrerPhone) })}/>}</View>
      <ReferralAlert message={globalError} tone={globalError ? "info" : "error"}/>
      <Pressable accessibilityRole="button" onPress={() => { setResult(null); setReferredName(""); setContact(""); setNotes(""); setConsent(false); setGlobalError(""); }} style={styles.another}><Text style={styles.anotherText}>Refer someone else</Text></Pressable>
    </View>
  </ReferralPage>;

  return <ReferralPage keyboard background={colors.canvas}><ReferralBack/><Text accessibilityRole="header" style={styles.title}>Do you know someone buying or selling a property?</Text><Text style={styles.intro}>Introduce them to Beryl and earn up to 25% commission when the deal completes.</Text>
    {!session.isAuthenticated ? <Section title="About you"><ReferralInput label="Full name" value={referrerName} onChange={setReferrerName} error={errors.referrerName}/><ReferralInput label="Your phone number" value={referrerPhone} onChange={setReferrerPhone} keyboardType="phone-pad" placeholder="0801 234 5678" error={errors.referrerPhone}/></Section> : null}
    <Section title="Who you're referring"><ReferralInput label="Their full name" value={referredName} onChange={setReferredName} error={errors.referredName}/><ReferralChoice label="How should we contact them?" value={contactMethod} onChange={(value) => { setContactMethod(value); setContact(""); }} options={[["WHATSAPP", "WhatsApp"], ["CALL", "Call"], ["EMAIL", "Email"]]}/><ReferralInput label={contactMethod === "EMAIL" ? "Their email address" : "Their phone number"} value={contact} onChange={setContact} keyboardType={contactMethod === "EMAIL" ? "email-address" : "phone-pad"} error={errors.contact}/><ReferralChoice label="Are they buying or selling?" value={purpose} onChange={setPurpose} options={[["BUYING", "Buying"], ["SELLING", "Selling"]]}/><ReferralInput label="Anything else we should know? · Optional" value={notes} onChange={setNotes} multiline maxLength={600}/></Section>
    <ReferralCheck selected={privateDisclosure} onPress={() => setPrivateDisclosure((value) => !value)} title="Don't tell them I referred them" copy="We'll keep your name private when we reach out."/>
    <ReferralCheck selected={consent} onPress={() => setConsent((value) => !value)} title="I have permission to share these details and accept the Referral Terms." error={errors.consent}/>
    <ReferralAlert message={globalError}/><ReferralButton label="Submit Referral" loading={submit.isPending} onPress={submitForm}/>
  </ReferralPage>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) { return <View style={styles.section}><Text style={styles.sectionTitle}>{title}</Text>{children}</View>; }
function ReferralInput({ label, value, onChange, error, keyboardType = "default", placeholder, multiline, maxLength }: { label: string; value: string; onChange: (value: string) => void; error?: string; keyboardType?: "default" | "phone-pad" | "email-address"; placeholder?: string; multiline?: boolean; maxLength?: number }) { return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput accessibilityLabel={label} value={value} onChangeText={onChange} keyboardType={keyboardType} autoCapitalize={keyboardType === "email-address" ? "none" : "sentences"} autoCorrect={keyboardType !== "email-address"} placeholder={placeholder} maxLength={maxLength} multiline={multiline} textAlignVertical={multiline ? "top" : "center"} placeholderTextColor={colors.inputPlaceholder} selectionColor={colors.selectionColor} cursorColor={colors.selectionColor} style={[styles.input, multiline && styles.multiline, error && styles.inputError]}/>{error ? <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text> : null}</View>; }
function ReferralCheck({ selected, onPress, title, copy, error }: { selected: boolean; onPress: () => void; title: string; copy?: string; error?: string }) { return <View><Pressable accessibilityRole="checkbox" accessibilityState={{ checked: selected }} onPress={onPress} style={styles.check}><View style={[styles.checkbox, selected && styles.checkboxOn]}>{selected ? <Feather name="check" size={14} color={colors.white}/> : null}</View><View style={styles.checkCopy}><Text style={styles.checkTitle}>{title}</Text>{copy ? <Text style={styles.checkDetail}>{copy}</Text> : null}</View></Pressable>{error ? <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text> : null}</View>; }

const styles = StyleSheet.create({
  title: { marginTop: 15, fontSize: 27, lineHeight: 34, fontWeight: "900", letterSpacing: -.6, color: colors.ink }, intro: { marginTop: 8, fontSize: 13, lineHeight: 20, color: colors.muted }, section: { marginTop: 24, borderRadius: radii.card, padding: 16, backgroundColor: colors.white }, sectionTitle: { fontSize: 18, fontWeight: "900", color: colors.ink }, field: { marginTop: 16 }, label: { marginBottom: 7, fontSize: 12, fontWeight: "800", color: colors.ink }, input: { minHeight: sizes.input, borderRadius: radii.control, borderWidth: 1, borderColor: colors.inputBorder, paddingHorizontal: 14, fontSize: 15, color: colors.inputText, backgroundColor: colors.inputBackground }, multiline: { minHeight: 104, paddingTop: 13 }, inputError: { borderColor: colors.danger }, error: { marginTop: 5, fontSize: 11, lineHeight: 16, color: colors.danger },
  check: { marginTop: 17, minHeight: 48, flexDirection: "row", alignItems: "flex-start", gap: 11 }, checkbox: { width: 23, height: 23, borderRadius: 5, borderWidth: 1, borderColor: colors.line, alignItems: "center", justifyContent: "center", backgroundColor: colors.white }, checkboxOn: { borderColor: colors.brown, backgroundColor: colors.brown }, checkCopy: { flex: 1 }, checkTitle: { fontSize: 12, lineHeight: 18, fontWeight: "700", color: colors.ink }, checkDetail: { marginTop: 2, fontSize: 11, lineHeight: 16, color: colors.muted },
  success: { flex: 1, paddingTop: 62, alignItems: "stretch" }, successIcon: { alignSelf: "center", width: 50, height: 50, borderRadius: 25, alignItems: "center", justifyContent: "center", backgroundColor: "#2fa260" }, successTitle: { marginTop: 21, textAlign: "center", fontSize: 23, fontWeight: "900", color: colors.ink }, successCopy: { marginTop: 9, textAlign: "center", fontSize: 15, lineHeight: 23, color: colors.ink }, bold: { fontWeight: "800" }, successCard: { marginTop: 22, borderRadius: radii.card, padding: 16, gap: 17, backgroundColor: colors.field }, successCardTitle: { fontSize: 15, fontWeight: "800", color: colors.ink }, another: { minHeight: 48, alignItems: "center", justifyContent: "center", marginTop: 7 }, anotherText: { fontSize: 13, fontWeight: "800", color: colors.brown }
});
