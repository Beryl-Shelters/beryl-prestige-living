import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { StyleSheet, View } from "react-native";
import { BrandSplash } from "./brand-splash";
import { OnboardingCarousel } from "./onboarding-carousel";
import { launchDelay, launchDestination, SPLASH_EXIT_MS } from "@/lib/onboarding";
import { useAuth } from "@/providers/auth-provider";

type Phase = "brand" | "transition" | "onboarding" | "hidden";
let launchExperienceHandled = false;

export function LaunchExperience() {
  const pathname = usePathname();
  const { status } = useAuth();
  const startedAt = useRef<number | null>(null);
  const latestPathname = useRef(pathname);
  const latestStatus = useRef(status);
  const [phase, setPhase] = useState<Phase>(() => launchExperienceHandled || pathname !== "/" ? "hidden" : "brand");

  useEffect(() => {
    latestPathname.current = pathname;
    latestStatus.current = status;
  }, [pathname, status]);

  const dismiss = useCallback(() => {
    launchExperienceHandled = true;
    setPhase("hidden");
  }, []);

  useEffect(() => {
    if (phase === "hidden" || pathname === "/") return;
    const timer = setTimeout(dismiss, 0);
    return () => clearTimeout(timer);
  }, [dismiss, pathname, phase]);

  useEffect(() => {
    if (phase !== "brand") return;
    if (startedAt.current === null) startedAt.current = Date.now();
    const remaining = launchDelay(status, Date.now() - startedAt.current);
    const timer = setTimeout(() => {
      launchExperienceHandled = true;
      setPhase("transition");
    }, remaining);
    return () => clearTimeout(timer);
  }, [phase, status]);

  useEffect(() => {
    if (phase !== "transition") return;
    const timer = setTimeout(() => {
      setPhase(launchDestination(latestStatus.current, latestPathname.current));
    }, SPLASH_EXIT_MS);
    return () => clearTimeout(timer);
  }, [phase]);

  if (phase === "hidden") return null;

  return (
    <View accessibilityViewIsModal style={styles.overlay}>
      {phase !== "brand" && status === "signedOut" ? <OnboardingCarousel onNavigate={dismiss} /> : null}
      {phase === "brand" || phase === "transition" ? (
        <>
          <StatusBar style="light" />
          <BrandSplash exiting={phase === "transition"} />
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { position: "absolute", inset: 0, zIndex: 1000, elevation: 1000, backgroundColor: "#242424" },
});

