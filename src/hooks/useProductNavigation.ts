import { useNavigation } from "expo-router";
import { useCallback } from "react";
import { getFoodId } from "../lib/foods";
import type { FoodProduct } from "../types/food";

type ProductNavigation = {
  navigate: (route: "product/[id]", params: { id: string }) => void;
};

export function useProductNavigation() {
  const navigation = useNavigation<ProductNavigation>();

  return useCallback(
    (food: FoodProduct) => {
      const foodId = getFoodId(food);
      if (!foodId) {
        console.error("Could not open food details: the item has no ID.");
        return;
      }

      navigation.navigate("product/[id]", { id: foodId });
    },
    [navigation],
  );
}
