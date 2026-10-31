import { useEffect, useRef, useState } from "react";
import { router } from "expo-router";
import { ArrowRight, Sparkles } from "lucide-react-native";
import {
  Animated,
  ImageBackground,
  Pressable,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import api, { API_BASE_URL } from "../lib/api";

type Banner = {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  image: string;
  link: string;
};

const FALLBACK_BANNER: Banner = {
  id: "welcome",
  title: "Taste Good Food Every Day",
  subtitle: "FRESHLY MADE, JUST FOR YOU",
  description: "Discover something delicious today.",
  image: "",
  link: "/shop",
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

type BannerDestination =
  | "/UsersTab/shop"
  | "/UsersTab/cart"
  | "/UsersTab/orders"
  | "/UsersTab/profile";

function getBannerDestination(link: string): BannerDestination {
  const rawLink = stringValue(link, FALLBACK_BANNER.link);
  const normalized = /^https?:\/\//i.test(rawLink)
    ? new URL(rawLink).pathname
    : rawLink.split("?")[0];

  switch (normalized) {
    case "/home":
    case "/shop":
    case "/explore":
      return "/UsersTab/shop";
    case "/cart":
      return "/UsersTab/cart";
    case "/orders":
      return "/UsersTab/orders";
    case "/profile":
      return "/UsersTab/profile";
    default:
      return "/UsersTab/shop";
  }
}

export default function HomeBanner() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const { width: screenWidth } = useWindowDimensions();

  // HomeScreen paddingHorizontal: 24 (total 48px)
  const bannerWidth = Math.max(280, screenWidth - 48);
  const bannerHeight = 310;

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
          .map((item, index) => {
            const rawImage =
              stringValue(item.mobile_image) ||
              stringValue(item.mobileImage) ||
              stringValue(item.image) ||
              stringValue(item.image_url);

            return {
              id: stringValue(item.id ?? item.banner_id, `banner-${index}`),
              title: stringValue(item.title ?? item.name, FALLBACK_BANNER.title),
              subtitle: stringValue(
                item.subtitle,
                "FRESHLY MADE, JUST FOR YOU",
              ),
              description: stringValue(
                item.description,
                "Discover something delicious today.",
              ),
              image: resolveAssetUrl(rawImage),
              link: stringValue(item.link ?? item.url, FALLBACK_BANNER.link),
            };
          });

        if (isMounted && activeBanners.length > 0) {
          setBanners(activeBanners);
        }
      } catch (error) {
        console.error("Failed to load home banners:", error);
      }
    };

    void loadBanners();
    return () => {
      isMounted = false;
    };
  }, []);

  const displayBanners = banners.length > 0 ? banners : [FALLBACK_BANNER];

  // Auto-play timer for transitioning between banners
  useEffect(() => {
    if (displayBanners.length <= 1) return;

    const interval = setInterval(() => {
      fadeAnim.setValue(0);
      setActiveIndex((currentIndex) => (currentIndex + 1) % displayBanners.length);
    }, 4500);

    return () => clearInterval(interval);
  }, [displayBanners.length, fadeAnim]);

  useEffect(() => {
    const animation = Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 450,
      useNativeDriver: true,
    });
    animation.start();

    return () => animation.stop();
  }, [activeIndex, fadeAnim]);

  const banner = displayBanners[activeIndex] ?? FALLBACK_BANNER;
  return (
    <View style={{ width: bannerWidth, height: bannerHeight }} className="overflow-hidden rounded-[28px]">
      <Animated.View className="h-full w-full" style={{ opacity: fadeAnim }}>
        <ImageBackground
          accessible
          accessibilityLabel={banner.title}
          className="h-full w-full justify-between overflow-hidden rounded-[28px] bg-[#183B2A]"
          imageStyle={{ borderRadius: 28 }}
          resizeMode="cover"
          source={banner.image ? { uri: banner.image } : undefined}
        >
          {/* Dark Overlay for readability */}
          <View className="absolute inset-0 bg-black/30" />
          <View className="absolute -right-12 -top-12 h-48 w-48 rounded-full border-[28px] border-white/10" />

          {/* Subtitle Badge */}
          <View className="px-5 pt-5">
            <View className="self-start flex-row items-center rounded-full bg-white/20 px-3 py-1.5 backdrop-blur-sm">
              <Sparkles color="#E9BE45" size={13} strokeWidth={2.2} />
              <Text className="ml-1.5 text-[10px] font-extrabold uppercase tracking-[1.4px] text-white">
                {banner.subtitle}
              </Text>
            </View>
          </View>

          {/* Bottom Content */}
          <View className="px-5 pb-5">
            <Text
              className="text-[26px] font-black leading-[32px] tracking-[-0.6px] text-white"
              numberOfLines={2}
            >
              {banner.title}
            </Text>
            <Text className="mt-1.5 text-xs font-medium leading-4 text-white/85" numberOfLines={2}>
              {banner.description}
            </Text>

            <View className="mt-4 flex-row items-center justify-between">
              <View className="flex-row items-center">
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Order now"
                  className="min-h-11 flex-row items-center justify-center rounded-2xl bg-[#E9BE45] px-4 shadow-sm"
                  onPress={() => router.push(getBannerDestination(banner.link))}
                  style={({ pressed }) => ({
                    opacity: pressed ? 0.88 : 1,
                    transform: [{ scale: pressed ? 0.97 : 1 }],
                  })}
                >
                  <Text className="text-xs font-extrabold text-[#084A2B]">Order now</Text>
                  <ArrowRight color="#084A2B" size={14} className="ml-1.5" />
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Explore menu"
                  className="ml-2.5 min-h-11 items-center justify-center rounded-2xl border border-white/60 bg-black/25 px-3.5 backdrop-blur-sm"
                  onPress={() => router.push("/UsersTab/shop")}
                  style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}
                >
                  <Text className="text-xs font-bold text-white">Explore menu</Text>
                </Pressable>
              </View>

              {/* Pagination Dots */}
              {displayBanners.length > 1 && (
                <View className="flex-row items-center gap-1.5 pr-1">
                  {displayBanners.map((_, dotIdx) => (
                    <View
                      key={dotIdx}
                      className={`h-2 rounded-full ${
                        dotIdx === activeIndex ? "w-5 bg-[#E9BE45]" : "w-2 bg-white/50"
                      }`}
                    />
                  ))}
                </View>
              )}
            </View>
          </View>
        </ImageBackground>
      </Animated.View>
    </View>
  );
}
