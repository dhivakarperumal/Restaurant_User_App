import colors from "../theme/colors.json";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { router } from "expo-router";
import { ArrowRight, UtensilsCrossed } from "lucide-react-native";
import { Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import api from "../lib/api";
import { getActiveFoods, getFoodId } from "../lib/foods";
import { getDefaultFoodCartInput } from "../lib/cart";
import { useCart } from "../contexts/CartContext";
import type { FoodProduct } from "../types/food";
import FoodProductCard from "./common/FoodProductCard";

type HomeProductAction = "add" | "buy";

function getFoodTimestamp(food: FoodProduct): number {
  const createdAt = food.created_at;
  if (typeof createdAt === "number") {
    return createdAt > 0 && createdAt < 1_000_000_000_000
      ? createdAt * 1000
      : createdAt;
  }

  const value = createdAt?.trim() ?? "";
  const numericValue = Number(value);
  if (value && Number.isFinite(numericValue)) {
    return numericValue > 0 && numericValue < 1_000_000_000_000
      ? numericValue * 1000
      : numericValue;
  }

  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function getFoodType(food: FoodProduct): string {
  return String(food.food_type ?? "").toLowerCase().replace(/[\s_-]/g, "");
}

export default function HomeProducts() {
  const [foods, setFoods] = useState<FoodProduct[]>([]);
  const [pendingAction, setPendingAction] = useState<{
    foodId: string;
    action: HomeProductAction;
  } | null>(null);
  const [actionError, setActionError] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { addItem, items: cartItems, wishlist, toggleWishlist } = useCart();
  const actionLock = useRef(false);
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
         )
        .slice(0, 10),
    [foods],
  );
  const newArrivals = useMemo(
    () =>
      foods
        .filter((food) => getFoodTimestamp(food) > 0)
        .sort((first, second) => getFoodTimestamp(second) - getFoodTimestamp(first)),
    [foods],
  );
  const vegetarianFoods = useMemo(
    () =>
      foods.filter((food) => {
        const type = getFoodType(food);
        return type === "veg" || type === "vegetarian";
      }),
    [foods],
  );
  const nonVegetarianFoods = useMemo(
    () =>
      foods.filter((food) => {
        const type = getFoodType(food);
        return type === "nonveg" || type === "nonvegetarian";
      }),
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

  const handleProductAction = async (
    food: FoodProduct,
    action: HomeProductAction,
  ) => {
    if (actionLock.current) return;
    actionLock.current = true;
    setPendingAction({ foodId: getFoodId(food), action });
    setActionError("");
    try {
      await addItem(getDefaultFoodCartInput(food));
      if (action === "buy") router.push("/checkout");
    } catch (requestError) {
      console.error(
        action === "buy"
          ? "Failed to start checkout from home:"
          : "Failed to add a home product to the cart:",
        requestError,
      );
      setActionError(
        action === "buy"
          ? "We could not start checkout. Please try again."
          : "We could not add this item to your cart. Please try again.",
      );
    } finally {
      actionLock.current = false;
      setPendingAction(null);
    }
  };

  const getCartQuantity = (foodId: string) =>
    cartItems
      .filter((item) => getFoodId(item.food) === foodId)
      .reduce((total, item) => total + item.quantity, 0);

  const renderFoodCards = (sectionFoods: FoodProduct[]) => (
    <ScrollView
      horizontal
      pagingEnabled
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: 6 }}
    >
      {Array.from(
        { length: Math.ceil(sectionFoods.length / 2) },
        (_, pageIndex) => (
          <View
            key={pageIndex}
            className="flex-row"
            style={{ width: pageWidth, gap: 12 }}
          >
            {sectionFoods.slice(pageIndex * 2, pageIndex * 2 + 2).map((food) => (
              <FoodProductCard
                key={getFoodId(food)}
                food={food}
                width={cardWidth}
                isInWishlist={wishlist.some((item) => getFoodId(item) === getFoodId(food))}
                cartQuantity={getCartQuantity(getFoodId(food))}
                pendingAction={
                  pendingAction?.foodId === getFoodId(food)
                    ? pendingAction.action
                    : null
                }
                isBusy={pendingAction !== null}
                onSelect={(item) =>
                  router.push({ pathname: "/UsersTab/product/[id]", params: { id: getFoodId(item) } })
                }
                onAdd={(item) => void handleProductAction(item, "add")}
                onBuyNow={(item) => void handleProductAction(item, "buy")}
                onToggleWishlist={(item) => void handleToggleWishlist(item)}
              />
            ))}
          </View>
        ),
      )}
    </ScrollView>
  );

  const renderFilteredSection = (
    eyebrow: string,
    title: string,
    subtitle: string,
    sectionFoods: FoodProduct[],
    emptyMessage: string,
  ) => (
    <View className="mt-8">
      <View className="mb-4">
        <Text className="text-center text-[11px] font-extrabold uppercase tracking-[2px] text-brand-gold">
          {eyebrow}
        </Text>
        <Text className="mt-1 text-center text-2xl font-black text-brand-neutral-text-primary">
          {title}
        </Text>
        <Text className="mt-1 text-center text-xs text-slate-500">{subtitle}</Text>
      </View>
      {sectionFoods.length ? (
        renderFoodCards(sectionFoods)
      ) : (
        <View className="items-center rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-8">
          <UtensilsCrossed color={colors["neutral-placeholder"]} size={30} />
          <Text className="mt-3 text-center text-sm font-semibold text-slate-600">
            {emptyMessage}
          </Text>
        </View>
      )}
    </View>
  );

  return (
    <View className="mt-8">
      <View className="mb-4">
        <Text className="text-center text-[11px] font-extrabold uppercase tracking-[2px] text-brand-gold">
          A taste of what we make
        </Text>
        <Text className="mt-1 text-center text-2xl font-black text-brand-neutral-text-primary">
          Guest <Text className="font-serif italic text-brand-green-primary">Favorites</Text>
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
              className="rounded-2xl bg-slate-200"
              style={{ width: cardWidth, height: cardWidth + 150 }}
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
                    cartQuantity={getCartQuantity(getFoodId(food))}
                    pendingAction={
                      pendingAction?.foodId === getFoodId(food)
                        ? pendingAction.action
                        : null
                    }
                    isBusy={pendingAction !== null}
                    onSelect={(item) =>
                      router.push({ pathname: "/UsersTab/product/[id]", params: { id: getFoodId(item) } })
                    }
                    onAdd={(item) => void handleProductAction(item, "add")}
                    onBuyNow={(item) => void handleProductAction(item, "buy")}
                    onToggleWishlist={(item) => void handleToggleWishlist(item)}
                  />
                ))}
              </View>
            ),
          )}
        </ScrollView>
      ) : (
        <View className="items-center rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-8">
          <UtensilsCrossed color={colors["neutral-placeholder"]} size={30} />
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
        <Text className="text-sm font-bold text-brand-green-primary">View the full menu</Text>
        <ArrowRight color={colors["green-primary"]} size={16} className="ml-2" />
      </Pressable>

      {!loading && !error ? (
        <>
          {renderFilteredSection(
            "Just added",
            "New Arrivals",
            "Discover the latest additions to our menu.",
            newArrivals,
            "New menu items will appear here.",
          )}
          {renderFilteredSection(
            "Plant-powered picks",
            "Vegetarian",
            "Fresh vegetarian favorites from our menu.",
            vegetarianFoods,
            "No vegetarian items are available right now.",
          )}
          {renderFilteredSection(
            "Made for meat lovers",
            "Non-Vegetarian",
            "Explore our non-vegetarian menu favorites.",
            nonVegetarianFoods,
            "No non-vegetarian items are available right now.",
          )}
        </>
      ) : null}

    </View>
  );
}
