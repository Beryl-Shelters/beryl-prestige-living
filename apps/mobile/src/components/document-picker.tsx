import { useMemo, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { AppIcon } from "./app-icon";
import type { PickedFile } from "@/lib/file-upload-helper";
import { useTheme } from "@/providers/theme-provider";
import { radius, spacing, typography, type ColorTokens } from "@/theme/tokens";

const MAX_DOC_BYTES = 10 * 1024 * 1024; // 10 MB
const DEFAULT_TYPES = ["application/pdf", "image/png", "image/jpeg"];

export type ExistingDocument = {
  id: string;
  title: string;
  mime_type: string;
  size_bytes: number;
};

type DocumentPickerProps = {
  label?: string;
  helper?: string;
  maxCount?: number;
  multiple?: boolean;
  allowedTypes?: string[];
  files: { file: PickedFile; title: string }[];
  existingDocs?: ExistingDocument[];
  onFilesChange: (files: { file: PickedFile; title: string }[]) => void;
  onRemoveExisting?: (id: string) => void;
  error?: string;
};

export function DocumentPickerComponent({
  label = "Title Documents *",
  helper = "Upload C of O, Governor's Consent, Deed of Assignment (PDF, JPG or PNG up to 10 MB)",
  maxCount = 10,
  multiple = true,
  allowedTypes = DEFAULT_TYPES,
  files,
  existingDocs = [],
  onFilesChange,
  onRemoveExisting,
  error,
}: DocumentPickerProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [pickerError, setPickerError] = useState("");
  const totalCount = existingDocs.length + files.length;

  async function pickDocument() {
    setPickerError("");
    if (totalCount >= maxCount) {
      setPickerError(`You can upload a maximum of ${maxCount} documents.`);
      return;
    }

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: allowedTypes,
        multiple: multiple && maxCount > 1,
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets) return;

      const newFiles: { file: PickedFile; title: string }[] = [];
      for (const asset of result.assets) {
        const mime = asset.mimeType || "application/pdf";
        if (asset.size && asset.size > MAX_DOC_BYTES) {
          setPickerError("One or more files exceeded the 10 MB limit.");
          continue;
        }
        const name = asset.name || "document.pdf";
        const title = name.replace(/\.[^/.]+$/, "");
        newFiles.push({
          file: {
            uri: asset.uri,
            name,
            type: mime,
            size: asset.size,
          },
          title,
        });
      }

      if (newFiles.length > 0) {
        const combined = multiple
          ? [...files, ...newFiles].slice(0, maxCount - existingDocs.length)
          : newFiles.slice(0, 1);
        onFilesChange(combined);
      }
    } catch {
      setPickerError("Could not pick document. Please try again.");
    }
  }

  function removeFile(index: number) {
    onFilesChange(files.filter((_, i) => i !== index));
  }

  function formatSize(bytes?: number): string {
    if (!bytes || bytes <= 0) return "";
    if (bytes < 1024 * 1024) return ` · ${(bytes / 1024).toFixed(0)} KB`;
    return ` · ${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function isPdf(mime?: string, name?: string): boolean {
    return mime === "application/pdf" || (name ? name.toLowerCase().endsWith(".pdf") : false);
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.label}>{label}</Text>
        {maxCount > 1 && <Text style={styles.countText}>{totalCount} / {maxCount}</Text>}
      </View>
      {helper ? <Text style={styles.helper}>{helper}</Text> : null}

      {totalCount < maxCount && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add document"
          onPress={pickDocument}
          style={styles.uploadBtn}
        >
          <AppIcon name="document-text-outline" size={22} color={colors.brandDark} />
          <Text style={styles.uploadBtnText}>
            {totalCount > 0 ? "Add Another Document" : "Choose Document"}
          </Text>
        </Pressable>
      )}

      {existingDocs.map((doc) => (
        <View key={doc.id} style={styles.docCard}>
          <View style={[styles.badge, isPdf(doc.mime_type, doc.title) ? styles.badgePdf : styles.badgeImg]}>
            <Text style={styles.badgeText}>{isPdf(doc.mime_type, doc.title) ? "PDF" : "IMG"}</Text>
          </View>
          <View style={styles.docInfo}>
            <Text numberOfLines={1} style={styles.docTitle}>{doc.title}</Text>
            <Text style={styles.docMeta}>Saved document{formatSize(doc.size_bytes)}</Text>
          </View>
          {onRemoveExisting && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Remove document ${doc.title}`}
              onPress={() => onRemoveExisting(doc.id)}
              style={styles.removeBtn}
            >
              <AppIcon name="close" size={16} color={colors.textMuted} />
            </Pressable>
          )}
        </View>
      ))}

      {files.map((item, idx) => (
        <View key={`${item.file.uri}-${idx}`} style={styles.docCard}>
          <View style={[styles.badge, isPdf(item.file.type, item.file.name) ? styles.badgePdf : styles.badgeImg]}>
            <Text style={styles.badgeText}>{isPdf(item.file.type, item.file.name) ? "PDF" : "IMG"}</Text>
          </View>
          <View style={styles.docInfo}>
            <Text numberOfLines={1} style={styles.docTitle}>{item.file.name}</Text>
            <Text style={styles.docMeta}>New upload{formatSize(item.file.size)}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Remove document ${item.file.name}`}
            onPress={() => removeFile(idx)}
            style={styles.removeBtn}
          >
            <AppIcon name="close" size={16} color={colors.textMuted} />
          </Pressable>
        </View>
      ))}

      {(pickerError || error) ? (
        <Text accessibilityRole="alert" style={styles.errorText}>
          {pickerError || error}
        </Text>
      ) : null}
    </View>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    container: { gap: spacing.xs },
    header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    label: { ...typography.label, color: colors.text },
    countText: { ...typography.caption, color: colors.textMuted, fontWeight: "600" },
    helper: { ...typography.caption, color: colors.textMuted },
    uploadBtn: {
      minHeight: 48,
      borderRadius: radius.md,
      borderWidth: 1.5,
      borderStyle: "dashed",
      borderColor: colors.brand,
      backgroundColor: colors.surfaceMuted,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.sm,
      paddingHorizontal: spacing.md,
      marginVertical: spacing.xs,
    },
    uploadBtnText: { ...typography.label, color: colors.brandDark },
    docCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      padding: spacing.md,
    },
    badge: {
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      borderRadius: radius.sm,
      alignItems: "center",
      justifyContent: "center",
    },
    badgePdf: { backgroundColor: colors.surfaceMuted },
    badgeImg: { backgroundColor: colors.brandTint },
    badgeText: { fontSize: 11, fontWeight: "700", color: colors.text },
    docInfo: { flex: 1, gap: 2 },
    docTitle: { ...typography.label, color: colors.text },
    docMeta: { ...typography.caption, color: colors.textMuted },
    removeBtn: {
      padding: spacing.xs,
      borderRadius: radius.pill,
    },
    errorText: { ...typography.caption, color: colors.danger },
  });
}
