import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
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
import api, { getApiErrorMessage } from "../../lib/api";

type FilterKey = "new" | "all" | "delivery" | "cancelled";
type OrderView = {
  key: FilterKey;
  label: string;
  statuses: readonly string[] | null;
};

const ORDER_VIEWS: OrderView[] = [
  { key: "new", label: "New", statuses: ["NEW", "NEW_ORDER", "PENDING", "ORDER_PLACED"] },
  { key: "all", label: "All", statuses: null },
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

function formatAmount(value: unknown): string {
  const amount = Number(value);
  return `₹${(Number.isFinite(amount) ? amount : 0).toLocaleString("en-IN")}`;
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
      className="mr-3 min-h-[118px] w-[148px] justify-between rounded-2xl p-4"
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

  const selectedView = ORDER_VIEWS.find((view) => view.key === activeFilter) ?? ORDER_VIEWS[1];
  const filteredOrders = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return orders.filter((order) => {
      const normalized = normalizeStatus(order.order_status);
      const matchesView = !selectedView.statuses || selectedView.statuses.includes(normalized);
      const dateKey = getDateKey(getOrderDate(order));
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
  }, [dateFrom, dateTo, orders, search, selectedView]);

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

    return (
      <Pressable
        accessibilityRole="button"
        className="mb-3 rounded-2xl border border-[#E7EDE7] bg-white p-4 active:border-[#A8C5AE]"
        key={orderIdentifier(order)}
        onPress={() => setSelectedOrder(order)}
      >
        <View className="flex-row items-start justify-between">
          <View className="mr-3 flex-1">
            <Text className="text-xs font-semibold text-slate-500">
              Order {orderIdentifier(order)}
            </Text>
            <Text className="mt-1 text-base font-extrabold text-[#17251E]">
              {customerName}
            </Text>
          </View>
          {renderStatus(order.order_status)}
        </View>
        <View className="mt-4 border-l-2 border-[#D9E5DB] pl-3">
          <Text className="text-xs leading-5 text-slate-600" numberOfLines={2}>
            <Text className="font-bold text-[#24372D]">Pickup · </Text>
            {pickup || "Pickup location pending"}
          </Text>
          <Text className="mt-1 text-xs leading-5 text-slate-600" numberOfLines={2}>
            <Text className="font-bold text-[#24372D]">Drop-off · </Text>
            {dropoff || "Delivery location pending"}
          </Text>
        </View>
        <View className="mt-4 flex-row items-center justify-between">
          <Text className="flex-1 text-xs text-slate-500" numberOfLines={1}>
            {formatDate(getOrderDate(order))}
          </Text>
          <Text className="ml-3 text-sm font-extrabold text-[#17663D]">
            {formatAmount(order.delivery_charge)} delivery
          </Text>
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
        <View className="mb-5 flex-row items-center justify-between">
          <View className="mr-3 flex-1">
            <Text className="text-[10px] font-extrabold uppercase tracking-[1.6px] text-[#39754A]">
              Deliveries
            </Text>
            <Text className="mt-1 text-2xl font-black text-[#17251E]">Your orders</Text>
            <Text className="mt-1 text-xs leading-5 text-slate-500">
              Only deliveries assigned to your account appear here.
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Refresh delivery orders"
            className="h-11 w-11 items-center justify-center rounded-xl border border-[#E1E8E1] bg-white"
            disabled={loading || refreshing}
            onPress={refreshOrders}
          >
            {loading || refreshing ? (
              <ActivityIndicator color="#17663D" size="small" />
            ) : (
              <RefreshCw color="#53645A" size={18} />
            )}
          </Pressable>
        </View>

        <ScrollView
          className="mb-5"
          contentContainerStyle={{ paddingRight: 4 }}
          horizontal
          showsHorizontalScrollIndicator={false}
        >
          <SummaryCard
            label="New orders"
            count={counts.newOrders}
            caption="Awaiting action"
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
        </ScrollView>

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
                    selectedOrder.items.map((item, index) => (
                      <View
                        className="mt-3 flex-row justify-between border-b border-[#F0F2EE] pb-2"
                        key={firstText(item, ["id", "food_id"]) || `${index}`}
                      >
                        <Text className="mr-3 flex-1 text-xs text-[#39483F]">
                          {firstText(item, ["food_name", "name", "product_name"]) || "Food item"}
                        </Text>
                        <Text className="text-xs font-semibold text-slate-500">
                          × {firstText(item, ["quantity", "qty"]) || "1"}
                        </Text>
                      </View>
                    ))
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
                  <View className="mt-2 flex-row justify-between">
                    <Text className="text-xs font-bold text-[#39483F]">Delivery charge</Text>
                    <Text className="text-xs font-extrabold text-[#17663D]">
                      {formatAmount(selectedOrder.delivery_charge)}
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
    </View>
  );
}
