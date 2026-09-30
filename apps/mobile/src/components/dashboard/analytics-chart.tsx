import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Line, Polyline, Text as SvgText } from "react-native-svg";
import type { CustomerAnalytics } from "@/lib/dashboard-api";
import { useTheme } from "@/providers/theme-provider";
import { radius, spacing, typography, type ColorTokens } from "@/theme/tokens";

const seriesConfig = [
  { key: "buy", label: "Buy", color: "#2B6CB0" },
  { key: "sell", label: "Sell", color: "#BC8748" },
  { key: "referral", label: "Referral", color: "#287A4C" },
] as const;

export function AnalyticsChart({
  analytics,
  changeYear,
}: {
  analytics: CustomerAnalytics;
  changeYear: (year: number) => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const points = analytics.categoryPerformance ?? [];
  const hasActivity = points.some(
    (p) => (p.buy ?? 0) > 0 || (p.sell ?? 0) > 0 || (p.referral ?? 0) > 0
  );

  const chartWidth = 320;
  const chartHeight = 160;
  const paddingLeft = 35;
  const paddingRight = 15;
  const paddingTop = 15;
  const paddingBottom = 25;

  const innerWidth = chartWidth - paddingLeft - paddingRight;
  const innerHeight = chartHeight - paddingTop - paddingBottom;

  const maxVal = Math.max(
    0,
    ...points.flatMap((p) => [p.buy ?? 0, p.sell ?? 0, p.referral ?? 0])
  );
  const ceiling = Math.max(1, Math.ceil(maxVal));

  const yRatios = [1, 0.75, 0.5, 0.25, 0];

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>Category Performance</Text>

        <View style={styles.yearRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Previous year"
            disabled={analytics.year <= 2000}
            onPress={() => changeYear(analytics.year - 1)}
            style={styles.yearBtn}
            hitSlop={8}
          >
            <Text style={styles.yearArrow}>‹</Text>
          </Pressable>
          <Text style={styles.yearText}>Jan 1 – Dec 31, {analytics.year}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Next year"
            disabled={analytics.year >= 2100}
            onPress={() => changeYear(analytics.year + 1)}
            style={styles.yearBtn}
            hitSlop={8}
          >
            <Text style={styles.yearArrow}>›</Text>
          </Pressable>
        </View>
      </View>

      {/* Series Legend */}
      <View style={styles.legendRow}>
        {seriesConfig.map((item) => (
          <View key={item.key} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: item.color }]} />
            <Text style={styles.legendText}>{item.label}</Text>
          </View>
        ))}
      </View>

      {/* Chart */}
      <View
        style={styles.chartWrapper}
        accessibilityLabel={`Category performance for ${analytics.year}. ${hasActivity ? "Showing Buy, Sell, and Referral series" : "No activity recorded."}`}
      >
        <Svg width="100%" height={chartHeight} viewBox={`0 0 ${chartWidth} ${chartHeight}`}>
          {/* Gridlines */}
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

          {/* Y-axis values */}
          {yRatios.map((ratio) => {
            const y = paddingTop + innerHeight * (1 - ratio) + 3;
            const val = ceiling * ratio;
            return (
              <SvgText
                key={`ylabel-${ratio}`}
                x={paddingLeft - 6}
                y={y}
                fontSize={9}
                fill={colors.textMuted}
                textAnchor="end"
              >
                {val.toFixed(0)}
              </SvgText>
            );
          })}

          {/* Series lines */}
          {hasActivity &&
            seriesConfig.map((series) => {
              const polyCoords = points.map((p, index) => {
                const val = (p[series.key as "buy" | "sell" | "referral"] ?? 0);
                const x =
                  points.length <= 1
                    ? paddingLeft + innerWidth / 2
                    : paddingLeft + (index / (points.length - 1)) * innerWidth;
                const y = paddingTop + innerHeight - (val / ceiling) * innerHeight;
                return `${x.toFixed(1)},${y.toFixed(1)}`;
              });

              return (
                <Polyline
                  key={series.key}
                  points={polyCoords.join(" ")}
                  fill="none"
                  stroke={series.color}
                  strokeWidth={2}
                />
              );
            })}

          {/* Month labels */}
          {points.map((p, index) => {
            const x =
              points.length <= 1
                ? paddingLeft + innerWidth / 2
                : paddingLeft + (index / (points.length - 1)) * innerWidth;
            // Render every 2nd month on mobile for readability
            if (index % 2 !== 0 && index !== points.length - 1) return null;
            return (
              <SvgText
                key={`m-${index}`}
                x={x}
                y={chartHeight - 6}
                fontSize={9}
                fill={colors.textMuted}
                textAnchor="middle"
              >
                {p.label ? p.label.slice(0, 3) : `M${index + 1}`}
              </SvgText>
            );
          })}
        </Svg>

        {!hasActivity && (
          <View style={styles.emptyOverlay}>
            <Text style={styles.emptyText}>No activity recorded</Text>
          </View>
        )}
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
      gap: spacing.xs,
    },
    title: {
      ...typography.heading,
      color: colors.text,
    },
    yearRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },
    yearBtn: {
      padding: spacing.xs,
    },
    yearArrow: {
      fontSize: 20,
      fontWeight: "700",
      color: colors.brandDark,
    },
    yearText: {
      ...typography.caption,
      color: colors.textMuted,
    },
    legendRow: {
      flexDirection: "row",
      gap: spacing.md,
    },
    legendItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
    },
    legendDot: {
      width: 10,
      height: 10,
      borderRadius: radius.pill,
    },
    legendText: {
      ...typography.caption,
      color: colors.text,
    },
    chartWrapper: {
      position: "relative",
      alignItems: "center",
    },
    emptyOverlay: {
      position: "absolute",
      top: 50,
      alignSelf: "center",
      backgroundColor: colors.surfaceMuted,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: radius.sm,
    },
    emptyText: {
      ...typography.caption,
      color: colors.textMuted,
      fontStyle: "italic",
    },
  });
}
