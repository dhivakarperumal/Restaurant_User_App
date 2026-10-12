import AsyncStorage from "@react-native-async-storage/async-storage";
import api from "./api";
import type { CartItem } from "../types/food";

export type CheckoutAddress = {
  id?: string | number;
  address_line: string;
  area_locality: string;
  city: string;
  state: string;
  pincode: string;
  landmark: string;
};

export type CheckoutCustomer = {
  name: string;
  phone: string;
  email: string;
};

export type CheckoutPayload = {
  customer: CheckoutCustomer;
  order_type: "home_delivery" | "pickup";
  address: CheckoutAddress | null;
  payment_method: "cod" | "online";
};

export type CheckoutOrder = {
  order_number: string;
  payment_method?: "cod" | "online";
  completed?: boolean;
  razorpay?: {
    key_id: string;
    order_id: string;
    amount: number | string;
    currency: string;
  };
};

type ApiRecord = Record<string, unknown>;

function asRecord(value: unknown): ApiRecord | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as ApiRecord)
    : null;
}

function getText(record: ApiRecord, key: string): string {
  const value = record[key];
  return typeof value === "string" || typeof value === "number"
    ? String(value)
    : "";
}

function normalizeAddress(value: unknown): CheckoutAddress | null {
  const record = asRecord(value);
  if (!record) return null;

  return {
    id:
      typeof record.id === "string" || typeof record.id === "number"
        ? record.id
        : undefined,
    address_line: getText(record, "address_line"),
    area_locality: getText(record, "area_locality"),
    city: getText(record, "city"),
    state: getText(record, "state"),
    pincode: getText(record, "pincode"),
    landmark: getText(record, "landmark"),
  };
}

export async function fetchSavedAddresses(): Promise<CheckoutAddress[]> {
  const response = await api.get("/orders/addresses");
  const body = asRecord(response.data);
  const addresses = body?.data;
  if (!Array.isArray(addresses)) {
    throw new Error("The saved-address response was invalid.");
  }

  return addresses.flatMap((address) => {
    const normalized = normalizeAddress(address);
    return normalized ? [normalized] : [];
  });
}

function getCartFingerprintItems(cart: CartItem[]) {
  return cart.map((item) => ({
    id: item.serverId,
    quantity: item.quantity,
    selected_addons: item.selectedAddons.map((option) => ({
      id: option.id,
      name: option.name,
    })),
    selected_customizations: item.selectedCustomizations.map((option) => ({
      id: option.id,
      name: option.name,
      groupName: option.groupName,
    })),
  }));
}

function createIdempotencyKey(): string {
  const segment = (length: number) =>
    Array.from({ length }, () => Math.floor(Math.random() * 16).toString(16))
      .join("");
  return `${segment(8)}-${segment(4)}-4${segment(3)}-${(
    8 + Math.floor(Math.random() * 4)
  ).toString(16)}${segment(3)}-${segment(12)}`;
}

export async function getCheckoutIdempotencyKey(
  userId: string,
  cart: CartItem[],
  payload: CheckoutPayload,
): Promise<{ idempotencyKey: string; storageKey: string }> {
  const fingerprint = JSON.stringify({
    userId,
    cart: getCartFingerprintItems(cart),
    payload,
  });
  const storageKey = `restaurant-checkout:${userId}`;
  const stored = await AsyncStorage.getItem(storageKey);
  let parsed: unknown;
  try {
    parsed = stored ? JSON.parse(stored) : null;
  } catch {
    parsed = null;
  }

  const storedRequest = asRecord(parsed);
  const existingKey = getText(storedRequest ?? {}, "idempotencyKey");
  if (
    storedRequest?.fingerprint === fingerprint &&
    existingKey
  ) {
    return { idempotencyKey: existingKey, storageKey };
  }

  const idempotencyKey = createIdempotencyKey();
  await AsyncStorage.setItem(
    storageKey,
    JSON.stringify({ fingerprint, idempotencyKey }),
  );
  return { idempotencyKey, storageKey };
}

export async function clearCheckoutIdempotencyKey(
  storageKey: string,
): Promise<void> {
  await AsyncStorage.removeItem(storageKey);
}

export async function createOrder(
  payload: CheckoutPayload,
  idempotencyKey: string,
): Promise<{ success: boolean; message?: string; data?: CheckoutOrder }> {
  const response = await api.post("/orders", payload, {
    headers: { "Idempotency-Key": idempotencyKey },
  });
  const body = asRecord(response.data);
  const data = asRecord(body?.data);
  const razorpay = asRecord(data?.razorpay);

  return {
    success: body?.success === true,
    message: getText(body ?? {}, "message"),
    data: data
      ? {
          order_number: getText(data, "order_number"),
          payment_method:
            data.payment_method === "online" || data.payment_method === "cod"
              ? data.payment_method
              : undefined,
          completed: data.completed === true,
          razorpay: razorpay
            ? {
                key_id: getText(razorpay, "key_id"),
                order_id: getText(razorpay, "order_id"),
                amount:
                  typeof razorpay.amount === "string" ||
                  typeof razorpay.amount === "number"
                    ? razorpay.amount
                    : "",
                currency: getText(razorpay, "currency"),
              }
            : undefined,
        }
      : undefined,
  };
}

export async function verifyOrderPayment(input: {
  order_number: string;
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}): Promise<{ success: boolean; message?: string }> {
  const response = await api.post("/orders/verify-payment", input);
  const body = asRecord(response.data);
  return {
    success: body?.success === true,
    message: getText(body ?? {}, "message"),
  };
}
