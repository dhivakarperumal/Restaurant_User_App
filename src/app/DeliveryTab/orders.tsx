import { useCallback, useEffect, useMemo, useState } from "react";
import DateTimePicker, {
  DateTimePickerAndroid,
} from "@react-native-community/datetimepicker";
import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import * as Linking from "expo-linking";
import {
  ArrowUpRight,
  Bike,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock3,
  Eye,
  MapPin,
  Navigation,
  Package,
  Phone,
  RefreshCw,
  Search,
  ShoppingBag,
  X,
  XCircle,
} from "lucide-react-native";
import { useCustomAlert } from "../../contexts/CustomAlertContext";
import api, { API_BASE_URL, getApiErrorMessage } from "../../lib/api";

type FilterKey = "all" | "today" | "delivery" | "cancelled";
type OrderView = {
  key: FilterKey;
  label: string;
  statuses: readonly string[] | null;
};

const ORDER_VIEWS: OrderView[] = [
  { key: "all", label: "All", statuses: null },
  { key: "today", label: "Today", statuses: null },
  {
    key: "delivery",
    label: "Delivery",
    statuses: [
      "ASSIGNED",
      "ACCEPTED",
      "REACHED_PICKUP",
      "PICKED_UP",
      "OUT_FOR_DELIVERY",
      "REACHED_CUSTOMER",
      "SHIPPED",
    ],
  },
  { key: "cancelled", label: "Cancelled", statuses: ["CANCELLED"] },
];

const STATUS_FLOW = [
  "ASSIGNED",
  "ACCEPTED",
  "REACHED_PICKUP",
  "PICKED_UP",
  "OUT_FOR_DELIVERY",
  "REACHED_CUSTOMER",
  "DELIVERED",
] as const;

const STATUS_LABELS: Record<string, string> = {
  ASSIGNED: "Assigned",
  ACCEPTED: "Accepted",
  REACHED_PICKUP: "Reached pickup",
  PICKED_UP: "Picked up",
  OUT_FOR_DELIVERY: "Out for delivery",
  REACHED_CUSTOMER: "Reached customer",
  DELIVERED: "Delivered",
  COMPLETED: "Delivered",
  CANCELLED: "Cancelled",
  NEW: "New",
  NEW_ORDER: "New",
  ORDER_PLACED: "Order placed",
  PENDING: "New",
};

const NEXT_STATUS: Record<string, string> = {
  ASSIGNED: "ACCEPTED",
  ACCEPTED: "REACHED_PICKUP",
  REACHED_PICKUP: "PICKED_UP",
  PICKED_UP: "OUT_FOR_DELIVERY",
  OUT_FOR_DELIVERY: "REACHED_CUSTOMER",
  REACHED_CUSTOMER: "DELIVERED",
};

type OrderItem = Record<string, unknown>;
type DeliveryOrder = Record<string, unknown> & {
  order_id: string;
  order_status: string;
  items: OrderItem[];
};
function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function textValue(value: unknown): string {
  if (typeof value === "string" || typeof value === "number") {
    return String(value).trim();
  }
  return "";
}

function firstText(record: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = textValue(record[key]);
    if (value) return value;
  }
  return "";
}

function normalizeStatus(status: unknown): string {
  return textValue(status).toUpperCase().replace(/[\s-]+/g, "_");
}

function statusLabel(status: unknown): string {
  const normalized = normalizeStatus(status);
  return STATUS_LABELS[normalized] ?? (normalized ? normalized.replace(/_/g, " ") : "New");
}

function normalizeOrder(value: unknown): DeliveryOrder | null {
  const record = asRecord(value);
  if (!record) return null;
  const orderId = firstText(record, ["order_id", "id", "order_number"]);
  if (!orderId) return null;
  const rawItems = record.items ?? record.food_items ?? record.order_items;
  const items = Array.isArray(rawItems)
    ? rawItems.flatMap((item) => {
        const itemRecord = asRecord(item);
        return itemRecord ? [itemRecord] : [];
      })
    : [];

  return {
    ...record,
    order_id: orderId,
    order_status: firstText(record, ["order_status", "status"]) || "NEW",
    items,
  };
}

function orderIdentifier(order: DeliveryOrder): string {
  return order.order_id;
}

function getCustomer(order: DeliveryOrder): Record<string, unknown> {
  return asRecord(order.customer) ?? {};
}

function getOrderDate(order: DeliveryOrder): Date | null {
  const value = firstText(order, ["order_date", "created_at", "createdAt"]);
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(value: Date | null): string {
  return value
    ? value.toLocaleString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "Date unavailable";
}

function getDateKey(date: Date | null): string {
  if (!date) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function parseDateFilter(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12);
  return getDateKey(date) === value ? date : null;
}

function formatFilterDate(value: string): string {
  const date = parseDateFilter(value);
  return date
    ? date.toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" })
    : "Choose date";
}

function formatAmount(value: unknown): string {
  const amount = Number(value);
  return `₹${(Number.isFinite(amount) ? amount : 0).toLocaleString("en-IN")}`;
}

function getOrderTotal(order: DeliveryOrder): number | null {
  for (const key of ["total_amount", "grand_total", "order_total", "total_price"]) {
    const rawValue = order[key];
    if (rawValue == null || rawValue === "") continue;
    const amount = Number(rawValue);
    if (Number.isFinite(amount)) return amount;
  }

  if (!order.items.length) return null;
  let total = 0;
  let hasItemAmount = false;
  for (const item of order.items) {
    const itemTotal = firstText(item, ["total_price", "item_total", "total_amount"]);
    if (itemTotal) {
      const amount = Number(itemTotal);
      if (Number.isFinite(amount)) {
        total += amount;
        hasItemAmount = true;
        continue;
      }
    }

    const unitPrice = Number(firstText(item, ["price", "unit_price"]));
    if (Number.isFinite(unitPrice) && unitPrice > 0) {
      const quantity = Number(firstText(item, ["quantity", "qty"])) || 1;
      total += unitPrice * quantity;
      hasItemAmount = true;
    }
  }
  return hasItemAmount ? total : null;
}

function getFirstItemImage(item: OrderItem | undefined): string {
  if (!item) return "";
  const images = item.food_images;
  const firstImage = Array.isArray(images) ? images[0] : null;
  const imageRecord = asRecord(firstImage);
  const value =
    firstText(item, ["product_image", "image", "thumbnail_image"]) ||
    firstText(imageRecord ?? {}, ["image_url", "url", "image"]);
  if (!value) return "";
  if (/^(data:|blob:|https?:\/\/)/i.test(value)) return value;
  const baseUrl = API_BASE_URL.replace(/\/api\/?$/i, "").replace(/\/+$/, "");
  return `${baseUrl}${value.startsWith("/") ? value : `/${value}`}`;
}

function OrderItemThumbnail({
  uri,
  accessibilityLabel,
}: {
  uri: string;
  accessibilityLabel: string;
}) {
  const [hasError, setHasError] = useState(false);
  return uri && !hasError ? (
    <Image
      accessibilityLabel={accessibilityLabel}
      className="mr-3 h-11 w-11 rounded-2xl bg-[#EAF4EA]"
      onError={() => setHasError(true)}
      resizeMode="cover"
      source={{ uri }}
    />
  ) : (
    <View className="mr-3 h-11 w-11 items-center justify-center rounded-2xl bg-[#EAF4EA]">
      <Package color="#17663D" size={20} />
    </View>
  );
}

function getStatusColors(status: unknown): { background: string; foreground: string } {
  const normalized = normalizeStatus(status);
  if (["DELIVERED", "COMPLETED"].includes(normalized)) {
    return { background: "#EAF4E4", foreground: "#17663D" };
  }
  if (normalized === "CANCELLED") {
    return { background: "#FFF0F2", foreground: "#C51D42" };
  }
  if (["PICKED_UP", "OUT_FOR_DELIVERY", "REACHED_CUSTOMER", "SHIPPED"].includes(normalized)) {
    return { background: "#EDF3FF", foreground: "#1749C6" };
  }
  if (
    [
      "ASSIGNED",
      "ACCEPTED",
      "REACHED_PICKUP",
      "NEW",
      "NEW_ORDER",
      "PENDING",
      "ORDER_PLACED",
    ].includes(normalized)
  ) {
    return { background: "#FFF6D8", foreground: "#A85B00" };
  }
  return { background: "#F1F5F9", foreground: "#475569" };
}

function getLocationUrl(
  address: string,
  latitude: unknown,
  longitude: unknown,
): string {
  const lat = textValue(latitude);
  const lng = textValue(longitude);
  const destination =
    lat && lng
      ? `${encodeURIComponent(lat)},${encodeURIComponent(lng)}`
      : encodeURIComponent(address);
  return `https://www.google.com/maps/dir/?api=1&destination=${destination}`;
}

async function fetchDeliveryOrders(): Promise<DeliveryOrder[]> {
  const response = await api.get("/delivery-partner/orders");
  const root = asRecord(response.data);
  const nested = asRecord(root?.data);
  const ordersValue = Array.isArray(response.data)
    ? response.data
    : root?.orders ?? nested?.orders ?? root?.data;
  if (!Array.isArray(ordersValue)) {
    throw new Error("The assigned orders response was invalid.");
  }

  const orders = ordersValue.flatMap((value) => {
    const order = normalizeOrder(value);
    return order ? [order] : [];
  });
  return [...new Map(orders.map((order) => [orderIdentifier(order), order])).values()];
}

function SummaryCard({
  label,
  count,
  caption,
  background,
  Icon,
  loading,
}: {
  label: string;
  count: number;
  caption: string;
  background: string;
  Icon: typeof Clock3;
  loading: boolean;
}) {
  return (
    <View
      className="mb-3 min-h-[118px] w-[48.5%] justify-between rounded-2xl p-4"
      style={{ backgroundColor: background }}
    >
      <View className="flex-row items-center justify-between">
        <Text className="flex-1 pr-2 text-xs font-bold text-white">{label}</Text>
        <Icon color="#FFFFFF" size={19} />
      </View>
      {loading ? (
        <ActivityIndicator className="self-start" color="#FFFFFF" />
      ) : (
        <Text className="text-3xl font-black text-white">{count}</Text>
      )}
      <Text className="text-[10px] font-semibold text-white/80">{caption}</Text>
    </View>
  );
}

export default function DeliveryOrdersScreen() {
  const { showAlert } = useCustomAlert();
  const [orders, setOrders] = useState<DeliveryOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all");
  const [page, setPage] = useState(1);
  const [selectedOrder, setSelectedOrder] = useState<DeliveryOrder | null>(null);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [pickerMode, setPickerMode] = useState<"from" | "to" | null>(null);
  const [pickerDraft, setPickerDraft] = useState(new Date());

  useEffect(() => {
    let active = true;
    const loadOrders = async () => {
      try {
        const result = await fetchDeliveryOrders();
        if (!active) return;
        setOrders(result);
        setErrorMessage("");
      } catch (error: unknown) {
        console.error("Failed to load delivery partner orders:", error);
        if (active) {
          setOrders([]);
          setErrorMessage(
            getApiErrorMessage(error, "Assigned orders are temporarily unavailable."),
          );
        }
      } finally {
        if (active) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    };

    void loadOrders();
    return () => {
      active = false;
    };
  }, [refreshVersion]);

  const refreshOrders = useCallback(() => {
    if (loading || refreshing) return;
    setRefreshing(true);
    setRefreshVersion((current) => current + 1);
  }, [loading, refreshing]);

  const todayKey = getDateKey(new Date());
  const selectedView = ORDER_VIEWS.find((view) => view.key === activeFilter) ?? ORDER_VIEWS[0];
  const filteredOrders = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return orders.filter((order) => {
      const normalized = normalizeStatus(order.order_status);
      const dateKey = getDateKey(getOrderDate(order));
      const matchesView =
        selectedView.key === "today"
          ? dateKey === todayKey
          : !selectedView.statuses || selectedView.statuses.includes(normalized);
      const matchesDate = (!dateFrom || (dateKey && dateKey >= dateFrom))
        && (!dateTo || (dateKey && dateKey <= dateTo));
      const customer = getCustomer(order);
      const matchesSearch =
        !query ||
        [
          orderIdentifier(order),
          firstText(order, ["customer_name"]),
          firstText(customer, ["name", "full_name", "fullName"]),
          firstText(order, ["customer_phone", "phone"]),
          firstText(customer, ["phone", "phone_number"]),
        ].some((value) => value.toLocaleLowerCase().includes(query));
      return matchesView && matchesDate && matchesSearch;
    });
  }, [dateFrom, dateTo, orders, search, selectedView, todayKey]);

  const todayOrders = useMemo(
    () =>
      orders
        .filter((order) => getDateKey(getOrderDate(order)) === todayKey)
        .sort(
          (first, second) =>
            (getOrderDate(second)?.getTime() ?? 0) -
            (getOrderDate(first)?.getTime() ?? 0),
        ),
    [orders, todayKey],
  );

  const counts = useMemo(() => {
    const statusCount = (statuses: readonly string[]) =>
      orders.filter((order) => statuses.includes(normalizeStatus(order.order_status))).length;
    return {
      newOrders: statusCount(["NEW", "NEW_ORDER", "PENDING", "ORDER_PLACED"]),
      active: statusCount([
        "ASSIGNED",
        "ACCEPTED",
        "REACHED_PICKUP",
        "PICKED_UP",
        "OUT_FOR_DELIVERY",
        "REACHED_CUSTOMER",
        "SHIPPED",
      ]),
      delivered: statusCount(["DELIVERED", "COMPLETED"]),
      cancelled: statusCount(["CANCELLED"]),
    };
  }, [orders]);

  const pageSize = 8;
  const pageCount = Math.max(1, Math.ceil(filteredOrders.length / pageSize));
  const visiblePage = Math.min(page, pageCount);
  const visibleOrders = filteredOrders.slice(
    (visiblePage - 1) * pageSize,
    visiblePage * pageSize,
  );

  const chooseFilter = (filter: FilterKey) => {
    setActiveFilter(filter);
    setPage(1);
  };

  const clearFilters = () => {
    setSearch("");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  };

  const applyPickedDate = (mode: "from" | "to", value: Date) => {
    const dateKey = getDateKey(value);
    if (mode === "from") setDateFrom(dateKey);
    else setDateTo(dateKey);
    setPage(1);
  };

  const openDatePicker = (mode: "from" | "to") => {
    const currentValue = mode === "from" ? dateFrom : dateTo;
    const value = parseDateFilter(currentValue) ?? new Date();
    if (Platform.OS === "android") {
      DateTimePickerAndroid.open({
        value,
        mode: "date",
        onValueChange: (_event, selectedDate) => applyPickedDate(mode, selectedDate),
      });
      return;
    }

    setPickerDraft(value);
    setPickerMode(mode);
  };

  const confirmIOSDatePicker = () => {
    if (pickerMode) applyPickedDate(pickerMode, pickerDraft);
    setPickerMode(null);
  };

  const updateOrderStatus = async (order: DeliveryOrder, nextStatus: string) => {
    if (updatingOrderId) return;
    setUpdatingOrderId(orderIdentifier(order));
    try {
      const response = await api.patch(
        `/delivery-partner/orders/${encodeURIComponent(orderIdentifier(order))}/status`,
        { status: nextStatus },
      );
      const root = asRecord(response.data);
      const nested = asRecord(root?.data);
      const updatedRecord =
        asRecord(root?.order) ?? asRecord(nested?.order) ?? nested;
      const updatedOrder = updatedRecord
        ? normalizeOrder({
            ...order,
            ...updatedRecord,
            order_status:
              firstText(updatedRecord, ["order_status", "status"]) || nextStatus,
          })
        : null;
      const result: DeliveryOrder = updatedOrder ?? { ...order, order_status: nextStatus };
      setOrders((current) =>
        current.map((item) =>
          orderIdentifier(item) === orderIdentifier(order) ? result : item,
        ),
      );
      setSelectedOrder(result);
      showAlert({
        title: "Delivery status updated",
        message: `Order ${orderIdentifier(order)} is now ${statusLabel(result.order_status)}.`,
        variant: "success",
      });
    } catch (error: unknown) {
      console.error("Failed to update delivery order status:", error);
      showAlert({
        title: "Could not update delivery",
        message: getApiErrorMessage(error, "Please try again."),
        variant: "error",
      });
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const confirmOrderStatus = (order: DeliveryOrder, nextStatus: string) => {
    showAlert({
      title: "Confirm status update",
      message: `Mark ${orderIdentifier(order)} as ${statusLabel(nextStatus)}?`,
      variant: "confirm",
      actions: [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm",
          onPress: () => void updateOrderStatus(order, nextStatus),
        },
      ],
    });
  };

  const openExternalUrl = async (url: string, title: string) => {
    try {
      await Linking.openURL(url);
    } catch (error: unknown) {
      console.error(`Failed to open ${title.toLowerCase()} link:`, error);
      showAlert({
        title: `Could not open ${title.toLowerCase()}`,
        message: getApiErrorMessage(error, "Please try again or open the details manually."),
        variant: "error",
      });
    }
  };

  const renderStatus = (status: unknown) => {
    const colors = getStatusColors(status);
    return (
      <View className="self-start rounded-full px-3 py-1.5" style={{ backgroundColor: colors.background }}>
        <Text className="text-xs font-bold" style={{ color: colors.foreground }}>
          {statusLabel(status)}
        </Text>
      </View>
    );
  };

  const renderOrderCard = (order: DeliveryOrder) => {
    const customer = getCustomer(order);
    const customerName =
      firstText(order, ["customer_name"]) ||
      firstText(customer, ["name", "full_name", "fullName"]) ||
      "Customer";
    const pickup = firstText(order, [
      "restaurant_name",
      "chef_name",
      "pickup_address",
      "restaurant_address",
    ]);
    const dropoff = firstText(order, ["delivery_address", "dropoff_address"]);
    const isUpdating = updatingOrderId === orderIdentifier(order);
    const orderTotal = getOrderTotal(order);
    const firstItemImage = getFirstItemImage(order.items[0]);

    return (
      <Pressable
        accessibilityRole="button"
        className="mb-4 overflow-hidden rounded-[22px] border border-[#E3EAE3] bg-white p-4 active:border-[#A8C5AE]"
        key={orderIdentifier(order)}
        onPress={() => setSelectedOrder(order)}
      >
        <View className="flex-row items-center">
          <OrderItemThumbnail
            uri={firstItemImage}
            accessibilityLabel="First food item image"
          />
          <View className="mr-2 flex-1">
            <Text className="text-[10px] font-extrabold uppercase tracking-[1.2px] text-[#718078]">
              Order {orderIdentifier(order)}
            </Text>
            <Text className="mt-0.5 text-base font-extrabold text-[#17251E]" numberOfLines={1}>
              {customerName}
            </Text>
          </View>
          {renderStatus(order.order_status)}
        </View>
        <View className="mt-4 rounded-2xl bg-[#F6F8F5] p-3">
          <View className="flex-row items-start">
            <View className="mr-2.5 mt-0.5 h-7 w-7 items-center justify-center rounded-lg bg-white">
              <ShoppingBag color="#65806A" size={15} />
            </View>
            <View className="flex-1">
              <Text className="text-[9px] font-extrabold uppercase tracking-wide text-[#718078]">
                Pickup
              </Text>
              <Text className="mt-0.5 text-xs font-semibold leading-5 text-[#34443A]" numberOfLines={2}>
                {pickup || "Pickup location pending"}
              </Text>
            </View>
          </View>
          <View className="ml-[13px] h-3 border-l border-dashed border-[#B8C9B9]" />
          <View className="flex-row items-start">
            <View className="mr-2.5 mt-0.5 h-7 w-7 items-center justify-center rounded-lg bg-white">
              <MapPin color="#17663D" size={15} />
            </View>
            <View className="flex-1">
              <Text className="text-[9px] font-extrabold uppercase tracking-wide text-[#718078]">
                Drop-off
              </Text>
              <Text className="mt-0.5 text-xs font-semibold leading-5 text-[#34443A]" numberOfLines={2}>
                {dropoff || "Delivery location pending"}
              </Text>
            </View>
          </View>
        </View>
        <View className="mt-3 flex-row items-center justify-between border-t border-[#EDF0EC] pt-3">
          <View className="mr-2 flex-1 flex-row items-center">
            <CalendarDays color="#829087" size={14} />
            <Text className="ml-1.5 flex-1 text-[10px] font-medium text-slate-500" numberOfLines={1}>
              {formatDate(getOrderDate(order))}
            </Text>
          </View>
          <View className="items-end">
            <Text className="text-[9px] font-bold uppercase tracking-wide text-slate-500">
              Order total
            </Text>
            <Text className="mt-0.5 text-sm font-black text-[#17663D]">
              {orderTotal == null ? "Amount unavailable" : formatAmount(orderTotal)}
            </Text>
          </View>
        </View>
        <View className="mt-3 flex-row">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Track order ${orderIdentifier(order)} on map`}
            className="mr-2 min-h-10 flex-1 flex-row items-center justify-center rounded-xl bg-[#EEF5EB] px-3 active:bg-[#E1EDE0]"
            onPress={(event) => {
              event.stopPropagation();
              void openExternalUrl(
                getLocationUrl(
                  dropoff,
                  order.delivery_latitude,
                  order.delivery_longitude,
                ),
                "Navigation",
              );
            }}
          >
            <Navigation color="#17663D" size={15} />
            <Text className="ml-2 text-xs font-bold text-[#17663D]">Track map</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`View order ${orderIdentifier(order)}`}
            className="min-h-10 flex-1 flex-row items-center justify-center rounded-xl border border-[#E1E8E1] bg-white px-3 active:bg-[#F6F8F5]"
            onPress={(event) => {
              event.stopPropagation();
              setSelectedOrder(order);
            }}
          >
            <Eye color="#53645A" size={16} />
            <Text className="ml-2 text-xs font-bold text-[#39483F]">View order</Text>
          </Pressable>
        </View>
        {normalizeStatus(order.order_status) === "REACHED_CUSTOMER" ? (
          <Pressable
            accessibilityRole="button"
            className="mt-4 min-h-11 flex-row items-center justify-center rounded-xl bg-[#17663D] px-4 active:bg-[#145333]"
            disabled={Boolean(updatingOrderId)}
            onPress={(event) => {
              event.stopPropagation();
              confirmOrderStatus(order, "DELIVERED");
            }}
          >
            {isUpdating ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <CheckCircle2 color="#FFFFFF" size={17} />
                <Text className="ml-2 text-sm font-bold text-white">Mark delivered</Text>
              </>
            )}
          </Pressable>
        ) : null}
      </Pressable>
    );
  };

  const selectedCustomer = selectedOrder ? getCustomer(selectedOrder) : {};
  const selectedPhone = selectedOrder
    ? firstText(selectedOrder, ["customer_phone", "phone"]) ||
      firstText(selectedCustomer, ["phone", "phone_number"])
    : "";
  const selectedDropoff = selectedOrder
    ? firstText(selectedOrder, ["delivery_address", "dropoff_address"])
    : "";
  const selectedPickup = selectedOrder
    ? firstText(selectedOrder, ["pickup_address", "restaurant_address"])
    : "";
  const selectedNextStatus = selectedOrder
    ? NEXT_STATUS[normalizeStatus(selectedOrder.order_status)]
    : undefined;
  const selectedOrderTotal = selectedOrder ? getOrderTotal(selectedOrder) : null;
  const customerName =
    firstText(selectedOrder ?? {}, ["customer_name"]) ||
    firstText(selectedCustomer, ["name", "full_name", "fullName"]) ||
    "Customer";

  return (
    <View className="flex-1 bg-[#F7F8F3]">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 24 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refreshOrders}
            tintColor="#17663D"
          />
        }
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View className="mb-2 flex-row flex-wrap justify-between">
          <SummaryCard
            label="Total Orders"
            count={orders.length}
            caption="All assigned orders"
            background="#C72D91"
            Icon={Clock3}
            loading={loading}
          />
          <SummaryCard
            label="Active deliveries"
            count={counts.active}
            caption="Assigned to you"
            background="#6256D9"
            Icon={Bike}
            loading={loading}
          />
          <SummaryCard
            label="Delivered"
            count={counts.delivered}
            caption="Completed"
            background="#18A982"
            Icon={CheckCircle2}
            loading={loading}
          />
          <SummaryCard
            label="Cancelled"
            count={counts.cancelled}
            caption="Closed"
            background="#E9A319"
            Icon={XCircle}
            loading={loading}
          />
        </View>

        <View className="mb-3 flex-row items-center rounded-xl border border-[#E1E8E1] bg-white px-3">
          <Search color="#87938A" size={18} />
          <TextInput
            accessibilityLabel="Search orders"
            className="min-h-12 flex-1 px-3 text-sm text-[#17251E]"
            onChangeText={(value) => {
              setSearch(value);
              setPage(1);
            }}
            placeholder="Search order or customer"
            placeholderTextColor="#98A199"
            value={search}
          />
          {search ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Clear search"
              className="h-9 w-9 items-center justify-center"
              onPress={() => {
                setSearch("");
                setPage(1);
              }}
            >
              <X color="#87938A" size={17} />
            </Pressable>
          ) : null}
        </View>

        <ScrollView
          className="mb-4"
          contentContainerStyle={{ alignItems: "center" }}
          horizontal
          showsHorizontalScrollIndicator={false}
        >
          {ORDER_VIEWS.map((view) => {
            const active = activeFilter === view.key;
            const count = view.statuses
              ? orders.filter((order) =>
                  view.statuses?.includes(normalizeStatus(order.order_status)),
                ).length
              : view.key === "today"
                ? todayOrders.length
                : orders.length;
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                className={`mr-2 min-h-10 flex-row items-center rounded-full border px-4 ${
                  active
                    ? "border-[#17663D] bg-[#17663D]"
                    : "border-[#E1E8E1] bg-white"
                }`}
                key={view.key}
                onPress={() => chooseFilter(view.key)}
              >
                <Text
                  className={`text-xs font-bold ${
                    active ? "text-white" : "text-[#526057]"
                  }`}
                >
                  {view.label}
                </Text>
                <Text
                  className={`ml-1.5 text-[10px] font-bold ${
                    active ? "text-white/80" : "text-slate-400"
                  }`}
                >
                  {count}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View className="mb-4 rounded-2xl border border-[#E1E8E1] bg-white p-3">
          <View className="mb-2 flex-row items-center">
            <CalendarDays color="#39754A" size={15} />
            <Text className="ml-2 text-xs font-bold text-[#39483F]">Filter by date</Text>
          </View>
          {Platform.OS === "web" ? (
            <View className="flex-row">
              <TextInput
                accessibilityLabel="Date from"
                className="mr-2 min-h-10 flex-1 rounded-lg bg-[#F5F7F3] px-3 text-xs text-[#17251E]"
                onChangeText={(value) => {
                  setDateFrom(value);
                  setPage(1);
                }}
                placeholder="From · YYYY-MM-DD"
                placeholderTextColor="#98A199"
                value={dateFrom}
              />
              <TextInput
                accessibilityLabel="Date to"
                className="min-h-10 flex-1 rounded-lg bg-[#F5F7F3] px-3 text-xs text-[#17251E]"
                onChangeText={(value) => {
                  setDateTo(value);
                  setPage(1);
                }}
                placeholder="To · YYYY-MM-DD"
                placeholderTextColor="#98A199"
                value={dateTo}
              />
            </View>
          ) : (
            <View className="flex-row">
              {(["from", "to"] as const).map((mode) => {
                const value = mode === "from" ? dateFrom : dateTo;
                const label = mode === "from" ? "From date" : "To date";
                return (
                  <Pressable
                    accessibilityLabel={`${label}: ${value ? formatFilterDate(value) : "not selected"}`}
                    accessibilityRole="button"
                    className={`min-h-11 flex-1 flex-row items-center rounded-lg bg-[#F5F7F3] px-3 ${
                      mode === "from" ? "mr-2" : ""
                    }`}
                    key={mode}
                    onPress={() => openDatePicker(mode)}
                  >
                    <CalendarDays color="#39754A" size={16} />
                    <View className="ml-2">
                      <Text className="text-[9px] font-semibold text-slate-500">
                        {label}
                      </Text>
                      <Text className="mt-0.5 text-xs font-bold text-[#17251E]">
                        {formatFilterDate(value)}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}
          {(dateFrom || dateTo || search) ? (
            <Pressable
              accessibilityRole="button"
              className="mt-2 self-end px-2 py-1"
              onPress={clearFilters}
            >
              <Text className="text-xs font-bold text-[#17663D]">Clear search and dates</Text>
            </Pressable>
          ) : null}
        </View>

        <View className="mb-3 flex-row items-center justify-between">
          <Text className="text-base font-extrabold text-[#17251E]">
            {selectedView.label} orders
          </Text>
          <Text className="text-xs font-semibold text-slate-500">
            {filteredOrders.length} {filteredOrders.length === 1 ? "order" : "orders"}
          </Text>
        </View>

        {errorMessage ? (
          <View className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <Text className="text-sm font-extrabold text-amber-900">
              Assigned orders are unavailable
            </Text>
            <Text className="mt-1 text-sm leading-5 text-amber-800">{errorMessage}</Text>
            <Text className="mt-2 text-xs leading-5 text-amber-800">
              This screen only shows orders assigned to your delivery account.
            </Text>
            <Pressable
              accessibilityRole="button"
              className="mt-3 min-h-10 flex-row items-center justify-center self-start rounded-xl bg-[#17663D] px-4"
              onPress={refreshOrders}
            >
              <RefreshCw color="#FFFFFF" size={15} />
              <Text className="ml-2 text-xs font-bold text-white">Try again</Text>
            </Pressable>
          </View>
        ) : loading ? (
          <View className="items-center rounded-2xl border border-[#E7EDE7] bg-white px-5 py-12">
            <ActivityIndicator color="#17663D" size="large" />
            <Text className="mt-3 text-sm font-semibold text-slate-500">
              Loading assigned orders…
            </Text>
          </View>
        ) : filteredOrders.length === 0 ? (
          <View className="items-center rounded-2xl border border-dashed border-[#Cddbd0] bg-white px-5 py-12">
            <ShoppingBag color="#7A9B82" size={26} />
            <Text className="mt-3 text-sm font-extrabold text-[#26352B]">
              No orders in this view
            </Text>
            <Text className="mt-1 text-center text-xs leading-5 text-slate-500">
              New assignments will appear here when they are available.
            </Text>
          </View>
        ) : (
          <>
            {visibleOrders.map(renderOrderCard)}
            <View className="mt-1 flex-row items-center justify-between">
              <Text className="text-xs text-slate-500">
                Page {visiblePage} of {pageCount}
              </Text>
              <View className="flex-row">
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Previous page"
                  className="mr-2 h-10 w-10 items-center justify-center rounded-xl border border-[#E1E8E1] bg-white"
                  disabled={visiblePage <= 1}
                  onPress={() => setPage((current) => Math.max(1, current - 1))}
                  style={{ opacity: visiblePage <= 1 ? 0.45 : 1 }}
                >
                  <Text className="text-lg font-bold text-[#53645A]">‹</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Next page"
                  className="h-10 w-10 items-center justify-center rounded-xl border border-[#E1E8E1] bg-white"
                  disabled={visiblePage >= pageCount}
                  onPress={() => setPage((current) => Math.min(pageCount, current + 1))}
                  style={{ opacity: visiblePage >= pageCount ? 0.45 : 1 }}
                >
                  <Text className="text-lg font-bold text-[#53645A]">›</Text>
                </Pressable>
              </View>
            </View>
          </>
        )}
      </ScrollView>

      <Modal
        animationType="slide"
        onRequestClose={() => setSelectedOrder(null)}
        transparent
        visible={selectedOrder !== null}
      >
        <View className="flex-1 justify-end bg-black/45">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close order details"
            className="absolute inset-0"
            onPress={() => setSelectedOrder(null)}
          />
          {selectedOrder ? (
            <View className="max-h-[92%] rounded-t-[28px] bg-[#FFFCF6] px-5 pb-8 pt-4">
              <View className="mb-4 h-1.5 w-12 self-center rounded-full bg-[#DED8CE]" />
              <View className="flex-row items-start justify-between">
                <View className="mr-3 flex-1">
                  <Text className="text-[10px] font-extrabold uppercase tracking-[1.6px] text-[#39754A]">
                    Delivery details
                  </Text>
                  <Text className="mt-1 text-xl font-black text-[#17251E]">
                    Order {orderIdentifier(selectedOrder)}
                  </Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Close order details"
                  className="h-10 w-10 items-center justify-center rounded-full bg-[#F1F3EE]"
                  onPress={() => setSelectedOrder(null)}
                >
                  <X color="#53645A" size={18} />
                </Pressable>
              </View>

              <ScrollView
                className="mt-4"
                contentContainerStyle={{ paddingBottom: 16 }}
                showsVerticalScrollIndicator={false}
              >
                <View className="flex-row items-center justify-between">
                  {renderStatus(selectedOrder.order_status)}
                  <Text className="ml-3 flex-1 text-right text-[10px] text-slate-500">
                    {formatDate(getOrderDate(selectedOrder))}
                  </Text>
                </View>

                <View className="mt-5 rounded-2xl border border-[#E7EDE7] bg-white p-4">
                  <View className="flex-row items-center">
                    <View className="mr-3 h-10 w-10 items-center justify-center rounded-xl bg-[#EAF2E8]">
                      <ShoppingBag color="#17663D" size={19} />
                    </View>
                    <View className="flex-1">
                      <Text className="text-[10px] font-extrabold uppercase tracking-wide text-slate-400">
                        Customer
                      </Text>
                      <Text className="mt-1 text-sm font-extrabold text-[#17251E]">
                        {customerName}
                      </Text>
                    </View>
                  </View>
                  <View className="mt-4 flex-row items-start">
                    <MapPin color="#78857B" size={16} />
                    <Text className="ml-2 flex-1 text-xs leading-5 text-slate-600">
                      {selectedDropoff || "Delivery address unavailable"}
                    </Text>
                  </View>
                  <View className="mt-3 flex-row">
                    {selectedPhone ? (
                      <Pressable
                        accessibilityRole="button"
                        className="mr-2 min-h-10 flex-1 flex-row items-center justify-center rounded-xl bg-[#EEF5EB]"
                        onPress={() =>
                          void openExternalUrl(`tel:${selectedPhone}`, "Call customer")
                        }
                      >
                        <Phone color="#17663D" size={15} />
                        <Text className="ml-2 text-xs font-bold text-[#17663D]">
                          Call customer
                        </Text>
                      </Pressable>
                    ) : null}
                    <Pressable
                      accessibilityRole="button"
                      className="min-h-10 flex-1 flex-row items-center justify-center rounded-xl bg-[#EEF5EB]"
                      onPress={() =>
                        void openExternalUrl(
                          getLocationUrl(
                            selectedDropoff,
                            selectedOrder.delivery_latitude,
                            selectedOrder.delivery_longitude,
                          ),
                          "Navigation",
                        )
                      }
                    >
                      <Navigation color="#17663D" size={15} />
                      <Text className="ml-2 text-xs font-bold text-[#17663D]">
                        Navigate to customer
                      </Text>
                      <ArrowUpRight color="#17663D" size={13} />
                    </Pressable>
                  </View>
                </View>

                <View className="mt-3 rounded-2xl border border-[#E7EDE7] bg-white p-4">
                  <Text className="text-[10px] font-extrabold uppercase tracking-wide text-slate-400">
                    Pickup
                  </Text>
                  <Text className="mt-1 text-sm font-extrabold text-[#17251E]">
                    {firstText(selectedOrder, ["restaurant_name", "chef_name"]) || "Restaurant"}
                  </Text>
                  <Text className="mt-1 text-xs leading-5 text-slate-600">
                    {selectedPickup || "Pickup address unavailable"}
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    className="mt-3 min-h-10 flex-row items-center self-start rounded-xl bg-[#EEF5EB] px-3"
                    onPress={() =>
                      void openExternalUrl(
                        getLocationUrl(
                          selectedPickup,
                          selectedOrder.pickup_latitude,
                          selectedOrder.pickup_longitude,
                        ),
                        "Pickup navigation",
                      )
                    }
                  >
                    <MapPin color="#17663D" size={15} />
                    <Text className="ml-2 text-xs font-bold text-[#17663D]">
                      Navigate to pickup
                    </Text>
                    <ArrowUpRight className="ml-1" color="#17663D" size={13} />
                  </Pressable>
                </View>

                <View className="mt-3 rounded-2xl border border-[#E7EDE7] bg-white p-4">
                  <View className="flex-row items-center">
                    <Package color="#39754A" size={17} />
                    <Text className="ml-2 text-sm font-extrabold text-[#17251E]">Food items</Text>
                  </View>
                  {selectedOrder.items.length ? (
                    selectedOrder.items.map((item, index) => {
                      const itemName =
                        firstText(item, ["food_name", "name", "product_name"]) ||
                        "Food item";
                      return (
                        <View
                          className="mt-3 flex-row items-center border-b border-[#F0F2EE] pb-3"
                          key={firstText(item, ["id", "food_id"]) || `${index}`}
                        >
                          <OrderItemThumbnail
                            accessibilityLabel={`${itemName} image`}
                            uri={getFirstItemImage(item)}
                          />
                          <Text className="mr-3 flex-1 text-xs font-semibold leading-5 text-[#39483F]">
                            {itemName}
                          </Text>
                          <View className="rounded-full bg-[#F3F6F1] px-2.5 py-1">
                            <Text className="text-xs font-bold text-slate-600">
                              × {firstText(item, ["quantity", "qty"]) || "1"}
                            </Text>
                          </View>
                        </View>
                      );
                    })
                  ) : (
                    <Text className="mt-3 text-xs text-slate-500">
                      Item details unavailable
                    </Text>
                  )}
                  <View className="mt-3 flex-row justify-between">
                    <Text className="text-xs text-slate-500">Payment</Text>
                    <Text className="text-xs font-semibold text-[#39483F]">
                      {firstText(selectedOrder, ["payment_type", "payment_method"]) || "—"}
                    </Text>
                  </View>
                  <View className="mt-3 flex-row justify-between border-t border-[#F0F2EE] pt-3">
                    <Text className="text-sm font-extrabold text-[#17251E]">Total amount</Text>
                    <Text className="text-sm font-black text-[#17663D]">
                      {selectedOrderTotal == null
                        ? "Unavailable"
                        : formatAmount(selectedOrderTotal)}
                    </Text>
                  </View>
                </View>

                {STATUS_FLOW.includes(normalizeStatus(selectedOrder.order_status) as (typeof STATUS_FLOW)[number]) ? (
                  <View className="mt-4 rounded-2xl border border-[#E7EDE7] bg-white p-4">
                    <Text className="mb-4 text-[10px] font-extrabold uppercase tracking-wide text-slate-400">
                      Delivery progress
                    </Text>
                    {STATUS_FLOW.map((status, index) => {
                      const currentIndex = STATUS_FLOW.indexOf(
                        normalizeStatus(selectedOrder.order_status) as (typeof STATUS_FLOW)[number],
                      );
                      const completed = index <= currentIndex;
                      return (
                        <View className="mb-3 flex-row items-center" key={status}>
                          <View
                            className={`mr-3 h-7 w-7 items-center justify-center rounded-full ${
                              completed ? "bg-[#287545]" : "bg-slate-100"
                            }`}
                          >
                            {completed ? (
                              <Check color="#FFFFFF" size={14} />
                            ) : (
                              <Text className="text-[10px] font-bold text-slate-400">
                                {index + 1}
                              </Text>
                            )}
                          </View>
                          <Text
                            className={`text-xs font-semibold ${
                              completed ? "text-[#17663D]" : "text-slate-400"
                            }`}
                          >
                            {statusLabel(status)}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                ) : null}

                <View className="mt-5 flex-row">
                  <Pressable
                    accessibilityRole="button"
                    className={`min-h-12 flex-1 items-center justify-center rounded-xl ${
                      selectedNextStatus || normalizeStatus(selectedOrder.order_status) === "REACHED_CUSTOMER"
                        ? "bg-[#17663D]"
                        : "border border-[#E1E8E1] bg-white"
                    }`}
                    disabled={Boolean(updatingOrderId)}
                    onPress={() => {
                      const next =
                        normalizeStatus(selectedOrder.order_status) === "REACHED_CUSTOMER"
                          ? "DELIVERED"
                          : selectedNextStatus;
                      if (next) confirmOrderStatus(selectedOrder, next);
                      else setSelectedOrder(null);
                    }}
                  >
                    {updatingOrderId === orderIdentifier(selectedOrder) ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : selectedNextStatus ||
                      normalizeStatus(selectedOrder.order_status) === "REACHED_CUSTOMER" ? (
                      <Text className="text-sm font-extrabold text-white">
                        {normalizeStatus(selectedOrder.order_status) === "REACHED_CUSTOMER"
                          ? "Mark delivered"
                          : statusLabel(selectedNextStatus)}
                      </Text>
                    ) : (
                      <Text className="text-sm font-extrabold text-[#53645A]">Close details</Text>
                    )}
                  </Pressable>
                </View>
              </ScrollView>
            </View>
          ) : null}
        </View>
      </Modal>
      {Platform.OS === "ios" && pickerMode ? (
        <Modal
          animationType="slide"
          onRequestClose={() => setPickerMode(null)}
          transparent
          visible
        >
          <View className="flex-1 justify-end bg-black/45">
            <View className="rounded-t-3xl bg-[#FFFCF6] px-4 pb-8 pt-4">
              <View className="mb-2 flex-row items-center justify-between">
                <Pressable
                  accessibilityRole="button"
                  className="min-h-11 justify-center px-2"
                  onPress={() => setPickerMode(null)}
                >
                  <Text className="text-sm font-semibold text-[#728071]">Cancel</Text>
                </Pressable>
                <Text className="text-base font-extrabold text-[#183B2A]">
                  {pickerMode === "from" ? "Select start date" : "Select end date"}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  className="min-h-11 justify-center px-2"
                  onPress={confirmIOSDatePicker}
                >
                  <Text className="text-sm font-extrabold text-[#1A6A3B]">Done</Text>
                </Pressable>
              </View>
              <DateTimePicker
                accentColor="#1A6A3B"
                display="spinner"
                mode="date"
                onValueChange={(_event, value) => setPickerDraft(value)}
                themeVariant="light"
                value={pickerDraft}
              />
            </View>
          </View>
        </Modal>
      ) : null}
    </View>
  );
}
