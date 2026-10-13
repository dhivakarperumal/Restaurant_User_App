import { useEffect, useMemo, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import {
  ArrowLeft,
  Check,
  Clock3,
  Minus,
  Plus,
  Star,
  UtensilsCrossed,
} from "lucide-react-native";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCart } from "../contexts/CartContext";
import { parseAddonChoices, parseCustomizationGroups } from "../lib/foodOptions";
import api from "../lib/api";
import {
  getFoodDiscountPercentage,
  getFoodId,
  getFoodImage,
  getFoodName,
  getFoodPrice,
  getMenuFoods,
} from "../lib/foods";
import type { FoodOption, FoodProduct } from "../types/food";

function firstParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function getFoodImages(food: FoodProduct): string[] {
  if (!Array.isArray(food.food_images)) return [];
  return food.food_images.flatMap((entry) => {
    const image =
      typeof entry === "string"
        ? entry
        : typeof entry === "object" && entry !== null && !Array.isArray(entry)
          ? ["image_url", "url", "image"]
              .map((key) => (key in entry ? entry[key] : undefined))
              .find((value): value is string => typeof value === "string")
          : undefined;
    if (!image?.trim()) return [];
    const uri = getFoodImage({ ...food, food_images: [image] });
    return uri ? [uri] : [];
  });
}

export default function ProductDetailsScreen() {
  const { id: idParam } = useLocalSearchParams<{ id?: string | string[] }>();
  const foodId = firstParam(idParam);
  const [food, setFood] = useState<FoodProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let active = true;
    api.get("/foods")
      .then((response) => {
        const foods = getMenuFoods(response.data?.data ?? response.data);
        const matchedFood = foods.find((item) => getFoodId(item) === foodId);
        if (!matchedFood) throw new Error("The requested menu item was not found.");
        if (active) {
          setFood(matchedFood);
          setLoadError("");
        }
      })
      .catch((error: unknown) => {
        console.error("Failed to load product details:", error);
        if (active) {
          setFood(null);
          setLoadError(
            foodId
              ? "We could not load this menu item. Please try again."
              : "This menu item could not be found.",
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [foodId, retryCount]);

  if (loading || (food !== null && getFoodId(food) !== foodId)) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator accessibilityLabel="Loading product details" color="#1A6A3B" />
      </View>
    );
  }

  if (!food || loadError) {
    return (
      <View className="flex-1 items-center justify-center bg-white px-8">
        <Text className="text-center text-base font-semibold text-slate-700">
          {loadError || "This menu item could not be found."}
        </Text>
        <Pressable
          accessibilityRole="button"
          className="mt-4 rounded-xl bg-[#1A6A3B] px-5 py-3"
          onPress={() => {
            setLoading(true);
            setRetryCount((count) => count + 1);
          }}
        >
          <Text className="font-bold text-white">Try again</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          className="mt-3 px-4 py-2"
          onPress={() => router.back()}
        >
          <Text className="font-semibold text-slate-600">Go back</Text>
        </Pressable>
      </View>
    );
  }

  return <ProductDetailsContent key={foodId} food={food} />;
}

function ProductDetailsContent({ food }: { food: FoodProduct }) {
  const insets = useSafeAreaInsets();
  const { addItem } = useCart();
  const addons = useMemo(() => parseAddonChoices(food.addons), [food]);
  const customizationGroups = useMemo(
    () => parseCustomizationGroups(food.customizations),
    [food],
  );
  const images = useMemo(() => getFoodImages(food), [food]);
  const [activeImage, setActiveImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [selectedAddons, setSelectedAddons] = useState<FoodOption[]>([]);
  const [selectedCustomizations, setSelectedCustomizations] = useState<FoodOption[]>(() =>
    customizationGroups
      .filter((group) => group.required)
      .flatMap((group) => {
        const option = group.options[0];
        return option ? [{ ...option, groupName: group.name }] : [];
      }),
  );
  const [addonRequest, setAddonRequest] = useState("");
  const [customizationRequest, setCustomizationRequest] = useState("");
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState("");
  const unitPrice =
    getFoodPrice(food) +
    selectedAddons.reduce((total, option) => total + option.price, 0) +
    selectedCustomizations.reduce((total, option) => total + option.price, 0);
  const available =
    food.is_available !== false &&
    String(food.status ?? "Active").toLowerCase() === "active";

  const toggleAddon = (option: FoodOption) => {
    setSelectedAddons((current) =>
      current.some((selected) => selected.id === option.id)
        ? current.filter((selected) => selected.id !== option.id)
        : [...current, option],
    );
  };

  const selectCustomization = (groupName: string, groupOptions: FoodOption[], option: FoodOption) => {
    setSelectedCustomizations((current) => [
      ...current.filter(
        (selected) => !groupOptions.some((groupOption) => groupOption.id === selected.id),
      ),
      { ...option, groupName },
    ]);
  };

  const handleAdd = async () => {
    if (!available || saving) return;
    setSaving(true);
    setActionError("");
    try {
      await addItem({
        food,
        quantity,
        unitPrice,
        selectedAddons: [
          ...selectedAddons,
          ...addonRequest
            .split("\n")
            .map((name, index) => ({
              id: `requested-addon-${index}`,
              name: name.trim(),
              price: 0,
            }))
            .filter((option) => option.name),
        ],
        selectedCustomizations: [
          ...selectedCustomizations,
          ...(customizationRequest.trim()
            ? [{
                id: "requested-customization",
                name: customizationRequest.trim(),
                price: 0,
                groupName: "Additional customization",
              }]
            : []),
        ],
      });
      router.back();
    } catch (error) {
      console.error("Failed to add product from details page:", error);
      setActionError("We could not add this item to your cart. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const imageUri = images[activeImage];
  const discount = getFoodDiscountPercentage(food);
  const isVeg = String(food.food_type ?? "").toLowerCase() === "veg";

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-white"
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View className="flex-1 bg-white">
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 24 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
          showsVerticalScrollIndicator={false}
        >
          <View className="relative bg-[#F5EFE5]" style={{ height: 300 }}>
            {imageUri ? (
              <Image
                accessible
                accessibilityLabel={getFoodName(food)}
                className="h-full w-full"
                resizeMode="cover"
                source={{ uri: imageUri }}
              />
            ) : (
              <View className="h-full items-center justify-center">
                <UtensilsCrossed color="#A05C2A" size={48} />
              </View>
            )}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Go back"
              className="absolute left-4 h-11 w-11 items-center justify-center rounded-full bg-black/50"
              style={{ top: Math.max(insets.top, 12) }}
              onPress={() => router.back()}
            >
              <ArrowLeft color="#FFFFFF" size={22} />
            </Pressable>

            {discount > 0 ? (
              <View className="absolute right-4 rounded-full bg-[#E86D16] px-3 py-1.5" style={{ top: Math.max(insets.top + 4, 16) }}>
                <Text className="text-xs font-extrabold text-white">{Math.round(discount)}% OFF</Text>
              </View>
            ) : null}

            {images.length > 1 ? (
              <ScrollView
                horizontal
                className="absolute bottom-3 left-3"
                contentContainerStyle={{ gap: 8 }}
                showsHorizontalScrollIndicator={false}
              >
                {images.map((image, index) => (
                  <Pressable
                    key={`${image}-${index}`}
                    accessibilityRole="button"
                    accessibilityLabel={`Show product image ${index + 1}`}
                    className={`h-14 w-14 overflow-hidden rounded-lg border-2 ${activeImage === index ? "border-white" : "border-white/50"}`}
                    onPress={() => setActiveImage(index)}
                  >
                    <Image className="h-full w-full" resizeMode="cover" source={{ uri: image }} />
                  </Pressable>
                ))}
              </ScrollView>
            ) : null}
          </View>

          <View className="px-5 pb-6 pt-4">
            <View className="mb-3 flex-row flex-wrap items-center gap-2">
              <View className="flex-row items-center rounded-full bg-emerald-50 px-2.5 py-1.5">
                <View className={`mr-1.5 h-2.5 w-2.5 rounded-sm border ${isVeg ? "border-emerald-700" : "border-rose-700"}`}>
                  <View className={`m-[2px] h-1 w-1 rounded-full ${isVeg ? "bg-emerald-700" : "bg-rose-700"}`} />
                </View>
                <Text className="text-xs font-bold text-emerald-800">
                  {food.category_name || "Main Course"}
                </Text>
              </View>
              {food.cuisine_name ? (
                <View className="rounded-full bg-slate-100 px-2.5 py-1.5">
                  <Text className="text-xs font-semibold text-slate-600">{food.cuisine_name}</Text>
                </View>
              ) : null}
            </View>

            <Text className="text-2xl font-black leading-8 text-[#17251E]">
              {getFoodName(food)}
            </Text>
            {food.description ? (
              <Text className="mt-2 text-sm leading-6 text-slate-600">{food.description}</Text>
            ) : null}

            <View className="mt-4 flex-row flex-wrap items-center gap-4">
              {food.portion_size ? (
                <View className="flex-row items-center">
                  <UtensilsCrossed color="#64748B" size={15} />
                  <Text className="ml-2 text-sm text-slate-600">{food.portion_size}</Text>
                </View>
              ) : null}
              {Number(food.preparation_time) > 0 ? (
                <View className="flex-row items-center">
                  <Clock3 color="#64748B" size={15} />
                  <Text className="ml-2 text-sm text-slate-600">{food.preparation_time} min</Text>
                </View>
              ) : null}
              {Number(food.rating) > 0 ? (
                <View className="flex-row items-center">
                  <Star color="#E7A626" fill="#E7A626" size={15} />
                  <Text className="ml-1.5 text-sm font-semibold text-slate-600">
                    {Number(food.rating).toFixed(1)}
                  </Text>
                </View>
              ) : null}
            </View>

            {addons.map((option) => {
              const selected = selectedAddons.some((item) => item.id === option.id);
              return (
                <Pressable
                  key={option.id}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: selected }}
                  className="mt-3 min-h-12 flex-row items-center justify-between rounded-xl border border-slate-200 px-3"
                  onPress={() => toggleAddon(option)}
                >
                  <Text className="flex-1 text-sm font-semibold text-slate-700">{option.name}</Text>
                  <Text className="ml-3 text-sm font-bold text-[#1A6A3B]">
                    {option.price > 0 ? `+₹${option.price.toFixed(2)}` : "Included"}
                  </Text>
                  <View className={`ml-3 h-5 w-5 items-center justify-center rounded border ${selected ? "border-[#1A6A3B] bg-[#1A6A3B]" : "border-slate-300"}`}>
                    {selected ? <Check color="#FFFFFF" size={14} /> : null}
                  </View>
                </Pressable>
              );
            })}

            {customizationGroups.map((group) => (
              <View key={group.id} className="mt-5">
                <Text className="mb-2 text-sm font-bold text-slate-700">
                  {group.name}{group.required ? " *" : ""}
                </Text>
                {group.options.map((option) => {
                  const selected = selectedCustomizations.some((item) => item.id === option.id);
                  return (
                    <Pressable
                      key={option.id}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: selected }}
                      className="mb-2 min-h-12 flex-row items-center justify-between rounded-xl border border-slate-200 px-3"
                      onPress={() => selectCustomization(group.name, group.options, option)}
                    >
                      <Text className="flex-1 text-sm font-semibold text-slate-700">{option.name}</Text>
                      <Text className="ml-3 text-sm font-bold text-[#1A6A3B]">
                        {option.price > 0 ? `+₹${option.price.toFixed(2)}` : "Included"}
                      </Text>
                      <View className={`ml-3 h-5 w-5 items-center justify-center rounded-full border ${selected ? "border-[#1A6A3B]" : "border-slate-300"}`}>
                        {selected ? <View className="h-2.5 w-2.5 rounded-full bg-[#1A6A3B]" /> : null}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            ))}

            <View className="mt-5">
              <Text className="mb-2 text-sm font-bold text-slate-700">Additional add-ons (optional)</Text>
              <TextInput
                accessibilityLabel="Additional add-ons"
                className="min-h-24 rounded-xl border border-slate-200 px-3 py-3 text-sm text-slate-700"
                multiline
                onChangeText={setAddonRequest}
                placeholder="Enter extra add-ons, one per line (e.g. Extra sauce)"
                placeholderTextColor="#94A3B8"
                textAlignVertical="top"
                value={addonRequest}
              />
              <Text className="mt-2 text-right text-xs text-slate-400">
                Typed requests do not change the price.
              </Text>
            </View>

            <View className="mt-5">
              <Text className="mb-2 text-sm font-bold text-slate-700">
                Additional customization (optional)
              </Text>
              <TextInput
                accessibilityLabel="Additional customization"
                className="min-h-24 rounded-xl border border-slate-200 px-3 py-3 text-sm text-slate-700"
                multiline
                onChangeText={setCustomizationRequest}
                placeholder="e.g. Less oil, extra spicy, no onions"
                placeholderTextColor="#94A3B8"
                textAlignVertical="top"
                value={customizationRequest}
              />
            </View>
            {actionError ? (
              <Text accessibilityRole="alert" className="mt-3 text-sm font-semibold text-rose-700">
                {actionError}
              </Text>
            ) : null}
          </View>
        </ScrollView>

        <View
          className="flex-row items-center gap-3 border-t border-slate-100 bg-white px-5 pt-3"
          style={{ paddingBottom: Math.max(insets.bottom, 12) }}
        >
          <View className="h-12 flex-row items-center rounded-xl border border-slate-200">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Decrease quantity"
              className="h-12 w-11 items-center justify-center"
              onPress={() => setQuantity((current) => Math.max(1, current - 1))}
            >
              <Minus color="#334155" size={17} />
            </Pressable>
            <Text className="min-w-7 text-center text-base font-bold text-slate-800">{quantity}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Increase quantity"
              className="h-12 w-11 items-center justify-center"
              onPress={() => setQuantity((current) => current + 1)}
            >
              <Plus color="#334155" size={17} />
            </Pressable>
          </View>
          <View className="flex-1">
            <Text className="mb-1 text-[10px] font-semibold text-slate-500">
              ₹{unitPrice.toFixed(2)} each
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: !available || saving }}
              className={`h-11 items-center justify-center rounded-xl ${available && !saving ? "bg-[#1A6A3B]" : "bg-slate-400"}`}
              disabled={!available || saving}
              onPress={() => void handleAdd()}
            >
              <Text className="text-sm font-extrabold text-white">
                {!available ? "Unavailable" : saving ? "Adding..." : `Add to Cart · ₹${(unitPrice * quantity).toFixed(2)}`}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
