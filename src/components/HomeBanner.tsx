import { useEffect, useState } from "react";
import { router } from "expo-router";
import { ArrowRight, Sparkles } from "lucide-react-native";
import { ImageBackground, Pressable, Text, View } from "react-native";
import api, { API_BASE_URL } from "../lib/api";

type Banner = {
  id: string;
  title: string;
  image: string;
  link: string;
};

const FALLBACK_BANNER: Banner = {
  id: "welcome",
  title: "Taste Good Food Every Day",
  image: "",
  link: "/explore",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() || fallback : fallback;
}

function extractArrayPayload(payload: unknown, preferredKeys: string[]) {
  if (Array.isArray(payload)) return payload;

  if (!isRecord(payload)) return [];

  for (const key of preferredKeys) {
    const candidate = payload[key];
    if (Array.isArray(candidate)) return candidate;
  }

  for (const value of Object.values(payload)) {
    if (Array.isArray(value)) return value;
  }

  return [];
}

function resolveAssetUrl(asset: unknown) {
  const value = stringValue(asset);
  if (!value) return "";

  const backendUrl = API_BASE_URL.replace(/\/api\/?$/i, "").replace(/\/+$/, "");
  if (/^data:/i.test(value)) return value;
  if (/^https?:\/\//i.test(value)) {
    return value.replace(
      /^https?:\/\/(?:localhost|127(?:\.\d{1,3}){3})(?::\d+)?/i,
      backendUrl,
    );
  }

  return `${backendUrl}/${value.replace(/^\/+/, "")}`;
}

function getBannerDestination(link: string) {
  const rawLink = stringValue(link, FALLBACK_BANNER.link);
  const normalized = /^https?:\/\//i.test(rawLink)
    ? new URL(rawLink).pathname
    : rawLink.split("?")[0];

  switch (normalized) {
    case "/home":
    case "/explore":
    case "/cart":
    case "/orders":
    case "/profile":
      return normalized;
    default:
      return "/explore";
  }
}

export default function HomeBanner() {
  const [banners, setBanners] = useState<Banner[]>([]);

  useEffect(() => {
    let isMounted = true;

    const loadBanners = async () => {
      try {
        const response = await api.get("/banners/public");
        const payload = extractArrayPayload(response.data, [
          "banners",
          "items",
          "results",
          "data",
          "list",
        ]);

        const activeBanners = payload
          .filter(
            (item): item is Record<string, unknown> =>
              isRecord(item) && item.active !== false,
          )
          .map((item, index) => ({
            id: stringValue(item.id ?? item.banner_id, `banner-${index}`),
            title: stringValue(item.title ?? item.name, FALLBACK_BANNER.title),
            image: resolveAssetUrl(
              item.mobile_image ?? item.mobileImage ?? item.image ?? item.image_url,
            ),
            link: stringValue(item.link ?? item.url, FALLBACK_BANNER.link),
          }));
        if (isMounted) setBanners(activeBanners);
      } catch (error) {
        console.error("Failed to load home banners:", error);
      }
    };

    void loadBanners();
    return () => {
      isMounted = false;
    };
  }, []);

  const banner = banners[0] ?? FALLBACK_BANNER;

  return (
    <ImageBackground
      accessible
      accessibilityLabel={banner.title}
      className="h-[320px] justify-between overflow-hidden rounded-[28px] bg-[#183B2A]"
      imageStyle={{ borderRadius: 28 }}
      resizeMode="cover"
      source={banner.image ? { uri: banner.image } : undefined}
    >
      <View className="absolute inset-0 bg-black/45" />
      <View className="absolute -right-12 -top-12 h-48 w-48 rounded-full border-[28px] border-white/10" />
      <View className="px-5 pt-5">
        <View className="self-start flex-row items-center rounded-full bg-white/20 px-3 py-2">
          <Sparkles color="#FFD29A" size={14} strokeWidth={2.2} />
          <Text className="ml-2 text-[10px] font-extrabold tracking-[1.4px] text-white">
            FRESHLY MADE, JUST FOR YOU
          </Text>
        </View>
      </View>
      <View className="px-5 pb-5">
        <Text
          className="text-[32px] font-black leading-[36px] tracking-[-0.8px] text-white"
          numberOfLines={2}
        >
          {banner.title}
        </Text>
        <Text className="mt-2 text-sm leading-5 text-white/85">
          Discover something delicious today.
        </Text>

        <View className="mt-5 flex-row items-center">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Order now"
            className="min-h-12 flex-row items-center justify-center rounded-2xl bg-[#F47716] px-5"
            onPress={() => router.push(getBannerDestination(banner.link))}
            style={({ pressed }) => ({
              opacity: pressed ? 0.88 : 1,
              transform: [{ scale: pressed ? 0.98 : 1 }],
            })}
          >
            <Text className="text-sm font-extrabold text-white">Order now</Text>
            <ArrowRight color="#FFFFFF" size={16} className="ml-2" />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Explore menu"
            className="ml-3 min-h-12 items-center justify-center rounded-2xl border border-white/60 bg-black/15 px-4"
            onPress={() => router.push("/explore")}
            style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}
          >
            <Text className="text-sm font-bold text-white">Explore menu</Text>
          </Pressable>
        </View>
      </View>
    </ImageBackground>
  );
}
