import { useState } from "react";
import { Clock3, Flame, Heart, Plus, Star, UtensilsCrossed } from "lucide-react-native";
import { Image, Pressable, Text, View } from "react-native";
import { getFoodImage, getFoodName, getFoodPrice } from "../../lib/foods";
import type { FoodProduct } from "../../types/food";

type FoodProductCardProps = {
  food: FoodProduct;
  width: number;
  isInWishlist: boolean;
  cartQuantity?: number;
  viewMode?: "grid" | "list";
  onSelect: (food: FoodProduct) => void;
  onCustomize: (food: FoodProduct) => void;
  onToggleWishlist: (food: FoodProduct) => void;
};

export default function FoodProductCard({
  food,
  width,
  isInWishlist,
  cartQuantity = 0,
  viewMode = "grid",
  onSelect,
  onCustomize,
  onToggleWishlist,
}: FoodProductCardProps) {
  const [imageError, setImageError] = useState(false);
  const image = getFoodImage(food);
  const name = getFoodName(food);
  const price = getFoodPrice(food);
  const mrp = Number(food.mrp ?? 0);
  const discount = Number(food.discount ?? 0);
  const isVeg = String(food.food_type || "").toLowerCase() === "veg";
  const isAvailable =
    food.is_available !== false &&
    String(food.status || "Active").toLowerCase() === "active";

  if (viewMode === "list") {
    return (
      <View
        className="flex-row items-center rounded-2xl border border-[#E7E0D8] bg-white p-2.5 shadow-sm"
        style={{ width }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`View ${name}`}
          className="h-[88px] w-[88px] items-center justify-center overflow-hidden rounded-xl bg-[#F5EFE5]"
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
            <UtensilsCrossed color="#A05C2A" size={26} />
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
                <Star color="#F59E0B" fill="#FBBF24" size={11} />
                <Text className="ml-0.5 text-[10px] font-bold text-amber-700">
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
            <Text className="text-sm font-extrabold text-[#17251E]" numberOfLines={1}>
              {name}
            </Text>
          </Pressable>
          <Text className="mt-0.5 text-[10px] text-slate-500" numberOfLines={1}>
            {food.description || "Freshly prepared."}
          </Text>
          <View className="mt-1.5 flex-row items-center justify-between">
            <View className="flex-row items-baseline">
              <Text className="text-sm font-black text-[#1A6A3B]">₹{price.toFixed(0)}</Text>
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
                  color={isInWishlist ? "#E11D48" : "#64748B"}
                  fill={isInWishlist ? "#E11D48" : "transparent"}
                  size={15}
                />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Customize ${name}`}
                accessibilityState={{ disabled: !isAvailable }}
                className={`h-8 flex-row items-center rounded-lg px-2.5 ${isAvailable ? "bg-[#1A6A3B]" : "bg-slate-300"}`}
                disabled={!isAvailable}
                onPress={() => onCustomize(food)}
              >
                {isAvailable ? <Plus color="#FFFFFF" size={15} /> : null}
                <Text className="ml-1 text-[10px] font-bold text-white">
                  {isAvailable
                    ? cartQuantity > 0
                      ? `Add (${cartQuantity})`
                      : "Add"
                    : "Unavailable"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View
      className="overflow-hidden rounded-2xl border border-[#E7E0D8] bg-white shadow-sm"
      style={{ width }}
    >
      <View className="relative h-[132px]">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`View ${name}`}
          className="h-full items-center justify-center overflow-hidden bg-[#F5EFE5]"
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
            <UtensilsCrossed color="#A05C2A" size={32} />
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
        <View pointerEvents="none" className="absolute left-2 top-2 h-5 w-5 items-center justify-center rounded-md border-2 border-white bg-white">
          <View className={`h-2.5 w-2.5 rounded-full ${isVeg ? "bg-emerald-600" : "bg-rose-600"}`} />
        </View>
        {food.is_spicy === true && (
          <View pointerEvents="none" className="absolute bottom-2 left-2 flex-row items-center rounded-md bg-amber-500 px-1.5 py-1">
            <Flame color="#FFFFFF" size={11} />
            <Text className="ml-0.5 text-[9px] font-bold text-white">Spicy</Text>
          </View>
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={isInWishlist ? `Remove ${name} from favorites` : `Add ${name} to favorites`}
          className="absolute right-2 top-2 h-8 w-8 items-center justify-center rounded-full bg-white/95"
          onPress={() => onToggleWishlist(food)}
          hitSlop={6}
        >
          <Heart
            color={isInWishlist ? "#E11D48" : "#64748B"}
            fill={isInWishlist ? "#E11D48" : "transparent"}
            size={16}
          />
        </Pressable>
      </View>

      <View className="flex-1 p-2.5">
        <View className="flex-row items-center justify-between">
          <Text className="flex-1 text-[10px] font-semibold text-slate-500" numberOfLines={1}>
            {food.category_name || food.cuisine_name || "Specialty"}
          </Text>
          {Number(food.rating) > 0 && (
            <View className="ml-1 flex-row items-center">
              <Star color="#F59E0B" fill="#FBBF24" size={11} />
              <Text className="ml-0.5 text-[10px] font-bold text-amber-700">
                {Number(food.rating).toFixed(1)}
              </Text>
            </View>
          )}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`View details for ${name}`}
          className="mt-1"
          onPress={() => onSelect(food)}
        >
          <Text className="text-sm font-extrabold text-[#17251E]" numberOfLines={1}>
            {name}
          </Text>
        </Pressable>
        <Text className="mt-1 min-h-8 text-[10px] leading-4 text-slate-500" numberOfLines={2}>
          {food.description || `${food.portion_size || "Standard"} portion, prepared fresh.`}
        </Text>

        <View className="mt-auto flex-row items-center justify-between pt-2">
          <View>
            <Text className="text-sm font-black text-[#1A6A3B]">₹{price.toFixed(0)}</Text>
            {discount > 0 && mrp > price && (
              <Text className="text-[9px] text-slate-400 line-through">₹{mrp.toFixed(0)}</Text>
            )}
            {Number(food.preparation_time) > 0 && (
              <View className="mt-0.5 flex-row items-center">
                <Clock3 color="#64748B" size={10} />
                <Text className="ml-1 text-[9px] text-slate-500">
                  {food.preparation_time} min
                </Text>
              </View>
            )}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Add ${name} to cart${cartQuantity > 0 ? `, ${cartQuantity} already in cart` : ""}`}
            accessibilityState={{ disabled: !isAvailable }}
            className={`h-9 min-w-9 flex-row items-center justify-center rounded-xl px-2 active:opacity-75 ${isAvailable ? "bg-[#1A6A3B]" : "bg-slate-300"}`}
            disabled={!isAvailable}
            onPress={() => onCustomize(food)}
          >
            {isAvailable ? <Plus color="#FFFFFF" size={19} /> : null}
            {isAvailable && cartQuantity > 0 ? (
              <Text className="ml-1 text-[10px] font-bold text-white">{cartQuantity}</Text>
            ) : !isAvailable ? (
              <Text className="text-[9px] font-bold text-white">N/A</Text>
            ) : null}
          </Pressable>
        </View>
      </View>
    </View>
  );
}
