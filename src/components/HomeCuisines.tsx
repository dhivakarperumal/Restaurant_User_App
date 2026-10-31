import { useCallback, useEffect, useState } from "react";
import { router } from "expo-router";
import { ImageIcon, Utensils } from "lucide-react-native";
import {
  Image,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import api, { API_BASE_URL } from "../lib/api";

type Cuisine = {
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

function resolveImageUrl(image: unknown): string {
  const value = getString(image);
  if (!value) return "";
  if (/^data:/i.test(value)) return value;

  const backendUrl = API_BASE_URL.replace(/\/api\/?$/i, "").replace(/\/+$/, "");
  if (/^https?:\/\//i.test(value)) {
    return value.replace(
      /^https?:\/\/(?:localhost|127(?:\.\d{1,3}){3})(?::\d+)?/i,
      backendUrl,
    );
  }

  return `${backendUrl}/${value.replace(/^\/+/, "")}`;
}

function getCuisineList(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (!isRecord(payload)) return [];

  if (Array.isArray(payload.data)) return payload.data;
  if (Array.isArray(payload.cuisines)) return payload.cuisines;
  if (Array.isArray(payload.items)) return payload.items;

  return [];
}

function isActiveCuisine(cuisine: Record<string, unknown>): boolean {
  const status = getString(cuisine.status ?? cuisine.is_active ?? "Active").toLowerCase();
  return status === "active" || status === "1" || status === "true" || status === "enabled";
}

export default function HomeCuisines() {
  const [cuisines, setCuisines] = useState<Cuisine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { width: screenWidth } = useWindowDimensions();
  const pageWidth = Math.max(0, screenWidth - 48);
  const cardWidth = (pageWidth - 12) / 2;

  const fetchCuisines = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await api.get("/cuisines");
      const rawCuisines = getCuisineList(response.data);
      const activeCuisines = rawCuisines
        .filter((item): item is Record<string, unknown> => isRecord(item) && isActiveCuisine(item))
        .map((item, index) => {
          const id = getString(item.cuisine_id ?? item.id, `cuisine-${index}`);
          const name = getString(item.cuisine_name ?? item.name, "Cuisine");
          return {
            id,
            name,
            image: resolveImageUrl(item.image ?? item.cuisine_image ?? item.image_url),
            filter: getString(item.cuisine_id ?? item.cuisine_name ?? item.name ?? item.id, id),
          };
        });

      setCuisines(activeCuisines);
    } catch (requestError) {
      console.error("Failed to load home cuisines:", requestError);
      setError("We could not load cuisines right now.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchCuisines();
  }, [fetchCuisines]);

  return (
    <View className="mt-8">
      <View className="mb-4 items-center">
        <Text className="text-[11px] font-extrabold uppercase tracking-[2px] text-[#E86D16]">
          Our Cuisines
        </Text>
        <Text className="mt-1 text-2xl font-black text-[#17251E]">
          A World of <Text className="italic text-[#1A6A3B]">Cuisines</Text>
        </Text>
      </View>

      {loading ? (
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 6 }}
        >
          <View
            className="flex-row"
            style={{ width: pageWidth, gap: 12 }}
          >
            {[0, 1].map((item) => (
              <View
                key={item}
                className="h-[152px] overflow-hidden rounded-2xl bg-slate-200"
                style={{ width: cardWidth }}
              />
            ))}
          </View>
        </ScrollView>
      ) : error ? (
        <View className="items-center rounded-2xl border border-rose-200 bg-rose-50 p-5">
          <Text className="text-center text-sm font-semibold text-rose-800">{error}</Text>
          <Pressable
            accessibilityRole="button"
            className="mt-3 rounded-xl bg-rose-600 px-4 py-2"
            onPress={() => void fetchCuisines()}
          >
            <Text className="text-xs font-bold text-white">Try again</Text>
          </Pressable>
        </View>
      ) : cuisines.length > 0 ? (
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 6 }}
        >
          {Array.from({ length: Math.ceil(cuisines.length / 2) }, (_, pageIndex) => (
            <View
              key={pageIndex}
              className="flex-row"
              style={{ width: pageWidth, gap: 12 }}
            >
              {cuisines.slice(pageIndex * 2, pageIndex * 2 + 2).map((cuisine) => (
                <CuisineCard
                  key={cuisine.id}
                  cuisine={cuisine}
                  cardWidth={cardWidth}
                />
              ))}
            </View>
          ))}
        </ScrollView>
      ) : (
        <View className="items-center rounded-2xl border border-[#E5E5E5] bg-white px-4 py-8">
          <Text className="text-center text-sm font-medium text-slate-500">
            Cuisines will appear here soon.
          </Text>
        </View>
      )}
    </View>
  );
}

function CuisineCard({
  cuisine,
  cardWidth,
}: {
  cuisine: Cuisine;
  cardWidth: number;
}) {
  const [imageError, setImageError] = useState(false);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Browse ${cuisine.name} cuisine`}
      className="h-[152px] overflow-hidden rounded-2xl border border-[#E7E0D8] bg-[#F5EFE5] shadow-sm active:opacity-80"
      style={{ width: cardWidth }}
      onPress={() =>
        router.push({
          pathname: "/UsersTab/shop",
          params: { cuisine: cuisine.filter },
        })
      }
    >
      {cuisine.image && !imageError ? (
        <Image
          accessible
          accessibilityLabel={cuisine.name}
          className="h-full w-full"
          onError={() => setImageError(true)}
          resizeMode="contain"
          source={{ uri: cuisine.image }}
        />
      ) : (
        <View className="h-full w-full items-center justify-center bg-[#315D2D]">
          {cuisine.image ? (
            <ImageIcon color="#FFFFFF" size={28} />
          ) : (
            <Utensils color="#FFFFFF" size={28} />
          )}
        </View>
      )}
    </Pressable>
  );
}
