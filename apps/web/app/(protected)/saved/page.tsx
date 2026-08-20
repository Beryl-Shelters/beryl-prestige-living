import type { Metadata } from "next";
import { SavedPropertiesScreen } from "@/components/marketplace/saved-properties-screen";

export const metadata: Metadata = { title: "Saved Properties", robots: { index: false, follow: false } };
export default function SavedPropertiesPage() { return <SavedPropertiesScreen />; }
