import { useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import SettingsProfileScreen from "./profile";
import SettingsBusinessScreen from "./business";
import SettingsPasswordScreen from "./password";
import { colors, radius, spacing, typography } from "@/theme/tokens";

type SettingsTab = "profile" | "business" | "password";

export default function SettingsIndexScreen() {
  const { tab } = useLocalSearchParams<{ tab?: string }>();
  const initialTab: SettingsTab =
    tab === "business" || tab === "password" ? tab : "profile";
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);

  return (
    <View style={styles.container}>
      {/* Segmented Tab Bar */}
      <View style={styles.tabBar}>
        <Pressable
          style={[styles.tabButton, activeTab === "profile" && styles.tabButtonActive]}
          onPress={() => setActiveTab("profile")}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === "profile" }}
        >
          <Text
            style={[
              styles.tabButtonText,
              activeTab === "profile" && styles.tabButtonTextActive,
            ]}
          >
            Profile
          </Text>
        </Pressable>

        <Pressable
          style={[styles.tabButton, activeTab === "business" && styles.tabButtonActive]}
          onPress={() => setActiveTab("business")}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === "business" }}
        >
          <Text
            style={[
              styles.tabButtonText,
              activeTab === "business" && styles.tabButtonTextActive,
            ]}
          >
            Business
          </Text>
        </Pressable>

        <Pressable
          style={[styles.tabButton, activeTab === "password" && styles.tabButtonActive]}
          onPress={() => setActiveTab("password")}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === "password" }}
        >
          <Text
            style={[
              styles.tabButtonText,
              activeTab === "password" && styles.tabButtonTextActive,
            ]}
          >
            Password
          </Text>
        </Pressable>
      </View>

      {/* Tab Content */}
      <View style={styles.tabContent}>
        {activeTab === "profile" && <SettingsProfileScreen />}
        {activeTab === "business" && <SettingsBusinessScreen />}
        {activeTab === "password" && <SettingsPasswordScreen />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  tabBar: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.xs,
  },
  tabButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
  },
  tabButtonActive: {
    backgroundColor: colors.brandTint,
  },
  tabButtonText: {
    ...typography.caption,
    fontFamily: "PlusJakartaSans-SemiBold",
    color: colors.textMuted,
  },
  tabButtonTextActive: {
    color: colors.brandDark,
    fontFamily: "PlusJakartaSans-Bold",
  },
  tabContent: {
    flex: 1,
  },
});
