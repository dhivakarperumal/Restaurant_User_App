import { useCallback, useEffect, useRef, useState } from "react";
import { router } from "expo-router";
import { ArrowRight, ChevronLeft, ChevronRight, ImageIcon } from "lucide-react-native";
import {
  Image,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import api, { API_BASE_URL } from "../lib/api";

type Category = {
  id: string;
  name: string;
  image: string;
  filter: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getString(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value.trim() || fallback;
  if (typeof value === "number") return String(value);
  return fallback;
}

const resolveImageUrl = (image: unknown): string => {
  if (!image || typeof image !== "string") return "";
  const trimmed = image.trim();
  if (!trimmed) return "";

  const backendUrl = API_BASE_URL.replace(/\/api\/?$/i, "").replace(/\/+$/, "");

  if (/^data:/i.test(trimmed)) return trimmed;

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed.replace(
      /^https?:\/\/(?:localhost|127(?:\.\d{1,3}){3})(?::\d+)?/i,
      backendUrl,
    );
  }

  return `${backendUrl}/${trimmed.replace(/^\/+/, "")}`;
};

export default function HomeCategories() {
  const scrollViewRef = useRef<ScrollView>(null);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { width: screenWidth } = useWindowDimensions();

  // Consistent card width and height across all categories
  const cardWidth = Math.round(Math.min(144, Math.max(130, (screenWidth - 48) / 2.4)));
  const cardHeight = 148;
  const cardSpacing = 12;
  const scrollStep = (cardWidth + cardSpacing) * 2;

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await api.get("/categories");
      const responseData = response.data;
      let rawList: unknown[] = [];

      if (Array.isArray(responseData)) {
        rawList = responseData;
      } else if (isRecord(responseData)) {
        if (Array.isArray(responseData.data)) {
          rawList = responseData.data;
        } else if (Array.isArray(responseData.categories)) {
          rawList = responseData.categories;
        } else if (Array.isArray(responseData.items)) {
          rawList = responseData.items;
        } else {
          for (const val of Object.values(responseData)) {
            if (Array.isArray(val)) {
              rawList = val;
              break;
            }
          }
        }
      }

      if (!Array.isArray(rawList)) {
        throw new Error("The categories response was invalid.");
      }

      const activeCategories: Category[] = rawList
        .filter((item): item is Record<string, unknown> => {
          if (!isRecord(item)) return false;
          const status = getString(item.status ?? item.is_active ?? "Active").toLowerCase();
          return status === "active" || status === "1" || status === "true" || status === "enabled";
        })
        .map((item, index) => {
          const categoryId = getString(
            item.category_id ?? item.categoryId ?? item.id,
            `cat-${index}`,
          );
          const categoryName = getString(
            item.category_name ?? item.categoryName ?? item.name,
            "Category",
          );
          const categoryFilter = getString(
            item.category_id ?? item.categoryId ?? item.category_name ?? item.name ?? item.id,
            categoryId,
          );
          const image = resolveImageUrl(
            item.category_image ?? item.categoryImage ?? item.image ?? item.image_url ?? item.icon,
          );

          return {
            id: categoryId,
            name: categoryName,
            image,
            filter: categoryFilter,
          };
        });

      setCategories(activeCategories);
    } catch (requestError: unknown) {
      console.error("Failed to load home categories:", requestError);
      setError("We could not load categories right now.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchCategories();
  }, [fetchCategories]);

  const handleScrollLeft = () => {
    const nextOffset = Math.max(0, scrollOffset - scrollStep);
    scrollViewRef.current?.scrollTo({ x: nextOffset, animated: true });
    setScrollOffset(nextOffset);
  };

  const handleScrollRight = () => {
    const nextOffset = scrollOffset + scrollStep;
    scrollViewRef.current?.scrollTo({ x: nextOffset, animated: true });
    setScrollOffset(nextOffset);
  };

  return (
    <View className="mt-8">
      {/* Header Section */}
      <View className="mb-4 flex-row items-end justify-between">
        <View className="flex-1 pr-2">
          <Text className="text-[11px] font-extrabold uppercase tracking-[2px] text-[#E86D16]">
            Popular Categories
          </Text>
          <View className="mt-1 flex-row items-baseline">
            <Text className="text-2xl font-black text-[#17251E]">Choose Your </Text>
            <Text className="text-2xl font-black italic text-[#1A6A3B]">Favorite</Text>
          </View>
        </View>

        <View className="flex-row items-center gap-1.5">
          {categories.length > 2 && (
            <>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Scroll categories left"
                onPress={handleScrollLeft}
                className="h-8 w-8 items-center justify-center rounded-full border border-[#E7E0D8] bg-white shadow-sm active:bg-[#FFF8ED]"
              >
                <ChevronLeft color="#203129" size={16} />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Scroll categories right"
                onPress={handleScrollRight}
                className="h-8 w-8 items-center justify-center rounded-full border border-[#E7E0D8] bg-white shadow-sm active:bg-[#FFF8ED]"
              >
                <ChevronRight color="#203129" size={16} />
              </Pressable>
            </>
          )}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="See all categories"
            className="flex-row items-center rounded-full border border-[#E7E0D8] bg-white px-3 py-1.5 active:bg-slate-50"
            onPress={() => router.push("/explore")}
          >
            <Text className="text-xs font-bold text-[#1A6A3B]">See all</Text>
            <ArrowRight color="#1A6A3B" size={12} className="ml-1" />
          </Pressable>
        </View>
      </View>

      {/* Body States */}
      {loading ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingRight: 8 }}
        >
          {[1, 2, 3, 4].map((item) => (
            <View
              key={item}
              className="mr-3 rounded-2xl border-2 border-slate-200 bg-white p-2.5 shadow-sm justify-between"
              style={{
                width: cardWidth,
                minWidth: cardWidth,
                maxWidth: cardWidth,
                height: cardHeight,
                minHeight: cardHeight,
                maxHeight: cardHeight,
              }}
            >
              <View className="h-24 w-full rounded-xl bg-slate-200" />
              <View className="mx-auto h-4 w-3/4 rounded bg-slate-200" />
            </View>
          ))}
        </ScrollView>
      ) : error ? (
        <View className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-center">
          <Text className="text-center text-sm font-semibold text-rose-800">{error}</Text>
          <Pressable
            accessibilityRole="button"
            className="mt-3 self-center rounded-xl bg-rose-600 px-4 py-2"
            onPress={() => void fetchCategories()}
          >
            <Text className="text-xs font-bold text-white">Try again</Text>
          </Pressable>
        </View>
      ) : categories.length > 0 ? (
        <ScrollView
          ref={scrollViewRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          onScroll={(event) => setScrollOffset(event.nativeEvent.contentOffset.x)}
          scrollEventThrottle={16}
          contentContainerStyle={{ paddingRight: 8, paddingBottom: 6 }}
        >
          {categories.map((category) => (
            <CategoryCard
              key={category.id}
              category={category}
              width={cardWidth}
              height={cardHeight}
            />
          ))}
        </ScrollView>
      ) : (
        <View className="rounded-2xl bg-white py-8 px-4 border border-[#E5E5E5] items-center">
          <Text className="text-center text-sm font-medium text-slate-500">
            Categories will appear here soon.
          </Text>
        </View>
      )}
    </View>
  );
}

function CategoryCard({
  category,
  width,
  height,
}: {
  category: Category;
  width: number;
  height: number;
}) {
  const [imageError, setImageError] = useState(false);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Browse ${category.name}`}
      className="mr-3 overflow-hidden rounded-2xl border-2 border-[#E5E5E5] bg-white p-2.5 shadow-sm active:border-[#D8C7A7]"
      onPress={() =>
        router.push({
          pathname: "/explore",
          params: { category: category.filter },
        })
      }
      style={({ pressed }) => ({
        width,
        minWidth: width,
        maxWidth: width,
        height,
        minHeight: height,
        maxHeight: height,
        justifyContent: "space-between",
        transform: [{ scale: pressed ? 0.96 : 1 }],
      })}
    >
      {/* 4:3 Aspect Ratio Image Container */}
      <View
        className="w-full overflow-hidden rounded-xl bg-[#F5EFE5] items-center justify-center"
        style={{ height: 96, width: "100%" }}
      >
        {category.image && !imageError ? (
          <Image
            accessible
            accessibilityLabel={category.name}
            className="h-full w-full"
            onError={() => setImageError(true)}
            resizeMode="cover"
            source={{ uri: category.image }}
          />
        ) : (
          <View className="items-center justify-center">
            <ImageIcon color="#A05C2A" size={28} strokeWidth={1.8} />
          </View>
        )}
      </View>

      {/* Category Name fixed-height container */}
      <View className="h-7 w-full items-center justify-center px-1">
        <Text
          className="text-center text-xs font-bold text-[#202020]"
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {category.name}
        </Text>
      </View>
    </Pressable>
  );
}
