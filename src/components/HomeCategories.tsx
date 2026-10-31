import { useCallback, useEffect, useState } from "react";
import { router } from "expo-router";
import { ImageIcon } from "lucide-react-native";
import {
  Image,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import api, { API_BASE_URL } from "../lib/api";
import colors from "../theme/colors.json";

type Category = {
  id: string;
  name: string;
  image: string;
  filter: string;
};

const CARD_GAP = 10;

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
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { width: screenWidth } = useWindowDimensions();

  // Exactly 3 categories visible per view
  // Home screen has paddingHorizontal: 24 (total 48px)
  const availableWidth = screenWidth - 48;
  const cardWidth = Math.max(96, Math.floor((availableWidth - 2 * CARD_GAP) / 3));
  const cardHeight = Math.round(cardWidth * 1.18);
  const imageHeight = Math.round(cardWidth * 0.72);
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

  return (
    <View className="mt-7">
      {/* Header Section */}
      <View className="mb-4 items-center">
        <Text className="text-[11px] font-extrabold uppercase tracking-[2px] text-brand-gold">
          MADE FOR YOU
        </Text>
        <View className="mt-1 flex-row items-baseline">
          <Text className="text-2xl font-black text-brand-neutral-text-primary">Choose Your </Text>
          <Text className="text-2xl font-black italic text-brand-green-primary">Category</Text>
        </View>
      </View>

      {/* Body States */}
      {loading ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingRight: 8, paddingBottom: 6 }}
        >
          {[1, 2, 3].map((item) => (
            <View
              key={item}
              className="shrink-0 items-center justify-between rounded-2xl border-2 border-slate-200 bg-white p-1.5 shadow-sm"
              style={{
                width: cardWidth,
                minWidth: cardWidth,
                maxWidth: cardWidth,
                height: cardHeight,
                marginRight: CARD_GAP,
              }}
            >
              <View
                className="w-full rounded-xl bg-slate-200"
                style={{ height: imageHeight }}
              />
              <View className="h-3 w-3/4 rounded-md bg-slate-200" />
            </View>
          ))}
        </ScrollView>
      ) : error ? (
        <View className="rounded-2xl border border-rose-200 bg-rose-50 p-5 items-center">
          <Text className="text-center text-sm font-semibold text-rose-800">{error}</Text>
          <Pressable
            accessibilityRole="button"
            className="mt-3 rounded-xl bg-rose-600 px-4 py-2"
            onPress={() => void fetchCategories()}
          >
            <Text className="text-xs font-bold text-white">Try again</Text>
          </Pressable>
        </View>
      ) : categories.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingRight: 8, paddingBottom: 6 }}
        >
          {categories.map((category) => (
            <CategoryCard
              key={category.id}
              category={category}
              cardWidth={cardWidth}
              cardHeight={cardHeight}
              imageHeight={imageHeight}
            />
          ))}
        </ScrollView>
      ) : (
        <View className="rounded-2xl border border-brand-neutral-border-light bg-white py-8 px-4 items-center">
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
  cardWidth,
  cardHeight,
  imageHeight,
}: {
  category: Category;
  cardWidth: number;
  cardHeight: number;
  imageHeight: number;
}) {
  const [imageError, setImageError] = useState(false);

  return (
    <View
      className="shrink-0"
      style={{
        width: cardWidth,
        minWidth: cardWidth,
        maxWidth: cardWidth,
        height: cardHeight,
        marginRight: CARD_GAP,
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Browse ${category.name}`}
        onPress={() =>
          router.push({
            pathname: "/UsersTab/shop",
            params: { category: category.filter },
          })
        }
        className="h-full w-full items-center justify-between rounded-2xl border-2 border-brand-gold-muted bg-white p-1.5 shadow-sm active:border-brand-gold active:scale-95"
      >
        {/* Aspect Ratio Image Container */}
        <View
          className="w-full items-center justify-center overflow-hidden rounded-xl bg-brand-surface-cream"
          style={{ height: imageHeight }}
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
            <View className="h-full w-full items-center justify-center">
              <ImageIcon color={colors.gold} size={24} strokeWidth={1.8} />
            </View>
          )}
        </View>

        {/* Title Container */}
        <View className="h-6 w-full items-center justify-center px-0.5">
          <Text
            className="text-center text-[11px] font-extrabold text-brand-neutral-text-black"
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {category.name}
          </Text>
        </View>
      </Pressable>
    </View>
  );
}
