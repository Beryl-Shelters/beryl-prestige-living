import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import { StatusBar } from "expo-status-bar";
import {
  Animated,
  AppState,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type AppStateStatus,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppIcon, type AppIconName } from "./app-icon";
import { BrandLogo } from "./brand-logo";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import {
  ONBOARDING_INTERVAL_MS,
  nextOnboardingSlide,
  onboardingPage,
  shouldAutoAdvance,
} from "@/lib/onboarding";

const slides = [
  {
    key: "refer",
    headline: "Refer a buyer to us and earn up to ₦2M",
    image: require("../../assets/onboarding/refer-and-earn.png"),
    imageLabel: "Customer viewing a successful Beryl Shelter referral payment notification",
  },
  {
    key: "home",
    headline: "Find a verified home you'll love",
    image: require("../../assets/onboarding/verified-home.png"),
    imageLabel: "Happy couple holding the keys to their home",
  },
  {
    key: "sell",
    headline: "Sell with people you can trust",
    image: require("../../assets/onboarding/sell-with-trust.png"),
    imageLabel: "Property professional holding house keys",
  },
] as const;

function Shortcut({ icon, label, onPress }: { icon: AppIconName; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.shortcut, pressed && styles.pressed]}>
      <AppIcon name={icon} color="#815914" size={21} />
      <Text maxFontSizeMultiplier={1.25} style={styles.shortcutText}>{label}</Text>
    </Pressable>
  );
}

export function OnboardingCarousel({ onNavigate }: { onNavigate: () => void }) {
  const { width, height } = useWindowDimensions();
  const compact = width < 350 || height < 690;
  const heroHeight = Math.max(160, Math.min(compact ? 210 : 300, Math.round(height * (compact ? 0.28 : 0.33))));
  const heroWidth = Math.min(width - (compact ? 40 : 56), compact ? 270 : 340);
  const reducedMotion = useReducedMotion();
  const listRef = useRef<FlatList<(typeof slides)[number]>>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialSlideReady = useRef(false);
  const [contentAnimation] = useState(() => new Animated.Value(1));
  const [activeIndex, setActiveIndex] = useState(0);
  const [focused, setFocused] = useState(true);
  const [appState, setAppState] = useState<AppStateStatus>(AppState.currentState);
  const [dragging, setDragging] = useState(false);
  const [timerEpoch, setTimerEpoch] = useState(0);

  const clearTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  const animateContent = useCallback(() => {
    contentAnimation.stopAnimation();
    contentAnimation.setValue(reducedMotion ? 1 : 0);
    if (!reducedMotion) {
      Animated.parallel([
        Animated.timing(contentAnimation, { toValue: 1, duration: 360, useNativeDriver: true }),
      ]).start();
    }
  }, [contentAnimation, reducedMotion]);

  const showSlide = useCallback((index: number, animated: boolean) => {
    setActiveIndex(index);
    listRef.current?.scrollToIndex({ index, animated: animated && !reducedMotion });
  }, [reducedMotion]);

  useFocusEffect(useCallback(() => {
    setFocused(true);
    return () => setFocused(false);
  }, []));

  useEffect(() => {
    const subscription = AppState.addEventListener("change", setAppState);
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!initialSlideReady.current) {
      initialSlideReady.current = true;
      contentAnimation.setValue(1);
      return;
    }
    animateContent();
  }, [activeIndex, animateContent, contentAnimation]);

  useEffect(() => {
    clearTimer();
    if (dragging || !shouldAutoAdvance(focused, appState, reducedMotion)) return;
    timerRef.current = setTimeout(() => {
      showSlide(nextOnboardingSlide(activeIndex, slides.length), true);
    }, ONBOARDING_INTERVAL_MS);
    return clearTimer;
  }, [activeIndex, appState, clearTimer, dragging, focused, reducedMotion, showSlide, timerEpoch]);

  useEffect(() => () => {
    clearTimer();
    contentAnimation.stopAnimation();
  }, [clearTimer, contentAnimation]);

  const animatedContentStyle = useMemo(() => ({
    opacity: contentAnimation,
    transform: [{ translateY: contentAnimation.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
  }), [contentAnimation]);

  function settled(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const index = onboardingPage(event.nativeEvent.contentOffset.x, width, slides.length);
    if (index !== activeIndex) {
      setActiveIndex(index);
    }
    setDragging(false);
    setTimerEpoch((value) => value + 1);
  }

  function navigate(path: "/(auth)/login" | "/(auth)/register", next?: string) {
    onNavigate();
    router.push(next ? { pathname: path, params: { next } } : path);
  }

  return (
    <SafeAreaView edges={["top", "bottom", "left", "right"]} style={styles.root}>
      <StatusBar style="dark" />
      <BrandLogo compact style={styles.logo} />
      <FlatList
        ref={listRef}
        accessibilityLabel="Beryl Shelter introduction"
        CellRendererComponent={({ children, onLayout, style }) => (
          <View onLayout={onLayout} style={[style, styles.carouselCell]}>{children}</View>
        )}
        contentContainerStyle={styles.carouselContent}
        data={slides}
        decelerationRate="fast"
        getItemLayout={(_, index) => ({ index, length: width, offset: width * index })}
        horizontal
        keyExtractor={(item) => item.key}
        onMomentumScrollEnd={settled}
        onScrollBeginDrag={() => {
          clearTimer();
          setDragging(true);
        }}
        onScrollEndDrag={() => setDragging(false)}
        pagingEnabled
        removeClippedSubviews={false}
        renderItem={({ item, index }) => (
          <View style={[styles.slide, { width, paddingHorizontal: compact ? 14 : 22 }]}>
            <Animated.View style={[styles.slideContent, compact && styles.slideContentCompact, index === activeIndex ? animatedContentStyle : undefined]}>
              <View style={[styles.heroFrame, { width: heroWidth, height: heroHeight }]}>
                <Image accessibilityLabel={item.imageLabel} source={item.image} resizeMode="contain" style={styles.heroImage} />
              </View>
              <Text accessibilityRole="header" maxFontSizeMultiplier={1.3} style={[styles.headline, compact && styles.headlineCompact]}>
                {item.headline}
              </Text>
            </Animated.View>
          </View>
        )}
        showsHorizontalScrollIndicator={false}
        style={styles.carousel}
      />
      <View accessibilityLabel={`Slide ${activeIndex + 1} of ${slides.length}`} style={styles.pagination}>
        {slides.map((slide, index) => (
          <View key={slide.key} style={[styles.dot, index === activeIndex && styles.dotActive]} />
        ))}
      </View>
      <View style={[styles.controls, compact && styles.controlsCompact]}>
        <Pressable accessibilityRole="button" onPress={() => navigate("/(auth)/login")} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
          <Text maxFontSizeMultiplier={1.25} style={styles.primaryButtonText}>Log in</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => navigate("/(auth)/register")} style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
          <Text maxFontSizeMultiplier={1.25} style={styles.secondaryButtonText}>Get started</Text>
        </Pressable>
        <Text maxFontSizeMultiplier={1.2} style={styles.supportingText}>Since 2001 · every property verified by our team</Text>
      </View>
      <View style={styles.shortcuts}>
        <Shortcut icon="share-social-outline" label="Refer and earn" onPress={() => navigate("/(auth)/login", "/dashboard/referrals")} />
        <View style={styles.shortcutDivider} />
        <Shortcut icon="analytics-outline" label="Track a referral" onPress={() => navigate("/(auth)/login", "/dashboard/referrals")} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { position: "absolute", inset: 0, backgroundColor: "#FFFFFF", zIndex: 100, elevation: 100 },
  logo: { alignSelf: "center", marginTop: 4 },
  carousel: { flex: 1 },
  carouselCell: { height: "100%" },
  carouselContent: { height: "100%", alignItems: "stretch" },
  slide: { flex: 1, height: "100%" },
  slideContent: { flex: 1, height: "100%", alignItems: "center", justifyContent: "center", gap: 14, paddingVertical: 10 },
  slideContentCompact: { gap: 8, paddingVertical: 4 },
  heroFrame: { flexShrink: 1, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  heroImage: { width: "100%", height: "100%" },
  headline: { color: "#17120E", fontSize: 28, lineHeight: 34, fontWeight: "800", textAlign: "center", letterSpacing: -0.45, paddingHorizontal: 10 },
  headlineCompact: { fontSize: 24, lineHeight: 29 },
  pagination: { minHeight: 28, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingVertical: 8 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#D9C7B1" },
  dotActive: { width: 24, backgroundColor: "#A86F28" },
  controls: { paddingHorizontal: 22, gap: 9 },
  controlsCompact: { paddingHorizontal: 14, gap: 7 },
  primaryButton: { minHeight: 50, borderRadius: 8, backgroundColor: "#A86F28", alignItems: "center", justifyContent: "center", paddingHorizontal: 18 },
  primaryButtonText: { color: "#FFFFFF", fontSize: 16, lineHeight: 22, fontWeight: "800" },
  secondaryButton: { minHeight: 50, borderRadius: 8, borderWidth: 1.5, borderColor: "#A86F28", backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center", paddingHorizontal: 18 },
  secondaryButtonText: { color: "#815914", fontSize: 16, lineHeight: 22, fontWeight: "800" },
  supportingText: { color: "#6F675F", fontSize: 12, lineHeight: 17, textAlign: "center", fontWeight: "500" },
  shortcuts: { minHeight: 58, flexDirection: "row", alignItems: "stretch", marginTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#DED8D1" },
  shortcut: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingHorizontal: 8 },
  shortcutText: { color: "#21170E", fontSize: 13, lineHeight: 18, fontWeight: "700", textAlign: "center" },
  shortcutDivider: { width: StyleSheet.hairlineWidth, backgroundColor: "#DED8D1", marginVertical: 11 },
  pressed: { opacity: 0.72 },
});

