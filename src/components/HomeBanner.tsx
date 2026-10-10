import { useEffect, useState } from "react";
import { router } from "expo-router";
import { ArrowRight } from "lucide-react-native";
import { Image, Pressable, Text, View } from "react-native";
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
  if (/^(https?:\/\/|data:)/i.test(value)) return value;

  const backendUrl = API_BASE_URL.replace(/\/api\/?$/i, "").replace(/\/+$/, "");
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
    <View className="overflow-hidden rounded-[24px] bg-[#FFF8ED]">
      <View className="flex-row items-center px-4 py-4">
        <View className="mr-3 flex-1">
          <Text
            className="text-[22px] font-black leading-[26px] tracking-[-0.6px] text-[#102C22]"
            numberOfLines={2}
          >
            {banner.title}
          </Text>
        </View>

        <View className="shrink-0 flex-row">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Order now"
            className="min-h-10 flex-row items-center justify-center rounded-lg bg-[#F47716] px-2"
            onPress={() => router.push(getBannerDestination(banner.link))}
            style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
          >
            <Text className="text-[10px] font-extrabold text-white">Order Now</Text>
            <ArrowRight color="#FFFFFF" size={12} className="ml-1" />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Explore menu"
            className="ml-1 min-h-10 items-center justify-center rounded-lg border border-[#263A30] px-2"
            onPress={() => router.push("/explore")}
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            <Text className="text-[10px] font-bold text-[#14291F]">Explore</Text>
          </Pressable>
        </View>
      </View>

      <View className="h-[240px] overflow-hidden bg-[#243B2B]">
        {banner.image && (
          <Image
            accessible
            accessibilityLabel={banner.title}
            className="absolute h-full w-full"
            resizeMode="cover"
            source={{ uri: banner.image }}
          />
        )}
      </View>
    </View>
  );
}
