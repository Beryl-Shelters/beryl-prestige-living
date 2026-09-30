import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router, usePathname } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppIcon, type AppIconName } from "../app-icon";
import { BrandLogo } from "../brand-logo";
import { useAuth } from "@/providers/auth-provider";
import { useTheme } from "@/providers/theme-provider";
import { radius, spacing, typography, type ColorTokens } from "@/theme/tokens";

type DrawerContextType = {
  isOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  toggleDrawer: () => void;
};

const DrawerContext = createContext<DrawerContextType | null>(null);

export function useDashboardDrawer(): DrawerContextType {
  const context = useContext(DrawerContext);
  if (!context) {
    return {
      isOpen: false,
      openDrawer: () => {},
      closeDrawer: () => {},
      toggleDrawer: () => {},
    };
  }
  return context;
}

type NavEntry = {
  id: string;
  label: string;
  icon: AppIconName;
  route: string;
};

const dashboardNavItems: NavEntry[] = [
  { id: "overview", label: "Dashboard", icon: "grid-outline", route: "/dashboard" },
  { id: "listings", label: "My Listings", icon: "list-outline", route: "/dashboard/listings" },
  { id: "analytics", label: "Analytics", icon: "analytics-outline", route: "/dashboard/analytics" },
  { id: "messages", label: "Messages", icon: "chatbubble-ellipses-outline", route: "/dashboard/messages" },
  { id: "purchased", label: "Purchased Properties", icon: "home-outline", route: "/dashboard/purchased-properties" },
  { id: "referrals", label: "Referrals", icon: "people-outline", route: "/dashboard/referrals" },
  { id: "withdraw", label: "Withdraw Earnings", icon: "wallet-outline", route: "/dashboard/referrals/withdraw" },
  { id: "settings", label: "Settings", icon: "settings-outline", route: "/dashboard/settings" },
  { id: "kyc", label: "KYC Verification", icon: "shield-checkmark-outline", route: "/dashboard/kyc" },
  { id: "support", label: "Support", icon: "help-circle-outline", route: "/support" },
];

export function DashboardDrawerProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const openDrawer = () => setIsOpen(true);
  const closeDrawer = () => setIsOpen(false);
  const toggleDrawer = () => setIsOpen((prev) => !prev);

  const value = useMemo(
    () => ({ isOpen, openDrawer, closeDrawer, toggleDrawer }),
    [isOpen]
  );

  return (
    <DrawerContext.Provider value={value}>
      {children}
      <DashboardDrawerModal visible={isOpen} onClose={closeDrawer} />
    </DrawerContext.Provider>
  );
}

export function DashboardHeaderLeft() {
  const { openDrawer } = useDashboardDrawer();
  const { colors } = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Open navigation menu"
      onPress={openDrawer}
      hitSlop={12}
      style={{ paddingRight: 14, paddingVertical: 6 }}
    >
      <AppIcon name="menu-outline" size={24} color={colors.text} />
    </Pressable>
  );
}

function DashboardDrawerModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { customer, logout } = useAuth();
  const { colors, effectiveTheme } = useTheme();
  const pathname = usePathname();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const name =
    [customer?.first_name, customer?.last_name].filter(Boolean).join(" ") ||
    "Beryl Customer";
  const email = customer?.email || "customer@berylshelter.com";

  function handleNavigate(route: string) {
    onClose();
    router.push(route as never);
  }

  async function handleLogout() {
    onClose();
    await logout();
    router.replace("/(auth)/login");
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalRoot}>
        {/* Dimmed backdrop */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close navigation drawer"
          style={styles.backdrop}
          onPress={onClose}
        />

        {/* Drawer slide-in container */}
        <View
          style={[
            styles.drawer,
            {
              paddingTop: Math.max(insets.top, 16),
              paddingBottom: Math.max(insets.bottom, 16),
            },
          ]}
        >
          {/* Brand belongs at the top; customer identity belongs in the footer. */}
          <View style={styles.drawerHeader}>
            <BrandLogo />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close menu"
              onPress={onClose}
              hitSlop={10}
              style={styles.closeButton}
            >
              <AppIcon name="close" size={22} color={colors.textMuted} />
            </Pressable>
          </View>

          {/* Nav List with active highlight */}
          <ScrollView
            style={styles.navList}
            contentContainerStyle={styles.navListContent}
            showsVerticalScrollIndicator={false}
          >
            {dashboardNavItems.map((item) => {
              const isActive =
                item.route === "/dashboard"
                  ? pathname === "/dashboard"
                  : pathname === item.route || pathname.startsWith(item.route + "/");

              return (
                <Pressable
                  key={item.id}
                  accessibilityRole="button"
                  accessibilityLabel={item.label}
                  accessibilityState={{ selected: isActive }}
                  onPress={() => handleNavigate(item.route)}
                  style={({ pressed }) => [
                    styles.navItem,
                    isActive && styles.navItemActive,
                    pressed && !isActive && styles.navItemPressed,
                  ]}
                >
                  <AppIcon
                    name={item.icon}
                    size={20}
                    color={isActive ? colors.brandDark : colors.textMuted}
                  />
                  <Text
                    style={[
                      styles.navItemText,
                      isActive && styles.navItemTextActive,
                    ]}
                  >
                    {item.label}
                  </Text>
                  {isActive ? (
                    <View style={styles.activeDot} />
                  ) : null}
                </Pressable>
              );
            })}
          </ScrollView>

          <View style={styles.drawerFooter}>
            <View style={styles.userSection}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{name.slice(0, 1).toUpperCase()}</Text>
              </View>
              <View style={styles.userInfo}>
                <Text style={styles.userName} numberOfLines={1}>{name}</Text>
                <Text style={styles.userEmail} numberOfLines={1}>{email}</Text>
              </View>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back to Home"
              onPress={() => {
                onClose();
                router.replace("/(tabs)");
              }}
              style={({ pressed }) => [
                styles.footerAction,
                pressed && styles.footerActionPressed,
              ]}
            >
              <AppIcon name="arrow-back" size={20} color={colors.text} />
              <Text style={styles.footerActionText}>Back to Home</Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Log out"
              onPress={() => void handleLogout()}
              style={({ pressed }) => [
                styles.footerAction,
                styles.logoutAction,
                pressed && styles.footerActionPressed,
              ]}
            >
              <AppIcon
                name="log-out-outline"
                size={20}
                color={effectiveTheme === "dark" ? "#FCA5A5" : "#C93E3E"}
              />
              <Text
                style={[
                  styles.footerActionText,
                  { color: effectiveTheme === "dark" ? "#FCA5A5" : "#C93E3E" },
                ]}
              >
                Log out
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    modalRoot: {
      flex: 1,
      flexDirection: "row",
    },
    backdrop: {
      ...StyleSheet.absoluteFill,
      backgroundColor: "rgba(0, 0, 0, 0.55)",
    },
    drawer: {
      width: "82%",
      maxWidth: 320,
      backgroundColor: colors.surface,
      borderRightWidth: 1,
      borderRightColor: colors.border,
      zIndex: 10,
    },
    drawerHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
      gap: spacing.xs,
    },
    userSection: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      flex: 1,
    },
    avatar: {
      width: 44,
      height: 44,
      borderRadius: radius.pill,
      backgroundColor: colors.surfaceMuted,
      alignItems: "center",
      justifyContent: "center",
    },
    avatarText: {
      ...typography.heading,
      color: colors.brandDark,
      fontSize: 18,
    },
    userInfo: {
      flex: 1,
      gap: 2,
    },
    userName: {
      ...typography.label,
      color: colors.text,
      fontSize: 15,
      fontWeight: "700",
    },
    userEmail: {
      ...typography.caption,
      color: colors.textMuted,
      fontSize: 12,
    },
    closeButton: {
      padding: spacing.xs,
    },
    navList: {
      flex: 1,
    },
    navListContent: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      gap: 4,
    },
    navItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      paddingVertical: 12,
      paddingHorizontal: spacing.md,
      borderRadius: radius.pill,
    },
    navItemActive: {
      backgroundColor: colors.brandTint,
    },
    navItemPressed: {
      backgroundColor: colors.surfaceMuted,
    },
    navItemText: {
      ...typography.body,
      color: colors.textMuted,
      fontSize: 14,
      fontWeight: "500",
      flex: 1,
    },
    navItemTextActive: {
      color: colors.brandDark,
      fontWeight: "700",
    },
    activeDot: {
      width: 6,
      height: 6,
      borderRadius: radius.pill,
      backgroundColor: colors.brand,
    },
    drawerFooter: {
      paddingHorizontal: spacing.md,
      paddingTop: spacing.md,
      paddingBottom: spacing.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      gap: spacing.sm,
    },
    footerAction: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      paddingVertical: 10,
      paddingHorizontal: spacing.md,
      borderRadius: radius.md,
    },
    footerActionPressed: {
      backgroundColor: colors.surfaceMuted,
    },
    footerActionText: {
      ...typography.body,
      color: colors.text,
      fontSize: 14,
      fontWeight: "600",
    },
    logoutAction: {
      marginTop: 2,
    },
  });
}
