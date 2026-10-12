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
import type { CartItem, CustomizedFoodCartInput } from "../types/food";

const CART_STORAGE_KEY = "restaurantCart";

type CartContextValue = {
  items: CartItem[];
  itemCount: number;
  isHydrated: boolean;
  addItem: (input: CustomizedFoodCartInput) => Promise<void>;
  setQuantity: (key: string, quantity: number) => Promise<void>;
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
  const [isHydrated, setIsHydrated] = useState(false);
  const itemsRef = useRef(items);
  const storageQueue = useRef<Promise<void>>(Promise.resolve());
  const hydrationPromise = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    hydrationPromise.current = AsyncStorage.getItem(CART_STORAGE_KEY)
      .then((serializedCart) => {
        if (!serializedCart) return;
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

  const itemCount = items.reduce((total, item) => total + item.quantity, 0);
  const value = useMemo(
    () => ({ items, itemCount, isHydrated, addItem, setQuantity }),
    [items, itemCount, isHydrated, addItem, setQuantity],
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
