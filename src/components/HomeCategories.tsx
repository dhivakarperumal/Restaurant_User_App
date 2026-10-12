import { useCallback, useEffect, useState } from "react";
import { router } from "expo-router";
import { ImageIcon } from "lucide-react-native";
import {
  FlatList,
  Image,
  Pressable,
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
      className="overflow-hidden rounded-2xl border border-[#E5E5E5] bg-white p-2"
      onPress={() =>
        router.push({
          pathname: "/explore",
          params: { category: category.filter },
        })
      }
      style={({ pressed }) => ({
        width,
        opacity: pressed ? 0.8 : 1,
        transform: [{ scale: pressed ? 0.98 : 1 }],
      })}
    >
      <View className="aspect-[4/3] overflow-hidden rounded-xl bg-[#F5EFE5]">
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
          <View className="flex-1 items-center justify-center">
            <ImageIcon color="#A05C2A" size={36} strokeWidth={1.7} />
          </View>
        )}
      </View>
      <Text
        className="px-1 pb-1 pt-3 text-center text-sm font-bold text-[#202020]"
        numberOfLines={1}
      >
        {category.name}
      </Text>
    </Pressable>
  );
}

export default function HomeCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const { width: screenWidth } = useWindowDimensions();
  const cardWidth = Math.min(176, Math.max(132, (screenWidth - 80) / 2.25));

  const fetchCategories = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage("");

    try {
      const response = await api.get("/categories");
      const payload = extractArrayPayload(response.data, [
        "categories",
        "items",
        "results",
        "data",
        "list",
      ]);

      const activeCategories = payload
        .filter(
          (category): category is Record<string, unknown> =>
            isRecord(category) &&
            getString(category.status, "Active").toLowerCase() === "active",
        )
        .map((category, index) => {
          const id = getString(
            category.category_id ?? category.id ?? category.category_name,
            `category-${index}`,
          );
          const name = getString(category.category_name ?? category.name, "Category");
          return {
            id,
            name,
            image: resolveImageUrl(
              category.category_image ?? category.image ?? category.icon,
            ),
            filter: getString(
              category.category_id ?? category.category_name ?? category.id ?? category.name,
              id,
            ),
          };
        });

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
    <View className="mt-8">
      <View className="mb-4">
        <Text className="text-xs font-extrabold uppercase tracking-[2px] text-[#E86D16]">
          Popular Categories
        </Text>
        <Text className="mt-1 text-2xl font-extrabold text-[#17251E]">
          Choose Your <Text className="italic text-[#1A6A3B]">Favorite</Text>
        </Text>
      </View>

      {isLoading ? (
        <View className="flex-row">
          {[0, 1, 2].map((item) => (
            <View
              key={item}
              className="mr-4 rounded-2xl border border-slate-200 bg-white p-2"
              style={{ width: cardWidth }}
            >
              <View className="aspect-[4/3] rounded-xl bg-slate-200" />
              <View className="mx-auto mb-1 mt-3 h-4 w-2/3 rounded bg-slate-200" />
            </View>
          ))}
        </View>
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
        <FlatList
          contentContainerStyle={{ paddingRight: 8 }}
          data={categories}
          horizontal
          keyExtractor={(category) => category.id}
          renderItem={({ item }) => (
            <View className="mr-4">
              <CategoryCard category={item} width={cardWidth} />
            </View>
          )}
          showsHorizontalScrollIndicator={false}
        />
      ) : (
        <Text className="py-4 text-center text-sm text-slate-500">
          Categories will appear here soon.
        </Text>
      )}
    </View>
  );
}
