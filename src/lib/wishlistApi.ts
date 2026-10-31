import api from "./api";
import { getFoodId } from "./foods";
import type { FoodProduct } from "../types/food";

type ApiRecord = Record<string, unknown>;

function asRecord(value: unknown): ApiRecord | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as ApiRecord)
    : null;
}

function getWishlistData(value: unknown): unknown {
  const response = asRecord(value);
  if (response?.success === false) {
    throw new Error(
      typeof response.message === "string"
        ? response.message
        : "The favorites request failed.",
    );
  }
  return response?.data ?? value;
}

function normalizeWishlistFood(value: unknown): FoodProduct {
  const record = asRecord(value);
  if (!record) throw new Error("A favorite item response was invalid.");

  const id = record.food_id ?? record.product_id ?? record.id;
  const name =
    record.food_name ?? record.product_name ?? record.item_name ?? record.name;
  const image =
    record.product_image ?? record.image ?? record.thumbnail_image;
  const images = Array.isArray(record.food_images)
    ? record.food_images
    : typeof image === "string" && image
      ? [image]
      : [];

  if (
    (typeof id !== "string" && typeof id !== "number") ||
    !String(id).trim()
  ) {
    throw new Error("A favorite item did not include its food ID.");
  }

  return {
    ...record,
    id:
      typeof record.id === "string" || typeof record.id === "number"
        ? record.id
        : id,
    food_id: id,
    food_name:
      typeof name === "string" && name.trim() ? name : "Menu item",
    food_images: images,
  };
}

export async function fetchWishlist(): Promise<FoodProduct[]> {
  const data = getWishlistData((await api.get("/wishlist")).data);
  if (!Array.isArray(data)) {
    throw new Error("The favorites response was invalid.");
  }
  return data.map(normalizeWishlistFood);
}

export async function addWishlistFood(food: FoodProduct): Promise<void> {
  const foodId = getFoodId(food);
  if (!foodId) throw new Error("The selected food did not include an ID.");

  getWishlistData((await api.post("/wishlist", { food_id: foodId })).data);
}

export async function removeWishlistFood(foodId: string): Promise<void> {
  if (!foodId) throw new Error("The selected food did not include an ID.");

  getWishlistData(
    (await api.delete(`/wishlist/${encodeURIComponent(foodId)}`)).data,
  );
}
