import { Stack } from "expo-router";
import { DashboardHeaderLeft } from "@/components/dashboard/dashboard-drawer";
import { useTheme } from "@/providers/theme-provider";

export default function MessagesLayout() {
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
          title: "Messages",
          headerLeft: () => <DashboardHeaderLeft />,
        }}
      />
      <Stack.Screen name="[id]" options={{ title: "Conversation" }} />
    </Stack>
  );
}
