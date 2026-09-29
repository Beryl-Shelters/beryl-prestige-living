import { Stack } from "expo-router";
import { colors } from "@/theme/tokens";

export default function SettingsLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        headerShadowVisible: false,
        headerBackButtonDisplayMode: "minimal",
      }}
    >
      <Stack.Screen name="index" options={{ title: "Account Settings" }} />
      <Stack.Screen name="profile" options={{ title: "Profile Settings" }} />
      <Stack.Screen name="business" options={{ title: "Business Profile" }} />
      <Stack.Screen name="password" options={{ title: "Change Password" }} />
    </Stack>
  );
}
