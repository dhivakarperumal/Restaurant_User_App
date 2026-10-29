import {
    ArrowRight,
    CalendarDays,
    CheckCircle2,
    CircleX,
    CookingPot,
    MapPin,
    Package,
    Search,
    ShoppingBag,
    Truck,
    Utensils,
    X,
} from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Image,
    Modal,
    Pressable,
    RefreshControl,
    ScrollView,
    Text,
    TextInput,
    View,
} from "react-native";
import api, { API_BASE_URL, getApiErrorMessage } from "../../lib/api";

const ORDER_FILTERS = [
  "All Orders",
  "Order Placed",
  "Preparing",
  "Ready",
  "Assigned",
  "Delivered",
  "Cancelled",
] as const;
const ORDERS_PER_PAGE = 5;
const TRACKING_STATUSES = ["Order Placed", "Preparing", "Ready", "Assigned", "Delivered"];

type OrderFilter = (typeof ORDER_FILTERS)[number];
type OrderItem = Record<string, unknown>;
type OrderRecord = Record<string, unknown> & {
  order_id: string;
  items: OrderItem[];
  item_count: number;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function getText(record: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" || typeof value === "number") {
      const text = String(value).trim();
      if (text) return text;
    }
  }
  return "";
}

function getNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeOrder(value: unknown): OrderRecord | null {
  const record = asRecord(value);
  if (!record) return null;

  const orderId = getText(record, ["order_number", "order_id", "id"]);
  if (!orderId) return null;

  const items = Array.isArray(record.items)
    ? record.items.flatMap((item) => {
        const itemRecord = asRecord(item);
        return itemRecord ? [itemRecord] : [];
      })
    : [];
  const itemCount =
    getNumber(record.item_count) ||
    items.reduce((count, item) => count + (getNumber(item.quantity) || 1), 0);

  return { ...record, order_id: orderId, items, item_count: itemCount };
}

async function fetchOrders(): Promise<OrderRecord[]> {
  const response = await api.get("/orders/mine");
  const body = asRecord(response.data);
  const records = Array.isArray(response.data)
    ? response.data
    : Array.isArray(body?.data)
      ? body.data
      : Array.isArray(body?.orders)
        ? body.orders
        : null;
  if (!records) throw new Error("The orders response was invalid.");

  const uniqueOrders = new Map<string, OrderRecord>();
  records.forEach((record) => {
    const order = normalizeOrder(record);
    if (order && !uniqueOrders.has(order.order_id)) {
      uniqueOrders.set(order.order_id, order);
    }
  });
  return [...uniqueOrders.values()];
}

async function fetchOrderDetails(orderId: string): Promise<OrderRecord> {
  const response = await api.get(
    `/orders/mine/${encodeURIComponent(orderId)}`,
  );
  const body = asRecord(response.data);
  const order = normalizeOrder(body?.data);
  if (!order) throw new Error("The order details response was invalid.");
  return order;
}

function normalizeStatus(status: unknown): string {
  return String(status || "processing")
    .trim()
    .toLowerCase()
    .replace(/_/g, " ");
}

function getOrderFilterGroup(status: unknown): Exclude<OrderFilter, "All Orders"> {
  const normalized = normalizeStatus(status);
  if (["cancelled", "returned", "payment failed"].includes(normalized)) return "Cancelled";
  if (["delivered", "completed"].includes(normalized)) return "Delivered";
  if (["assigned", "out for delivery", "shipped"].includes(normalized)) return "Assigned";
  if (["ready", "ready to serve"].includes(normalized)) return "Ready";
  if (normalized === "preparing") return "Preparing";
  return "Order Placed";
}

function getStatusStyle(status: string): string {
  switch (status) {
    case "Delivered":
      return "border-[#CFE3C4] bg-[#EAF4E4] text-[#075B20]";
    case "Assigned":
      return "border-[#CFDDFF] bg-[#EDF3FF] text-[#1749C6]";
    case "Cancelled":
      return "border-[#F6D1D9] bg-[#FFF0F2] text-[#C51D42]";
    default:
      return "border-[#F1D889] bg-[#FFF6D8] text-[#A85B00]";
  }
}

function getStatusColor(status: string): string {
  switch (status) {
    case "Delivered":
      return "#075B20";
    case "Assigned":
      return "#1749C6";
    case "Cancelled":
      return "#C51D42";
    default:
      return "#A85B00";
  }
}

function getOrderDate(order: OrderRecord): Date | null {
  const rawDate = getText(order, ["created_at", "order_date"]);
  if (!rawDate) return null;
  const date = new Date(rawDate);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(date: Date | null): string {
  return date
    ? date.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "Recent";
}

function formatMoney(value: unknown): string {
  return getNumber(value).toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

function resolveImageUrl(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) return "";
  const image = value.trim();
  if (/^(data:|blob:|https?:\/\/)/i.test(image)) return image;
  const baseUrl = API_BASE_URL.replace(/\/api\/?$/, "");
  return `${baseUrl}${image.startsWith("/") ? image : `/${image}`}`;
}

function getItemImage(item: OrderItem): string {
  const foodImages = item.food_images;
  const firstFoodImage = Array.isArray(foodImages) ? foodImages[0] : "";
  return resolveImageUrl(item.product_image || item.image || firstFoodImage);
}

function getItemName(item: OrderItem): string {
  return getText(item, ["product_name", "food_name", "name"]) || "Food item";
}

function getItemTotal(item: OrderItem): number {
  const total = getNumber(item.total_price);
  return total || getNumber(item.price) * (getNumber(item.quantity) || 1);
}

function getOrderItemsTotal(order: OrderRecord): number {
  return order.items.reduce((total, item) => total + getItemTotal(item), 0);
}

function getOrderTotal(order: OrderRecord): number {
  return getNumber(order.total_amount) || getOrderItemsTotal(order);
}

function OrderStatusBadge({ status }: { status: string }) {
  const Icon =
    status === "Delivered" || status === "Ready"
      ? CheckCircle2
      : status === "Assigned"
        ? Truck
        : status === "Cancelled"
          ? CircleX
          : CookingPot;

  return (
    <View
      className={`flex-row items-center self-start rounded-full border px-3 py-1.5 ${getStatusStyle(status)}`}
    >
      <Icon color={getStatusColor(status)} size={14} />
      <Text className="ml-1.5 text-xs font-bold">{status}</Text>
    </View>
  );
}

function OrderDetailsModal({
  order,
  onClose,
  onOrderUpdated,
}: {
  order: OrderRecord | null;
  onClose: () => void;
  onOrderUpdated: (order: OrderRecord) => void;
}) {
  const [details, setDetails] = useState<OrderRecord | null>(order);
  const [errorMessage, setErrorMessage] = useState("");
  const orderId = order?.order_id;

  const refreshDetails = useCallback(
    async () => {
      if (!orderId) return;
      try {
        const refreshed = await fetchOrderDetails(orderId);
        setDetails(refreshed);
        setErrorMessage("");
        onOrderUpdated(refreshed);
      } catch (error) {
        setErrorMessage(getApiErrorMessage(error, "Could not load order details."));
      }
    },
    [onOrderUpdated, orderId],
  );

  useEffect(() => {
    if (!orderId) return;
    let active = true;
    const refresh = () => {
      void fetchOrderDetails(orderId)
        .then((refreshed) => {
          if (!active) return;
          setDetails(refreshed);
          setErrorMessage("");
          onOrderUpdated(refreshed);
        })
        .catch((error) => {
          if (active) {
            setErrorMessage(
              getApiErrorMessage(error, "Could not load order details."),
            );
          }
        });
    };
    refresh();
    const intervalId = setInterval(refresh, 10000);
    return () => {
      active = false;
      clearInterval(intervalId);
    };
  }, [onOrderUpdated, orderId]);

  if (!order) return null;

  const currentOrder = details || order;
  const statusGroup = getOrderFilterGroup(currentOrder.order_status);
  const date = getOrderDate(currentOrder);
  const address = asRecord(currentOrder.address) || asRecord(currentOrder.delivery_address);
  const addressLines = address
    ? [
        getText(address, ["address_line", "address_line1", "door_number"]),
        getText(address, ["area_locality", "address_line2", "street_name"]),
        [
          getText(address, ["city"]),
          getText(address, ["state"]),
          getText(address, ["pincode"]),
        ]
          .filter(Boolean)
          .join(", "),
      ].filter(Boolean)
    : [];
  const cancelled = statusGroup === "Cancelled";
  const currentStep = TRACKING_STATUSES.indexOf(statusGroup);
  const subtotal = getNumber(currentOrder.subtotal) || getOrderItemsTotal(currentOrder);
  const tax =
    getNumber(currentOrder.tax_amount) || getNumber(currentOrder.tax);
  const deliveryFee = getNumber(currentOrder.delivery_fee);

  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      transparent
      visible
    >
      <View className="flex-1 justify-end bg-black/45">
        <View className="max-h-[90%] rounded-t-3xl bg-[#FFFCF6]">
          <View className="flex-row items-center justify-between border-b border-[#E7E0D8] px-5 py-4">
            <View className="flex-1 pr-3">
              <Text className="text-xs font-semibold uppercase tracking-widest text-[#728071]">
                Order details
              </Text>
              <Text className="mt-1 text-lg font-bold text-[#183B2A]">
                #{currentOrder.order_id}
              </Text>
            </View>
            <Pressable
              accessibilityLabel="Close order details"
              accessibilityRole="button"
              className="h-10 w-10 items-center justify-center rounded-full bg-[#F0EEE7]"
              onPress={onClose}
            >
              <X color="#183B2A" size={20} />
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={{ padding: 20, paddingBottom: 36 }}
            showsVerticalScrollIndicator={false}
          >
            {errorMessage ? (
              <View className="mb-4 rounded-xl border border-[#F3C9C5] bg-[#FFF4F2] p-3">
                <Text accessibilityRole="alert" className="text-sm text-[#A33424]">
                  {errorMessage}
                </Text>
                <Pressable
                  className="mt-2 self-start"
                  onPress={() => void refreshDetails()}
                >
                  <Text className="text-sm font-bold text-[#A33424]">Try again</Text>
                </Pressable>
              </View>
            ) : null}

            <View className="rounded-2xl border border-[#E7E0D8] bg-white p-4">
              <View className="flex-row flex-wrap items-center justify-between gap-3">
                <OrderStatusBadge status={statusGroup} />
                <Text className="text-xs text-[#728071]">
                  {formatDate(date)}
                  {date
                    ? ` · ${date.toLocaleTimeString("en-IN", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}`
                    : ""}
                </Text>
              </View>

              {!cancelled ? (
                <View className="mt-5 flex-row">
                  {TRACKING_STATUSES.map((step, index) => {
                    const complete = index <= currentStep;
                    return (
                      <View key={step} className="flex-1 items-center">
                        <View
                          className={`h-3 w-3 rounded-full ${
                            complete ? "bg-[#1A6A3B]" : "bg-[#D9DED5]"
                          }`}
                        />
                        <Text
                          className={`mt-2 text-center text-[9px] ${
                            complete ? "font-bold text-[#1A6A3B]" : "text-[#8A9188]"
                          }`}
                        >
                          {step}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              ) : null}
            </View>

            <View className="mt-4 rounded-2xl border border-[#E7E0D8] bg-white p-4">
              <Text className="mb-3 text-base font-bold text-[#183B2A]">Items</Text>
              {currentOrder.items.map((item, index) => {
                const image = getItemImage(item);
                const quantity = getNumber(item.quantity) || 1;
                return (
                  <View
                    key={`${currentOrder.order_id}-${index}`}
                    className="flex-row items-center border-t border-[#F0EEE7] py-3"
                  >
                    {image ? (
                      <Image
                        accessibilityLabel={getItemName(item)}
                        className="h-12 w-12 rounded-xl bg-[#F1F3EC]"
                        source={{ uri: image }}
                      />
                    ) : (
                      <View className="h-12 w-12 items-center justify-center rounded-xl bg-[#F1F3EC]">
                        <Utensils color="#1A6A3B" size={20} />
                      </View>
                    )}
                    <View className="ml-3 flex-1">
                      <Text className="text-sm font-semibold text-[#26352A]">
                        {getItemName(item)}
                      </Text>
                      <Text className="mt-1 text-xs text-[#728071]">
                        Qty {quantity}
                      </Text>
                    </View>
                    <Text className="text-sm font-bold text-[#26352A]">
                      ₹{formatMoney(getItemTotal(item))}
                    </Text>
                  </View>
                );
              })}
              {currentOrder.items.length === 0 ? (
                <Text className="border-t border-[#F0EEE7] pt-3 text-sm text-[#728071]">
                  Item details are not available.
                </Text>
              ) : null}
            </View>

            {addressLines.length > 0 ? (
              <View className="mt-4 flex-row rounded-2xl border border-[#E7E0D8] bg-white p-4">
                <MapPin color="#1A6A3B" size={18} />
                <View className="ml-3 flex-1">
                  <Text className="font-bold text-[#183B2A]">Delivery address</Text>
                  {addressLines.map((line) => (
                    <Text key={line} className="mt-1 text-sm text-[#647064]">
                      {line}
                    </Text>
                  ))}
                </View>
              </View>
            ) : null}

            <View className="mt-4 rounded-2xl border border-[#E7E0D8] bg-white p-4">
              <Text className="mb-3 text-base font-bold text-[#183B2A]">
                Payment summary
              </Text>
              <SummaryRow label="Subtotal" amount={subtotal} />
              {tax > 0 ? <SummaryRow label="Tax" amount={tax} /> : null}
              {deliveryFee > 0 ? (
                <SummaryRow label="Delivery fee" amount={deliveryFee} />
              ) : null}
              <View className="mt-3 flex-row justify-between border-t border-[#E7E0D8] pt-3">
                <Text className="font-bold text-[#183B2A]">Total</Text>
                <Text className="font-bold text-[#183B2A]">
                  ₹{formatMoney(getOrderTotal(currentOrder))}
                </Text>
              </View>
              <Text className="mt-2 text-xs capitalize text-[#728071]">
                {getText(currentOrder, ["payment_method"]).replace(/_/g, " ") ||
                  "Payment method unavailable"}
              </Text>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function SummaryRow({ label, amount }: { label: string; amount: number }) {
  return (
    <View className="mt-2 flex-row justify-between">
      <Text className="text-sm text-[#728071]">{label}</Text>
      <Text className="text-sm font-medium text-[#26352A]">
        ₹{formatMoney(amount)}
      </Text>
    </View>
  );
}

export default function OrdersScreen() {
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<OrderFilter>("All Orders");
  const [page, setPage] = useState(1);
  const [selectedOrder, setSelectedOrder] = useState<OrderRecord | null>(null);

  const loadOrders = useCallback(async (refresh = false) => {
    if (refresh) setIsRefreshing(true);

    try {
      setErrorMessage("");
      setOrders(await fetchOrders());
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, "We could not load your orders."));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void fetchOrders()
      .then((records) => {
        if (active) {
          setErrorMessage("");
          setOrders(records);
        }
      })
      .catch((error) => {
        if (active) {
          setErrorMessage(
            getApiErrorMessage(error, "We could not load your orders."),
          );
        }
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const filteredOrders = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return orders.filter((order) => {
      const matchesStatus =
        statusFilter === "All Orders" ||
        getOrderFilterGroup(order.order_status) === statusFilter;
      const orderDate = getOrderDate(order);
      const dateValue = orderDate
        ? `${orderDate.getFullYear()}-${String(orderDate.getMonth() + 1).padStart(2, "0")}-${String(orderDate.getDate()).padStart(2, "0")}`
        : "";
      const matchesDate = !dateFilter || dateValue === dateFilter;
      const searchableText = [
        order.order_id,
        getText(order, ["order_number"]),
        ...order.items.map((item) => getItemName(item)),
      ]
        .join(" ")
        .toLowerCase();
      return matchesStatus && matchesDate && (!query || searchableText.includes(query));
    });
  }, [dateFilter, orders, searchQuery, statusFilter]);

  const pageCount = Math.max(1, Math.ceil(filteredOrders.length / ORDERS_PER_PAGE));
  const currentPage = Math.min(page, pageCount);
  const visibleOrders = filteredOrders.slice(
    (currentPage - 1) * ORDERS_PER_PAGE,
    currentPage * ORDERS_PER_PAGE,
  );

  const updateOrder = useCallback((updatedOrder: OrderRecord) => {
    setOrders((current) =>
      current.map((order) =>
        order.order_id === updatedOrder.order_id ? updatedOrder : order,
      ),
    );
    setSelectedOrder(updatedOrder);
  }, []);

  const normalizedDate = /^\d{4}-\d{2}-\d{2}$/.test(dateFilter);
  const invalidDate = Boolean(dateFilter) && !normalizedDate;

  return (
    <View className="flex-1 bg-[#F3F4F3]">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 32 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            colors={["#1A6A3B"]}
            onRefresh={() => void loadOrders(true)}
            refreshing={isRefreshing}
            tintColor="#1A6A3B"
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View className="mb-4 flex-row items-center justify-between rounded-2xl bg-[#183B2A] px-4 py-4">
          <View className="flex-1 pr-3">
            <Text className="text-xl font-bold text-white">Your Orders</Text>
            <Text className="mt-1 text-sm text-[#D8E4D7]">
              Track your meals, payments, and delivery updates.
            </Text>
          </View>
          <View className="items-center rounded-xl bg-white/10 px-3 py-2">
            <ShoppingBag color="#F7BD48" size={19} />
            <Text className="mt-1 text-xs font-bold text-white">
              {orders.length} {orders.length === 1 ? "order" : "orders"}
            </Text>
          </View>
        </View>

        <ScrollView
          className="mb-3 max-h-12"
          contentContainerStyle={{ alignItems: "center", gap: 8 }}
          horizontal
          showsHorizontalScrollIndicator={false}
        >
          {ORDER_FILTERS.map((filter) => {
            const count =
              filter === "All Orders"
                ? orders.length
                : orders.filter(
                    (order) => getOrderFilterGroup(order.order_status) === filter,
                  ).length;
            const selected = statusFilter === filter;
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected }}
                className={`rounded-full border px-3.5 py-2 ${
                  selected
                    ? "border-[#075B2B] bg-[#075B2B]"
                    : "border-[#E1E5DF] bg-white"
                }`}
                key={filter}
                onPress={() => {
                  setStatusFilter(filter);
                  setPage(1);
                }}
              >
                <Text
                  className={`text-xs font-semibold ${
                    selected ? "text-white" : "text-[#344035]"
                  }`}
                >
                  {filter} ({count})
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View className="mb-4 gap-2">
          <View className="flex-row items-center rounded-xl border border-[#E1E5DF] bg-white px-3">
            <Search color="#59645E" size={18} />
            <TextInput
              accessibilityLabel="Search orders by order ID or dish name"
              className="h-12 flex-1 px-3 text-sm text-[#183B2A]"
              onChangeText={(value) => {
                setSearchQuery(value);
                setPage(1);
              }}
              placeholder="Search order ID or dish"
              placeholderTextColor="#879087"
              returnKeyType="search"
              value={searchQuery}
            />
            {searchQuery ? (
              <Pressable
                accessibilityLabel="Clear order search"
                hitSlop={8}
                onPress={() => {
                  setSearchQuery("");
                  setPage(1);
                }}
              >
                <X color="#728071" size={17} />
              </Pressable>
            ) : null}
          </View>
          <View className="flex-row items-center rounded-xl border border-[#E1E5DF] bg-white px-3">
            <CalendarDays color="#59645E" size={17} />
            <TextInput
              accessibilityLabel="Filter orders by date in YYYY-MM-DD format"
              className="h-12 flex-1 px-3 text-sm text-[#183B2A]"
              keyboardType="numbers-and-punctuation"
              maxLength={10}
              onChangeText={(value) => {
                setDateFilter(value);
                setPage(1);
              }}
              placeholder="Filter date (YYYY-MM-DD)"
              placeholderTextColor="#879087"
              value={dateFilter}
            />
            {dateFilter ? (
              <Pressable
                accessibilityLabel="Clear date filter"
                hitSlop={8}
                onPress={() => {
                  setDateFilter("");
                  setPage(1);
                }}
              >
                <X color="#728071" size={17} />
              </Pressable>
            ) : null}
          </View>
          {invalidDate ? (
            <Text className="ml-1 text-xs text-[#A33424]">
              Enter a date as YYYY-MM-DD.
            </Text>
          ) : null}
        </View>

        {isLoading ? (
          <View className="items-center rounded-2xl bg-white px-5 py-12">
            <ActivityIndicator color="#1A6A3B" size="large" />
            <Text className="mt-3 text-sm text-[#728071]">Loading your orders…</Text>
          </View>
        ) : errorMessage && orders.length === 0 ? (
          <View className="items-center rounded-2xl border border-[#F3C9C5] bg-white px-5 py-10">
            <Text accessibilityRole="alert" className="text-center text-sm text-[#A33424]">
              {errorMessage}
            </Text>
            <Pressable
              className="mt-4 rounded-xl bg-[#183B2A] px-5 py-3"
              onPress={() => {
                setIsLoading(true);
                void loadOrders();
              }}
            >
              <Text className="font-semibold text-white">Try again</Text>
            </Pressable>
          </View>
        ) : errorMessage ? (
          <Text accessibilityRole="alert" className="mb-3 text-sm text-[#A33424]">
            {errorMessage}
          </Text>
        ) : null}

        {!isLoading && !errorMessage && visibleOrders.length === 0 ? (
          <View className="items-center rounded-2xl border border-dashed border-[#DCE8D5] bg-white px-5 py-12">
            <View className="h-14 w-14 items-center justify-center rounded-2xl bg-[#EFF5E9]">
              <Package color="#396F0B" size={25} />
            </View>
            <Text className="mt-4 text-lg font-bold text-[#183B2A]">
              {orders.length ? "No matching orders" : "No orders yet"}
            </Text>
            <Text className="mt-1 text-center text-sm text-[#7B8580]">
              {orders.length
                ? "Try changing your search or filters."
                : "Your orders will appear here after your first purchase."}
            </Text>
          </View>
        ) : null}

        <View className="gap-3">
          {visibleOrders.map((order) => {
            const date = getOrderDate(order);
            const status = getOrderFilterGroup(order.order_status);
            const previewImages = order.items
              .map(getItemImage)
              .filter(Boolean)
              .slice(0, 3);
            const firstItem = order.items[0];
            const image = firstItem ? getItemImage(firstItem) : "";

            return (
              <Pressable
                accessibilityRole="button"
                className="rounded-2xl border border-[#E8EDE6] bg-white p-3 shadow-sm active:opacity-80"
                key={order.order_id}
                onPress={() => setSelectedOrder(order)}
              >
                <View className="flex-row">
                  {image ? (
                    <Image
                      accessibilityLabel={getItemName(firstItem)}
                      className="h-[76px] w-[76px] rounded-xl bg-[#EFF5E9]"
                      source={{ uri: image }}
                    />
                  ) : (
                    <View className="h-[76px] w-[76px] items-center justify-center rounded-xl bg-[#EFF5E9]">
                      <Utensils color="#396F0B" size={25} />
                    </View>
                  )}
                  <View className="ml-3 flex-1 justify-center">
                    <Text className="text-sm font-extrabold text-[#101820]">
                      #{order.order_id}
                    </Text>
                    <Text className="mt-1 text-xs text-[#697386]">
                      {formatDate(date)}
                      {date
                        ? ` · ${date.toLocaleTimeString("en-IN", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}`
                        : ""}
                    </Text>
                    <Text className="mt-1 text-xs text-[#697386]">
                      {order.item_count} {order.item_count === 1 ? "item" : "items"}
                    </Text>
                    {previewImages.length > 1 ? (
                      <View className="mt-1.5 flex-row">
                        {previewImages.slice(1).map((preview, index) => (
                          <Image
                            className="mr-1 h-6 w-6 rounded-md border border-white"
                            key={`${order.order_id}-preview-${index}`}
                            source={{ uri: preview }}
                          />
                        ))}
                      </View>
                    ) : null}
                  </View>
                  <View className="items-end justify-center">
                    <Text className="text-sm font-extrabold text-[#183B2A]">
                      ₹{formatMoney(getOrderTotal(order))}
                    </Text>
                    <ArrowRight color="#8A9188" size={18} style={{ marginTop: 8 }} />
                  </View>
                </View>
                <View className="mt-3 flex-row items-center justify-between border-t border-[#F0EEE7] pt-3">
                  <OrderStatusBadge status={status} />
                  <Text className="text-xs font-semibold text-[#396F0B]">
                    View details
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        {!isLoading && filteredOrders.length > ORDERS_PER_PAGE ? (
          <View className="mt-4 flex-row items-center justify-between rounded-xl bg-white px-3 py-3">
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: currentPage <= 1 }}
              className={`rounded-lg px-3 py-2 ${
                currentPage <= 1 ? "bg-[#F1F2EF]" : "bg-[#EAF2E8]"
              }`}
              disabled={currentPage <= 1}
              onPress={() => setPage(Math.max(1, currentPage - 1))}
            >
              <Text className="text-sm font-semibold text-[#183B2A]">Previous</Text>
            </Pressable>
            <Text className="text-sm font-medium text-[#59645E]">
              Page {currentPage} of {pageCount}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: currentPage >= pageCount }}
              className={`rounded-lg px-3 py-2 ${
                currentPage >= pageCount ? "bg-[#F1F2EF]" : "bg-[#EAF2E8]"
              }`}
              disabled={currentPage >= pageCount}
              onPress={() => setPage(Math.min(pageCount, currentPage + 1))}
            >
              <Text className="text-sm font-semibold text-[#183B2A]">Next</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>

      <OrderDetailsModal
        key={selectedOrder?.order_id ?? "closed"}
        onClose={() => setSelectedOrder(null)}
        onOrderUpdated={updateOrder}
        order={selectedOrder}
      />
    </View>
  );
}
