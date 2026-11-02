import { router, usePathname } from "expo-router";
import { useCallback } from "react";
import { getFoodId } from "../lib/foods";
import type { FoodProduct } from "../types/food";

export function useProductNavigation() {
  const pathname = usePathname();

  return useCallback(
    (food: FoodProduct) => {
      const foodId = getFoodId(food);
      if (!foodId) {
        console.error("Could not open food details: the item has no ID.");
        return;
      }

      const isOnProductPage = pathname.startsWith("/UsersTab/product/");

      if (isOnProductPage) {
        // Already on a product page — replace so back() returns to the previous screen
        router.replace({
          pathname: "/UsersTab/product/[id]",
          params: { id: foodId },
        });
      } else {
        router.push({
          pathname: "/UsersTab/product/[id]",
          params: { id: foodId },
        });
      }
    },
    [pathname],
  );
}
