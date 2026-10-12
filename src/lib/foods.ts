import { API_BASE_URL } from "./api";
import type { FoodProduct } from "../types/food";

export function getFoodId(food: FoodProduct): string {
  return String(food.food_id ?? food.id ?? "");
}

export function getFoodName(food: FoodProduct): string {
  return food.food_name || food.name || "Menu item";
}

export function getFoodPrice(food: FoodProduct): number {
  const price = Number(food.final_price || food.price || food.mrp || 0);
  return Number.isFinite(price) ? price : 0;
}

export function getFoodDiscountPercentage(food: FoodProduct): number {
  const mrp = Number(food.mrp ?? 0);
  const price = Number(food.final_price ?? food.mrp ?? 0);
  if (mrp <= price || mrp <= 0) return 0;

  const declaredDiscount = Number(food.discount ?? 0);
  return declaredDiscount > 0
    ? declaredDiscount
    : ((mrp - price) / mrp) * 100;
}

export function getFoodImage(food: FoodProduct): string {
  const images = Array.isArray(food.food_images) ? food.food_images : [];
  const firstImage = images[0];
  const image =
    typeof firstImage === "string"
      ? firstImage
      : typeof firstImage === "object" && firstImage !== null
        ? "image_url" in firstImage
          ? firstImage.image_url
          : "url" in firstImage
            ? firstImage.url
            : "image" in firstImage
              ? firstImage.image
              : ""
        : "";

  if (typeof image !== "string" || !image.trim()) return "";
  const value = image.trim();
  if (/^data:/i.test(value)) return value;

  const backendUrl = API_BASE_URL.replace(/\/api\/?$/i, "").replace(/\/+$/, "");
  if (/^https?:\/\//i.test(value)) {
    return value.replace(
      /^https?:\/\/(?:localhost|127(?:\.\d{1,3}){3})(?::\d+)?/i,
      backendUrl,
    );
  }

  return `${backendUrl}/${value.replace(/^\/+/, "")}`;
}

export function getMenuFoods(payload: unknown): FoodProduct[] {
  const rawFoods = Array.isArray(payload)
    ? payload
    : typeof payload === "object" && payload !== null && "data" in payload
      ? payload.data
      : payload;

  if (!Array.isArray(rawFoods)) {
    throw new Error("The menu response was invalid.");
  }

  return rawFoods.filter(
    (food): food is FoodProduct =>
      typeof food === "object" &&
      food !== null &&
      food.is_menu_visible !== false &&
      String(food.status || "Active").toLowerCase() === "active",
  );
}

export function getActiveFoods(payload: unknown): FoodProduct[] {
  return getMenuFoods(payload).filter((food) => food.is_available !== false);
}
