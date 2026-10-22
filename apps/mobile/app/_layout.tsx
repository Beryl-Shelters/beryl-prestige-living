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

function ThemedNavigationShell() {
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
      <LaunchExperience />
    </>
  );
}

export default function RootLayout() {
  const nativeSplashHidden = useRef(false);
  const hideNativeSplash = useCallback(() => {
    if (nativeSplashHidden.current) return;
    nativeSplashHidden.current = true;
    void SplashScreen.hideAsync().catch(() => {});
  }, []);

  return (
    <SafeAreaProvider>
      <View onLayout={hideNativeSplash} style={styles.root}>
        <ThemeProvider>
          <AuthProvider>
            <PropertyStateProvider>
              <ThemedNavigationShell />
            </PropertyStateProvider>
          </AuthProvider>
        </ThemeProvider>
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: "#242424" } });
