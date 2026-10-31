import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { router, useLocalSearchParams } from "expo-router";
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Filter,
  Grid2X2,
  List,
  Search,
  SlidersHorizontal,
  Star,
  Tag,
  Utensils,
  X,
} from "lucide-react-native";
import {
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import api from "../lib/api";
import {
  getFoodDiscountPercentage,
  getFoodId,
  getMenuFoods,
} from "../lib/foods";
import { useCart } from "../contexts/CartContext";
import type { FoodProduct } from "../types/food";
import FoodCustomizationModal from "./common/FoodCustomizationModal";
import FoodProductCard from "./common/FoodProductCard";

type ShopCategory = {
  id: string;
  name: string;
};

type ShopCuisine = {
  id: string;
  name: string;
};

type FoodTypeFilter = "all" | "Veg" | "Non-Veg";
type SortOption = "recommended" | "price-low" | "price-high" | "rating" | "prep-time";
type ViewMode = "grid" | "list";

const PAGE_SIZE = 12;
const OFFER_RANGES = [
  { value: "5-10", label: "5–10% off" },
  { value: "10-20", label: "10–20% off" },
  { value: "20-30", label: "20–30% off" },
  { value: "30+", label: "More than 30% off" },
];
const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "recommended", label: "Featured" },
  { value: "price-low", label: "Price ↑" },
  { value: "price-high", label: "Price ↓" },
  { value: "rating", label: "Top rated" },
  { value: "prep-time", label: "Fastest" },
];

function firstParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getString(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value.trim() || fallback;
  if (typeof value === "number") return String(value);
  return fallback;
}

function getList(payload: unknown, keys: string[]): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (!isRecord(payload)) return [];
  for (const key of keys) {
    if (Array.isArray(payload[key])) return payload[key];
  }
  return [];
}

function getActiveFilters(payload: unknown, keys: string[], idKeys: string[], nameKeys: string[]) {
  return getList(payload, keys)
    .filter((item): item is Record<string, unknown> => {
      if (!isRecord(item)) return false;
      const status = getString(item.status ?? item.is_active ?? "Active").toLowerCase();
      return status === "active" || status === "1" || status === "true" || status === "enabled";
    })
    .map((item, index) => {
      const name = nameKeys
        .map((key) => item[key])
        .map((value) => getString(value))
        .find(Boolean) ?? "Category";
      const id = idKeys
        .map((key) => item[key])
        .map((value) => getString(value))
        .find(Boolean) ?? `${name}-${index}`;
      return { id, name };
    });
}

function matchesOfferRange(discount: number, range: string): boolean {
  if (range === "30+") return discount > 30;
  const [minimum, maximum] = range.split("-").map(Number);
  return discount >= minimum && (range === "20-30" ? discount <= maximum : discount < maximum);
}

function matchesCuisine(food: FoodProduct, cuisine: ShopCuisine): boolean {
  return (
    String(food.cuisine_id ?? "") === cuisine.id ||
    String(food.cuisine_name ?? "").toLowerCase() === cuisine.name.toLowerCase()
  );
}

export default function ShopScreen() {
  const params = useLocalSearchParams<{
    category?: string | string[];
    cuisine?: string | string[];
    search?: string | string[];
  }>();
  const [foods, setFoods] = useState<FoodProduct[]>([]);
  const [categories, setCategories] = useState<ShopCategory[]>([]);
  const [cuisines, setCuisines] = useState<ShopCuisine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState(() => firstParam(params.search));
  const [selectedCategory, setSelectedCategory] = useState(
    () => firstParam(params.category) || "all",
  );
  const [selectedCuisines, setSelectedCuisines] = useState<string[]>(() => {
    const cuisineFilter = firstParam(params.cuisine);
    return cuisineFilter && cuisineFilter !== "all" ? cuisineFilter.split(",") : [];
  });
  const [foodType, setFoodType] = useState<FoodTypeFilter>("all");
  const [minimumPrice, setMinimumPrice] = useState("");
  const [maximumPrice, setMaximumPrice] = useState("");
  const [minimumRating, setMinimumRating] = useState(0);
  const [offerRange, setOfferRange] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("recommended");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [currentPage, setCurrentPage] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedFood, setSelectedFood] = useState<FoodProduct | null>(null);
  const [actionError, setActionError] = useState("");
  const { addItem, items: cartItems, wishlist, toggleWishlist } = useCart();
  const { width: screenWidth } = useWindowDimensions();
  const pageWidth = Math.max(0, screenWidth - 48);
  const cardWidth = (pageWidth - 12) / 2;
  const productsPerPage = PAGE_SIZE;

  useEffect(() => {
    setSearchQuery(firstParam(params.search));
    setSelectedCategory(firstParam(params.category) || "all");
    const cuisineFilter = firstParam(params.cuisine);
    setSelectedCuisines(
      cuisineFilter && cuisineFilter !== "all" ? cuisineFilter.split(",") : [],
    );
  }, [params.category, params.cuisine, params.search]);

  const fetchMenuData = useCallback(async () => {
    setLoading(true);
    setError("");
    const [foodsResult, categoriesResult, cuisinesResult] = await Promise.allSettled([
      api.get("/foods"),
      api.get("/categories"),
      api.get("/cuisines"),
    ]);

    if (foodsResult.status === "rejected") {
      console.error("Failed to load shop menu:", foodsResult.reason);
      setError("We could not load the menu right now.");
      setLoading(false);
      return;
    }

    try {
      setFoods(getMenuFoods(foodsResult.value.data?.data ?? foodsResult.value.data));
    } catch (menuError) {
      console.error("Failed to parse shop menu:", menuError);
      setError("We could not load the menu right now.");
      setLoading(false);
      return;
    }

    if (categoriesResult.status === "fulfilled") {
      setCategories(
        getActiveFilters(
          categoriesResult.value.data?.data ?? categoriesResult.value.data,
          ["categories", "items", "results"],
          ["category_id", "categoryId", "id"],
          ["category_name", "categoryName", "name"],
        ),
      );
    } else {
      console.error("Failed to load shop categories:", categoriesResult.reason);
      setCategories([]);
    }

    if (cuisinesResult.status === "fulfilled") {
      setCuisines(
        getActiveFilters(
          cuisinesResult.value.data?.data ?? cuisinesResult.value.data,
          ["cuisines", "items", "results"],
          ["cuisine_id", "cuisineId", "id"],
          ["cuisine_name", "cuisineName", "name"],
        ),
      );
    } else {
      console.error("Failed to load shop cuisines:", cuisinesResult.reason);
      setCuisines([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void fetchMenuData();
  }, [fetchMenuData]);

  const setSearchFilter = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
    router.setParams({ search: value || undefined });
  };

  const setCategoryFilter = (value: string) => {
    setSelectedCategory(value);
    setCurrentPage(1);
    router.setParams({ category: value === "all" ? undefined : value });
  };

  const setCuisineFilters = (values: string[]) => {
    setSelectedCuisines(values);
    setCurrentPage(1);
    router.setParams({ cuisine: values.length > 0 ? values.join(",") : undefined });
  };

  const selectFood = (food: FoodProduct) => {
    router.push({ pathname: "/UsersTab/product/[id]", params: { id: getFoodId(food) } });
  };

  const filteredFoods = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return foods
      .filter((food) => {
        if (food.is_menu_visible === false) return false;
        if (food.status && String(food.status).toLowerCase() !== "active") return false;

        if (query) {
          const searchable = [
            food.food_name,
            food.description,
            food.category_name,
            food.cuisine_name,
            food.subcategory_name,
          ];
          if (!searchable.some((value) => String(value ?? "").toLowerCase().includes(query))) {
            return false;
          }
        }

        if (selectedCategory !== "all") {
          const category = categories.find(
            (item) =>
              item.id === selectedCategory ||
              item.name.toLowerCase() === selectedCategory.toLowerCase(),
          );
          const matchesCategory =
            String(food.category_id ?? "") === selectedCategory ||
            String(food.category_name ?? "").toLowerCase() === selectedCategory.toLowerCase() ||
            (category?.name.toLowerCase() === String(food.category_name ?? "").toLowerCase() &&
              category.id === selectedCategory);
          if (!matchesCategory) return false;
        }

        if (selectedCuisines.length > 0) {
          const selected = selectedCuisines
            .map((value) =>
              cuisines.find(
                (cuisine) =>
                  cuisine.id === value ||
                  cuisine.name.toLowerCase() === value.toLowerCase(),
              ) ?? { id: value, name: value },
            );
          if (!selected.some((cuisine) => matchesCuisine(food, cuisine))) return false;
        }

        if (
          foodType !== "all" &&
          String(food.food_type ?? "").toLowerCase().replace(/[\s_-]/g, "") !==
            foodType.toLowerCase().replace(/[\s_-]/g, "")
        ) {
          return false;
        }

        const price = Number(food.final_price || food.mrp || 0);
        if (minimumPrice !== "" && price < Number(minimumPrice)) return false;
        if (maximumPrice !== "" && price > Number(maximumPrice)) return false;

        const discount = getFoodDiscountPercentage(food);
        if (offerRange && !matchesOfferRange(discount, offerRange)) return false;
        if (minimumRating > 0 && Number(food.rating || 0) < minimumRating) return false;
        return true;
      })
      .sort((first, second) => {
        if (sortBy === "price-low") {
          return Number(first.final_price || first.mrp || 0) -
            Number(second.final_price || second.mrp || 0);
        }
        if (sortBy === "price-high") {
          return Number(second.final_price || second.mrp || 0) -
            Number(first.final_price || first.mrp || 0);
        }
        if (sortBy === "rating") return Number(second.rating || 0) - Number(first.rating || 0);
        if (sortBy === "prep-time") {
          return Number(first.preparation_time || 999) - Number(second.preparation_time || 999);
        }
        if (Boolean(first.featured) !== Boolean(second.featured)) {
          return Number(Boolean(second.featured)) - Number(Boolean(first.featured));
        }
        const firstCreated = Date.parse(String(first.created_at ?? ""));
        const secondCreated = Date.parse(String(second.created_at ?? ""));
        if (Number.isFinite(firstCreated) && Number.isFinite(secondCreated)) {
          return secondCreated - firstCreated;
        }
        return String(second.id ?? second.food_id ?? "").localeCompare(
          String(first.id ?? first.food_id ?? ""),
          undefined,
          { numeric: true },
        );
      });
  }, [
    categories,
    cuisines,
    foodType,
    foods,
    maximumPrice,
    minimumPrice,
    minimumRating,
    offerRange,
    searchQuery,
    selectedCategory,
    selectedCuisines,
    sortBy,
  ]);

  const totalPages = Math.max(1, Math.ceil(filteredFoods.length / productsPerPage));
  const pageFoods = filteredFoods.slice(
    (currentPage - 1) * productsPerPage,
    currentPage * productsPerPage,
  );
  const maximumMenuPrice = Math.ceil(
    foods.reduce(
      (maximum, food) => Math.max(maximum, Number(food.final_price || food.mrp || 0)),
      0,
    ),
  );
  const hasActiveFilters =
    searchQuery.trim() !== "" ||
    selectedCategory !== "all" ||
    selectedCuisines.length > 0 ||
    foodType !== "all" ||
    minimumPrice !== "" ||
    maximumPrice !== "" ||
    minimumRating > 0 ||
    offerRange !== "";

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages));
  }, [totalPages]);

  const resetFilters = () => {
    setSearchQuery("");
    setSelectedCategory("all");
    setSelectedCuisines([]);
    setFoodType("all");
    setMinimumPrice("");
    setMaximumPrice("");
    setMinimumRating(0);
    setOfferRange("");
    setSortBy("recommended");
    setCurrentPage(1);
    router.setParams({
      search: undefined,
      category: undefined,
      cuisine: undefined,
    });
  };

  const setSort = (value: SortOption) => {
    setSortBy(value);
    setCurrentPage(1);
  };

  const categoryCount = (category: ShopCategory) =>
    foods.filter(
      (food) =>
        String(food.category_id ?? "") === category.id ||
        String(food.category_name ?? "").toLowerCase() === category.name.toLowerCase(),
    ).length;

  const cartQuantity = (foodId: string) =>
    cartItems
      .filter((item) => getFoodId(item.food) === foodId)
      .reduce((total, item) => total + item.quantity, 0);

  const handleToggleWishlist = async (food: FoodProduct) => {
    setActionError("");
    try {
      await toggleWishlist(food);
    } catch (requestError) {
      console.error("Failed to update shop wishlist:", requestError);
      setActionError("We could not save your favorites. Please try again.");
    }
  };

  const openCustomizer = (food: FoodProduct) => setSelectedFood(food);

  return (
    <>
    <ScrollView
      className="flex-1 bg-[#F3F4F3]"
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 18, paddingBottom: 120 }}
    >
      <View className="mb-5 items-center">
        <Text className="text-[11px] font-extrabold uppercase tracking-[2px] text-[#D5A233]">
          Fresh from our kitchen
        </Text>
        <Text className="mt-1 text-2xl font-black text-[#17251E]">Shop the menu</Text>
      </View>

      <View className="mb-4 flex-row flex-wrap gap-2">
        <StatPill icon={<Utensils color="#D4A843" size={14} />} label={`${foods.length} Dishes`} />
        <StatPill icon={<Filter color="#D4A843" size={14} />} label={`${categories.length} Categories`} />
        <StatPill icon={<Star color="#D4A843" size={14} />} label={`${cuisines.length} Cuisines`} />
      </View>

      <View className="mb-4 h-12 flex-row items-center rounded-xl border border-slate-200 bg-white px-3">
        <Search color="#94A3B8" size={18} />
        <TextInput
          accessibilityLabel="Search food, dish, or cuisine"
          className="ml-2 h-full flex-1 text-sm text-slate-800"
          placeholder="Search food, dish, cuisine..."
          placeholderTextColor="#94A3B8"
          returnKeyType="search"
          value={searchQuery}
          onChangeText={setSearchFilter}
        />
        {searchQuery ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Clear search"
            onPress={() => setSearchFilter("")}
            hitSlop={8}
          >
            <X color="#64748B" size={17} />
          </Pressable>
        ) : null}
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: filtersOpen }}
        className="mb-3 h-12 flex-row items-center justify-between rounded-xl border border-slate-200 bg-white px-4"
        onPress={() => setFiltersOpen((open) => !open)}
      >
        <View className="flex-row items-center">
          <SlidersHorizontal color="#1A6A3B" size={17} />
          <Text className="ml-2 text-sm font-bold text-[#17251E]">Filters</Text>
          {hasActiveFilters ? (
            <View className="ml-2 h-2 w-2 rounded-full bg-[#D5A233]" />
          ) : null}
        </View>
        <ChevronDown
          color="#64748B"
          size={18}
          style={{ transform: [{ rotate: filtersOpen ? "180deg" : "0deg" }] }}
        />
      </Pressable>

      {filtersOpen ? (
        <View className="mb-4 rounded-2xl border border-slate-200 bg-white p-4">
          <FilterHeading title="Categories" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
            <View className="flex-row gap-2 pr-1">
              <FilterChip
                label={`All dishes (${foods.length})`}
                selected={selectedCategory === "all"}
                onPress={() => setCategoryFilter("all")}
              />
              {categories.map((category) => {
                const selected =
                  selectedCategory === category.id ||
                  selectedCategory.toLowerCase() === category.name.toLowerCase();
                return (
                  <FilterChip
                    key={category.id}
                    label={`${category.name} (${categoryCount(category)})`}
                    selected={selected}
                    onPress={() => setCategoryFilter(selected ? "all" : category.id)}
                  />
                );
              })}
            </View>
          </ScrollView>

          <FilterHeading title="Price range" />
          <View className="mb-4 flex-row items-center gap-3">
            <PriceInput
              label="Minimum"
              value={minimumPrice}
              onChange={(value) => {
                setMinimumPrice(value);
                setCurrentPage(1);
              }}
            />
            <PriceInput
              label="Maximum"
              value={maximumPrice}
              onChange={(value) => {
                setMaximumPrice(value);
                setCurrentPage(1);
              }}
              placeholder={maximumMenuPrice ? String(maximumMenuPrice) : "0"}
            />
          </View>

          <FilterHeading title="Dietary" />
          <View className="mb-4 flex-row gap-2">
            {(
              [
                ["all", "All"],
                ["Veg", "Pure Veg"],
                ["Non-Veg", "Non-Veg"],
              ] as const
            ).map(([value, label]) => (
              <FilterChip
                key={value}
                label={label}
                selected={foodType === value}
                onPress={() => {
                  setFoodType(value);
                  setCurrentPage(1);
                }}
              />
            ))}
          </View>

          {cuisines.length > 0 ? (
            <>
              <FilterHeading title="Cuisine" />
              <View className="mb-4 flex-row flex-wrap gap-2">
                <FilterChip
                  label="All cuisines"
                  selected={selectedCuisines.length === 0}
                  onPress={() => setCuisineFilters([])}
                />
                {cuisines.map((cuisine) => {
                  const selectedFilter = selectedCuisines.find(
                    (item) =>
                      item === cuisine.id ||
                      item.toLowerCase() === cuisine.name.toLowerCase(),
                  );
                  const selected = Boolean(selectedFilter);
                  return (
                    <FilterChip
                      key={cuisine.id}
                      label={cuisine.name}
                      selected={selected}
                      onPress={() =>
                        setCuisineFilters(
                          selected
                            ? selectedCuisines.filter((item) => item !== selectedFilter)
                            : [...selectedCuisines, cuisine.id],
                        )
                      }
                    />
                  );
                })}
              </View>
            </>
          ) : null}

          <FilterHeading title="Offers" />
          <View className="mb-4 flex-row flex-wrap gap-2">
            <FilterChip
              label="Any offer"
              selected={offerRange === ""}
              onPress={() => {
                setOfferRange("");
                setCurrentPage(1);
              }}
            />
            {OFFER_RANGES.map((offer) => (
              <FilterChip
                key={offer.value}
                label={offer.label}
                selected={offerRange === offer.value}
                onPress={() => {
                  setOfferRange(offer.value);
                  setCurrentPage(1);
                }}
              />
            ))}
          </View>

          <FilterHeading title="Minimum rating" />
          <View className="mb-4 flex-row flex-wrap gap-2">
            {[0, 5, 4, 3, 2, 1].map((rating) => (
              <FilterChip
                key={rating}
                label={rating === 0 ? "Any" : `${rating}+ stars`}
                selected={minimumRating === rating}
                onPress={() => {
                  setMinimumRating(rating);
                  setCurrentPage(1);
                }}
              />
            ))}
          </View>

          {hasActiveFilters ? (
            <Pressable
              accessibilityRole="button"
              className="self-start rounded-lg bg-rose-50 px-3 py-2"
              onPress={resetFilters}
            >
              <Text className="text-xs font-bold text-rose-700">Reset all filters</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {hasActiveFilters ? (
        <View className="mb-3 flex-row flex-wrap gap-2">
          {searchQuery ? (
            <ActiveFilter label={`Search: ${searchQuery}`} onClear={() => setSearchFilter("")} />
          ) : null}
          {selectedCategory !== "all" ? (
            <ActiveFilter
              label={`Category: ${categories.find((item) => item.id === selectedCategory)?.name ?? selectedCategory}`}
              onClear={() => setCategoryFilter("all")}
            />
          ) : null}
          {selectedCuisines.map((cuisineId) => (
            <ActiveFilter
              key={cuisineId}
              label={`Cuisine: ${cuisines.find((item) => item.id === cuisineId)?.name ?? cuisineId}`}
              onClear={() =>
                setCuisineFilters(selectedCuisines.filter((item) => item !== cuisineId))
              }
            />
          ))}
          {foodType !== "all" ? (
            <ActiveFilter
              label={`Type: ${foodType}`}
              onClear={() => {
                setFoodType("all");
                setCurrentPage(1);
              }}
            />
          ) : null}
          {minimumPrice || maximumPrice ? (
            <ActiveFilter
              label={`Price: ₹${minimumPrice || "0"}–₹${maximumPrice || maximumMenuPrice}`}
              onClear={() => {
                setMinimumPrice("");
                setMaximumPrice("");
                setCurrentPage(1);
              }}
            />
          ) : null}
          {offerRange ? (
            <ActiveFilter
              label={`${offerRange === "30+" ? "More than 30%" : offerRange.replace("-", "–") + "%"} off`}
              onClear={() => {
                setOfferRange("");
                setCurrentPage(1);
              }}
            />
          ) : null}
          {minimumRating > 0 ? (
            <ActiveFilter
              label={`${minimumRating}+ stars`}
              onClear={() => {
                setMinimumRating(0);
                setCurrentPage(1);
              }}
            />
          ) : null}
        </View>
      ) : null}

      <View className="mb-3 rounded-xl border border-slate-200 bg-white p-3">
        <View className="flex-row items-center justify-between">
          <View className="flex-1">
            <Text className="text-sm font-extrabold text-[#17251E]">Our menu</Text>
            <Text className="mt-0.5 text-[11px] text-slate-500">
              Showing {filteredFoods.length === 0 ? 0 : (currentPage - 1) * productsPerPage + 1}
              –{Math.min(currentPage * productsPerPage, filteredFoods.length)} of {filteredFoods.length} dishes
            </Text>
          </View>
          <View className="flex-row rounded-lg bg-slate-100 p-1">
            <ViewModeButton
              label="Grid view"
              selected={viewMode === "grid"}
              onPress={() => setViewMode("grid")}
              icon={<Grid2X2 color={viewMode === "grid" ? "#FFFFFF" : "#64748B"} size={16} />}
            />
            <ViewModeButton
              label="List view"
              selected={viewMode === "list"}
              onPress={() => setViewMode("list")}
              icon={<List color={viewMode === "list" ? "#FFFFFF" : "#64748B"} size={16} />}
            />
          </View>
        </View>
        <Text className="mb-1 mt-3 text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
          Sort by
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View className="flex-row gap-2">
            {SORT_OPTIONS.map((option) => (
              <FilterChip
                key={option.value}
                label={option.label}
                selected={sortBy === option.value}
                onPress={() => setSort(option.value)}
              />
            ))}
          </View>
        </ScrollView>
      </View>

      {actionError ? (
        <Text accessibilityRole="alert" className="mb-3 text-center text-xs font-semibold text-rose-700">
          {actionError}
        </Text>
      ) : null}

      {loading ? (
        <View className="flex-row flex-wrap gap-3">
          {[0, 1, 2, 3].map((item) => (
            <View
              key={item}
              className="h-[278px] rounded-2xl bg-slate-200"
              style={{ width: cardWidth }}
            />
          ))}
        </View>
      ) : error ? (
        <View className="items-center rounded-2xl border border-rose-200 bg-rose-50 p-6">
          <Text className="text-center text-sm font-semibold text-rose-800">{error}</Text>
          <Pressable
            accessibilityRole="button"
            className="mt-3 rounded-xl bg-rose-600 px-4 py-2"
            onPress={() => void fetchMenuData()}
          >
            <Text className="text-xs font-bold text-white">Try again</Text>
          </Pressable>
        </View>
      ) : pageFoods.length > 0 ? (
        <View className={viewMode === "grid" ? "flex-row flex-wrap gap-3" : "gap-3"}>
          {pageFoods.map((food) => {
            const foodId = getFoodId(food);
            return (
              <FoodProductCard
                key={foodId}
                food={food}
                width={viewMode === "grid" ? cardWidth : pageWidth}
                viewMode={viewMode}
                isInWishlist={wishlist.some((item) => getFoodId(item) === foodId)}
                cartQuantity={cartQuantity(foodId)}
                onSelect={selectFood}
                onCustomize={openCustomizer}
                onToggleWishlist={(item) => void handleToggleWishlist(item)}
              />
            );
          })}
        </View>
      ) : (
        <View className="items-center rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-10">
          <Utensils color="#94A3B8" size={30} />
          <Text className="mt-3 text-base font-extrabold text-slate-700">No dishes found</Text>
          <Text className="mt-1 text-center text-xs text-slate-500">
            Try adjusting your search or filters.
          </Text>
          {hasActiveFilters ? (
            <Pressable
              accessibilityRole="button"
              className="mt-4 rounded-xl bg-[#1A6A3B] px-4 py-2.5"
              onPress={resetFilters}
            >
              <Text className="text-xs font-bold text-white">View full menu</Text>
            </Pressable>
          ) : null}
        </View>
      )}

      {!loading && !error && filteredFoods.length > 0 ? (
        <View className="mb-2 mt-5 flex-row items-center justify-between">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Previous shop page"
            className={`h-10 flex-row items-center rounded-lg px-3 ${currentPage === 1 ? "bg-slate-100" : "bg-white"}`}
            disabled={currentPage === 1}
            onPress={() => setCurrentPage((page) => Math.max(1, page - 1))}
          >
            <ChevronLeft color={currentPage === 1 ? "#CBD5E1" : "#334155"} size={17} />
            <Text className={`text-xs font-bold ${currentPage === 1 ? "text-slate-300" : "text-slate-700"}`}>
              Previous
            </Text>
          </Pressable>
          <Text className="text-xs font-semibold text-slate-500">
            Page {currentPage} of {totalPages}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Next shop page"
            className={`h-10 flex-row items-center rounded-lg px-3 ${currentPage === totalPages ? "bg-slate-100" : "bg-white"}`}
            disabled={currentPage === totalPages}
            onPress={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
          >
            <Text className={`text-xs font-bold ${currentPage === totalPages ? "text-slate-300" : "text-slate-700"}`}>
              Next
            </Text>
            <ChevronRight color={currentPage === totalPages ? "#CBD5E1" : "#334155"} size={17} />
          </Pressable>
        </View>
      ) : null}

    </ScrollView>
    <FoodCustomizationModal
      key={selectedFood ? getFoodId(selectedFood) : "no-food-selected"}
      food={selectedFood}
      onClose={() => setSelectedFood(null)}
      onAdd={addItem}
    />
    </>
  );
}

function StatPill({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <View className="flex-row items-center rounded-lg bg-white px-3 py-2 shadow-sm">
      {icon}
      <Text className="ml-1.5 text-[10px] font-bold text-[#1A3C36]">{label}</Text>
    </View>
  );
}

function FilterHeading({ title }: { title: string }) {
  return (
    <Text className="mb-2 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
      {title}
    </Text>
  );
}

function FilterChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      className={`min-h-9 flex-row items-center rounded-lg px-3 ${selected ? "bg-[#1A6A3B]" : "bg-slate-100"}`}
      onPress={onPress}
    >
      {selected ? <Check color="#FFFFFF" size={13} /> : null}
      <Text className={`text-[11px] font-bold ${selected ? "ml-1 text-white" : "text-slate-600"}`}>
        {label}
      </Text>
    </Pressable>
  );
}

function PriceInput({
  label,
  value,
  placeholder = "0",
  onChange,
}: {
  label: string;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
}) {
  return (
    <View className="flex-1">
      <Text className="mb-1 text-[10px] font-semibold text-slate-500">{label}</Text>
      <View className="h-10 flex-row items-center rounded-lg border border-slate-200 px-2">
        <Text className="text-xs text-slate-400">₹</Text>
        <TextInput
          accessibilityLabel={label}
          className="ml-1 h-full flex-1 text-xs text-slate-800"
          keyboardType="numeric"
          placeholder={placeholder}
          placeholderTextColor="#94A3B8"
          value={value}
          onChangeText={onChange}
        />
      </View>
    </View>
  );
}

function ActiveFilter({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <View className="flex-row items-center rounded-lg bg-emerald-50 px-2.5 py-1.5">
      <Tag color="#047857" size={11} />
      <Text className="ml-1 text-[10px] font-semibold text-emerald-800" numberOfLines={1}>
        {label}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Clear ${label} filter`}
        className="ml-1"
        onPress={onClear}
        hitSlop={6}
      >
        <X color="#047857" size={12} />
      </Pressable>
    </View>
  );
}

function ViewModeButton({
  label,
  selected,
  onPress,
  icon,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  icon: ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      className={`h-8 w-9 items-center justify-center rounded-md ${selected ? "bg-[#1A6A3B]" : ""}`}
      onPress={onPress}
    >
      {icon}
    </Pressable>
  );
}
