import colors from "../../theme/colors.json";
import { router } from "expo-router";
import { Heart, UtensilsCrossed } from "lucide-react-native";
import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import FoodCustomizationModal from "../../components/common/FoodCustomizationModal";
import FoodProductCard from "../../components/common/FoodProductCard";
import { useCart } from "../../contexts/CartContext";
import { getFoodId } from "../../lib/foods";
import type { FoodProduct } from "../../types/food";

export default function FavoritesScreen() {
  const {
    addItem,
    items: cartItems,
    wishlist,
    isWishlistLoading,
    wishlistError,
    refreshWishlist,
    toggleWishlist,
  } = useCart();
  const [selectedFood, setSelectedFood] = useState<FoodProduct | null>(null);
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
        className="flex-1 bg-brand-surface-app"
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="mb-5">
          <Text className="text-[11px] font-extrabold uppercase tracking-[2px] text-brand-gold">
            Saved for later
          </Text>
          <Text className="mt-1 text-2xl font-black text-brand-neutral-text-primary">
            Your favorites
          </Text>
          <Text className="mt-1 text-sm text-slate-500">
            {wishlist.length
              ? `${wishlist.length} ${wishlist.length === 1 ? "dish" : "dishes"} you love`
              : "Save dishes you love and find them here."}
          </Text>
        </View>

        {isWishlistLoading ? (
          <View className="items-center py-12">
            <ActivityIndicator color={colors["green-primary"]} />
            <Text className="mt-2 text-xs text-slate-500">Loading favorites...</Text>
          </View>
        ) : wishlistError ? (
          <View className="items-center rounded-2xl border border-rose-100 bg-white px-6 py-8">
            <Text className="text-center text-sm text-rose-700">{wishlistError}</Text>
            <Pressable
              accessibilityRole="button"
              className="mt-4 rounded-xl bg-brand-green-primary px-4 py-3 active:opacity-80"
              onPress={() => void refreshWishlist().catch(() => undefined)}
            >
              <Text className="text-sm font-bold text-white">Try again</Text>
            </Pressable>
          </View>
        ) : wishlist.length > 0 ? (
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
                    router.push({ pathname: "/UsersTab/product/[id]", params: { id: foodId } })
                  }
                  onCustomize={setSelectedFood}
                  onToggleWishlist={(item) => void handleToggleWishlist(item)}
                />
              );
            })}
          </View>
        ) : (
          <View className="items-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-10">
            <View className="h-14 w-14 items-center justify-center rounded-full bg-rose-50">
              <Heart color={colors["danger-heart"]} size={26} />
            </View>
            <Text className="mt-4 text-base font-extrabold text-brand-neutral-text-primary">
              No favorites yet
            </Text>
            <Text className="mt-1 text-center text-sm leading-5 text-slate-500">
              Browse the menu and tap the heart on any dish to save it here.
            </Text>
            <Pressable
              accessibilityRole="button"
              className="mt-5 flex-row items-center rounded-xl bg-brand-green-primary px-4 py-3 active:opacity-80"
              onPress={() => router.push("/UsersTab/shop")}
            >
              <UtensilsCrossed color={colors["white"]} size={16} />
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
      <FoodCustomizationModal
        food={selectedFood}
        onClose={() => setSelectedFood(null)}
        onAdd={addItem}
      />
    </>
  );
}
