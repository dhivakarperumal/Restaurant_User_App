import { useState } from "react";
import {
  Clock3,
  Flame,
  Heart,
  Plus,
  Star,
  UtensilsCrossed,
} from "lucide-react-native";
import { Image, Pressable, Text, View } from "react-native";
import {
  getFoodDiscountPercentage,
  getFoodImage,
  getFoodName,
  getFoodPrice,
} from "../../lib/foods";
import type { FoodProduct } from "../../types/food";
import colors from "../../theme/colors.json";

type FoodProductCardProps = {
  food: FoodProduct;
  width: number;
  isInWishlist: boolean;
  cartQuantity?: number;
  pendingAction?: "add" | "buy" | null;
  isBusy?: boolean;
  viewMode?: "grid" | "list";
  onSelect: (food: FoodProduct) => void;
  onAdd?: (food: FoodProduct) => void;
  onCustomize?: (food: FoodProduct) => void;
  onBuyNow?: (food: FoodProduct) => void;
  onToggleWishlist: (food: FoodProduct) => void;
};

export default function FoodProductCard({
  food,
  width,
  isInWishlist,
  cartQuantity = 0,
  pendingAction = null,
  isBusy,
  viewMode = "grid",
  onSelect,
  onAdd,
  onCustomize,
  onBuyNow,
  onToggleWishlist,
}: FoodProductCardProps) {
  const [imageError, setImageError] = useState(false);
  const image = getFoodImage(food);
  const name = getFoodName(food);
  const price = getFoodPrice(food);
  const mrp = Number(food.mrp ?? 0);
  const discount = getFoodDiscountPercentage(food);
  const isVeg = String(food.food_type || "").toLowerCase() === "veg";
  const isAvailable =
    food.is_available !== false &&
    String(food.status || "Active").toLowerCase() === "active";
  const isPending = isBusy ?? pendingAction !== null;
  const addToCart = () => (onAdd ?? onCustomize)?.(food);

  if (viewMode === "list") {
    return (
      <View
        className="flex-row items-center rounded-2xl border border-brand-neutral-border-warm bg-white p-2.5 shadow-sm"
        style={{ width }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`View ${name}`}
          className="h-[88px] w-[88px] items-center justify-center overflow-hidden rounded-xl bg-brand-surface-cream"
          onPress={() => onSelect(food)}
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
            <UtensilsCrossed color={colors.gold} size={26} />
          )}
        </Pressable>
        <View className="ml-3 min-w-0 flex-1">
          <View className="flex-row items-center">
            <View className={`h-2.5 w-2.5 rounded-sm ${isVeg ? "bg-emerald-600" : "bg-rose-600"}`} />
            <Text className="ml-1.5 flex-1 text-[10px] font-semibold text-slate-500" numberOfLines={1}>
              {food.category_name || food.cuisine_name || "Specialty"}
            </Text>
            {Number(food.rating) > 0 && (
              <View className="ml-1 flex-row items-center">
                <Star color={colors.gold} fill={colors.gold} size={11} />
                <Text className="ml-0.5 text-[10px] font-bold text-brand-gold-dark">
                  {Number(food.rating).toFixed(1)}
                </Text>
              </View>
            )}
          </View>
          <Pressable
            accessibilityRole="button"
            className="mt-1"
            onPress={() => onSelect(food)}
          >
            <Text className="text-sm font-extrabold text-brand-neutral-text-primary" numberOfLines={1}>
              {name}
            </Text>
          </Pressable>
          <Text className="mt-0.5 text-[10px] text-slate-500" numberOfLines={1}>
            {food.description || "Freshly prepared."}
          </Text>
          <View className="mt-1.5 flex-row items-center justify-between">
            <View className="flex-row items-baseline">
              <Text className="text-sm font-black text-brand-green-primary">₹{price.toFixed(0)}</Text>
              {discount > 0 && mrp > price && (
                <Text className="ml-1 text-[9px] text-slate-400 line-through">
                  ₹{mrp.toFixed(0)}
                </Text>
              )}
            </View>
            <View className="flex-row items-center">
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={isInWishlist ? `Remove ${name} from favorites` : `Add ${name} to favorites`}
                className="mr-2 h-8 w-8 items-center justify-center rounded-lg bg-rose-50"
                onPress={() => onToggleWishlist(food)}
              >
                <Heart
                  color={isInWishlist ? colors["danger-heart"] : colors["neutral-slate"]}
                  fill={isInWishlist ? colors["danger-heart"] : "transparent"}
                  size={15}
                />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Add ${name} to cart`}
                accessibilityState={{ disabled: !isAvailable || isPending }}
                className={`h-8 flex-row items-center rounded-lg px-2 ${isAvailable ? "bg-brand-green-primary" : "bg-slate-300"}`}
                disabled={!isAvailable || isPending}
                onPress={addToCart}
              >
                {isAvailable ? <Plus color={colors["white"]} size={15} /> : null}
                <Text className="ml-1 text-[10px] font-bold text-white">
                  {pendingAction === "add"
                    ? "Adding..."
                    : isAvailable
                    ? cartQuantity > 0
                      ? `Add (${cartQuantity})`
                      : "Add"
                    : "Unavailable"}
                </Text>
              </Pressable>
              {onBuyNow ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Buy ${name} now`}
                  accessibilityState={{ disabled: !isAvailable || isPending }}
                  className={`ml-1 h-8 flex-row items-center rounded-lg px-2 ${isAvailable ? "bg-brand-gold-bright" : "bg-slate-300"}`}
                  disabled={!isAvailable || isPending}
                  onPress={() => onBuyNow(food)}
                >
                  <Text className="ml-1 text-[10px] font-bold text-brand-green">
                    {pendingAction === "buy" ? "Buying..." : "Buy Now"}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View
      className="overflow-hidden rounded-3xl border border-brand-neutral-border-warm bg-white shadow-sm"
      style={{ width }}
    >
      <View className="relative" style={{ height: width }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`View ${name}`}
          className="h-full items-center justify-center overflow-hidden bg-slate-100"
          onPress={() => onSelect(food)}
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
            <UtensilsCrossed color={colors.gold} size={32} />
          )}
          {!isAvailable ? (
            <View
              pointerEvents="none"
              className="absolute inset-0 items-center justify-center bg-black/45"
            >
              <Text className="rounded-md bg-rose-600 px-2 py-1 text-[9px] font-extrabold text-white">
                Unavailable
              </Text>
            </View>
          ) : null}
        </Pressable>
        <View pointerEvents="none" className="absolute left-2 top-2 flex-row items-center gap-1.5">
          <View className="h-5 w-5 items-center justify-center rounded-md border-2 border-white bg-white">
            <View className={`h-2.5 w-2.5 rounded-full ${isVeg ? "bg-emerald-600" : "bg-rose-600"}`} />
          </View>
          {food.is_spicy === true ? (
            <View className="flex-row items-center rounded-md bg-amber-500/90 px-1.5 py-1">
              <Flame color={colors.white} size={11} />
              <Text className="ml-0.5 text-[9px] font-bold text-white">Spicy</Text>
            </View>
          ) : null}
        </View>
        {discount > 0 && mrp > price ? (
          <View pointerEvents="none" className="absolute bottom-2 left-2 rounded-lg bg-brand-gold-bright px-2 py-1">
            <Text className="text-[9px] font-black uppercase tracking-wider text-slate-950">
              {Math.round(discount)}% off
            </Text>
          </View>
        ) : null}
        {Number(food.preparation_time) > 0 ? (
          <View pointerEvents="none" className="absolute bottom-2 right-2 flex-row items-center rounded-lg bg-black/65 px-2 py-1">
            <Clock3 color={colors["gold"]} size={10} />
            <Text className="ml-1 text-[9px] font-semibold text-white">
              {food.preparation_time}m
            </Text>
          </View>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={isInWishlist ? `Remove ${name} from favorites` : `Add ${name} to favorites`}
          className="absolute right-2 top-2 h-8 w-8 items-center justify-center rounded-full bg-white/95"
          onPress={() => onToggleWishlist(food)}
          hitSlop={6}
        >
          <Heart
            color={isInWishlist ? colors["danger-heart"] : colors["neutral-slate"]}
            fill={isInWishlist ? colors["danger-heart"] : "transparent"}
            size={16}
          />
        </Pressable>
      </View>

      <View className="flex-1 p-2.5">
        <View className="mb-1 flex-row items-center justify-between gap-2">
          <View className="min-w-0 flex-1 flex-row items-center gap-1">
            <Text className="min-w-0 flex-1 text-[10px] font-semibold text-slate-500" numberOfLines={1}>
              {food.category_name || "Specialty"}
            </Text>
            {Number(food.rating) > 0 && (
              <View className="flex-row items-center">
                <Star color={colors.gold} fill={colors.gold} size={11} />
                <Text className="ml-0.5 text-[10px] font-bold text-brand-gold-dark">
                  {Number(food.rating).toFixed(1)}
                </Text>
              </View>
            )}
          </View>
          {food.cuisine_name ? (
            <Text className="max-w-[45%] rounded-full border border-emerald-100 bg-emerald-50 px-2 py-0.5 text-[9px] font-bold text-emerald-800" numberOfLines={1}>
              {food.cuisine_name}
            </Text>
          ) : null}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`View details for ${name}`}
          className="mt-1"
          onPress={() => onSelect(food)}
        >
          <Text className="text-sm font-extrabold text-brand-neutral-text-primary" numberOfLines={1}>
            {name}
          </Text>
        </Pressable>
        <View className="mt-3 border-t border-slate-100 pt-3">
          <View className="flex-row items-center justify-between">
            <View className="min-w-0 flex-1">
              <Text className="text-sm font-black text-brand-green-primary">
                ₹{price.toFixed(2)}
              </Text>
              {discount > 0 && mrp > price && (
                <Text className="text-[9px] text-slate-400 line-through">
                  ₹{mrp.toFixed(2)}
                </Text>
              )}
              {food.portion_size ? (
                <Text className="text-[9px] font-medium text-slate-400" numberOfLines={1}>
                  {food.portion_size}
                </Text>
              ) : null}
            </View>
          </View>
          <View className="mt-2 flex-row gap-2">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Add ${name} to cart${cartQuantity > 0 ? `, ${cartQuantity} already in cart` : ""}`}
              accessibilityState={{ disabled: !isAvailable || isPending }}
              className={`h-9 min-w-0 flex-1 flex-row items-center justify-center rounded-lg px-1 active:opacity-75 ${isAvailable ? "bg-brand-green-primary" : "bg-slate-300"}`}
              disabled={!isAvailable || isPending}
              onPress={addToCart}
            >
              {isAvailable ? <Plus color={colors["white"]} size={14} /> : null}
              <Text className="ml-1 text-[10px] font-bold text-white" numberOfLines={1}>
                {pendingAction === "add"
                  ? "Adding..."
                  : isAvailable
                    ? cartQuantity > 0
                      ? `Add (${cartQuantity})`
                      : "Add"
                    : "Unavailable"}
              </Text>
            </Pressable>
            {onBuyNow ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Buy ${name} now`}
                accessibilityState={{ disabled: !isAvailable || isPending }}
                className={`h-9 min-w-0 flex-1 flex-row items-center justify-center rounded-lg border px-1 active:opacity-75 ${isAvailable ? "border-brand-green-primary bg-white" : "border-slate-200 bg-slate-100"}`}
                disabled={!isAvailable || isPending}
                onPress={() => onBuyNow(food)}
              >
                <Text className="text-[10px] font-bold text-brand-green" numberOfLines={1}>
                  {pendingAction === "buy" ? "Buying..." : "Buy Now"}
                </Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>
    </View>
  );
}
