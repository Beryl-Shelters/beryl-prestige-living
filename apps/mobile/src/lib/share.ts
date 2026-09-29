import { Share } from "react-native";

export async function shareCanonicalUrl(title: string, message: string, url: string) {
  if (!/^https:\/\//.test(url)) throw new Error("Only canonical HTTPS links can be shared.");
  await Share.share({ title, message: `${message}\n${url}`, url });
}
