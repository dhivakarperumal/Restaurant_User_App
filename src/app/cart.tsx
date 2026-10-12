import { useState } from "react";
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import {
  Minus,
  Plus,
  ShoppingCart,
  Trash2,
  UtensilsCrossed,
} from "lucide-react-native";
import { getFoodImage, getFoodName } from "../lib/foods";
import { useCart } from "../contexts/CartContext";
import type { CartItem } from "../types/food";

export default function CartScreen() {
  const {
    items,
    itemCount,
    isHydrated,
    isCartLoading,
    cartError,
    setQuantity,
    removeItem,
    clearCart,
    refreshCart,
  } = useCart();
  const [error, setError] = useState("");

  const changeQuantity = async (item: CartItem, quantity: number) => {
    setError("");
    try {
      await setQuantity(item.key, quantity);
    } catch (requestError) {
      console.error("Failed to update cart quantity:", requestError);
      setError("We could not update your cart. Please try again.");
    }
  };

  const deleteItem = async (item: CartItem) => {
    setError("");
    try {
      await removeItem(item.key);
    } catch (requestError) {
      console.error("Failed to remove cart item:", requestError);
      setError("We could not remove that item. Please try again.");
    }
  };

  const confirmClearCart = () => {
    Alert.alert("Clear your cart?", "This will remove all items from your cart.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Clear cart",
        style: "destructive",
        onPress: () => {
          setError("");
          void clearCart().catch((requestError: unknown) => {
            console.error("Failed to clear cart:", requestError);
            setError("We could not clear your cart. Please try again.");
          });
        },
      },
    ]);
  };

  const total = items.reduce(
    (sum, item) => sum + item.unitPrice * item.quantity,
    0,
  );

  return (
    <ScrollView
      className="flex-1 bg-[#F3F4F3]"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ padding: 24, paddingBottom: 120 }}
    >
      <View className="flex-row items-center">
        <ShoppingCart color="#1A6A3B" size={22} />
        <Text className="ml-2 text-lg font-extrabold text-[#17251E]">
          Your cart
        </Text>
      </View>

      {items.length > 0 && isHydrated ? (
        <Pressable
          accessibilityRole="button"
          className="mt-4 self-end flex-row items-center rounded-xl border border-[#E7E0D8] bg-white px-3 py-2 active:bg-[#F5EFE5]"
          onPress={confirmClearCart}
        >
          <Trash2 color="#B83E2E" size={14} />
          <Text className="ml-2 text-xs font-bold text-[#B83E2E]">
            Clear cart
          </Text>
        </Pressable>
      ) : null}

      {!isHydrated || isCartLoading ? (
        <View className="mt-6 h-24 animate-pulse rounded-2xl bg-slate-200" />
      ) : cartError ? null : items.length === 0 ? (
        <View className="mt-6 items-center rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-12">
          <UtensilsCrossed color="#94A3B8" size={32} />
          <Text className="mt-3 text-center text-base font-bold text-slate-700">
            Your cart is empty
          </Text>
          <Text className="mt-1 text-center text-sm text-slate-500">
            Add something delicious from Guest Favorites.
          </Text>
        </View>
      ) : (
        <>
          {items.map((item) => (
            <CartRow
              key={item.key}
              item={item}
              onQuantityChange={(quantity) => void changeQuantity(item, quantity)}
              onRemove={() => void deleteItem(item)}
            />
          ))}

          <View className="mt-5 rounded-2xl border border-slate-200 bg-white p-4">
            <View className="flex-row justify-between">
              <Text className="text-sm font-semibold text-slate-600">
                Items ({itemCount})
              </Text>
              <Text className="text-sm font-bold text-slate-800">₹{total.toFixed(2)}</Text>
            </View>
            <View className="mt-3 border-t border-slate-100 pt-3">
              <View className="flex-row justify-between">
                <Text className="text-base font-extrabold text-[#17251E]">Total</Text>
                <Text className="text-base font-extrabold text-[#1A6A3B]">
                  ₹{total.toFixed(2)}
                </Text>
              </View>
            </View>
          </View>
        </>
      )}

      {cartError ? (
        <View className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4">
          <Text accessibilityRole="alert" className="text-sm font-semibold text-rose-800">
            {cartError}
          </Text>
          <Pressable
            accessibilityRole="button"
            className="mt-2 self-start"
            onPress={() => {
              void refreshCart().catch(() => undefined);
            }}
          >
            <Text className="text-sm font-bold text-rose-700 underline">
              Try again
            </Text>
          </Pressable>
        </View>
      ) : null}

      {error ? (
        <Text accessibilityRole="alert" className="mt-3 text-sm font-semibold text-rose-700">
          {error}
        </Text>
      ) : null}
    </ScrollView>
  );
}

function CartRow({
  item,
  onQuantityChange,
  onRemove,
}: {
  item: CartItem;
  onQuantityChange: (quantity: number) => void;
  onRemove: () => void;
}) {
  const image = getFoodImage(item.food);
  const selectedOptions = [
    ...item.selectedAddons,
    ...item.selectedCustomizations,
  ];

  return (
    <View className="mt-4 flex-row rounded-2xl border border-slate-200 bg-white p-3">
      <View className="h-20 w-20 items-center justify-center overflow-hidden rounded-xl bg-[#F5EFE5]">
        {image ? (
          <Image
            accessible
            accessibilityLabel={getFoodName(item.food)}
            className="h-full w-full"
            resizeMode="cover"
            source={{ uri: image }}
          />
        ) : (
          <UtensilsCrossed color="#A05C2A" size={24} />
        )}
      </View>

      <View className="ml-3 flex-1 justify-between">
        <View className="flex-row items-start justify-between">
          <View className="mr-2 flex-1">
            <Text
              className="text-sm font-extrabold text-[#17251E]"
              numberOfLines={1}
            >
              {getFoodName(item.food)}
            </Text>
            {item.food.portion_size ? (
              <Text className="mt-0.5 text-[11px] text-slate-500">
                Size: {item.food.portion_size}
              </Text>
            ) : null}
            {selectedOptions.length > 0 && (
              <Text
                className="mt-1 text-[11px] leading-4 text-slate-500"
                numberOfLines={2}
              >
                {selectedOptions.map((option) => option.name).join(", ")}
              </Text>
            )}
            <Text className="mt-1 text-xs font-bold text-[#1A6A3B]">
              ₹{item.unitPrice.toFixed(2)} each
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Remove ${getFoodName(item.food)} from cart`}
            className="h-8 w-8 items-center justify-center rounded-full active:bg-rose-50"
            onPress={onRemove}
          >
            <Trash2 color="#B83E2E" size={15} />
          </Pressable>
        </View>

        <View className="mt-2 flex-row items-center justify-between">
          <View className="flex-row items-center rounded-lg border border-slate-200">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Decrease ${getFoodName(item.food)} quantity`}
              className="h-8 w-9 items-center justify-center"
              onPress={() => onQuantityChange(item.quantity - 1)}
            >
              <Minus color="#334155" size={15} />
            </Pressable>
            <Text className="min-w-6 text-center text-sm font-bold text-slate-800">
              {item.quantity}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Increase ${getFoodName(item.food)} quantity`}
              className="h-8 w-9 items-center justify-center"
              onPress={() => onQuantityChange(item.quantity + 1)}
            >
              <Plus color="#334155" size={15} />
            </Pressable>
          </View>
          <Text className="text-sm font-extrabold text-[#17251E]">
            ₹{(item.unitPrice * item.quantity).toFixed(2)}
          </Text>
        </View>
      </View>
    </View>
  );
}
