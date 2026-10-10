import { useEffect, useState } from "react";
import { router } from "expo-router";
import {
  ArrowRight,
  Bike,
  ChefHat,
  ChevronLeft,
  ChevronRight,
  Leaf,
  ShieldCheck,
  Sparkles,
  type LucideIcon,
} from "lucide-react-native";
import {
  Image,
  Pressable,
  Text,
  View,
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

type FoodTeaser = {
  id: string;
  image: string;
  name: string;
};

type Benefit = {
  Icon: LucideIcon;
  title: string;
  subtitle: string;
};

const benefits: Benefit[] = [
  { Icon: Leaf, title: "Fresh", subtitle: "Ingredients" },
  { Icon: ChefHat, title: "Authentic", subtitle: "Taste" },
  { Icon: ShieldCheck, title: "Hygienic", subtitle: "& Safe" },
  { Icon: Bike, title: "Fast", subtitle: "Delivery" },
];

const FALLBACK_BANNER: Banner = {
  id: "welcome",
  title: "Taste Good Food Every Day",
  subtitle: "Food That Feels Like Home",
  description:
    "Fresh ingredients, traditional recipes, and a dining experience that feels like home.",
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
  const [foodImages, setFoodImages] = useState<FoodTeaser[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    let isMounted = true;

    const loadBannerContent = async () => {
      const [bannerResult, foodResult] = await Promise.allSettled([
        api.get("/banners/public"),
        api.get("/foods"),
      ]);

      if (bannerResult.status === "fulfilled") {
        const payload: unknown =
          bannerResult.value.data?.data ?? bannerResult.value.data;
        if (Array.isArray(payload)) {
          const activeBanners = payload
            .filter(
              (item): item is Record<string, unknown> =>
                isRecord(item) && item.active !== false,
            )
            .map((item, index) => ({
              id: stringValue(item.id, `banner-${index}`),
              title: stringValue(item.title, FALLBACK_BANNER.title),
              subtitle: stringValue(item.subtitle, FALLBACK_BANNER.subtitle),
              description: stringValue(
                item.description,
                FALLBACK_BANNER.description,
              ),
              image: resolveAssetUrl(item.mobile_image || item.image),
              link: stringValue(item.link, FALLBACK_BANNER.link),
            }));
          if (isMounted) setBanners(activeBanners);
        } else {
          console.error("Home banners response was not an array.");
        }
      } else {
        console.error("Failed to load home banners:", bannerResult.reason);
      }

      if (foodResult.status === "fulfilled") {
        const payload: unknown =
          foodResult.value.data?.data ?? foodResult.value.data;
        if (Array.isArray(payload)) {
          const images = payload
            .filter(
              (item): item is Record<string, unknown> =>
                isRecord(item) &&
                item.is_available !== false &&
                stringValue(item.status, "Active").toLowerCase() === "active",
            )
            .map((item, index) => {
              const images = Array.isArray(item.food_images)
                ? item.food_images
                : [];
              return {
                id: stringValue(
                  item.food_id ?? item.id,
                  `food-${index}`,
                ),
                image: resolveAssetUrl(images[0]),
                name: stringValue(item.food_name, "Featured dish"),
              };
            })
            .filter((food) => food.image)
            .slice(0, 3);
          if (isMounted) setFoodImages(images);
        }
      } else {
        console.error("Failed to load menu images for the home banner:", foodResult.reason);
      }
    };

    void loadBannerContent();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (banners.length < 2) return undefined;
    const timer = setInterval(() => {
      setActiveIndex((current) => (current + 1) % banners.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [banners.length]);

  const banner = banners[activeIndex] ?? FALLBACK_BANNER;
  const showcaseImages =
    foodImages.length > 0
      ? foodImages
      : banner.image
        ? [{ id: banner.id, image: banner.image, name: banner.title }]
        : [];
  const moveSlide = (direction: number) => {
    setActiveIndex((current) => (current + direction + banners.length) % banners.length);
  };

  return (
    <View className="overflow-hidden rounded-[30px] bg-[#FFF8ED]">
      <View className="flex-row items-center px-3 pb-4 pt-5">
        <View className="flex-1 pr-2">
          <View className="mb-1 flex-row items-center">
            <Sparkles color="#E86D16" size={12} />
            <Text className="ml-1 text-[8px] font-extrabold uppercase tracking-[0.7px] text-[#B64F12]">
              Good food · Good company
            </Text>
          </View>
          <Text
            className="text-[22px] font-black leading-[25px] tracking-[-0.6px] text-[#102C22]"
            numberOfLines={3}
          >
            {banner.title}
          </Text>
          <Text className="mt-1 text-[10px] font-semibold leading-[14px] text-[#B64F12]">
            {banner.subtitle}
          </Text>
          <Text className="mt-1 text-[11px] leading-[15px] text-[#41443E]" numberOfLines={3}>
            {banner.description}
          </Text>
        </View>

        <View className="flex-row items-center">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Order now"
            className="min-h-10 flex-row items-center justify-center rounded-lg bg-[#F47716] px-2"
            onPress={() => router.push(getBannerDestination(banner.link))}
            style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
          >
            <Text className="text-[10px] font-extrabold text-white">Order Now</Text>
            <ArrowRight color="#FFFFFF" size={13} className="ml-1" />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Explore menu"
            className="ml-1 min-h-10 items-center justify-center rounded-lg border border-[#263A30] px-2"
            onPress={() => router.push("/explore")}
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            <Text className="text-[10px] font-bold text-[#14291F]">Explore Menu</Text>
          </Pressable>
        </View>
      </View>

      <View className="flex-row justify-between px-2 pb-4">
        {benefits.map(({ Icon, title, subtitle }) => (
          <View key={title} className="flex-1 items-center px-0.5">
            <View className="mb-1 h-8 w-8 items-center justify-center rounded-full bg-white">
              <Icon color="#183B2B" size={17} strokeWidth={1.8} />
            </View>
            <Text className="text-center text-[9px] font-bold leading-[11px] text-[#153526]">
              {title}
            </Text>
            <Text className="text-center text-[9px] leading-[11px] text-[#153526]">
              {subtitle}
            </Text>
          </View>
        ))}
      </View>

      <View className="h-[260px] overflow-hidden bg-[#243B2B]">
        {banner.image ? (
          <Image
            accessible
            accessibilityLabel={banner.title}
            className="absolute h-full w-full"
            resizeMode="cover"
            source={{ uri: banner.image }}
          />
        ) : (
          <View className="absolute inset-0 items-center justify-center bg-[#243B2B]">
            <ChefHat color="#F3A126" size={70} strokeWidth={1.4} />
          </View>
        )}
        <View className="absolute inset-0 bg-black/25" />

        {showcaseImages.length > 0 && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Explore our special dishes"
            className="absolute bottom-4 right-4 max-w-[90%] flex-row items-center rounded-2xl border border-white/70 bg-[#FFFAF2]/95 p-2.5"
            onPress={() => router.push("/explore")}
            style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
          >
            <View className="flex-row">
              {showcaseImages.map((food, index) => (
                <Image
                  key={food.id}
                  accessible
                  accessibilityLabel={food.name}
                  className={`h-10 w-10 rounded-full border-2 border-[#FFFAF2] ${
                    index > 0 ? "-ml-3" : ""
                  }`}
                  resizeMode="cover"
                  source={{ uri: food.image }}
                />
              ))}
            </View>
            <View className="ml-2 h-8 w-8 items-center justify-center rounded-full bg-[#F47716]">
              <ArrowRight color="#FFFFFF" size={16} />
            </View>
          </Pressable>
        )}

        {banners.length > 1 && (
          <>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Previous banner"
              className="absolute left-3 top-1/2 h-9 w-9 items-center justify-center rounded-full bg-black/40"
              onPress={() => moveSlide(-1)}
              hitSlop={8}
            >
              <ChevronLeft color="#FFFFFF" size={22} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Next banner"
              className="absolute right-3 top-1/2 h-9 w-9 items-center justify-center rounded-full bg-black/40"
              onPress={() => moveSlide(1)}
              hitSlop={8}
            >
              <ChevronRight color="#FFFFFF" size={22} />
            </Pressable>
            <View className="absolute bottom-2 left-0 right-0 flex-row justify-center">
              {banners.map((item, index) => (
                <Pressable
                  key={item.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Show banner ${index + 1}`}
                  accessibilityState={{ selected: index === activeIndex }}
                  className={`mx-1 h-2 rounded-full ${
                    index === activeIndex ? "w-6 bg-[#F28A20]" : "w-2 bg-white/75"
                  }`}
                  onPress={() => setActiveIndex(index)}
                  hitSlop={6}
                />
              ))}
            </View>
          </>
        )}
      </View>

    </View>
  );
}
