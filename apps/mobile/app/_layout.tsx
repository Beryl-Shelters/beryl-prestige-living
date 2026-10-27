import { useCallback, useRef } from "react";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { StyleSheet, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { LaunchExperience } from "@/components/launch-experience";
import { AuthProvider } from "@/providers/auth-provider";
import { PropertyStateProvider } from "@/providers/property-state-provider";
import { ThemeProvider, useTheme } from "@/providers/theme-provider";

void SplashScreen.preventAutoHideAsync().catch(() => {});

function ThemedNavigationShell({ onVisualReady }: { onVisualReady: () => void }) {
  const { colors, effectiveTheme } = useTheme();

  return (
    <>
      <StatusBar style={effectiveTheme === "dark" ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.text,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.background },
          headerBackButtonDisplayMode: "minimal",
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="saved-properties" options={{ title: "Saved Properties" }} />
        <Stack.Screen name="compare-properties" options={{ title: "Compare Properties" }} />
        <Stack.Screen name="dashboard" options={{ headerShown: false }} />
        <Stack.Screen name="referrals/[referralCode]" options={{ title: "Referral" }} />
        <Stack.Screen name="support" options={{ title: "Support" }} />
        <Stack.Screen name="sell-assistance" options={{ headerShown: false }} />
        <Stack.Screen name="buy-assistance" options={{ headerShown: false }} />
        <Stack.Screen name="+not-found" options={{ title: "Not Found" }} />
      </Stack>
      <LaunchExperience onVisualReady={onVisualReady} />
    </>
  );
}

export default function RootLayout() {
  const nativeSplashHidden = useRef(false);
  const rootLaidOut = useRef(false);
  const visualReady = useRef(false);
  const hideNativeSplash = useCallback(() => {
    if (nativeSplashHidden.current || !rootLaidOut.current || !visualReady.current) return;
    nativeSplashHidden.current = true;
    void SplashScreen.hideAsync().catch(() => {});
  }, []);
  const onRootLayout = useCallback(() => {
    rootLaidOut.current = true;
    hideNativeSplash();
  }, [hideNativeSplash]);
  const onVisualReady = useCallback(() => {
    visualReady.current = true;
    hideNativeSplash();
  }, [hideNativeSplash]);

  return (
    <SafeAreaProvider>
      <View onLayout={onRootLayout} style={styles.root}>
        <ThemeProvider>
          <AuthProvider>
            <PropertyStateProvider>
              <ThemedNavigationShell onVisualReady={onVisualReady} />
            </PropertyStateProvider>
          </AuthProvider>
        </ThemeProvider>
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: "#242424" } });
