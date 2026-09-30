import { Redirect, Stack } from "expo-router";
import { LoadingState, Screen } from "@/components/ui";
import {
  DashboardDrawerProvider,
  DashboardHeaderLeft,
} from "@/components/dashboard/dashboard-drawer";
import { useAuth } from "@/providers/auth-provider";
import { useTheme } from "@/providers/theme-provider";

export default function DashboardLayout() {
  const { status } = useAuth();
  const { colors } = useTheme();

  if (status === "loading" || status === "unavailable") {
    return (
      <Screen>
        <LoadingState label="Checking your account" />
      </Screen>
    );
  }

  if (status !== "signedIn") {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <DashboardDrawerProvider>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.text,
          headerShadowVisible: false,
          headerBackButtonDisplayMode: "minimal",
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="index" options={{ title: "Dashboard", headerLeft: () => <DashboardHeaderLeft /> }} />
        <Stack.Screen name="listings" options={{ headerShown: false }} />
        <Stack.Screen name="analytics" options={{ title: "Analytics", headerLeft: () => <DashboardHeaderLeft /> }} />
        <Stack.Screen name="purchased-properties" options={{ title: "Purchased Properties", headerLeft: () => <DashboardHeaderLeft /> }} />
        <Stack.Screen name="messages" options={{ headerShown: false }} />
        <Stack.Screen name="referrals" options={{ headerShown: false }} />
        <Stack.Screen name="settings" options={{ headerShown: false }} />
        <Stack.Screen name="kyc" options={{ title: "KYC Verification", headerLeft: () => <DashboardHeaderLeft /> }} />
        <Stack.Screen name="[feature]" options={{ title: "Account" }} />
      </Stack>
    </DashboardDrawerProvider>
  );
}
