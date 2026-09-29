import { Stack } from "expo-router";
import { colors } from "@/theme/tokens";

export default function ListingsLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        headerShadowVisible: false,
        headerBackButtonDisplayMode: "minimal",
      }}
    >
      <Stack.Screen name="index" options={{ title: "My Listings" }} />
      <Stack.Screen name="[id]" options={{ title: "Listing Details" }} />
    </Stack>
  );
}
