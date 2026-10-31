import { router } from "expo-router";
import { useCallback } from "react";
import { getFoodId } from "../lib/foods";
import type { FoodProduct } from "../types/food";

export function useProductNavigation() {
  return useCallback(
    (food: FoodProduct) => {
      const foodId = getFoodId(food);
      if (!foodId) {
        console.error("Could not open food details: the item has no ID.");
        return;
      }

      router.push({
        pathname: "/UsersTab/product/[id]",
        params: { id: foodId },
      });
    },
    [],
  );
}
