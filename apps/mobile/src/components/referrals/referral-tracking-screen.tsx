import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import type { TextInput as TextInputType } from "react-native";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { requestReferralTracking, verifyReferralTracking } from "@/api/referrals";
import { ReferralAlert, ReferralBack, ReferralButton, ReferralPage } from "@/components/referrals/referral-ui";
import { referralErrorMessage, referralRoutes } from "@/referrals/helpers";
import { referralQueryKeys } from "@/referrals/query-keys";
import { referralOtpSchema, referralTrackingIdentitySchema } from "@/referrals/schemas";
import { useReferralFlow, referralTrackingSession } from "@/store/referral-flow";
import { colors, radii, sizes, spacing } from "@/theme/tokens";
import { normalizeNigerianPhone } from "@/utils/phone";

export function ReferralTrackingScreen() {
  const router = useRouter(); const queryClient = useQueryClient();
  const flow = useReferralFlow();
  const [fullName, setFullName] = useState(flow.trackingIdentity?.fullName ?? ""); const [phone, setPhone] = useState(flow.trackingIdentity?.phone ?? "");
  const [stage, setStage] = useState<"identity" | "otp">(flow.trackingIdentity ? "otp" : "identity");
  const [digits, setDigits] = useState(["", "", "", "", "", ""]); const [error, setError] = useState(""); const [countdown, setCountdown] = useState(0);
  const refs = useRef<Array<TextInputType | null>>([]);
  useEffect(() => { if (countdown <= 0) return; const timer = setTimeout(() => setCountdown((value) => Math.max(0, value - 1)), 1000); return () => clearTimeout(timer); }, [countdown]);
  const requestCode = useMutation({ retry: false, mutationFn: () => requestReferralTracking(fullName.trim(), normalizeNigerianPhone(phone)), onSuccess: (response) => { const identity = { fullName: fullName.trim(), phone: normalizeNigerianPhone(phone) }; flow.setTrackingIdentity(identity); setStage("otp"); setCountdown(response.data?.resendAvailableIn ?? 60); setError(""); }, onError: (next: { code?: string }) => setError(referralErrorMessage(next.code)) });
  const verifyCode = useMutation({ retry: false, mutationFn: (otp: string) => verifyReferralTracking(normalizeNigerianPhone(phone), otp), onSuccess: async (response) => { const token = response.data?.trackingToken; if (!token) { setError("Referral verification did not return a tracking session."); return; } await referralTrackingSession.save(token); await queryClient.invalidateQueries({ queryKey: referralQueryKeys.all }); router.replace(referralRoutes.dashboard); }, onError: (next: { code?: string }) => { setError(referralErrorMessage(next.code)); setDigits(["", "", "", "", "", ""]); refs.current[0]?.focus(); } });

  const start = () => { const parsed = referralTrackingIdentitySchema.safeParse({ fullName, phone }); if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? "Enter your name and phone number"); return; } setFullName(parsed.data.fullName); setPhone(parsed.data.phone); setError(""); requestCode.mutate(); };
  const submitOtp = (code = digits.join("")) => { const parsed = referralOtpSchema.safeParse(code); if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? "Enter the six-digit code"); return; } if (!verifyCode.isPending) verifyCode.mutate(parsed.data); };
  const change = (value: string, index: number) => { const clean = value.replace(/\D/g, "").slice(-1); const next = [...digits]; next[index] = clean; setDigits(next); setError(""); if (clean && index < 5) refs.current[index + 1]?.focus(); if (next.every(Boolean)) submitOtp(next.join("")); };
  const backspace = (index: number) => { if (!digits[index] && index > 0) refs.current[index - 1]?.focus(); };
  const resend = () => { if (!countdown && !requestCode.isPending) requestCode.mutate(); };

  return <ReferralPage keyboard background={colors.white}><ReferralBack/>{stage === "identity" ? <>
    <Text accessibilityRole="header" style={styles.title}>Track your referrals</Text><Text style={styles.copy}>Enter the name and phone number you used when making your referral. We&apos;ll send a code on WhatsApp.</Text>
    <Field label="Your full name" value={fullName} onChange={setFullName}/><Field label="Your phone number" value={phone} onChange={setPhone} keyboard="phone-pad" placeholder="0801 234 5678"/>
    <ReferralAlert message={error} tone={error.includes("temporarily") ? "info" : "error"}/><ReferralButton label="Send tracking code" loading={requestCode.isPending} onPress={start}/>
  </> : <>
    <Text accessibilityRole="header" style={styles.title}>Track your referrals</Text><Text style={styles.copy}>Enter the six-digit code sent to the phone number you referred with.</Text><Text style={styles.otpLabel}>Enter OTP here</Text>
    <View accessibilityLabel="Six digit referral tracking code" style={styles.otpRow}>{digits.map((digit, index) => <TextInput key={index} ref={(node) => { refs.current[index] = node; }} accessibilityLabel={`Digit ${index + 1}`} value={digit} onChangeText={(value) => change(value, index)} onKeyPress={(event) => { if (event.nativeEvent.key === "Backspace") backspace(index); }} keyboardType="number-pad" textContentType="oneTimeCode" maxLength={1} style={styles.otpBox}/>)}</View>
    <View style={styles.resendRow}><Text style={styles.resendCopy}>Didn&apos;t get it?</Text><Pressable accessibilityRole="button" disabled={Boolean(countdown) || requestCode.isPending} onPress={resend}><Text style={[styles.resend, countdown > 0 && styles.resendDisabled]}>{countdown ? `Resend code in 0:${String(countdown).padStart(2, "0")}` : "Resend code"}</Text></Pressable></View>
    {verifyCode.isPending ? <ActivityIndicator accessibilityLabel="Verifying referral code" color={colors.brown} style={styles.spinner}/> : null}<ReferralAlert message={error} tone={error.includes("temporarily") ? "info" : "error"}/><ReferralButton label="Verify and view referrals" disabled={!digits.every(Boolean)} loading={verifyCode.isPending} onPress={() => submitOtp()}/>
    <Pressable accessibilityRole="button" onPress={() => { setStage("identity"); setDigits(["", "", "", "", "", ""]); setError(""); }} style={styles.change}><Text style={styles.changeText}>Wrong phone? <Text style={styles.changeStrong}>Change it</Text></Text></Pressable>
  </>}</ReferralPage>;
}

function Field({ label, value, onChange, keyboard = "default", placeholder }: { label: string; value: string; onChange: (value: string) => void; keyboard?: "default" | "phone-pad"; placeholder?: string }) { return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput accessibilityLabel={label} value={value} onChangeText={onChange} keyboardType={keyboard} placeholder={placeholder} placeholderTextColor={colors.inputPlaceholder} selectionColor={colors.selectionColor} cursorColor={colors.selectionColor} style={styles.input}/></View>; }
const styles = StyleSheet.create({ title: { marginTop: 28, fontSize: 25, lineHeight: 31, fontWeight: "900", color: colors.ink }, copy: { marginTop: 7, marginBottom: 18, fontSize: 15, lineHeight: 23, color: colors.muted }, field: { marginBottom: 14 }, label: { marginBottom: 7, fontSize: 13, fontWeight: "800", color: colors.ink }, input: { minHeight: sizes.input, borderRadius: radii.control, paddingHorizontal: 14, fontSize: 15, color: colors.inputText, backgroundColor: colors.inputBackground, borderWidth: 1, borderColor: colors.inputBorder }, otpLabel: { marginTop: 11, marginBottom: 8, fontSize: 12, color: colors.ink }, otpRow: { flexDirection: "row", gap: 8 }, otpBox: { flex: 1, minWidth: 0, height: 55, borderRadius: 10, textAlign: "center", fontSize: 20, fontWeight: "800", color: colors.ink, backgroundColor: colors.field }, resendRow: { minHeight: 45, flexDirection: "row", alignItems: "center", gap: 5 }, resendCopy: { fontSize: 13, color: colors.muted }, resend: { fontSize: 13, fontWeight: "800", color: colors.brown }, resendDisabled: { color: colors.ink }, spinner: { marginVertical: 6 }, change: { marginTop: 15, minHeight: 55, borderRadius: radii.pill, alignItems: "center", justifyContent: "center", backgroundColor: "#fff8e8" }, changeText: { fontSize: 13, color: colors.muted }, changeStrong: { fontWeight: "800", color: colors.brown } });
