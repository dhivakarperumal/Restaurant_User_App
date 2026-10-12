import api, { getStoredUser } from "./api";
import { getFoodId, getFoodImage, getFoodName, getFoodPrice } from "./foods";
import type {
  CartItem,
  CustomizedFoodCartInput,
  FoodOption,
  FoodProduct,
} from "../types/food";

type UserProfile = Record<string, unknown>;

export type CartAccount = {
  id: string;
  name: string;
  email: string;
  phone: string;
};

function asRecord(value: unknown): UserProfile | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as UserProfile)
    : null;
}

function firstString(record: UserProfile, keys: string[]): string {
  for (const key of keys) {
    const value = record[key];
    if ((typeof value === "string" || typeof value === "number") && String(value).trim()) {
      return String(value).trim();
    }
  }
  return "";
}

function getProfileRecord(value: unknown): UserProfile | null {
  const record = asRecord(value);
  if (!record) return null;
  return asRecord(record.user) ?? asRecord(record.data) ?? record;
}

export async function getCartAccount(): Promise<CartAccount | null> {
  const profile = getProfileRecord(await getStoredUser());
  if (!profile) return null;

  const id = firstString(profile, ["user_id", "userId", "id", "_id"]);
  if (!id) return null;

  const firstName = firstString(profile, ["first_name", "firstName"]);
  const lastName = firstString(profile, ["last_name", "lastName"]);
  return {
    id,
    name:
      firstString(profile, ["name", "full_name", "fullName", "username"]) ||
      [firstName, lastName].filter(Boolean).join(" "),
    email: firstString(profile, ["email", "email_address"]),
    phone: firstString(profile, ["mobile_number", "phone", "phone_number"]),
  };
}

function parseJson(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function parseOptions(value: unknown, defaultGroup?: string): FoodOption[] {
  const parsed = parseJson(value);
  if (Array.isArray(parsed)) {
    return parsed.flatMap((entry) => {
      if (typeof entry === "string") {
        return [{ id: entry, name: entry, price: 0, groupName: defaultGroup }];
      }
      const option = asRecord(entry);
      if (!option) return [];
      const name = firstString(option, ["name", "option_name", "addon_name", "value"]);
      if (!name) return [];
      return [{
        id: firstString(option, ["id", "option_id", "addon_id"]) || name,
        name,
        price: Number(option.price ?? option.additional_price ?? 0) || 0,
        groupName: defaultGroup,
      }];
    });
  }

  const record = asRecord(parsed);
  if (!record) return [];
  return Object.entries(record).flatMap(([groupName, selection]) =>
    parseOptions(Array.isArray(selection) ? selection : [selection], groupName),
  );
}

function getCartResponseItems(responseData: unknown): unknown[] {
  const response = asRecord(responseData);
  const data = response?.data ?? responseData;
  if (Array.isArray(data)) return data;
  const nested = asRecord(data);
  if (Array.isArray(nested?.items)) return nested.items;
  throw new Error("The cart response was invalid.");
}

function normalizeCartItem(value: unknown): CartItem {
  const record = asRecord(value);
  if (!record) throw new Error("A cart item response was invalid.");

  const serverId = firstString(record, ["id", "cart_id", "cart_item_id", "_id"]);
  if (!serverId) throw new Error("A cart item did not include its server ID.");

  const nestedFood =
    asRecord(record.food) ??
    asRecord(record.product) ??
    {};
  const foodId = firstString(record, ["food_id", "product_id"]) ||
    firstString(nestedFood, ["food_id", "product_id", "id", "_id"]);
  const name =
    firstString(record, ["product_name", "food_name", "name"]) ||
    firstString(nestedFood, ["food_name", "product_name", "name"]) ||
    "Restaurant item";
  const image =
    firstString(record, ["product_image", "image", "thumbnail_image"]) ||
    firstString(nestedFood, ["product_image", "image", "thumbnail_image"]);
  const unitPrice = Number(record.unit_price ?? record.price ?? nestedFood.final_price ?? 0);
  const food: FoodProduct = {
    ...nestedFood,
    id: foodId || nestedFood.id as string | number | undefined,
    food_id: foodId || nestedFood.food_id as string | number | undefined,
    food_name: name,
    name,
    final_price: Number.isFinite(unitPrice) ? unitPrice : 0,
    price: Number.isFinite(unitPrice) ? unitPrice : 0,
    portion_size:
      firstString(record, ["portion_size", "size"]) ||
      firstString(nestedFood, ["portion_size"]),
    food_images: image
      ? [image]
      : Array.isArray(nestedFood.food_images)
        ? nestedFood.food_images
        : [],
  };

  return {
    key: serverId,
    serverId,
    food,
    quantity: Math.max(1, Number(record.quantity) || 1),
    unitPrice: Number.isFinite(unitPrice) ? unitPrice : getFoodPrice(food),
    selectedAddons: parseOptions(record.selected_addons ?? record.selectedAddons),
    selectedCustomizations: parseOptions(
      record.selected_customizations ?? record.selectedCustomizations,
    ),
  };
}

export async function fetchCart(userId: string): Promise<CartItem[]> {
  const response = await api.get(`/cart/${encodeURIComponent(userId)}`);
  return getCartResponseItems(response.data).map(normalizeCartItem);
}

export async function addCartItem(
  account: CartAccount,
  input: CustomizedFoodCartInput,
): Promise<void> {
  const foodId = getFoodId(input.food);
  if (!foodId) throw new Error("The selected food did not include an ID.");

  const selectedCustomizations = input.selectedCustomizations.reduce<
    Record<string, string[]>
  >((groups, option) => {
    const groupName = option.groupName || "Customizations";
    groups[groupName] = [...(groups[groupName] ?? []), option.name];
    return groups;
  }, {});

  await api.post("/cart", {
    user_id: account.id,
    food_id: foodId,
    product_id: foodId,
    product_name: getFoodName(input.food),
    food_name: getFoodName(input.food),
    product_image: getFoodImage(input.food),
    price: input.unitPrice,
    quantity: input.quantity,
    total_price: input.unitPrice * input.quantity,
    portion_size: input.food.portion_size || "Standard",
    selected_addons: input.selectedAddons.map((option) => option.name),
    selected_customizations: selectedCustomizations,
    customer_name: account.name,
    customer_email: account.email,
    customer_phone: account.phone,
  });
}

export async function updateCartItem(
  item: CartItem,
  quantity: number,
): Promise<void> {
  if (quantity <= 0) {
    await api.delete(`/cart/${encodeURIComponent(item.serverId)}`);
    return;
  }
  await api.put(`/cart/${encodeURIComponent(item.serverId)}`, {
    quantity,
    price: item.unitPrice,
  });
}

export async function removeCartItem(item: CartItem): Promise<void> {
  await api.delete(`/cart/${encodeURIComponent(item.serverId)}`);
}

export async function clearRemoteCart(userId: string): Promise<void> {
  await api.delete(`/cart/clear/${encodeURIComponent(userId)}`);
}
