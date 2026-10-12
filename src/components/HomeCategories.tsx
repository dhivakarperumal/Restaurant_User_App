import { useCallback, useEffect, useState } from "react";
import { router } from "expo-router";
import { ArrowRight, ImageIcon } from "lucide-react-native";
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

function getString(value: unknown, fallback = "") {
  return typeof value === "string" || typeof value === "number"
    ? String(value).trim() || fallback
    : fallback;
}

function extractArrayPayload(
  payload: unknown,
  preferredKeys: string[],
  depth = 0,
): unknown[] | null {
  if (Array.isArray(payload)) return payload;

  if (!isRecord(payload) || depth >= 5) return null;

  for (const key of preferredKeys) {
    const candidate = payload[key];
    const result = extractArrayPayload(candidate, preferredKeys, depth + 1);
    if (result) return result;
  }

  for (const value of Object.values(payload)) {
    if (isRecord(value)) {
      const result = extractArrayPayload(value, preferredKeys, depth + 1);
      if (result) return result;
    }
  }

  return null;
}

function resolveImageUrl(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return "";
  const image = value.trim();
  const backendUrl = API_BASE_URL.replace(/\/api\/?$/i, "").replace(/\/+$/, "");

  if (/^data:/i.test(image)) return image;
  if (/^https?:\/\//i.test(image)) {
    return image.replace(
      /^https?:\/\/(?:localhost|127(?:\.\d{1,3}){3})(?::\d+)?/i,
      backendUrl,
    );
  }

  return `${backendUrl}/${image.replace(/^\/+/, "")}`;
}

function isActiveCategory(category: Record<string, unknown>) {
  if (category.active === false || category.is_active === false) return false;
  if (category.is_active === 0) return false;
  if (category.status === false || category.status === 0) return false;

  const status = getString(category.status).toLowerCase();
  return (
    !status ||
    status === "active" ||
    status === "1" ||
    status === "true" ||
    status === "enabled"
  );
}

function CategoryCard({
  category,
  width,
}: {
  category: Category;
  width: number;
}) {
  const [imageFailed, setImageFailed] = useState(false);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Browse ${category.name}`}
      className="overflow-hidden rounded-[24px] bg-white"
      onPress={() =>
        router.push({
          pathname: "/explore",
          params: { category: category.filter },
        })
      }
      style={({ pressed }) => ({
        width,
        opacity: pressed ? 0.88 : 1,
        transform: [{ scale: pressed ? 0.97 : 1 }],
        elevation: 3,
      })}
    >
      <View className="h-[172px] overflow-hidden rounded-[24px] bg-[#E9E1D3]">
        {category.image && !imageFailed ? (
          <Image
            accessible
            accessibilityLabel={category.name}
            className="h-full w-full"
            onError={() => setImageFailed(true)}
            resizeMode="cover"
            source={{ uri: category.image }}
          />
        ) : (
          <View className="flex-1 items-center justify-center bg-[#F1E8D9]">
            <View className="h-14 w-14 items-center justify-center rounded-full bg-white/75">
              <ImageIcon color="#A05C2A" size={28} strokeWidth={1.7} />
            </View>
          </View>
        )}
        <View className="absolute inset-0 bg-black/15" />
        <View className="absolute inset-x-0 bottom-0 bg-black/45 px-3 pb-3 pt-8">
          <Text
            className="text-base font-extrabold text-white"
            numberOfLines={1}
          >
            {category.name}
          </Text>
          <Text className="mt-0.5 text-[11px] font-semibold text-white/80">
            Explore dishes
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

export default function HomeCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const { width: screenWidth } = useWindowDimensions();
  const cardWidth = Math.min(164, Math.max(144, (screenWidth - 72) / 2.2));

  const fetchCategories = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage("");

    try {
      const response = await api.get("/categories");
      const payload = extractArrayPayload(response.data, [
        "categories",
        "category",
        "items",
        "results",
        "data",
        "list",
      ]);
      if (!payload) {
        throw new Error("The categories response did not contain a category list.");
      }

      const activeCategories = payload
        .filter(
          (category): category is Record<string, unknown> =>
            isRecord(category) && isActiveCategory(category),
        )
        .map((category, index) => {
          const id = getString(
            category.category_id ??
              category.categoryId ??
              category.id ??
              category.category_name ??
              category.name,
            `category-${index}`,
          );
          const name = getString(
            category.category_name ?? category.categoryName ?? category.name,
            "Category",
          );
          return {
            id,
            name,
            image: resolveImageUrl(
              category.category_image ??
                category.categoryImage ??
                category.image ??
                category.image_url ??
                category.icon,
            ),
            filter: getString(
              category.category_id ??
                category.categoryId ??
                category.category_name ??
                category.categoryName ??
                category.id ??
                category.name,
              id,
            ),
          };
        });

      console.info(
        `[HomeCategories] Loaded ${activeCategories.length} active categories from ${payload.length} records.`,
      );
      setCategories(activeCategories);
    } catch (error) {
      console.error("Failed to load home categories:", error);
      setErrorMessage("We could not load categories right now.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(fetchCategories);
  }, [fetchCategories]);

  return (
    <View className="mt-9">
      <View className="mb-5 flex-row items-end justify-between">
        <View className="flex-1 pr-3">
          <Text className="text-[11px] font-extrabold uppercase tracking-[1.8px] text-[#E86D16]">
            Find your favorite
          </Text>
          <Text className="mt-1 text-[25px] font-extrabold leading-[30px] text-[#17251E]">
            What are you craving?
          </Text>
          <Text className="mt-1 text-sm text-[#737A73]">
            Pick a category to get started
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="See all categories"
          className="mb-1 flex-row items-center rounded-full bg-white px-3 py-2"
          onPress={() => router.push("/explore")}
          style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
        >
          <Text className="text-xs font-bold text-[#1A6A3B]">See all</Text>
          <ArrowRight color="#1A6A3B" size={14} className="ml-1" />
        </Pressable>
      </View>

      {isLoading ? (
        <ScrollView
          horizontal
          style={{ height: 188 }}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingRight: 8, alignItems: "center" }}
        >
          {[0, 1, 2].map((item) => (
            <View
              key={item}
              className="mr-4 h-[172px] overflow-hidden rounded-[24px] bg-slate-200"
              style={{ width: cardWidth }}
            />
          ))}
        </ScrollView>
      ) : errorMessage ? (
        <View className="rounded-xl border border-rose-200 bg-rose-50 p-4">
          <Text className="text-sm font-semibold text-rose-800">
            {errorMessage}
          </Text>
          <Pressable
            accessibilityRole="button"
            className="mt-2 self-start"
            onPress={() => void fetchCategories()}
          >
            <Text className="text-sm font-bold text-rose-700 underline">
              Try again
            </Text>
          </Pressable>
        </View>
      ) : categories.length > 0 ? (
        <ScrollView
          horizontal
          style={{ height: 188 }}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingRight: 8, alignItems: "center" }}
        >
          {categories.map((category) => (
            <View key={category.id} className="mr-4">
              <CategoryCard category={category} width={cardWidth} />
            </View>
          ))}
        </ScrollView>
      ) : (
        <Text className="rounded-2xl bg-white py-5 text-center text-sm text-slate-500">
          Categories will appear here soon.
        </Text>
      )}
    </View>
  );
}
