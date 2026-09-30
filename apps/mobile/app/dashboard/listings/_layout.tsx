import { Pressable, Text } from "react-native";
import { router, Stack } from "expo-router";
import { DashboardHeaderLeft } from "@/components/dashboard/dashboard-drawer";
import { useTheme } from "@/providers/theme-provider";

export default function ListingsLayout() {
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
          title: "My Listings",
          headerLeft: () => <DashboardHeaderLeft />,
          headerRight: () => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Add new listing"
              onPress={() => router.push("/(tabs)/list")}
              hitSlop={8}
              style={{ paddingHorizontal: 10, paddingVertical: 6 }}
            >
              <Text style={{ color: colors.brandDark, fontWeight: "700", fontSize: 14 }}>
                + Add
              </Text>
            </Pressable>
          ),
        }}
      />
      <Stack.Screen name="[id]" options={{ title: "Listing Details" }} />
    </Stack>
  );
}
