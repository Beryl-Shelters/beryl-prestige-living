import { useCallback, useEffect, useState } from "react";
import { Animated, Image, ImageBackground, Platform, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { brandLogoSource } from "./brand-logo";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { SPLASH_EXIT_MS } from "@/lib/onboarding";

const texture = require("../../assets/onboarding/charcoal-texture.jpg");

export function BrandSplash({ exiting = false, onReady }: { exiting?: boolean; onReady?: () => void }) {
  const { width, height } = useWindowDimensions();
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const reducedMotion = useReducedMotion();
  const [reveal] = useState(() => new Animated.Value(0));
  const [pulse] = useState(() => new Animated.Value(1));
  const [screenOpacity] = useState(() => new Animated.Value(1));
  const [loaded, setLoaded] = useState({ texture: false, logo: false });
  const markLoaded = useCallback((asset: "texture" | "logo") => {
    setLoaded((current) => current[asset] ? current : { ...current, [asset]: true });
  }, []);

  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;
    const measure = () => setViewport({ width: window.innerWidth, height: window.innerHeight });
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  useEffect(() => {
    if (!loaded.texture || !loaded.logo || !viewport.width || !viewport.height) return;
    const frame = requestAnimationFrame(() => onReady?.());
    return () => cancelAnimationFrame(frame);
  }, [loaded, onReady, viewport]);

  useEffect(() => {
    if (reducedMotion) {
      reveal.setValue(1);
      pulse.setValue(1);
      return;
    }
    reveal.setValue(0);
    const entrance = Animated.timing(reveal, { toValue: 1, duration: 850, useNativeDriver: true });
    const breathing = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.015, duration: 1800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 1800, useNativeDriver: true }),
      ]),
    );
    entrance.start(({ finished }) => {
      if (finished) breathing.start();
    });
    return () => {
      entrance.stop();
      breathing.stop();
    };
  }, [pulse, reducedMotion, reveal]);

  useEffect(() => {
    if (!exiting) return;
    if (reducedMotion) {
      screenOpacity.setValue(0);
      return;
    }
    const exit = Animated.timing(screenOpacity, { toValue: 0, duration: SPLASH_EXIT_MS, useNativeDriver: true });
    exit.start();
    return () => exit.stop();
  }, [exiting, reducedMotion, screenOpacity]);

  const entranceScale = reveal.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] });
  const availableWidth = viewport.width || width || 320;
  const availableHeight = viewport.height || height || 640;
  const logoSize = Math.round(Math.min(availableWidth * 0.56, availableHeight * 0.29, 232));
  const nameSize = Math.round(Math.max(32, Math.min(availableWidth * 0.095, 38)));

  return (
    <Animated.View
      accessibilityLabel="BERYL Shelter Nigeria Limited"
      onLayout={(event) => {
        const { width: nextWidth, height: nextHeight } = event.nativeEvent.layout;
        setViewport((current) => current.width === nextWidth && current.height === nextHeight ? current : { width: nextWidth, height: nextHeight });
      }}
      style={[styles.fill, { opacity: screenOpacity }]}
    >
      <ImageBackground onLoadEnd={() => markLoaded("texture")} source={texture} resizeMode="cover" style={styles.fill} imageStyle={styles.texture}>
        <View style={styles.scrim} />
        <Animated.View
          style={[
            styles.brand,
            { transform: [{ scale: Animated.multiply(entranceScale, pulse) }] },
          ]}
        >
          <Image accessibilityIgnoresInvertColors onLoadEnd={() => markLoaded("logo")} source={brandLogoSource} resizeMode="contain" style={[styles.logo, { width: logoSize, height: logoSize }]} />
          <Text maxFontSizeMultiplier={1.2} style={[styles.companyName, { fontSize: nameSize, lineHeight: nameSize + 7 }]}>
            <Text style={styles.companyStrong}>BERYL</Text> Shelter
          </Text>
          <Text maxFontSizeMultiplier={1.2} style={styles.companySuffix}>NIGERIA LIMITED</Text>
        </Animated.View>
      </ImageBackground>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fill: { position: "absolute", inset: 0, overflow: "hidden" },
  texture: { width: "100%", height: "100%", opacity: 0.95 },
  scrim: { position: "absolute", inset: 0, backgroundColor: "rgba(13, 17, 23, 0.14)" },
  brand: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 28 },
  logo: { marginBottom: 8 },
  companyName: { color: "#E5A45A", fontWeight: "800", letterSpacing: 0.2, textShadowColor: "rgba(229, 164, 90, 0.22)", textShadowRadius: 7 },
  companyStrong: { fontWeight: "900" },
  companySuffix: { color: "#E8C18E", fontSize: 13, lineHeight: 20, fontWeight: "700", letterSpacing: 4.1, marginTop: 5 },
});

