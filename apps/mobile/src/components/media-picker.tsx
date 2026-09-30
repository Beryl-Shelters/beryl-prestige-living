import { useMemo, useState } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { AppIcon } from "./app-icon";
import type { PickedFile } from "@/lib/file-upload-helper";
import { useTheme } from "@/providers/theme-provider";
import { radius, spacing, typography, type ColorTokens } from "@/theme/tokens";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp"];

type MediaPickerProps = {
  label?: string;
  helper?: string;
  maxCount?: number;
  files: PickedFile[];
  existingUrls?: { id: string; url: string }[];
  onFilesChange: (files: PickedFile[]) => void;
  onRemoveExisting?: (id: string) => void;
  error?: string;
};

export function MediaPicker({
  label = "Property Photographs *",
  helper = "Add up to 10 JPG, PNG or WEBP photos (max 5 MB each)",
  maxCount = 10,
  files,
  existingUrls = [],
  onFilesChange,
  onRemoveExisting,
  error,
}: MediaPickerProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [pickerError, setPickerError] = useState("");
  const totalCount = existingUrls.length + files.length;

  async function pickImages() {
    setPickerError("");
    if (totalCount >= maxCount) {
      setPickerError(`You can upload a maximum of ${maxCount} images.`);
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsMultipleSelection: true,
        selectionLimit: maxCount - totalCount,
        quality: 0.8,
      });

      if (result.canceled || !result.assets) return;

      const newFiles: PickedFile[] = [];
      for (const asset of result.assets) {
        const mime = asset.mimeType || "image/jpeg";
        if (!ALLOWED_MIME.includes(mime)) {
          setPickerError("Only JPG, PNG and WEBP images are supported.");
          continue;
        }
        if (asset.fileSize && asset.fileSize > MAX_IMAGE_BYTES) {
          setPickerError("One or more images exceeded the 5 MB limit.");
          continue;
        }
        newFiles.push({
          uri: asset.uri,
          name: asset.fileName || `photo_${Date.now()}_${newFiles.length}.jpg`,
          type: mime,
          size: asset.fileSize,
        });
      }

      if (newFiles.length > 0) {
        const combined = [...files, ...newFiles].slice(0, maxCount - existingUrls.length);
        onFilesChange(combined);
      }
    } catch {
      setPickerError("Could not open photo library. Please check permissions.");
    }
  }

  function removeFile(index: number) {
    onFilesChange(files.filter((_, i) => i !== index));
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.countText}>{totalCount} / {maxCount}</Text>
      </View>
      {helper ? <Text style={styles.helper}>{helper}</Text> : null}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.list}>
        {totalCount < maxCount && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add property photos"
            onPress={pickImages}
            style={styles.addBtn}
          >
            <AppIcon name="camera-outline" size={26} color={colors.brandDark} />
            <Text style={styles.addBtnText}>Add Photos</Text>
          </Pressable>
        )}

        {existingUrls.map((item) => (
          <View key={item.id} style={styles.thumbWrapper}>
            <Image source={{ uri: item.url }} style={styles.thumb} resizeMode="cover" />
            {onRemoveExisting && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Remove photo"
                onPress={() => onRemoveExisting(item.id)}
                style={styles.removeBtn}
              >
                <AppIcon name="close" size={14} color="#FFF" />
              </Pressable>
            )}
          </View>
        ))}

        {files.map((file, idx) => (
          <View key={`${file.uri}-${idx}`} style={styles.thumbWrapper}>
            <Image source={{ uri: file.uri }} style={styles.thumb} resizeMode="cover" />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Remove photo ${idx + 1}`}
              onPress={() => removeFile(idx)}
              style={styles.removeBtn}
            >
              <AppIcon name="close" size={14} color="#FFF" />
            </Pressable>
          </View>
        ))}
      </ScrollView>

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
    list: { flexDirection: "row", gap: spacing.md, paddingVertical: spacing.sm },
    addBtn: {
      width: 96,
      height: 96,
      borderRadius: radius.md,
      borderWidth: 1.5,
      borderStyle: "dashed",
      borderColor: colors.brand,
      backgroundColor: colors.surfaceMuted,
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.xs,
    },
    addBtnText: { ...typography.caption, color: colors.brandDark, fontWeight: "600" },
    thumbWrapper: {
      width: 96,
      height: 96,
      borderRadius: radius.md,
      overflow: "hidden",
      position: "relative",
      backgroundColor: colors.surfaceMuted,
    },
    thumb: { width: "100%", height: "100%" },
    removeBtn: {
      position: "absolute",
      top: 4,
      right: 4,
      width: 22,
      height: 22,
      borderRadius: radius.pill,
      backgroundColor: colors.action,
      alignItems: "center",
      justifyContent: "center",
    },
    errorText: { ...typography.caption, color: colors.danger },
  });
}
