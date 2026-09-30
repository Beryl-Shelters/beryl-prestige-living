import { Stack } from "expo-router";
import { useTheme } from "@/providers/theme-provider";

export default function PropertiesLayout() {
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
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="[propertyCode]" options={{ title: "Property Details" }} />
    </Stack>
  );
}
