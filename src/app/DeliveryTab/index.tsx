import { useCallback, useEffect, useRef, useState } from "react";
import { router } from "expo-router";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import {
  ArrowRight,
  Bike,
  CalendarDays,
  CalendarCheck2,
  Clock3,
  IndianRupee,
  MapPin,
  PackageCheck,
  Power,
  RefreshCw,
  Timer,
  UserRound,
  X,
  Zap,
} from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import api, { getApiErrorMessage } from "../../lib/api";
import { useCustomAlert } from "../../contexts/CustomAlertContext";

type Attendance = {
  check_in?: string | null;
  check_out?: string | null;
  duration_seconds?: number | null;
  total_hours?: string | number | null;
  status?: string | null;
};

type DeliveryOrder = {
  id: string;
  [key: string]: unknown;
};

type DashboardData = {
  is_online?: boolean;
  isOnline?: boolean;
  isCheckedIn?: boolean;
  attendance?: Attendance | null;
  summary?: Record<string, number | string | null | undefined>;
  stats?: Record<string, number | string | null | undefined>;
  active_order?: DeliveryOrder | null;
  activeOrder?: DeliveryOrder | null;
};

type AttendanceRecord = Attendance & {
  id?: string | number;
  date?: string | null;
};

type MetricDefinition = {
  key: string;
  label: string;
  caption: string;
  Icon: typeof PackageCheck;
  colors: [string, string];
};

const metrics: MetricDefinition[] = [
  {
    key: "newOrders",
    label: "New orders",
    caption: "Awaiting action",
    Icon: Clock3,
    colors: ["#D83291", "#EC53B0"],
  },
  {
    key: "todayOrders",
    label: "Today's orders",
    caption: "Assigned today",
    Icon: PackageCheck,
    colors: ["#0D9B7B", "#20C997"],
  },
];

function unwrapDashboard(responseData: unknown): DashboardData | null {
  if (typeof responseData !== "object" || responseData === null) return null;
  const root = responseData as Record<string, unknown>;
  const payload = root.dashboard ?? root.data ?? root;
  return typeof payload === "object" && payload !== null
    ? (payload as DashboardData)
    : null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function firstText(record: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" || typeof value === "number") {
      const text = String(value).trim();
      if (text) return text;
    }
  }
  return "";
}

function normalizeOrders(responseData: unknown): DeliveryOrder[] {
  const root = asRecord(responseData);
  const nested = asRecord(root?.data);
  const ordersValue = Array.isArray(responseData)
    ? responseData
    : root?.orders ?? nested?.orders ?? root?.data;
  if (!Array.isArray(ordersValue)) {
    throw new Error("The assigned orders response was invalid.");
  }

  const orders = ordersValue.flatMap((value) => {
    const order = asRecord(value);
    if (!order) return [];
    const id = firstText(order, ["order_id", "id", "order_number"]);
    return id ? [{ ...order, id }] : [];
  });
  return [...new Map(orders.map((order) => [order.id, order])).values()];
}

function getOrderDate(order: DeliveryOrder): Date | null {
  const value = firstText(order, ["order_date", "created_at", "createdAt"]);
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isToday(date: Date | null): boolean {
  if (!date) return false;
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

function formatTime(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDate(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });
}

function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  return hours > 0
    ? `${hours}h ${minutes}m ${remainder}s`
    : `${minutes}m ${remainder}s`;
}

export default function DeliveryPartnerScreen() {
  const { showAlert } = useCustomAlert();
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [orders, setOrders] = useState<DeliveryOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [ordersError, setOrdersError] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isAvailabilityBusy, setIsAvailabilityBusy] = useState(false);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [liveSeconds, setLiveSeconds] = useState(0);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<AttendanceRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [checkInBusy, setCheckInBusy] = useState(false);
  const [checkInError, setCheckInError] = useState("");
  const [showAttendancePrompt, setShowAttendancePrompt] = useState(false);
  const hasLoadedDashboard = useRef(false);

  useEffect(() => {
    let active = true;
    api
      .get("/delivery-partner/dashboard")
      .then((response) => {
        const data = unwrapDashboard(response.data);
        if (!data) throw new Error("Dashboard response was empty.");
        if (!active) return;
        setDashboard(data);
        setErrorMessage("");
        if (!hasLoadedDashboard.current) {
          hasLoadedDashboard.current = true;
          setShowAttendancePrompt(
            !Boolean(data.isCheckedIn ?? (data.attendance?.check_in && !data.attendance.check_out)),
          );
        }
        if (data.attendance?.duration_seconds != null) {
          setLiveSeconds(Number(data.attendance.duration_seconds) || 0);
        }
      })
      .catch((error: unknown) => {
        console.error("Failed to load delivery dashboard:", error);
        if (active) {
          setErrorMessage(
            getApiErrorMessage(error, "The delivery dashboard service is unavailable."),
          );
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
          setRefreshing(false);
        }
      });

    return () => {
      active = false;
    };
  }, [refreshVersion]);

  const attendance = dashboard?.attendance ?? null;
  const isOnline = Boolean(dashboard?.is_online ?? dashboard?.isOnline);
  const isCheckedIn = Boolean(
    dashboard?.isCheckedIn ??
      (attendance?.check_in && !attendance.check_out),
  );
  const summary = dashboard?.summary ?? dashboard?.stats ?? {};
  const todayOrders = orders
    .filter((order) => isToday(getOrderDate(order)))
    .sort(
      (first, second) =>
        (getOrderDate(second)?.getTime() ?? 0) - (getOrderDate(first)?.getTime() ?? 0),
    );
  const newOrderCount = orders.filter((order) =>
    ["NEW", "NEW_ORDER", "PENDING", "ORDER_PLACED"].includes(
      firstText(order, ["order_status", "status"])
        .toUpperCase()
        .replace(/[\s-]+/g, "_"),
    ),
  ).length;

  useEffect(() => {
    let active = true;
    setOrdersLoading(true);
    api
      .get("/delivery-partner/orders")
      .then((response) => {
        const result = normalizeOrders(response.data);
        if (!active) return;
        setOrders(result);
        setOrdersError("");
      })
      .catch((error: unknown) => {
        console.error("Failed to load today's assigned delivery orders:", error);
        if (active) {
          setOrders([]);
          setOrdersError(
            getApiErrorMessage(error, "Today's assigned orders are unavailable."),
          );
        }
      })
      .finally(() => {
        if (active) setOrdersLoading(false);
      });

    return () => {
      active = false;
    };
  }, [refreshVersion]);

  useEffect(() => {
    if (!isOnline || !isCheckedIn) return;
    const interval = setInterval(() => setLiveSeconds((value) => value + 1), 1000);
    return () => clearInterval(interval);
  }, [isOnline, isCheckedIn]);

  const checkInAndContinue = async () => {
    if (checkInBusy) return;
    setCheckInBusy(true);
    setCheckInError("");
    try {
      const response = await api.post("/attendance/clock-in");
      const root = response.data as Record<string, unknown>;
      const record = root.data;
      if (typeof record !== "object" || record === null) {
        throw new Error("Clock-in response did not include attendance details.");
      }
      const attendanceRecord = record as Attendance;
      setDashboard((current) =>
        current
          ? { ...current, attendance: attendanceRecord, isCheckedIn: true }
          : current,
      );
      setLiveSeconds(Number(attendanceRecord.duration_seconds) || 0);
      setShowAttendancePrompt(false);
    } catch (error: unknown) {
      console.error("Failed to check in delivery partner:", error);
      setCheckInError(getApiErrorMessage(error, "Unable to check in. Please try again."));
    } finally {
      setCheckInBusy(false);
    }
  };

  const refreshDashboard = useCallback(() => {
    setRefreshing(true);
    setRefreshVersion((value) => value + 1);
  }, []);

  const updateAvailability = async (
    requestedState: boolean,
    clockOut = false,
  ) => {
    if (isAvailabilityBusy) return;
    setIsAvailabilityBusy(true);
    setErrorMessage("");
    try {
      const response = await api.patch("/delivery-partner/availability", {
        is_online: requestedState,
        ...(clockOut ? { clock_out: true } : {}),
      });
      const root = response.data as Record<string, unknown>;
      const result = (root.data ?? root) as Partial<DashboardData> & {
        is_online?: boolean;
      };
      setDashboard((current) => ({
        ...current,
        ...result,
        is_online: result.is_online ?? requestedState,
        isCheckedIn: clockOut ? false : result.isCheckedIn ?? (requestedState || current?.isCheckedIn),
        attendance: result.attendance ?? current?.attendance,
      }));
      if (result.attendance?.duration_seconds != null) {
        setLiveSeconds(Number(result.attendance.duration_seconds) || 0);
      }
      showAlert({
        title: clockOut
          ? "Shift ended"
          : requestedState
            ? "You are online"
            : "You are offline",
        message: clockOut
          ? `You have clocked out. Total hours: ${result.attendance?.total_hours ?? "—"}.`
          : requestedState
            ? "You are checked in and ready to receive deliveries."
            : "You will no longer receive new delivery assignments.",
        variant: "success",
      });
    } catch (error: unknown) {
      console.error("Failed to update delivery partner availability:", error);
      showAlert({
        title: "Could not update availability",
        message: getApiErrorMessage(error, "Please try again."),
        variant: "error",
      });
    } finally {
      setIsAvailabilityBusy(false);
    }
  };

  const confirmClockOut = () => {
    showAlert({
      title: "End your shift?",
      message: "You will be taken offline and clocked out for today.",
      variant: "confirm",
      actions: [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clock out",
          style: "destructive",
          onPress: () => void updateAvailability(false, true),
        },
      ],
    });
  };

  const loadAttendanceHistory = async () => {
    setShowHistory(true);
    setHistoryLoading(true);
    setHistoryError("");
    try {
      const response = await api.get("/attendance/my-history?limit=30");
      const root = response.data as Record<string, unknown>;
      const records = root.data ?? root.records;
      if (!Array.isArray(records)) {
        throw new Error("Attendance history response was invalid.");
      }
      setHistory(records as AttendanceRecord[]);
    } catch (error: unknown) {
      console.error("Failed to load delivery attendance history:", error);
      setHistoryError(getApiErrorMessage(error, "Unable to load attendance history."));
    } finally {
      setHistoryLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-[#F5F7F3]" edges={[]}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 12, paddingBottom: 24 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refreshDashboard}
            tintColor="#17663D"
          />
        }
        showsVerticalScrollIndicator={false}
      >
       

        <View
          className={`overflow-hidden rounded-[24px] border p-5 ${
            isOnline
              ? "border-emerald-300 bg-[#0E4835]"
              : isCheckedIn
                ? "border-amber-300 bg-[#4A351A]"
                : "border-[#30463A] bg-[#16271C]"
          }`}
        >
          <View className="flex-row items-start">
            <View className="mr-3 h-12 w-12 items-center justify-center rounded-2xl border border-white/20 bg-white/10">
              {isOnline ? (
                <Bike color="#6EE7B7" size={24} />
              ) : (
                <Power color={isCheckedIn ? "#FCD34D" : "#CBD5D1"} size={24} />
              )}
            </View>
            <View className="flex-1">
              <View
                className={`self-start rounded-full px-3 py-1 ${
                  isOnline
                    ? "bg-emerald-400/20"
                    : isCheckedIn
                      ? "bg-amber-400/20"
                      : "bg-white/10"
                }`}
              >
                <Text
                  className={`text-[10px] font-extrabold uppercase tracking-wide ${
                    isOnline
                      ? "text-emerald-200"
                      : isCheckedIn
                        ? "text-amber-200"
                        : "text-slate-200"
                  }`}
                >
                  {isOnline
                    ? "Online · Ready for deliveries"
                    : isCheckedIn
                      ? "Paused · Currently offline"
                      : "Offline · Check-in required"}
                </Text>
              </View>
              <Text className="mt-2 text-lg font-extrabold text-white">
                {isOnline
                  ? "You are online and on duty"
                  : attendance?.check_out
                    ? "Shift completed for today"
                    : isCheckedIn
                      ? "You are temporarily offline"
                      : "You are offline"}
              </Text>
              <Text className="mt-1 text-xs leading-5 text-white/75">
                {isOnline
                  ? `Attendance checked in at ${formatTime(attendance?.check_in)}. New delivery requests can be assigned to you.`
                  : isCheckedIn
                    ? `You checked in at ${formatTime(attendance?.check_in)}. Go online when you're ready to resume.`
                    : "Check in now to go online and start receiving customer delivery orders."}
              </Text>
            </View>
          </View>

          {isOnline ? (
            <View className="mt-4 flex-row items-center rounded-xl border border-white/15 bg-white/10 p-3">
              <Timer color="#6EE7B7" size={20} />
              <View className="ml-3 flex-1">
                <Text className="text-[9px] font-bold uppercase tracking-wider text-emerald-100">
                  Duty duration
                </Text>
                <Text className="mt-0.5 font-mono text-base font-extrabold text-white">
                  {formatDuration(liveSeconds)}
                </Text>
              </View>
            </View>
          ) : null}

          <View className="mt-4 flex-row flex-wrap justify-between gap-y-2">
            {isOnline ? (
              <>
                <ActionButton
                  label="Go offline"
                  Icon={Power}
                  disabled={isAvailabilityBusy}
                  variant="secondary"
                  onPress={() => void updateAvailability(false)}
                />
                <ActionButton
                  label="Clock out"
                  Icon={X}
                  disabled={isAvailabilityBusy}
                  variant="danger"
                  onPress={confirmClockOut}
                />
              </>
            ) : (
              <ActionButton
                label={
                  isAvailabilityBusy
                    ? "Updating..."
                    : attendance?.check_out
                      ? "Resume shift & go online"
                      : "Go online & check in"
                }
                Icon={Zap}
                disabled={isAvailabilityBusy || loading}
                variant="primary"
                onPress={() => void updateAvailability(true)}
              />
            )}
            <ActionButton
              label="Attendance"
              Icon={CalendarCheck2}
              variant="secondary"
              onPress={() => router.push("/DeliveryTab/attendance")}
            />
            <ActionButton
              label="History"
              Icon={CalendarDays}
              variant="secondary"
              onPress={() => void loadAttendanceHistory()}
            />
          </View>
        </View>

        <View className="mt-5">
          <Text className="mb-3 text-base font-extrabold text-[#17251E]">
            Quick actions
          </Text>
          <View className="flex-row flex-wrap justify-between">
            {([
              {
                label: "Orders",
                description: "View assigned orders",
                Icon: PackageCheck,
                route: "/DeliveryTab/orders",
              },
              {
                label: "Earnings",
                description: "Check your income",
                Icon: IndianRupee,
                route: "/DeliveryTab/earnings",
              },
              {
                label: "Attendance",
                description: "View your shifts",
                Icon: CalendarCheck2,
                route: "/DeliveryTab/attendance",
              },
              {
                label: "Profile",
                description: "Manage your account",
                Icon: UserRound,
                route: "/DeliveryTab/profile",
              },
            ] as const).map(({ label, description, Icon, route }) => (
              <Pressable
                accessibilityRole="button"
                className="mb-3 min-h-[92px] w-[48.5%] flex-row items-center rounded-2xl border border-[#E2E9E3] bg-white p-3 active:bg-[#F4F8F3]"
                key={label}
                onPress={() => router.push(route)}
              >
                <View className="mr-3 h-10 w-10 items-center justify-center rounded-xl bg-[#EAF2E8]">
                  <Icon color="#21643A" size={19} />
                </View>
                <View className="min-w-0 flex-1">
                  <Text className="text-sm font-extrabold text-[#17251E]">
                    {label}
                  </Text>
                  <Text
                    className="mt-1 text-[10px] leading-4 text-slate-500"
                    numberOfLines={2}
                  >
                    {description}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        </View>

        {errorMessage ? (
          <View className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <Text className="text-sm font-bold text-amber-900">Dashboard data notice</Text>
            <Text className="mt-1 text-sm leading-5 text-amber-800">{errorMessage}</Text>
            <Pressable
              accessibilityRole="button"
              className="mt-3 self-start rounded-lg bg-amber-800 px-4 py-2"
              onPress={refreshDashboard}
            >
              <Text className="text-xs font-bold text-white">Try again</Text>
            </Pressable>
          </View>
        ) : null}

        <View className="mt-5 flex-row flex-wrap justify-between">
          {metrics.map(({ key, label, caption, Icon, colors }) => {
            const value =
              key === "todayOrders"
                ? todayOrders.length
                : key === "newOrders"
                  ? newOrderCount
                  : summary[key];
            return (
              <View
                key={key}
                className="mb-3 min-h-[146px] overflow-hidden rounded-[20px] p-4"
                style={{ width: "48.5%", backgroundColor: colors[0] }}
              >
                <View className="flex-row items-start justify-between">
                  <Text className="mr-2 flex-1 text-[10px] font-extrabold uppercase tracking-wide text-white/90">
                    {label}
                  </Text>
                  <View
                    className="h-9 w-9 items-center justify-center rounded-xl border border-white/25"
                    style={{ backgroundColor: colors[1] }}
                  >
                    <Icon color="#FFFFFF" size={17} strokeWidth={2.3} />
                  </View>
                </View>
                {ordersLoading ? (
                  <View className="mt-3 h-8 w-16 rounded-lg bg-white/25" />
                ) : (
                  <Text
                    className="mt-3 text-[25px] font-black text-white"
                    numberOfLines={1}
                    adjustsFontSizeToFit
                  >
                    {String(value ?? 0)}
                  </Text>
                )}
                <View className="mt-auto self-start rounded-full border border-white/25 bg-white/15 px-2.5 py-1">
                  <Text className="text-[9px] font-bold text-white">{caption}</Text>
                </View>
              </View>
            );
          })}
        </View>

        <View className="mb-5 rounded-[24px] border border-[#E2E9E3] bg-white p-4">
          <View className="flex-row items-center justify-between">
            <View className="mr-3 flex-1">
              <Text className="text-[10px] font-extrabold uppercase tracking-[1.5px] text-[#39804F]">
                Assigned deliveries
              </Text>
              <Text className="mt-1 text-lg font-extrabold text-[#17251E]">
                Today&apos;s orders
              </Text>
            </View>
            <View className="mr-2 min-w-9 items-center rounded-full bg-[#EAF2E8] px-3 py-2">
              <Text className="text-sm font-extrabold text-[#21643A]">
                {todayOrders.length}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open all delivery orders"
              className="h-10 w-10 items-center justify-center rounded-xl bg-[#F4F7F2]"
              onPress={() => router.push("/DeliveryTab/orders")}
            >
              <ArrowRight color="#21643A" size={18} />
            </Pressable>
          </View>

          {ordersLoading ? (
            <View className="mt-4 min-h-28 items-center justify-center rounded-2xl bg-[#F7F9F7]">
              <ActivityIndicator color="#17663D" />
              <Text className="mt-2 text-xs font-medium text-slate-500">
                Loading today&apos;s orders…
              </Text>
            </View>
          ) : ordersError ? (
            <View className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <Text className="text-sm font-bold text-amber-900">
                Could not load today&apos;s orders
              </Text>
              <Text className="mt-1 text-xs leading-5 text-amber-800">{ordersError}</Text>
            </View>
          ) : todayOrders.length ? (
            todayOrders.map((order) => {
              const customer = asRecord(order.customer);
              const customerName =
                firstText(order, ["customer_name"]) ||
                firstText(customer ?? {}, ["name", "full_name", "fullName"]) ||
                "Customer";
              const location = [
                firstText(order, ["delivery_address", "dropoff_address", "address_line"]),
                firstText(order, ["area_locality"]),
                firstText(order, ["city"]),
              ]
                .filter(Boolean)
                .join(", ");
              const status = firstText(order, ["order_status", "status"]) || "New";
              const normalizedStatus = status.toUpperCase().replace(/[\s-]+/g, "_");
              const statusStyle =
                normalizedStatus === "DELIVERED" || normalizedStatus === "COMPLETED"
                  ? { backgroundColor: "#EAF4E4", color: "#17663D" }
                  : normalizedStatus === "CANCELLED"
                    ? { backgroundColor: "#FFF0F2", color: "#C51D42" }
                    : { backgroundColor: "#FFF6D8", color: "#A85B00" };
              const placedAt = getOrderDate(order);
              const orderNumber = firstText(order, ["order_number", "order_id", "id"]);

              return (
                <View
                  className="mt-3 rounded-2xl border border-[#E6ECE7] bg-[#FAFCFA] p-4"
                  key={order.id}
                >
                  <View className="flex-row items-center">
                    <View className="mr-3 h-10 w-10 items-center justify-center rounded-xl bg-[#EAF2E8]">
                      <PackageCheck color="#21643A" size={19} />
                    </View>
                    <View className="flex-1">
                      <Text className="text-xs font-bold text-slate-500">
                        Order #{orderNumber}
                      </Text>
                      <Text className="mt-0.5 text-sm font-extrabold text-[#17251E]">
                        {customerName}
                      </Text>
                    </View>
                    <View
                      className="rounded-full px-2.5 py-1.5"
                      style={{ backgroundColor: statusStyle.backgroundColor }}
                    >
                      <Text
                        className="text-[10px] font-bold"
                        style={{ color: statusStyle.color }}
                      >
                        {status.replace(/_/g, " ")}
                      </Text>
                    </View>
                  </View>
                  <View className="mt-3 flex-row items-start border-t border-[#E8EEE8] pt-3">
                    <MapPin color="#39804F" size={16} />
                    <Text
                      className="ml-2 flex-1 text-xs leading-5 text-slate-600"
                      numberOfLines={2}
                    >
                      {location || "Delivery location pending"}
                    </Text>
                    <View className="ml-2 max-w-[120px] flex-row items-center">
                      <Clock3 color="#839087" size={13} />
                      <Text
                        className="ml-1 text-right text-[10px] font-semibold text-slate-500"
                        numberOfLines={1}
                      >
                        {placedAt
                          ? placedAt.toLocaleString([], {
                              day: "numeric",
                              month: "short",
                              hour: "numeric",
                              minute: "2-digit",
                            })
                          : "Date unavailable"}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })
          ) : (
            <View className="mt-4 items-center rounded-2xl bg-[#F7F9F7] px-5 py-7">
              <View className="h-12 w-12 items-center justify-center rounded-2xl bg-white">
                <CalendarDays color="#5B8063" size={22} />
              </View>
              <Text className="mt-3 text-sm font-extrabold text-[#24372D]">
                No assigned orders today
              </Text>
              <Text className="mt-1 text-center text-xs leading-5 text-slate-500">
                {isOnline
                  ? "You are online and ready for new delivery assignments."
                  : "Go online when you are ready to receive delivery assignments."}
              </Text>
            </View>
          )}
        </View>

      </ScrollView>

      <Modal
        animationType="slide"
        onRequestClose={() => setShowHistory(false)}
        transparent
        visible={showHistory}
      >
        <View className="flex-1 justify-end bg-black/50">
          <Pressable
            accessibilityLabel="Close attendance history"
            className="absolute inset-0"
            onPress={() => setShowHistory(false)}
          />
          <View className="max-h-[78%] rounded-t-[28px] bg-[#FFFCF6] px-5 pb-8 pt-4">
            <View className="mb-4 flex-row items-center justify-between">
              <View className="flex-row items-center">
                <CalendarDays color="#17663D" size={20} />
                <View className="ml-3">
                  <Text className="text-lg font-extrabold text-[#183B2A]">
                    Attendance history
                  </Text>
                  <Text className="text-xs text-slate-500">
                    Recent check-ins and completed shifts
                  </Text>
                </View>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close history"
                className="h-10 w-10 items-center justify-center rounded-full bg-[#F1EEE7]"
                onPress={() => setShowHistory(false)}
              >
                <X color="#53645A" size={20} />
              </Pressable>
            </View>
            {historyLoading ? (
              <View className="items-center py-12">
                <ActivityIndicator color="#17663D" />
                <Text className="mt-3 text-sm text-slate-500">Loading attendance history...</Text>
              </View>
            ) : historyError ? (
              <Text accessibilityRole="alert" className="py-8 text-center text-sm text-rose-700">
                {historyError}
              </Text>
            ) : history.length === 0 ? (
              <Text className="py-10 text-center text-sm text-slate-500">
                No attendance logs found yet.
              </Text>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                {history.map((record, index) => (
                  <View
                    key={record.id ?? `${record.date ?? "attendance"}-${index}`}
                    className="mb-3 rounded-2xl border border-[#E7E0D8] bg-white p-4"
                  >
                    <View className="flex-row items-center justify-between">
                      <Text className="font-bold text-[#17251E]">{formatDate(record.date)}</Text>
                      <Text className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-800">
                        {record.status || (record.check_out ? "Completed" : "Active")}
                      </Text>
                    </View>
                    <View className="mt-3 flex-row">
                      <HistoryValue label="Check in" value={formatTime(record.check_in)} />
                      <HistoryValue
                        label="Check out"
                        value={record.check_out ? formatTime(record.check_out) : "Active"}
                      />
                      <HistoryValue
                        label="Hours"
                        value={
                          record.total_hours == null
                            ? record.check_out
                              ? "—"
                              : "In progress"
                            : `${record.total_hours} hrs`
                        }
                      />
                    </View>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
      <Modal
        animationType="fade"
        onRequestClose={() => undefined}
        transparent
        visible={showAttendancePrompt && dashboard !== null}
      >
        <View className="flex-1 items-center justify-center bg-[#292D3A]/85 px-7">
          <View
            accessibilityViewIsModal
            className="w-full max-w-[560px] items-center rounded-[20px] bg-white px-6 pb-8 pt-9"
          >
            <View className="h-[70px] w-[70px] items-center justify-center rounded-[22px] bg-[#D1FAE8]">
              <CalendarCheck2 color="#00805A" size={34} strokeWidth={2.2} />
            </View>
            <Text className="mt-5 text-xs font-extrabold tracking-[2.5px] text-[#00805A]">
              STAFF ATTENDANCE
            </Text>
            <Text className="mt-3 text-center text-[29px] font-black leading-[36px] text-[#111827]">
              Mark your attendance
            </Text>
            <Text className="mt-2 text-center text-base leading-[25px] text-[#52627A]">
              Check in to begin your shift. You can access the staff pages after your
              attendance is recorded.
            </Text>
            {checkInError ? (
              <Text
                accessibilityRole="alert"
                className="mt-4 text-center text-sm font-semibold text-red-700"
              >
                {checkInError}
              </Text>
            ) : null}
            <Pressable
              accessibilityRole="button"
              className={`mt-8 min-h-[56px] w-full flex-row items-center justify-center rounded-2xl bg-[#00805A] px-4 ${
                checkInBusy ? "opacity-70" : "active:opacity-80"
              }`}
              disabled={checkInBusy}
              onPress={() => void checkInAndContinue()}
            >
              {checkInBusy ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <CalendarCheck2 color="#FFFFFF" size={20} strokeWidth={2.2} />
                  <Text className="ml-3 text-base font-extrabold text-white">
                    Check In &amp; Continue
                  </Text>
                </>
              )}
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function ActionButton({
  label,
  Icon,
  disabled = false,
  variant,
  onPress,
}: {
  label: string;
  Icon: typeof Power;
  disabled?: boolean;
  variant: "primary" | "secondary" | "danger";
  onPress: () => void;
}) {
  const variantClass = {
    primary: "bg-[#1E9B64]",
    secondary: "border border-white/25 bg-white/10",
    danger: "bg-rose-600",
  }[variant];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      className={`min-h-11 w-[48.5%] flex-row items-center justify-center rounded-xl px-3 ${variantClass} ${
        disabled ? "opacity-60" : "active:opacity-80"
      }`}
      disabled={disabled}
      onPress={onPress}
    >
      {disabled && variant === "primary" ? (
        <ActivityIndicator color="#FFFFFF" size="small" />
      ) : (
        <Icon color="#FFFFFF" size={14} />
      )}
      <Text className="ml-1.5 text-[11px] font-bold text-white">{label}</Text>
    </Pressable>
  );
}

function HistoryValue({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-1">
      <Text className="text-[10px] text-slate-500">{label}</Text>
      <Text className="mt-1 text-xs font-bold text-slate-800">{value}</Text>
    </View>
  );
}
