import { useState } from "react";
import { router } from "expo-router";
import { Heart, UtensilsCrossed } from "lucide-react-native";
import { Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { useCart } from "../contexts/CartContext";
import FoodProductCard from "../components/common/FoodProductCard";
import { getFoodId } from "../lib/foods";
import type { FoodProduct } from "../types/food";

export default function FavoritesScreen() {
  const { items: cartItems, wishlist, toggleWishlist } = useCart();
  const [actionError, setActionError] = useState("");
  const { width: screenWidth } = useWindowDimensions();
  const cardWidth = Math.max(0, screenWidth - 40);

  const handleToggleWishlist = async (food: FoodProduct) => {
    setActionError("");
    try {
      await toggleWishlist(food);
    } catch (requestError) {
      console.error("Failed to update favorites:", requestError);
      setActionError("We could not update your favorites. Please try again.");
    }
  };

  return (
    <>
      <ScrollView
        className="flex-1 bg-[#F3F4F3]"
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="mb-5">
          <Text className="text-[11px] font-extrabold uppercase tracking-[2px] text-[#E86D16]">
            Saved for later
          </Text>
          <Text className="mt-1 text-2xl font-black text-[#17251E]">
            Your favorites
          </Text>
          <Text className="mt-1 text-sm text-slate-500">
            {wishlist.length
              ? `${wishlist.length} ${wishlist.length === 1 ? "dish" : "dishes"} you love`
              : "Save dishes you love and find them here."}
          </Text>
        </View>

        {wishlist.length > 0 ? (
          <View className="gap-3">
            {wishlist.map((food) => {
              const foodId = getFoodId(food);
              return (
                <FoodProductCard
                  key={foodId}
                  food={food}
                  width={cardWidth}
                  viewMode="list"
                  isInWishlist
                  cartQuantity={cartItems
                    .filter((item) => getFoodId(item.food) === foodId)
                    .reduce((total, item) => total + item.quantity, 0)}
                  onSelect={() =>
                    router.push({ pathname: "/product/[id]", params: { id: foodId } })
                  }
                  onToggleWishlist={(item) => void handleToggleWishlist(item)}
                />
              );
            })}
          </View>
        ) : (
          <View className="items-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-10">
            <View className="h-14 w-14 items-center justify-center rounded-full bg-rose-50">
              <Heart color="#E11D48" size={26} />
            </View>
            <Text className="mt-4 text-base font-extrabold text-[#17251E]">
              No favorites yet
            </Text>
            <Text className="mt-1 text-center text-sm leading-5 text-slate-500">
              Browse the menu and tap the heart on any dish to save it here.
            </Text>
            <Pressable
              accessibilityRole="button"
              className="mt-5 flex-row items-center rounded-xl bg-[#1A6A3B] px-4 py-3 active:opacity-80"
              onPress={() => router.push("/shop")}
            >
              <UtensilsCrossed color="#FFFFFF" size={16} />
              <Text className="ml-2 text-sm font-bold text-white">Browse the menu</Text>
            </Pressable>
          </View>
        )}

        {actionError ? (
          <Text accessibilityRole="alert" className="mt-3 text-center text-xs font-semibold text-rose-700">
            {actionError}
          </Text>
        ) : null}
      </ScrollView>

    </>
  );
}
