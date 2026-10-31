import { useCallback, useEffect, useMemo, useState } from "react";
import { router } from "expo-router";
import { ArrowRight, UtensilsCrossed } from "lucide-react-native";
import { Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import api from "../lib/api";
import { getActiveFoods, getFoodId } from "../lib/foods";
import { useCart } from "../contexts/CartContext";
import type { FoodProduct } from "../types/food";
import FoodCustomizationModal from "./common/FoodCustomizationModal";
import FoodProductCard from "./common/FoodProductCard";

export default function HomeProducts() {
  const [foods, setFoods] = useState<FoodProduct[]>([]);
  const [selectedFood, setSelectedFood] = useState<FoodProduct | null>(null);
  const [actionError, setActionError] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { addItem, items: cartItems, wishlist, toggleWishlist } = useCart();
  const { width: screenWidth } = useWindowDimensions();
  const pageWidth = Math.max(0, screenWidth - 48);
  const cardWidth = (pageWidth - 12) / 2;

  const fetchFoods = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await api.get("/foods");
      const activeFoods = getActiveFoods(response.data?.data ?? response.data);
      setFoods(activeFoods);
    } catch (requestError) {
      console.error("Failed to load home menu:", requestError);
      setError("We could not load the menu right now.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchFoods();
  }, [fetchFoods]);

  const featuredFoods = useMemo(
    () =>
      [...foods]
        .sort(
          (first, second) =>
            Number(Boolean(second.featured)) - Number(Boolean(first.featured)),
        ),
    [foods],
  );

  const handleToggleWishlist = async (food: FoodProduct) => {
    setActionError("");
    try {
      await toggleWishlist(food);
    } catch (requestError) {
      console.error("Failed to update home wishlist:", requestError);
      setActionError("We could not save your favorites. Please try again.");
    }
  };

  return (
    <View className="mt-8">
      <View className="mb-4">
        <Text className="text-center text-[11px] font-extrabold uppercase tracking-[2px] text-[#E86D16]">
          A taste of what we make
        </Text>
        <Text className="mt-1 text-center text-2xl font-black text-[#17251E]">
          Guest <Text className="font-serif italic text-[#1A6A3B]">Favorites</Text>
        </Text>
        <Text className="mt-1 text-center text-xs text-slate-500">
          Fresh picks from our menu, ready for your next meal.
        </Text>
      </View>

      {loading ? (
        <View className="flex-row gap-3">
          {[0, 1].map((item) => (
            <View
              key={item}
              className="h-[300px] rounded-2xl bg-slate-200"
              style={{ width: cardWidth }}
            />
          ))}
        </View>
      ) : error ? (
        <View className="items-center rounded-2xl border border-rose-200 bg-rose-50 p-5">
          <Text className="text-center text-sm font-semibold text-rose-800">{error}</Text>
          <Pressable
            accessibilityRole="button"
            className="mt-3 rounded-xl bg-rose-600 px-4 py-2"
            onPress={() => void fetchFoods()}
          >
            <Text className="text-xs font-bold text-white">Try again</Text>
          </Pressable>
        </View>
      ) : featuredFoods.length ? (
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 6 }}
        >
          {Array.from(
            { length: Math.ceil(featuredFoods.length / 2) },
            (_, pageIndex) => (
              <View
                key={pageIndex}
                className="flex-row"
                style={{ width: pageWidth, gap: 12 }}
              >
                {featuredFoods.slice(pageIndex * 2, pageIndex * 2 + 2).map((food) => (
                  <FoodProductCard
                    key={getFoodId(food)}
                    food={food}
                    width={cardWidth}
                    isInWishlist={wishlist.some((item) => getFoodId(item) === getFoodId(food))}
                    cartQuantity={cartItems
                      .filter((item) => getFoodId(item.food) === getFoodId(food))
                      .reduce((total, item) => total + item.quantity, 0)}
                    onSelect={(item) =>
                      router.push({ pathname: "/UsersTab/product/[id]", params: { id: getFoodId(item) } })
                    }
                    onCustomize={setSelectedFood}
                    onToggleWishlist={(item) => void handleToggleWishlist(item)}
                  />
                ))}
              </View>
            ),
          )}
        </ScrollView>
      ) : (
        <View className="items-center rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-8">
          <UtensilsCrossed color="#94A3B8" size={30} />
          <Text className="mt-3 text-center text-sm font-semibold text-slate-600">
            Menu favorites will appear here.
          </Text>
        </View>
      )}

      {actionError ? (
        <Text accessibilityRole="alert" className="mt-2 text-center text-xs font-semibold text-rose-700">
          {actionError}
        </Text>
      ) : null}

      <Pressable
        accessibilityRole="button"
        className="mt-3 flex-row items-center justify-center py-2"
        onPress={() => router.push("/UsersTab/shop")}
      >
        <Text className="text-sm font-bold text-[#1A6A3B]">View the full menu</Text>
        <ArrowRight color="#1A6A3B" size={16} className="ml-2" />
      </Pressable>

      <FoodCustomizationModal
        food={selectedFood}
        onClose={() => setSelectedFood(null)}
        onAdd={addItem}
      />
    </View>
  );
}
