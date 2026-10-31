import { getFoodPrice } from "./foods";
import { parseCustomizationGroups } from "./foodOptions";
import type { CustomizedFoodCartInput, FoodProduct } from "../types/food";

export function getDefaultFoodCartInput(food: FoodProduct): CustomizedFoodCartInput {
  const selectedCustomizations = parseCustomizationGroups(food.customizations)
    .filter((group) => group.required)
    .flatMap((group) => {
      const option = group.options[0];
      return option ? [{ ...option, groupName: group.name }] : [];
    });

  return {
    food,
    quantity: 1,
    unitPrice:
      getFoodPrice(food) +
      selectedCustomizations.reduce((total, option) => total + option.price, 0),
    selectedAddons: [],
    selectedCustomizations,
  };
}
