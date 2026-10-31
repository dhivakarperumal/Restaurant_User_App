import colors from "../../theme/colors.json";
import { router } from "expo-router";
import { Heart, Trash2, UtensilsCrossed, X } from "lucide-react-native";
import { useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCart } from "../../contexts/CartContext";
import { getFoodId, getFoodImage, getFoodName, getFoodPrice } from "../../lib/foods";
import type { FoodProduct } from "../../types/food";

type FavoritesDrawerProps = {
  visible: boolean;
  onClose: () => void;
};

function FavoriteRow({
  food,
  onOpen,
  onRemove,
}: {
  food: FoodProduct;
  onOpen: () => void;
  onRemove: () => void;
}) {
  const [imageError, setImageError] = useState(false);
  const image = getFoodImage(food);
  const name = getFoodName(food);
  const isVeg = String(food.food_type || "").toLowerCase() === "veg";
  const details = [
    food.category_name,
    food.cuisine_name,
    food.portion_size,
  ].filter((value): value is string => typeof value === "string" && Boolean(value));

  return (
    <View className="mb-2.5 min-h-[88px] flex-row items-center rounded-2xl border border-brand-neutral-border-warm bg-white p-2 shadow-sm">
      <Pressable
        accessibilityLabel={`View ${name}`}
        accessibilityRole="button"
        className="h-[68px] w-[68px] items-center justify-center overflow-hidden rounded-xl bg-brand-surface-cream"
        onPress={onOpen}
      >
        {image && !imageError ? (
          <Image
            accessible
            accessibilityLabel={name}
            className="h-full w-full"
            onError={() => setImageError(true)}
            resizeMode="cover"
            source={{ uri: image }}
          />
        ) : (
          <UtensilsCrossed color={colors.gold} size={22} />
        )}
      </Pressable>

      <View className="ml-2.5 min-w-0 flex-1">
        <Pressable accessibilityRole="button" onPress={onOpen}>
          <Text
            className="text-[11px] font-extrabold text-brand-neutral-text-primary"
            numberOfLines={1}
          >
            {name}
          </Text>
        </Pressable>
        <Text className="mt-0.5 text-[9px] text-brand-neutral-text-warm" numberOfLines={1}>
          {details.join("  ·  ") || "Menu favorite"}
        </Text>
        <View className="mt-1.5 flex-row items-center justify-between">
          <Text className="text-[11px] font-black text-brand-green-primary">
            ₹{getFoodPrice(food).toFixed(2)}
          </Text>
          <Pressable
            accessibilityLabel={`Remove ${name} from favorites`}
            accessibilityRole="button"
            className="flex-row items-center rounded-lg bg-brand-rose-surface px-2 py-1"
            hitSlop={6}
            onPress={onRemove}
          >
            <Trash2 color={colors["danger-strong"]} size={10} />
            <Text className="ml-1 text-[9px] font-bold text-brand-danger-strong">
              Remove
            </Text>
          </Pressable>
        </View>
      </View>

      <View className={`ml-1 self-start mt-1 h-3.5 w-3.5 items-center justify-center rounded border ${isVeg ? "border-emerald-600" : "border-rose-600"}`}>
        <View className={`h-1.5 w-1.5 rounded-full ${isVeg ? "bg-emerald-600" : "bg-rose-600"}`} />
      </View>
    </View>
  );
}

export default function FavoritesDrawer({
  visible,
  onClose,
}: FavoritesDrawerProps) {
  const {
    wishlist,
    isWishlistLoading,
    wishlistError,
    refreshWishlist,
    toggleWishlist,
  } = useCart();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const [actionError, setActionError] = useState("");

  const handleRemove = async (food: FoodProduct) => {
    setActionError("");
    try {
      await toggleWishlist(food);
    } catch (error) {
      console.error("Failed to remove a favorite:", error);
      setActionError("We could not update your favorites. Please try again.");
    }
  };

  const openFood = (food: FoodProduct) => {
    const foodId = getFoodId(food);
    if (!foodId) {
      setActionError("This menu item is unavailable right now.");
      return;
    }
    onClose();
    router.push({ pathname: "/UsersTab/product/[id]", params: { id: foodId } });
  };

  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      transparent
      visible={visible}
    >
      <View className="flex-1 flex-row justify-end">
        <Pressable
          accessibilityLabel="Close favorites"
          accessibilityRole="button"
          className="absolute inset-0 bg-black/35"
          onPress={onClose}
        />
        <View
          accessibilityViewIsModal
          className="h-full border-l border-brand-neutral-border-warm bg-brand-surface-modal shadow-2xl"
          style={{
            width: Math.min(400, windowWidth * 0.94),
            paddingTop: insets.top,
            paddingBottom: insets.bottom,
          }}
        >
          <View className="flex-row items-center border-b border-brand-neutral-border-cream bg-brand-gold-white px-4 py-3">
            <View className="h-10 w-10 items-center justify-center rounded-full bg-brand-gold-soft">
              <Heart color={colors.heart} fill={colors.heart} size={17} />
            </View>
            <View className="ml-2.5 flex-1">
              <Text className="font-serif text-[15px] font-extrabold text-brand-neutral-text-forest">
                My Favorites
              </Text>
              <Text className="mt-0.5 text-[9px] text-brand-neutral-text-warm">
                Your personally saved dishes
              </Text>
            </View>
            <View className="rounded-full bg-brand-rose-surface px-2.5 py-1">
              <Text className="text-[9px] font-bold text-brand-danger-strong">
                {wishlist.length} {wishlist.length === 1 ? "Item" : "Items"}
              </Text>
            </View>
            <Pressable
              accessibilityLabel="Close favorites"
              accessibilityRole="button"
              className="ml-2 h-8 w-8 items-center justify-center rounded-full bg-white/80 active:bg-white"
              hitSlop={6}
              onPress={onClose}
            >
              <X color={colors["neutral-text-warm"]} size={15} />
            </Pressable>
          </View>

          <ScrollView
            className="flex-1"
            contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 13, paddingBottom: 14, flexGrow: 1 }}
            showsVerticalScrollIndicator={false}
          >
            {isWishlistLoading ? (
              <View className="flex-1 items-center justify-center">
                <ActivityIndicator color={colors["green-primary"]} />
                <Text className="mt-2 text-xs text-slate-500">
                  Loading favorites...
                </Text>
              </View>
            ) : wishlistError ? (
              <View className="flex-1 items-center justify-center px-5">
                <Text className="text-center text-xs leading-5 text-rose-700">
                  {wishlistError}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  className="mt-3 rounded-xl bg-brand-green-primary px-4 py-2.5 active:opacity-80"
                  onPress={() => void refreshWishlist().catch(() => undefined)}
                >
                  <Text className="text-xs font-bold text-white">Try again</Text>
                </Pressable>
              </View>
            ) : wishlist.length ? (
              wishlist.map((food, index) => {
                const foodId = getFoodId(food);
                return (
                  <FavoriteRow
                    key={foodId || `favorite-${index}`}
                    food={food}
                    onOpen={() => openFood(food)}
                    onRemove={() => void handleRemove(food)}
                  />
                );
              })
            ) : (
              <View className="flex-1 items-center justify-center px-5">
                <View className="h-14 w-14 items-center justify-center rounded-full bg-brand-gold-soft">
                  <Heart color={colors.heart} size={24} />
                </View>
                <Text className="mt-4 text-base font-extrabold text-brand-neutral-text-primary">
                  No favorites yet
                </Text>
                <Text className="mt-1 text-center text-xs leading-5 text-slate-500">
                  Browse the menu and tap the heart on any dish to save it here.
                </Text>
                <Pressable
                  accessibilityRole="button"
                  className="mt-4 flex-row items-center rounded-xl bg-brand-green-primary px-4 py-3 active:opacity-80"
                  onPress={() => {
                    onClose();
                    router.push("/UsersTab/shop");
                  }}
                >
                  <UtensilsCrossed color={colors.white} size={15} />
                  <Text className="ml-2 text-xs font-bold text-white">
                    Browse the menu
                  </Text>
                </Pressable>
              </View>
            )}
            {actionError ? (
              <Text
                accessibilityRole="alert"
                className="mt-1 text-center text-[10px] font-semibold text-rose-700"
              >
                {actionError}
              </Text>
            ) : null}
          </ScrollView>
          <View className="flex-row items-center justify-center border-t border-brand-neutral-border-cream bg-brand-gold-white px-3 py-2.5">
            <UtensilsCrossed color={colors["gold-copper"]} size={12} />
            <Text className="ml-1.5 text-[9px] font-medium text-brand-neutral-text-warm">
              Made with love, saved for you
            </Text>
            <Heart className="ml-1" color={colors.heart} fill={colors.heart} size={9} />
          </View>
        </View>
      </View>
    </Modal>
  );
}
