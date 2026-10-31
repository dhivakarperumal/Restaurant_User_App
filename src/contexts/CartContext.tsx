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
import {
  addWishlistFood,
  fetchWishlist,
  removeWishlistFood,
} from "../lib/wishlistApi";
import type {
  CartItem,
  CustomizedFoodCartInput,
  FoodProduct,
} from "../types/food";

type CartContextValue = {
  items: CartItem[];
  itemCount: number;
  isHydrated: boolean;
  isCartLoading: boolean;
  cartError: string;
  wishlist: FoodProduct[];
  isWishlistLoading: boolean;
  wishlistError: string;
  refreshWishlist: () => Promise<void>;
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
  const [isWishlistLoading, setIsWishlistLoading] = useState(false);
  const [wishlistError, setWishlistError] = useState("");
  const [isHydrated, setIsHydrated] = useState(false);
  const [isCartLoading, setIsCartLoading] = useState(false);
  const [cartError, setCartError] = useState("");
  const itemsRef = useRef(items);
  const wishlistRef = useRef(wishlist);
  const wishlistAccountIdRef = useRef("");
  const wishlistLoadVersion = useRef(0);
  const wishlistOperationQueue = useRef<Promise<void>>(Promise.resolve());
  const accountIdRef = useRef("");
  const accountLoadPromise = useRef<Promise<void>>(Promise.resolve());

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

  const commitWishlist = useCallback((nextWishlist: FoodProduct[]) => {
    wishlistRef.current = nextWishlist;
    setWishlist(nextWishlist);
  }, []);

  const loadWishlist = useCallback(async () => {
    const account = await getCartAccount();
    const accountId = account?.id ?? "";
    if (wishlistAccountIdRef.current !== accountId) {
      commitWishlist([]);
    }
    wishlistAccountIdRef.current = accountId;
    const requestVersion = ++wishlistLoadVersion.current;

    if (!account) {
      commitWishlist([]);
      setWishlistError("");
      setIsWishlistLoading(false);
      return;
    }

    setIsWishlistLoading(true);
    setWishlistError("");
    try {
      const nextWishlist = await fetchWishlist();
      if (
        wishlistLoadVersion.current === requestVersion &&
        wishlistAccountIdRef.current === accountId
      ) {
        commitWishlist(nextWishlist);
      }
    } catch (error) {
      console.error("Failed to load the signed-in user's favorites:", error);
      if (
        wishlistLoadVersion.current === requestVersion &&
        wishlistAccountIdRef.current === accountId
      ) {
        setWishlistError("We could not load your favorites. Please try again.");
      }
      throw error;
    } finally {
      if (wishlistLoadVersion.current === requestVersion) {
        setIsWishlistLoading(false);
      }
    }
  }, [commitWishlist]);

  useEffect(() => {
    const loadingCart = loadCart();
    accountLoadPromise.current = loadingCart.catch(() => undefined);
    void loadWishlist().catch(() => undefined);
  }, [loadCart, loadWishlist, pathname]);

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

  const toggleWishlist = useCallback(
    async (food: FoodProduct) => {
      const operation = wishlistOperationQueue.current
        .catch(() => undefined)
        .then(async () => {
          await accountLoadPromise.current;
          const account = await getCartAccount();
          if (!account) {
            throw new Error("Please log in before changing your favorites.");
          }
          if (wishlistAccountIdRef.current !== account.id) {
            await loadWishlist();
          }

          const foodId = getFoodId(food);
          if (!foodId) {
            throw new Error("The selected food did not include an ID.");
          }

          const previousWishlist = wishlistRef.current;
          const isInWishlist = previousWishlist.some(
            (item) => getFoodId(item) === foodId,
          );
          const nextWishlist = isInWishlist
            ? previousWishlist.filter((item) => getFoodId(item) !== foodId)
            : [...previousWishlist, food];
          const requestVersion = ++wishlistLoadVersion.current;
          setIsWishlistLoading(false);
          commitWishlist(nextWishlist);

          try {
            if (isInWishlist) {
              await removeWishlistFood(foodId);
            } else {
              await addWishlistFood(food);
            }
            setWishlistError("");
          } catch (error) {
            console.error("Failed to update favorites:", error);
            if (wishlistLoadVersion.current === requestVersion) {
              commitWishlist(previousWishlist);
            }
            throw error;
          }
        });
      wishlistOperationQueue.current = operation;
      await operation;
    },
    [commitWishlist, loadWishlist],
  );

  const itemCount = items.reduce((total, item) => total + item.quantity, 0);
  const value = useMemo(
    () => ({
      items,
      itemCount,
      isHydrated,
      isCartLoading,
      cartError,
      wishlist,
      isWishlistLoading,
      wishlistError,
      refreshWishlist: loadWishlist,
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
      isWishlistLoading,
      wishlistError,
      loadWishlist,
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
