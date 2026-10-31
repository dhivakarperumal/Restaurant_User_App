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
  CheckCircle2,
  Clock3,
  IndianRupee,
  MapPin,
  PackageCheck,
  Power,
  RefreshCw,
  Timer,
  WalletCards,
  X,
  XCircle,
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
  id?: string | number;
  order_number?: string | number | null;
  customer_name?: string | null;
  address_line?: string | null;
  area_locality?: string | null;
  city?: string | null;
  status?: string | null;
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
  isMoney?: boolean;
};

const metrics: MetricDefinition[] = [
  {
    key: "todayDeliveries",
    label: "Today's deliveries",
    caption: "Today",
    Icon: PackageCheck,
    colors: ["#0D9B7B", "#20C997"],
  },
  {
    key: "newOrders",
    label: "New orders",
    caption: "Awaiting action",
    Icon: Clock3,
    colors: ["#D83291", "#EC53B0"],
  },
  {
    key: "assignedOrders",
    label: "Assigned",
    caption: "Assigned to you",
    Icon: Bike,
    colors: ["#5C53CF", "#8066E9"],
  },
  {
    key: "pickupPending",
    label: "Pickup pending",
    caption: "Pickup stage",
    Icon: MapPin,
    colors: ["#E68B00", "#F8B929"],
  },
  {
    key: "deliveredOrders",
    label: "Delivered",
    caption: "Completed",
    Icon: CheckCircle2,
    colors: ["#16854E", "#2FB86C"],
  },
  {
    key: "cancelledOrders",
    label: "Cancelled",
    caption: "Closed",
    Icon: XCircle,
    colors: ["#C93755", "#E76473"],
  },
  {
    key: "todayEarnings",
    label: "Today's earnings",
    caption: "Today",
    Icon: IndianRupee,
    colors: ["#63A82D", "#92C94B"],
    isMoney: true,
  },
  {
    key: "totalEarnings",
    label: "Total earnings",
    caption: "Lifetime",
    Icon: WalletCards,
    colors: ["#14553A", "#267653"],
    isMoney: true,
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

function formatMoney(value: unknown): string {
  if (value == null || value === "") return "—";
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "—";
  return `₹${amount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
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
  const activeOrder = dashboard?.active_order ?? dashboard?.activeOrder ?? null;

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

          <View className="mt-4 flex-row flex-wrap gap-2">
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
          {metrics.map(({ key, label, caption, Icon, colors, isMoney }) => {
            const value = summary[key];
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
                {loading ? (
                  <View className="mt-3 h-8 w-16 rounded-lg bg-white/25" />
                ) : (
                  <Text
                    className="mt-3 text-[25px] font-black text-white"
                    numberOfLines={1}
                    adjustsFontSizeToFit
                  >
                    {isMoney ? formatMoney(value) : String(value ?? 0)}
                  </Text>
                )}
                <View className="mt-auto self-start rounded-full border border-white/25 bg-white/15 px-2.5 py-1">
                  <Text className="text-[9px] font-bold text-white">{caption}</Text>
                </View>
              </View>
            );
          })}
        </View>

        <View className="mb-5 rounded-2xl border border-[#E2E9E3] bg-white p-4">
          <View className="flex-row items-center justify-between">
            <View>
              <Text className="text-[10px] font-extrabold uppercase tracking-[1.5px] text-[#39804F]">
                On the road
              </Text>
              <Text className="mt-1 text-lg font-extrabold text-[#17251E]">
                Active delivery
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              className="flex-row items-center rounded-xl bg-[#EAF2E8] px-3 py-2"
              onPress={() => router.push("/DeliveryTab/orders")}
            >
              <Text className="text-xs font-bold text-[#21643A]">Open orders</Text>
              <ArrowRight color="#21643A" size={15} style={{ marginLeft: 5 }} />
            </Pressable>
          </View>

          {activeOrder ? (
            <View className="mt-4 rounded-xl bg-[#F5F8F5] p-4">
              <View className="flex-row items-center justify-between">
                <Text className="text-xs font-semibold text-slate-500">
                  Order #{activeOrder.order_number || activeOrder.id || "—"}
                </Text>
                {activeOrder.status ? (
                  <Text className="rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-bold text-emerald-800">
                    {activeOrder.status}
                  </Text>
                ) : null}
              </View>
              <Text className="mt-2 text-base font-extrabold text-[#17251E]">
                {activeOrder.customer_name || "Customer"}
              </Text>
              <View className="mt-2 flex-row items-start">
                <MapPin color="#39804F" size={16} />
                <Text className="ml-2 flex-1 text-sm leading-5 text-slate-600">
                  {[
                    activeOrder.address_line,
                    activeOrder.area_locality,
                    activeOrder.city,
                  ]
                    .filter(Boolean)
                    .join(", ") || "Delivery location pending"}
                </Text>
              </View>
            </View>
          ) : (
            <View className="mt-4 flex-row items-center rounded-xl bg-[#F7F9F7] p-4">
              <PackageCheck color="#5B8063" size={20} />
              <Text className="ml-3 flex-1 text-sm leading-5 text-slate-600">
                {isOnline
                  ? "No active delivery right now. You are online and waiting for new assignments."
                  : "Go online to start receiving delivery assignments."}
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
      className={`min-h-10 flex-row items-center justify-center rounded-xl px-3 ${variantClass} ${
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
