import { Stack } from "expo-router";
import { DashboardHeaderLeft } from "@/components/dashboard/dashboard-drawer";
import { useTheme } from "@/providers/theme-provider";

export default function SettingsLayout() {
  const { colors } = useTheme();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        headerShadowVisible: false,
        headerBackButtonDisplayMode: "minimal",
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: "Account Settings",
          headerLeft: () => <DashboardHeaderLeft />,
        }}
      />
      <Stack.Screen name="profile" options={{ title: "Profile Settings" }} />
      <Stack.Screen name="business" options={{ title: "Business Profile" }} />
      <Stack.Screen name="password" options={{ title: "Change Password" }} />
    </Stack>
  );
}
