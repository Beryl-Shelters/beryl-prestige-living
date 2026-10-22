import { useEffect, useState } from "react";
import { Animated, Image, ImageBackground, StyleSheet, Text, View } from "react-native";
import { brandLogoSource } from "./brand-logo";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { SPLASH_EXIT_MS } from "@/lib/onboarding";

const texture = require("../../assets/onboarding/charcoal-texture.jpg");

export function BrandSplash({ exiting = false }: { exiting?: boolean }) {
  const reducedMotion = useReducedMotion();
  const [reveal] = useState(() => new Animated.Value(0));
  const [pulse] = useState(() => new Animated.Value(1));
  const [screenOpacity] = useState(() => new Animated.Value(1));

  useEffect(() => {
    if (reducedMotion) {
      reveal.setValue(1);
      pulse.setValue(1);
      return;
    }
    reveal.setValue(0);
    const entrance = Animated.parallel([
      Animated.timing(reveal, { toValue: 1, duration: 850, useNativeDriver: true }),
      Animated.spring(pulse, { toValue: 1, damping: 14, stiffness: 75, mass: 0.8, useNativeDriver: true }),
    ]);
    const breathing = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.025, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.985, duration: 900, useNativeDriver: true }),
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

  const entranceScale = reveal.interpolate({ inputRange: [0, 1], outputRange: [0.86, 1] });

  return (
    <Animated.View accessibilityLabel="BERYL Shelter Nigeria Limited" style={[styles.fill, { opacity: screenOpacity }]}>
      <ImageBackground source={texture} resizeMode="cover" style={styles.fill} imageStyle={styles.texture}>
        <View style={styles.scrim} />
        <Animated.View
          style={[
            styles.brand,
            { opacity: reveal, transform: [{ scale: Animated.multiply(entranceScale, pulse) }] },
          ]}
        >
          <Image accessibilityIgnoresInvertColors source={brandLogoSource} resizeMode="contain" style={styles.logo} />
          <Text maxFontSizeMultiplier={1.2} style={styles.companyName}>
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
  scrim: { position: "absolute", inset: 0, backgroundColor: "rgba(13, 17, 23, 0.34)" },
  brand: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 28 },
  logo: { width: 136, height: 136, marginBottom: 22 },
  companyName: { color: "#E5A45A", fontSize: 31, lineHeight: 38, fontWeight: "500", letterSpacing: 0.2, textShadowColor: "rgba(229, 164, 90, 0.22)", textShadowRadius: 7 },
  companyStrong: { fontWeight: "900" },
  companySuffix: { color: "#E8C18E", fontSize: 13, lineHeight: 20, fontWeight: "700", letterSpacing: 4.1, marginTop: 5 },
});

