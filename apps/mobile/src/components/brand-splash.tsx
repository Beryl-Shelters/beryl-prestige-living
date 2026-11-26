import { useCallback, useEffect, useState } from "react";
import { Animated, Image, ImageBackground, Platform, StyleSheet, View, useWindowDimensions } from "react-native";
import Svg, { Defs, LinearGradient, Stop, Text as SvgText, TSpan } from "react-native-svg";
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
  const wordmarkWidth = Math.max(0, availableWidth - 56);
  const wordmarkCenter = wordmarkWidth / 2;
  const nameBaseline = nameSize + 2;

  const nameLayer = (fill: string, offsetX = 0, offsetY = 0, opacity = 1) => (
    <SvgText x={wordmarkCenter + offsetX} y={nameBaseline + offsetY} fill={fill} opacity={opacity} fontSize={nameSize} fontWeight="800" fontFamily="sans-serif" letterSpacing={0.2} textAnchor="middle">
      <TSpan fontWeight="900">BERYL</TSpan><TSpan> Shelter</TSpan>
    </SvgText>
  );
  const suffixLayer = (fill: string, offsetX = 0, offsetY = 0, opacity = 1) => (
    <SvgText x={wordmarkCenter + offsetX} y={17 + offsetY} fill={fill} opacity={opacity} fontSize={13} fontWeight="700" fontFamily="sans-serif" letterSpacing={4.1} textAnchor="middle">NIGERIA LIMITED</SvgText>
  );

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
          <Svg width={wordmarkWidth} height={nameSize + 7}>
            <Defs>
              <LinearGradient id="silver-name" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#E8E7E3" />
                <Stop offset="0.23" stopColor="#CAC7C2" />
                <Stop offset="0.44" stopColor="#E0DED9" />
                <Stop offset="0.65" stopColor="#AAA6A0" />
                <Stop offset="0.84" stopColor="#C7C3BD" />
                <Stop offset="1" stopColor="#87837D" />
              </LinearGradient>
            </Defs>
            {nameLayer("#101113", 0.65, 1.15, 0.55)}
            {nameLayer("#F4F2EE", -0.3, -0.4, 0.28)}
            {nameLayer("url(#silver-name)")}
          </Svg>
          <Svg width={wordmarkWidth} height={20} style={styles.companySuffix}>
            <Defs>
              <LinearGradient id="silver-suffix" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#F3F1ED" />
                <Stop offset="0.48" stopColor="#D9D5CF" />
                <Stop offset="1" stopColor="#98938D" />
              </LinearGradient>
            </Defs>
            {suffixLayer("#101113", 0.5, 1, 0.5)}
            {suffixLayer("#F0EEEA", -0.25, -0.3, 0.28)}
            {suffixLayer("url(#silver-suffix)")}
          </Svg>
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
  companySuffix: { marginTop: 5 },
});

