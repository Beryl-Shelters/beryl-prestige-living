import { forwardRef, useImperativeHandle, useMemo, useRef, useState } from "react";
import {
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
} from "react-native";
import Svg, { Path } from "react-native-svg";
import { AppIcon } from "./app-icon";
import { renderStrokesToPng, type Stroke } from "@/lib/png-encoder";
import type { PickedFile } from "@/lib/file-upload-helper";
import { useTheme } from "@/providers/theme-provider";
import { radius, spacing, typography, type ColorTokens } from "@/theme/tokens";

export type SignaturePadRef = {
  clear: () => void;
  hasSignature: () => boolean;
  exportPngFile: () => PickedFile | null;
};

type SignaturePadProps = {
  initialSignatureSaved?: boolean;
  onSignatureChange?: (hasValid: boolean) => void;
  disabled?: boolean;
};

function countPoints(allStrokes: Stroke[]): number {
  return allStrokes.reduce((acc, s) => acc + s.length, 0);
}

function checkValid(allStrokes: Stroke[], existing: boolean): boolean {
  if (existing) return true;
  const pts = countPoints(allStrokes);
  if (pts < 6) return false;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const s of allStrokes) {
    for (const p of s) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
  }
  return (maxX - minX > 15) || (maxY - minY > 15);
}

export const SignaturePad = forwardRef<SignaturePadRef, SignaturePadProps>(
  function SignaturePad(
    { initialSignatureSaved = false, onSignatureChange, disabled = false },
    ref
  ) {
    const { colors } = useTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const [strokes, setStrokes] = useState<Stroke[]>([]);
    const [hasExisting, setHasExisting] = useState(initialSignatureSaved);
    const strokesRef = useRef<Stroke[]>([]);
    strokesRef.current = strokes;

    const padWidth = 340;
    const padHeight = 150;

    const clear = () => {
      setStrokes([]);
      setHasExisting(false);
      onSignatureChange?.(false);
    };

    useImperativeHandle(ref, () => ({
      clear,
      hasSignature: () => checkValid(strokesRef.current, hasExisting),
      exportPngFile: () => {
        if (!checkValid(strokesRef.current, hasExisting)) return null;
        if (hasExisting && strokesRef.current.length === 0) {
          return null; // indicates to backend that existing signature is retained
        }
        const bytes = renderStrokesToPng(strokesRef.current, padWidth, padHeight, 3);
        return {
          uri: `data:image/png;base64,${toBase64(bytes)}`,
          name: "signature.png",
          type: "image/png",
          size: bytes.length,
          bytes,
        };
      },
    }));

    const panResponder = useMemo(
      () =>
        PanResponder.create({
          onStartShouldSetPanResponder: () => !disabled && !hasExisting,
          onMoveShouldSetPanResponder: () => !disabled && !hasExisting,
          onPanResponderGrant: (evt: GestureResponderEvent) => {
            const { locationX, locationY } = evt.nativeEvent;
            const newStroke: Stroke = [{ x: locationX, y: locationY }];
            const next = [...strokesRef.current, newStroke];
            setStrokes(next);
            onSignatureChange?.(checkValid(next, false));
          },
          onPanResponderMove: (evt: GestureResponderEvent) => {
            const { locationX, locationY } = evt.nativeEvent;
            const current = [...strokesRef.current];
            const last = current[current.length - 1];
            if (last) {
              last.push({ x: locationX, y: locationY });
              setStrokes(current);
              onSignatureChange?.(checkValid(current, false));
            }
          },
          onPanResponderRelease: () => {
            onSignatureChange?.(checkValid(strokesRef.current, false));
          },
        }),
      [disabled, hasExisting, onSignatureChange]
    );

    const svgPath = useMemo(() => {
      return strokes
        .map((stroke) => {
          if (stroke.length === 0) return "";
          const first = stroke[0]!;
          let d = `M ${first.x.toFixed(1)} ${first.y.toFixed(1)}`;
          for (let i = 1; i < stroke.length; i++) {
            d += ` L ${stroke[i]!.x.toFixed(1)} ${stroke[i]!.y.toFixed(1)}`;
          }
          return d;
        })
        .join(" ");
    }, [strokes]);

    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.label}>Digital Signature *</Text>
          {(strokes.length > 0 || hasExisting) && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Clear signature"
              onPress={clear}
              style={styles.clearBtn}
            >
              <AppIcon name="trash-outline" size={16} color={colors.danger} />
              <Text style={styles.clearText}>Clear / Re-sign</Text>
            </Pressable>
          )}
        </View>

        {hasExisting && strokes.length === 0 ? (
          <View style={styles.existingBox}>
            <AppIcon name="checkmark-circle" size={28} color={colors.success} />
            <Text style={styles.existingTitle}>Saved signature on file</Text>
            <Text style={styles.existingSubtitle}>
              Tap &quot;Clear / Re-sign&quot; above if you wish to draw a new signature.
            </Text>
          </View>
        ) : (
          <View style={styles.padWrapper} {...panResponder.panHandlers}>
            <Svg width="100%" height={padHeight} style={styles.svg}>
              {svgPath ? (
                <Path
                  d={svgPath}
                  stroke="#17120E"
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
              ) : null}
            </Svg>
            {strokes.length === 0 && (
              <View pointerEvents="none" style={styles.placeholder}>
                <AppIcon name="pencil-outline" size={22} color="#6F675F" />
                <Text style={styles.placeholderText}>Sign with your finger inside this box</Text>
              </View>
            )}
            <View style={styles.baseline} />
          </View>
        )}
      </View>
    );
  }
);

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  if (typeof btoa === "function") {
    return btoa(binary);
  }
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let result = "";
  for (let i = 0; i < len; i += 3) {
    const b0 = bytes[i]!;
    const b1 = i + 1 < len ? bytes[i + 1]! : 0;
    const b2 = i + 2 < len ? bytes[i + 2]! : 0;
    result += chars[b0 >> 2]!;
    result += chars[((b0 & 3) << 4) | (b1 >> 4)]!;
    result += i + 1 < len ? chars[((b1 & 15) << 2) | (b2 >> 6)]! : "=";
    result += i + 2 < len ? chars[b2 & 63]! : "=";
  }
  return result;
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    container: { gap: spacing.xs },
    header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    label: { ...typography.label, color: colors.text },
    clearBtn: { flexDirection: "row", alignItems: "center", gap: spacing.xs, paddingVertical: spacing.xs },
    clearText: { ...typography.caption, color: colors.danger, fontWeight: "600" },
    padWrapper: {
      height: 150,
      backgroundColor: "#FFFFFF",
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: radius.md,
      overflow: "hidden",
      position: "relative",
      justifyContent: "center",
    },
    svg: { flex: 1 },
    placeholder: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      justifyContent: "center",
      alignItems: "center",
      gap: spacing.xs,
      opacity: 0.6,
    },
    placeholderText: { ...typography.caption, color: "#6F675F" },
    baseline: {
      position: "absolute",
      bottom: 28,
      left: 20,
      right: 20,
      height: 1,
      backgroundColor: "#DED8D1",
      borderStyle: "dashed",
    },
    existingBox: {
      height: 130,
      backgroundColor: colors.surfaceMuted,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.xs,
      padding: spacing.md,
    },
    existingTitle: { ...typography.label, color: colors.text },
    existingSubtitle: { ...typography.caption, color: colors.textMuted, textAlign: "center" },
  });
}
