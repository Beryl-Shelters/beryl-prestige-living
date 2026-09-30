import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Line, Polyline, Text as SvgText } from "react-native-svg";
import type { DashboardOverview } from "@/lib/dashboard-api";
import { formatNaira } from "@/lib/money";
import { useTheme } from "@/providers/theme-provider";
import { radius, spacing, typography, type ColorTokens } from "@/theme/tokens";

export function RevenueChart({ revenue }: { revenue: DashboardOverview["revenue"] }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [period, setPeriod] = useState<"monthly" | "yearly">("monthly");
  const points = revenue[period] ?? [];
  const total = points.reduce((sum, p) => sum + p.amount, 0);

  // Layout geometry for SVG
  const chartWidth = 320;
  const chartHeight = 150;
  const paddingLeft = 45;
  const paddingRight = 15;
  const paddingTop = 15;
  const paddingBottom = 25;

  const innerWidth = chartWidth - paddingLeft - paddingRight;
  const innerHeight = chartHeight - paddingTop - paddingBottom;

  const maxVal = Math.max(0, ...points.map((p) => p.amount));
  const ceiling = Math.max(2, Math.ceil(maxVal));

  const coords = points.map((p, index) => {
    const x =
      points.length <= 1
        ? paddingLeft + innerWidth / 2
        : paddingLeft + (index / (points.length - 1)) * innerWidth;
    const y = paddingTop + innerHeight - (p.amount / ceiling) * innerHeight;
    return { x, y, point: p };
  });

  const polylinePoints = coords.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ");

  const yRatios = [1, 0.75, 0.5, 0.25, 0];

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.titleCol}>
          <Text style={styles.sectionLabel}>INVESTMENTS</Text>
          <Text style={styles.heading}>Cumulative Revenue</Text>
          <Text style={styles.totalAmount}>{formatNaira(total)}</Text>
        </View>

        <View style={styles.toggleGroup} accessibilityRole="radiogroup">
          <Pressable
            accessibilityRole="radio"
            accessibilityLabel="Monthly revenue"
            accessibilityState={{ checked: period === "monthly" }}
            onPress={() => setPeriod("monthly")}
            style={[styles.toggleBtn, period === "monthly" && styles.toggleBtnActive]}
          >
            <Text style={[styles.toggleText, period === "monthly" && styles.toggleTextActive]}>
              Monthly
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="radio"
            accessibilityLabel="Yearly revenue"
            accessibilityState={{ checked: period === "yearly" }}
            onPress={() => setPeriod("yearly")}
            style={[styles.toggleBtn, period === "yearly" && styles.toggleBtnActive]}
          >
            <Text style={[styles.toggleText, period === "yearly" && styles.toggleTextActive]}>
              Yearly
            </Text>
          </Pressable>
        </View>
      </View>

      <View
        style={styles.chartWrapper}
        accessibilityLabel={`${period === "monthly" ? "Monthly" : "Yearly"} revenue chart, total ${formatNaira(total)}`}
      >
        <Svg width="100%" height={chartHeight} viewBox={`0 0 ${chartWidth} ${chartHeight}`}>
          {/* Horizontal gridlines and Y-axis labels */}
          {yRatios.map((ratio) => {
            const y = paddingTop + innerHeight * (1 - ratio);
            return (
              <Line
                key={`grid-${ratio}`}
                x1={paddingLeft}
                y1={y}
                x2={chartWidth - paddingRight}
                y2={y}
                stroke={colors.border}
                strokeDasharray="3, 3"
                strokeWidth={1}
              />
            );
          })}

          {/* Y-axis text labels */}
          {yRatios.map((ratio) => {
            const y = paddingTop + innerHeight * (1 - ratio) + 3;
            const val = ceiling * ratio;
            return (
              <SvgText
                key={`label-${ratio}`}
                x={paddingLeft - 6}
                y={y}
                fontSize={9}
                fill={colors.textMuted}
                textAnchor="end"
              >
                {val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val.toFixed(0)}
              </SvgText>
            );
          })}

          {/* Polyline connecting points */}
          {polylinePoints ? (
            <Polyline
              points={polylinePoints}
              fill="none"
              stroke={colors.brand}
              strokeWidth={2.5}
            />
          ) : null}

          {/* Data points */}
          {coords.map((c, i) => (
            <Circle
              key={`dot-${i}`}
              cx={c.x}
              cy={c.y}
              r={3}
              fill={colors.surface}
              stroke={colors.brand}
              strokeWidth={2}
            />
          ))}

          {/* X-axis labels (render every 2nd or all if <= 6) */}
          {coords.map((c, i) => {
            const showLabel = points.length <= 6 || i % 2 === 0 || i === points.length - 1;
            if (!showLabel) return null;
            return (
              <SvgText
                key={`xlabel-${i}`}
                x={c.x}
                y={chartHeight - 6}
                fontSize={9}
                fill={colors.textMuted}
                textAnchor="middle"
              >
                {c.point.label.slice(0, 3).toUpperCase()}
              </SvgText>
            );
          })}
        </Svg>
      </View>
    </View>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      gap: spacing.md,
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
    },
    titleCol: {
      gap: 2,
    },
    sectionLabel: {
      ...typography.caption,
      color: colors.brandDark,
      fontWeight: "700",
      letterSpacing: 0.5,
    },
    heading: {
      ...typography.label,
      color: colors.text,
    },
    totalAmount: {
      ...typography.title,
      color: colors.text,
    },
    toggleGroup: {
      flexDirection: "row",
      backgroundColor: colors.surfaceMuted,
      borderRadius: radius.pill,
      padding: 2,
    },
    toggleBtn: {
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.sm,
      borderRadius: radius.pill,
    },
    toggleBtnActive: {
      backgroundColor: colors.surface,
      shadowColor: "#000",
      shadowOpacity: 0.05,
      shadowRadius: 2,
    },
    toggleText: {
      ...typography.caption,
      color: colors.textMuted,
      fontWeight: "500",
    },
    toggleTextActive: {
      color: colors.text,
      fontWeight: "700",
    },
    chartWrapper: {
      alignItems: "center",
    },
  });
}
