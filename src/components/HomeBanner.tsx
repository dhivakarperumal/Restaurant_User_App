import { useEffect, useState } from "react";
import { router } from "expo-router";
import { ArrowRight } from "lucide-react-native";
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
  const path = link.split("?")[0];
  switch (path) {
    case "/home":
    case "/explore":
    case "/cart":
    case "/orders":
    case "/profile":
      return path;
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
        const payload: unknown = response.data?.data ?? response.data;
        if (!Array.isArray(payload)) {
          throw new Error("Home banners response was not an array.");
        }

        const activeBanners = payload
          .filter(
            (item): item is Record<string, unknown> =>
              isRecord(item) && item.active !== false,
          )
          .map((item, index) => ({
            id: stringValue(item.id, `banner-${index}`),
            title: stringValue(item.title, FALLBACK_BANNER.title),
            image: resolveAssetUrl(item.mobile_image || item.image),
            link: stringValue(item.link, FALLBACK_BANNER.link),
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
      className="h-[280px] justify-end overflow-hidden rounded-[24px] bg-[#243B2B]"
      imageStyle={{ borderRadius: 24 }}
      resizeMode="cover"
      source={banner.image ? { uri: banner.image } : undefined}
    >
      <View className="absolute inset-0 bg-black/45" />
      <View className="px-5 pb-6 pt-10">
        <Text
          className="text-[28px] font-black leading-[32px] tracking-[-0.7px] text-white"
          numberOfLines={3}
        >
          {banner.title}
        </Text>

        <View className="mt-4 flex-row">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Order now"
            className="min-h-11 flex-row items-center justify-center rounded-lg bg-[#F47716] px-4"
            onPress={() => router.push(getBannerDestination(banner.link))}
            style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
          >
            <Text className="text-xs font-extrabold text-white">Order Now</Text>
            <ArrowRight color="#FFFFFF" size={14} className="ml-1.5" />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Explore menu"
            className="ml-2 min-h-11 items-center justify-center rounded-lg border border-white px-4"
            onPress={() => router.push("/explore")}
            style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}
          >
            <Text className="text-xs font-bold text-white">Explore Menu</Text>
          </Pressable>
        </View>
      </View>
    </ImageBackground>
  );
}
