import AsyncStorage from "@react-native-async-storage/async-storage";
import { usePathname } from "expo-router";
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
import {
  addCartItem,
  clearRemoteCart,
  fetchCart,
  getCartAccount,
  removeCartItem,
  updateCartItem,
} from "../lib/cartApi";
import type {
  CartItem,
  CustomizedFoodCartInput,
  FoodProduct,
} from "../types/food";

const WISHLIST_STORAGE_KEY = "restaurantWishlist";

type CartContextValue = {
  items: CartItem[];
  itemCount: number;
  isHydrated: boolean;
  isCartLoading: boolean;
  cartError: string;
  wishlist: FoodProduct[];
  buyNowItem: CustomizedFoodCartInput | null;
  addItem: (input: CustomizedFoodCartInput) => Promise<void>;
  setBuyNowItem: (input: CustomizedFoodCartInput | null) => void;
  setQuantity: (key: string, quantity: number) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
  clearCart: () => Promise<void>;
  refreshCart: () => Promise<void>;
  toggleWishlist: (food: FoodProduct) => Promise<void>;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [items, setItems] = useState<CartItem[]>([]);
  const [buyNowItem, setBuyNowItem] =
    useState<CustomizedFoodCartInput | null>(null);
  const [wishlist, setWishlist] = useState<FoodProduct[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);
  const [isCartLoading, setIsCartLoading] = useState(false);
  const [cartError, setCartError] = useState("");
  const itemsRef = useRef(items);
  const wishlistRef = useRef(wishlist);
  const accountIdRef = useRef("");
  const accountLoadPromise = useRef<Promise<void>>(Promise.resolve());
  const wishlistStorageQueue = useRef<Promise<void>>(Promise.resolve());

  const commitItems = useCallback((nextItems: CartItem[]) => {
    itemsRef.current = nextItems;
    setItems(nextItems);
  }, []);

  const loadCart = useCallback(
    async (force = false) => {
      const account = await getCartAccount();
      if (!force && account?.id === accountIdRef.current) return;

      accountIdRef.current = account?.id ?? "";
      setCartError("");
      setIsCartLoading(Boolean(account));
      commitItems([]);

      if (!account) {
        setIsCartLoading(false);
        setIsHydrated(true);
        return;
      }

      try {
        const nextItems = await fetchCart(account.id);
        if (accountIdRef.current === account.id) {
          commitItems(nextItems);
        }
      } catch (error) {
        console.error("Failed to load the signed-in user's cart:", error);
        if (accountIdRef.current === account.id) {
          setCartError("We could not load your cart. Please try again.");
        }
        throw error;
      } finally {
        if (accountIdRef.current === account.id) {
          setIsCartLoading(false);
          setIsHydrated(true);
        }
      }
    },
    [commitItems],
  );

  useEffect(() => {
    const loadingCart = loadCart();
    accountLoadPromise.current = loadingCart.catch(() => undefined);
  }, [loadCart, pathname]);

  useEffect(() => {
    void AsyncStorage.getItem(WISHLIST_STORAGE_KEY)
      .then((serializedWishlist) => {
        if (!serializedWishlist) return;
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
      })
      .catch((error: unknown) => {
        console.error("Failed to restore saved wishlist:", error);
      });
  }, []);

  const addItem = useCallback(
    async (input: CustomizedFoodCartInput) => {
      await accountLoadPromise.current;
      const account = await getCartAccount();
      if (!account || account.id !== accountIdRef.current) {
        throw new Error("Please log in before adding items to your cart.");
      }
      await addCartItem(account, input);
      await loadCart(true);
    },
    [loadCart],
  );

  const requireCartAccount = useCallback(async () => {
    await accountLoadPromise.current;
    const account = await getCartAccount();
    if (!account || account.id !== accountIdRef.current) {
      throw new Error("Please log in before changing your cart.");
    }
    return account;
  }, []);

  const removeItem = useCallback(
    async (key: string) => {
      await requireCartAccount();
      const item = itemsRef.current.find((cartItem) => cartItem.key === key);
      if (!item) return;
      await removeCartItem(item);
      await loadCart(true);
    },
    [loadCart, requireCartAccount],
  );

  const clearCart = useCallback(async () => {
    await accountLoadPromise.current;
    const account = await getCartAccount();
    if (!account || account.id !== accountIdRef.current) {
      throw new Error("Please log in to clear your cart.");
    }
    await clearRemoteCart(account.id);
    commitItems([]);
    setCartError("");
  }, [commitItems]);

  const refreshCart = useCallback(async () => {
    await loadCart(true);
  }, [loadCart]);

  const updateQuantityForAccount = useCallback(
    async (key: string, quantity: number) => {
      await requireCartAccount();
      const item = itemsRef.current.find((cartItem) => cartItem.key === key);
      if (!item) return;
      await updateCartItem(item, quantity);
      await loadCart(true);
    },
    [loadCart, requireCartAccount],
  );

  const toggleWishlist = useCallback(async (food: FoodProduct) => {
    await accountLoadPromise.current;
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
      isCartLoading,
      cartError,
      wishlist,
      buyNowItem,
      addItem,
      setBuyNowItem,
      setQuantity: updateQuantityForAccount,
      removeItem,
      clearCart,
      refreshCart,
      toggleWishlist,
    }),
    [
      items,
      itemCount,
      isHydrated,
      isCartLoading,
      cartError,
      wishlist,
      buyNowItem,
      addItem,
      setBuyNowItem,
      updateQuantityForAccount,
      removeItem,
      clearCart,
      refreshCart,
      toggleWishlist,
    ],
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
