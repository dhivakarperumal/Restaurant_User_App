import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { getFoodId } from "../lib/foods";
import type {
  CartItem,
  CustomizedFoodCartInput,
  FoodProduct,
} from "../types/food";

const CART_STORAGE_KEY = "restaurantCart";
const WISHLIST_STORAGE_KEY = "restaurantWishlist";

type CartContextValue = {
  items: CartItem[];
  itemCount: number;
  isHydrated: boolean;
  wishlist: FoodProduct[];
  addItem: (input: CustomizedFoodCartInput) => Promise<void>;
  setQuantity: (key: string, quantity: number) => Promise<void>;
  toggleWishlist: (food: FoodProduct) => Promise<void>;
};

const CartContext = createContext<CartContextValue | null>(null);

function getCartItemKey(input: CustomizedFoodCartInput): string {
  const optionIds = (options: CustomizedFoodCartInput["selectedAddons"]) =>
    options.map((option) => option.id).sort();
  return JSON.stringify([
    getFoodId(input.food),
    optionIds(input.selectedAddons),
    optionIds(input.selectedCustomizations),
  ]);
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [wishlist, setWishlist] = useState<FoodProduct[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);
  const itemsRef = useRef(items);
  const wishlistRef = useRef(wishlist);
  const storageQueue = useRef<Promise<void>>(Promise.resolve());
  const wishlistStorageQueue = useRef<Promise<void>>(Promise.resolve());
  const hydrationPromise = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    hydrationPromise.current = Promise.all([
      AsyncStorage.getItem(CART_STORAGE_KEY),
      AsyncStorage.getItem(WISHLIST_STORAGE_KEY),
    ])
      .then(([serializedCart, serializedWishlist]) => {
        if (serializedCart) {
          const storedCart: unknown = JSON.parse(serializedCart);
          if (!Array.isArray(storedCart)) {
            throw new Error("Saved cart data was invalid.");
          }

          const validItems = storedCart.filter(
            (item): item is CartItem =>
              typeof item === "object" &&
              item !== null &&
              typeof item.key === "string" &&
              typeof item.quantity === "number" &&
              typeof item.unitPrice === "number" &&
              typeof item.food === "object" &&
              item.food !== null &&
              Array.isArray(item.selectedAddons) &&
              Array.isArray(item.selectedCustomizations),
          );
          itemsRef.current = validItems;
          setItems(validItems);
        }

        if (serializedWishlist) {
          const storedWishlist: unknown = JSON.parse(serializedWishlist);
          if (!Array.isArray(storedWishlist)) {
            throw new Error("Saved wishlist data was invalid.");
          }
          const validWishlist = storedWishlist.filter(
            (food): food is FoodProduct =>
              typeof food === "object" && food !== null,
          );
          wishlistRef.current = validWishlist;
          setWishlist(validWishlist);
        }
      })
      .catch((error: unknown) => {
        console.error("Failed to restore saved cart:", error);
      })
      .finally(() => {
        setIsHydrated(true);
      });
  }, []);

  const commitItems = useCallback((nextItems: CartItem[]) => {
    itemsRef.current = nextItems;
    setItems(nextItems);

    const write = storageQueue.current
      .catch(() => undefined)
      .then(async () => {
        try {
          await AsyncStorage.setItem(CART_STORAGE_KEY, JSON.stringify(nextItems));
        } catch (error) {
          console.error("Failed to save cart:", error);
          throw error;
        }
      });
    storageQueue.current = write;
    return write;
  }, []);

  const addItem = useCallback(
    async (input: CustomizedFoodCartInput) => {
      await hydrationPromise.current;
      const key = getCartItemKey(input);
      const existingItem = itemsRef.current.find((item) => item.key === key);
      const nextItems = existingItem
        ? itemsRef.current.map((item) =>
            item.key === key ? { ...item, quantity: item.quantity + input.quantity } : item,
          )
        : [
            ...itemsRef.current,
            {
              ...input,
              key,
            },
          ];
      await commitItems(nextItems);
    },
    [commitItems],
  );

  const setQuantity = useCallback(
    async (key: string, quantity: number) => {
      await hydrationPromise.current;
      const nextItems =
        quantity <= 0
          ? itemsRef.current.filter((item) => item.key !== key)
          : itemsRef.current.map((item) =>
              item.key === key ? { ...item, quantity } : item,
            );
      await commitItems(nextItems);
    },
    [commitItems],
  );

  const toggleWishlist = useCallback(async (food: FoodProduct) => {
    await hydrationPromise.current;
    const foodId = getFoodId(food);
    const isInWishlist = wishlistRef.current.some(
      (item) => getFoodId(item) === foodId,
    );
    const previousWishlist = wishlistRef.current;
    const nextWishlist = isInWishlist
      ? wishlistRef.current.filter((item) => getFoodId(item) !== foodId)
      : [...wishlistRef.current, food];
    wishlistRef.current = nextWishlist;
    setWishlist(nextWishlist);

    const write = wishlistStorageQueue.current
      .catch(() => undefined)
      .then(async () => {
        try {
          await AsyncStorage.setItem(
            WISHLIST_STORAGE_KEY,
            JSON.stringify(nextWishlist),
          );
        } catch (error) {
          console.error("Failed to save wishlist:", error);
          if (wishlistRef.current === nextWishlist) {
            wishlistRef.current = previousWishlist;
            setWishlist(previousWishlist);
          }
          throw error;
        }
      });
    wishlistStorageQueue.current = write;
    await write;
  }, []);

  const itemCount = items.reduce((total, item) => total + item.quantity, 0);
  const value = useMemo(
    () => ({
      items,
      itemCount,
      isHydrated,
      wishlist,
      addItem,
      setQuantity,
      toggleWishlist,
    }),
    [items, itemCount, isHydrated, wishlist, addItem, setQuantity, toggleWishlist],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider.");
  }
  return context;
}
