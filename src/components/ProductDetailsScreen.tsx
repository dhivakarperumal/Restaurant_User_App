import { useEffect, useMemo, useRef, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import {
  ArrowLeft,
  Check,
  Minus,
  Plus,
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
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCart } from "../contexts/CartContext";
import { useProductNavigation } from "../hooks/useProductNavigation";
import { getDefaultFoodCartInput } from "../lib/cart";
import { parseAddonChoices, parseCustomizationGroups } from "../lib/foodOptions";
import api from "../lib/api";
import FoodCustomizationModal from "./common/FoodCustomizationModal";
import FoodProductCard from "./common/FoodProductCard";
import {
  getFoodDiscountPercentage,
  getFoodId,
  getFoodImage,
  getFoodName,
  getFoodPrice,
  getMenuFoods,
} from "../lib/foods";
import type { FoodOption, FoodProduct } from "../types/food";
import colors from "../theme/colors.json";

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

function RecommendationSection({
  title,
  description,
  foods,
  pageWidth,
  cardWidth,
  cartItems,
  wishlist,
  pendingAction,
  onSelect,
  onCustomize,
  onAdd,
  onBuyNow,
  onToggleWishlist,
}: {
  title: string;
  description: string;
  foods: FoodProduct[];
  pageWidth: number;
  cardWidth: number;
  cartItems: ReturnType<typeof useCart>["items"];
  wishlist: FoodProduct[];
  pendingAction: { foodId: string; action: "add" | "buy" } | null;
  onSelect: (food: FoodProduct) => void;
  onCustomize: (food: FoodProduct) => void;
  onAdd: (food: FoodProduct) => void;
  onBuyNow: (food: FoodProduct) => void;
  onToggleWishlist: (food: FoodProduct) => void;
}) {
  if (foods.length === 0) return null;

  return (
    <View className="mt-8">
      <View className="mb-3 px-5">
        <Text className="text-lg font-extrabold text-brand-neutral-text-primary">{title}</Text>
        <Text className="mt-1 text-xs text-slate-500">{description}</Text>
      </View>
      <ScrollView
        horizontal
        pagingEnabled
        contentContainerStyle={{ paddingBottom: 6 }}
        showsHorizontalScrollIndicator={false}
      >
        {Array.from({ length: Math.ceil(foods.length / 2) }, (_, pageIndex) => (
          <View
            key={pageIndex}
            className="flex-row"
            style={{ width: pageWidth, gap: 12, paddingHorizontal: 20 }}
          >
            {foods.slice(pageIndex * 2, pageIndex * 2 + 2).map((item) => {
              const itemId = getFoodId(item);
              return (
                <FoodProductCard
                  key={itemId}
                  food={item}
                  width={cardWidth}
                  isInWishlist={wishlist.some((saved) => getFoodId(saved) === itemId)}
                  cartQuantity={cartItems
                    .filter((cartItem) => getFoodId(cartItem.food) === itemId)
                    .reduce((total, cartItem) => total + cartItem.quantity, 0)}
                  pendingAction={
                    pendingAction?.foodId === itemId
                      ? pendingAction.action
                      : null
                  }
                  isBusy={pendingAction !== null}
                  onSelect={onSelect}
                  onCustomize={onCustomize}
                  onAdd={onAdd}
                  onBuyNow={onBuyNow}
                  onToggleWishlist={onToggleWishlist}
                />
              );
            })}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

export default function ProductDetailsScreen() {
  const { id: idParam } = useLocalSearchParams<{ id?: string | string[] }>();
  const foodId = firstParam(idParam);
  const [food, setFood] = useState<FoodProduct | null>(null);
  const [foods, setFoods] = useState<FoodProduct[]>([]);
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
          setFoods(foods);
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
        <ActivityIndicator accessibilityLabel="Loading product details" color={colors["green-primary"]} />
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
          className="mt-4 rounded-xl bg-brand-green-primary px-5 py-3"
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

  return <ProductDetailsContent key={foodId} food={food} foods={foods} />;
}

function ProductDetailsContent({
  food,
  foods,
}: {
  food: FoodProduct;
  foods: FoodProduct[];
}) {
  const openProduct = useProductNavigation();
  const insets = useSafeAreaInsets();
  const {
    addItem,
    items: cartItems,
    wishlist,
    toggleWishlist,
    setBuyNowItem,
  } = useCart();
  const [customizingFood, setCustomizingFood] = useState<FoodProduct | null>(null);
  const [recommendationError, setRecommendationError] = useState("");
  const [pendingRecommendationAction, setPendingRecommendationAction] =
    useState<{ foodId: string; action: "add" | "buy" } | null>(null);
  const recommendationActionLock = useRef(false);
  const { width: screenWidth } = useWindowDimensions();
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
  const foodId = getFoodId(food);
  const relatedByCategory = foods.filter(
    (item) =>
      getFoodId(item) !== foodId &&
      ((food.category_id != null &&
        item.category_id != null &&
        String(item.category_id) === String(food.category_id)) ||
        (food.category_name &&
          item.category_name?.toLowerCase() === food.category_name.toLowerCase())),
  );
  const relatedByCuisine = foods.filter(
    (item) =>
      getFoodId(item) !== foodId &&
      ((food.cuisine_id != null &&
        item.cuisine_id != null &&
        String(item.cuisine_id) === String(food.cuisine_id)) ||
        (food.cuisine_name &&
          item.cuisine_name?.toLowerCase() === food.cuisine_name.toLowerCase())),
  );
  const recommendationPageWidth = screenWidth;
  const recommendationCardWidth = (recommendationPageWidth - 52) / 2;
  const galleryImageHeight = Math.min(Math.max(screenWidth * 0.74, 240), 340);

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

  const handleRecommendationWishlist = async (item: FoodProduct) => {
    setRecommendationError("");
    try {
      await toggleWishlist(item);
    } catch (error) {
      console.error("Failed to update product recommendation wishlist:", error);
      setRecommendationError("We could not update your favorites. Please try again.");
    }
  };

  const handleRecommendationAction = async (
    item: FoodProduct,
    action: "add" | "buy",
  ) => {
    if (recommendationActionLock.current) return;
    recommendationActionLock.current = true;
    setPendingRecommendationAction({ foodId: getFoodId(item), action });
    setRecommendationError("");

    try {
      const input = getDefaultFoodCartInput(item);
      if (action === "buy") {
        setBuyNowItem(input);
        router.push({ pathname: "/checkout", params: { buyNow: "true" } });
      } else {
        await addItem(input);
      }
    } catch (error) {
      console.error(
        action === "buy"
          ? "Failed to start checkout from product recommendations:"
          : "Failed to add a recommended product to the cart:",
        error,
      );
      if (action === "buy") setBuyNowItem(null);
      setRecommendationError(
        action === "buy"
          ? "We could not start checkout. Please try again."
          : "We could not add this item to your cart. Please try again.",
      );
    } finally {
      recommendationActionLock.current = false;
      setPendingRecommendationAction(null);
    }
  };

  const imageUri = images[activeImage];
  const discount = getFoodDiscountPercentage(food);
  const isVeg = String(food.food_type ?? "").toLowerCase() === "veg";
  const productDetails = [
    food.category_name ? { label: "Category", value: food.category_name } : null,
    food.subcategory_name ? { label: "Subcategory", value: food.subcategory_name } : null,
    food.cuisine_name ? { label: "Cuisine", value: food.cuisine_name } : null,
    food.food_type
      ? { label: "Food type", value: isVeg ? "Vegetarian" : "Non-vegetarian" }
      : null,
    food.portion_size ? { label: "Portion", value: food.portion_size } : null,
    Number(food.preparation_time) > 0
      ? { label: "Preparation time", value: `${food.preparation_time} min` }
      : null,
    Number(food.rating) > 0
      ? { label: "Rating", value: `${Number(food.rating).toFixed(1)} / 5` }
      : null,
    food.is_spicy === true ? { label: "Spice level", value: "Spicy" } : null,
    { label: "Availability", value: available ? "Available" : "Currently unavailable" },
  ].filter((detail): detail is { label: string; value: string } => detail !== null);

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-brand-surface-app"
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View className="flex-1 bg-brand-surface-app">
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 24 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
          showsVerticalScrollIndicator={false}
        >
          <View
            className="bg-brand-surface-app px-4 pb-3"
            style={{ paddingTop: Math.max(insets.top, 12) }}
          >
            <View
              className="relative overflow-hidden rounded-3xl border-2 border-brand-gold-white bg-brand-surface-cream shadow-sm"
              style={{ height: galleryImageHeight }}
            >
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
                  <UtensilsCrossed color={colors.gold} size={48} />
                </View>
              )}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Go back"
                className="absolute left-3 top-3 h-11 w-11 items-center justify-center rounded-full border border-white/70 bg-brand-green-forest/85"
                onPress={() => router.back()}
              >
                <ArrowLeft color={colors["white"]} size={22} />
              </Pressable>

              {discount > 0 ? (
                <View className="absolute right-3 top-3 rounded-full border border-brand-gold-white bg-brand-gold-bright px-3 py-1.5">
                  <Text className="text-xs font-extrabold text-brand-green">
                    {Math.round(discount)}% OFF
                  </Text>
                </View>
              ) : null}
            </View>

            {images.length > 1 ? (
              <View className="mt-3">
                <View className="mb-2 flex-row items-center justify-between px-1">
                  <Text className="text-xs font-bold text-brand-neutral-text-primary">
                    Photos
                  </Text>
                  <Text className="text-xs font-semibold text-brand-neutral-text-warm">
                    {activeImage + 1} / {images.length}
                  </Text>
                </View>
                <ScrollView
                  horizontal
                  contentContainerStyle={{
                    gap: 10,
                    paddingHorizontal: 1,
                    paddingBottom: 2,
                  }}
                  showsHorizontalScrollIndicator={false}
                >
                  {images.map((image, index) => (
                    <Pressable
                      key={`${image}-${index}`}
                      accessibilityRole="button"
                      accessibilityLabel={`Show product image ${index + 1}`}
                      accessibilityState={{ selected: activeImage === index }}
                      className="h-[68px] w-[68px] overflow-hidden rounded-xl border-2 bg-brand-surface-cream"
                      style={{
                        borderColor:
                          activeImage === index
                            ? colors["gold-bright"]
                            : colors["neutral-border-warm"],
                      }}
                      onPress={() => setActiveImage(index)}
                    >
                      <Image
                        className="h-full w-full"
                        resizeMode="cover"
                        source={{ uri: image }}
                      />
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            ) : null}
          </View>

          <View className="px-4 pb-6 pt-2">
            <View className="rounded-2xl border border-brand-neutral-border-warm bg-white p-4 shadow-sm">
              <View className="mb-3 flex-row flex-wrap items-center gap-2">
                {food.food_type ? (
                  <View className={`flex-row items-center rounded-full px-2.5 py-1.5 ${isVeg ? "bg-emerald-50" : "bg-rose-50"}`}>
                    <View className={`mr-1.5 h-2.5 w-2.5 items-center justify-center rounded-sm border ${isVeg ? "border-emerald-700" : "border-rose-700"}`}>
                      <View className={`h-1 w-1 rounded-full ${isVeg ? "bg-emerald-700" : "bg-rose-700"}`} />
                    </View>
                    <Text className={`text-xs font-bold ${isVeg ? "text-emerald-800" : "text-rose-800"}`}>
                      {isVeg ? "Vegetarian" : "Non-vegetarian"}
                    </Text>
                  </View>
                ) : null}
                {food.is_spicy === true ? (
                  <View className="rounded-full bg-brand-gold-pale px-2.5 py-1.5">
                    <Text className="text-xs font-bold text-brand-green">Spicy</Text>
                  </View>
                ) : null}
                {food.featured === true ? (
                  <View className="rounded-full bg-brand-gold-pale px-2.5 py-1.5">
                    <Text className="text-xs font-bold text-brand-green">Chef&apos;s pick</Text>
                  </View>
                ) : null}
              </View>

              <Text className="text-2xl font-black leading-8 text-brand-neutral-text-primary">
                {getFoodName(food)}
              </Text>
              <View className="mt-2 flex-row items-baseline">
                <Text className="text-xl font-black text-brand-green-primary">
                  ₹{getFoodPrice(food).toFixed(2)}
                </Text>
                {Number(food.mrp) > getFoodPrice(food) ? (
                  <>
                    <Text className="ml-2 text-sm text-slate-400 line-through">
                      ₹{Number(food.mrp).toFixed(2)}
                    </Text>
                    {discount > 0 ? (
                      <Text className="ml-2 text-xs font-bold text-brand-gold-dark">
                        Save {Math.round(discount)}%
                      </Text>
                    ) : null}
                  </>
                ) : null}
              </View>
              <Text className="mt-2 text-sm leading-6 text-slate-600">
                {food.description || "Freshly prepared to order."}
              </Text>
            </View>

            {productDetails.length > 0 ? (
              <View className="mt-4 rounded-2xl border border-brand-green-border bg-brand-green-surface p-4">
                <Text className="mb-3 text-base font-extrabold text-brand-neutral-text-primary">
                  Food details
                </Text>
                <View className="flex-row flex-wrap">
                  {productDetails.map((detail) => (
                    <View
                      key={detail.label}
                      className="mb-3 w-1/2 pr-2"
                    >
                      <Text className="text-xs text-slate-500">{detail.label}</Text>
                      <Text className="mt-1 text-sm font-semibold text-slate-800">
                        {detail.value}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

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
                  <Text className="ml-3 text-sm font-bold text-brand-green-primary">
                    {option.price > 0 ? `+₹${option.price.toFixed(2)}` : "Included"}
                  </Text>
                  <View className={`ml-3 h-5 w-5 items-center justify-center rounded border ${selected ? "border-brand-green-primary bg-brand-green-primary" : "border-slate-300"}`}>
                    {selected ? <Check color={colors["white"]} size={14} /> : null}
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
                      <Text className="ml-3 text-sm font-bold text-brand-green-primary">
                        {option.price > 0 ? `+₹${option.price.toFixed(2)}` : "Included"}
                      </Text>
                      <View className={`ml-3 h-5 w-5 items-center justify-center rounded-full border ${selected ? "border-brand-green-primary" : "border-slate-300"}`}>
                        {selected ? <View className="h-2.5 w-2.5 rounded-full bg-brand-green-primary" /> : null}
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
                placeholderTextColor={colors["neutral-placeholder"]}
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
                placeholderTextColor={colors["neutral-placeholder"]}
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
          {recommendationError ? (
            <Text accessibilityRole="alert" className="mx-5 mt-4 text-sm font-semibold text-rose-700">
              {recommendationError}
            </Text>
          ) : null}
          <RecommendationSection
            title="More in this category"
            description={`Explore more ${food.category_name || "menu"} favorites.`}
            foods={relatedByCategory}
            pageWidth={recommendationPageWidth}
            cardWidth={recommendationCardWidth}
            cartItems={cartItems}
            wishlist={wishlist}
            pendingAction={pendingRecommendationAction}
            onSelect={openProduct}
            onCustomize={setCustomizingFood}
            onAdd={(item) => void handleRecommendationAction(item, "add")}
            onBuyNow={(item) => void handleRecommendationAction(item, "buy")}
            onToggleWishlist={(item) => void handleRecommendationWishlist(item)}
          />
          <RecommendationSection
            title="More from this cuisine"
            description={`Discover more ${food.cuisine_name || "cuisine"} dishes.`}
            foods={relatedByCuisine}
            pageWidth={recommendationPageWidth}
            cardWidth={recommendationCardWidth}
            cartItems={cartItems}
            wishlist={wishlist}
            pendingAction={pendingRecommendationAction}
            onSelect={openProduct}
            onCustomize={setCustomizingFood}
            onAdd={(item) => void handleRecommendationAction(item, "add")}
            onBuyNow={(item) => void handleRecommendationAction(item, "buy")}
            onToggleWishlist={(item) => void handleRecommendationWishlist(item)}
          />
        </ScrollView>

        <View
          className="flex-row items-center gap-3 border-t border-brand-gold-white bg-brand-surface-modal px-5 pt-3"
          style={{ paddingBottom: Math.max(insets.bottom, 12) }}
        >
          <View className="h-12 flex-row items-center rounded-xl border border-brand-neutral-border-warm bg-white">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Decrease quantity"
              className="h-12 w-11 items-center justify-center"
              onPress={() => setQuantity((current) => Math.max(1, current - 1))}
            >
              <Minus color={colors["neutral-slate-dark"]} size={17} />
            </Pressable>
            <Text className="min-w-7 text-center text-base font-bold text-slate-800">{quantity}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Increase quantity"
              className="h-12 w-11 items-center justify-center"
              onPress={() => setQuantity((current) => current + 1)}
            >
              <Plus color={colors["neutral-slate-dark"]} size={17} />
            </Pressable>
          </View>
          <View className="flex-1">
            <Text className="mb-1 text-[10px] font-semibold text-slate-500">
              ₹{unitPrice.toFixed(2)} each
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: !available || saving }}
              className={`h-11 items-center justify-center rounded-xl ${available && !saving ? "bg-brand-green-primary" : "bg-slate-400"}`}
              disabled={!available || saving}
              onPress={() => void handleAdd()}
            >
              <Text className="text-sm font-extrabold text-white">
                {!available ? "Unavailable" : saving ? "Adding..." : `Add to Cart · ₹${(unitPrice * quantity).toFixed(2)}`}
              </Text>
            </Pressable>
          </View>
        </View>
        <FoodCustomizationModal
          key={customizingFood ? getFoodId(customizingFood) : "no-recommendation-selected"}
          food={customizingFood}
          onClose={() => setCustomizingFood(null)}
          onAdd={addItem}
        />
      </View>
    </KeyboardAvoidingView>
  );
}
