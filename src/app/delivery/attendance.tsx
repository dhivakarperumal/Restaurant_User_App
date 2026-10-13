import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  AlertCircle,
  Bike,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Download,
  Filter,
  History,
  LogOut,
  Play,
  Power,
  RefreshCw,
  RotateCcw,
  Search,
  Timer,
  X,
  Zap,
} from "lucide-react-native";
import api, { getApiErrorMessage } from "../../lib/api";
import { useCustomAlert } from "../../contexts/CustomAlertContext";

type AttendanceRecord = {
  id?: string | number;
  attendance_id?: string | number;
  date?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  check_in?: string | null;
  check_out?: string | null;
  total_hours?: string | number | null;
  duration_seconds?: number | null;
  status?: string | null;
  notes?: string | null;
};

type AttendanceResponse = {
  data?: AttendanceRecord | AttendanceRecord[] | null;
  shift?: ShiftInfo | null;
  employee?: ShiftInfo | null;
  success?: boolean;
};

type ShiftInfo = {
  start_time?: string | null;
  end_time?: string | null;
};

type DashboardResponse = {
  dashboard?: {
    is_online?: boolean;
    isOnline?: boolean;
    attendance?: AttendanceRecord | null;
  };
  data?: {
    is_online?: boolean;
    isOnline?: boolean;
    attendance?: AttendanceRecord | null;
  };
  is_online?: boolean;
  isOnline?: boolean;
  attendance?: AttendanceRecord | null;
};

type StatusFilter = "All" | "Present" | "Late" | "Working" | "Completed";
type MonthFilter = "All" | "current" | "previous";

const statusOptions: { label: string; value: StatusFilter }[] = [
  { label: "All", value: "All" },
  { label: "Present", value: "Present" },
  { label: "Late", value: "Late" },
  { label: "On duty", value: "Working" },
  { label: "Completed", value: "Completed" },
];

function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  return hours > 0
    ? `${hours}h ${minutes}m ${remainder}s`
    : `${minutes}m ${remainder}s`;
}

function formatShortDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

function formatTime(value?: string | null): string {
  if (!value) return "--:--";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "--:--"
    : date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatShiftTime(value?: string | null): string {
  if (!value) return "--:--";
  const [hours, minutes] = value.split(":");
  const date = new Date();
  date.setHours(Number(hours), Number(minutes), 0, 0);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDate(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString([], {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      });
}

function getPayload<T>(response: unknown): T | null {
  if (typeof response !== "object" || response === null) return null;
  const root = response as Record<string, unknown>;
  const data = root.data;
  return (data ?? null) as T | null;
}

function csvCell(value: unknown): string {
  const stringValue = String(value ?? "").replace(/"/g, '""');
  return `"${stringValue}"`;
}

export default function DeliveryAttendanceScreen() {
  const { showAlert } = useCustomAlert();
  const [attendance, setAttendance] = useState<AttendanceRecord | null>(null);
  const [shiftInfo, setShiftInfo] = useState<ShiftInfo | null>(null);
  const [historyRecords, setHistoryRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [availabilityBusy, setAvailabilityBusy] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  const [liveSeconds, setLiveSeconds] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");
  const [historyError, setHistoryError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("All");
  const [monthFilter, setMonthFilter] = useState<MonthFilter>("All");

  const loadTodayData = useCallback(async () => {
    const [attendanceResult, dashboardResult] = await Promise.allSettled([
      api.get<AttendanceResponse>("/attendance/today"),
      api.get<DashboardResponse>("/delivery-partner/dashboard"),
    ]);

    let failureMessage = "";

    if (attendanceResult.status === "fulfilled") {
      const response = attendanceResult.value.data;
      if (response?.success !== false) {
        const record = Array.isArray(response?.data) ? response.data[0] : response?.data;
        setAttendance(record ?? null);
        setShiftInfo(response?.shift ?? response?.employee ?? null);
        if (record?.duration_seconds != null) {
          setLiveSeconds(Number(record.duration_seconds) || 0);
        } else if (!record?.check_in || record.check_out) {
          setLiveSeconds(0);
        }
      }
    } else {
      console.error("Failed to load today's attendance:", attendanceResult.reason);
      failureMessage = getApiErrorMessage(
        attendanceResult.reason,
        "Unable to load today's attendance.",
      );
    }

    if (dashboardResult.status === "fulfilled") {
      const root = dashboardResult.value.data;
      const dashboard = root?.dashboard ?? root?.data ?? root;
      setIsOnline(Boolean(dashboard?.is_online ?? dashboard?.isOnline));
      if (dashboard?.attendance) {
        setAttendance((current) => current ?? dashboard.attendance ?? null);
      }
    } else {
      console.error("Failed to load delivery availability:", dashboardResult.reason);
      failureMessage ||= getApiErrorMessage(
        dashboardResult.reason,
        "Unable to load delivery availability.",
      );
    }

    setErrorMessage(failureMessage);
  }, []);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    setHistoryError("");
    try {
      const response = await api.get("/attendance/my-history?limit=100");
      const root =
        typeof response.data === "object" && response.data !== null
          ? (response.data as Record<string, unknown>)
          : {};
      const records = root.data ?? root.records;
      if (!Array.isArray(records)) {
        throw new Error("Attendance history response was invalid.");
      }
      setHistoryRecords(records as AttendanceRecord[]);
    } catch (error: unknown) {
      console.error("Failed to load delivery attendance history:", error);
      setHistoryError(
        getApiErrorMessage(error, "Unable to load your attendance history."),
      );
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  const refreshAll = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    await Promise.all([loadTodayData(), loadHistory()]);
    setLoading(false);
    setRefreshing(false);
  }, [loadHistory, loadTodayData]);

  useEffect(() => {
    void refreshAll();
  }, [refreshAll]);

  useEffect(() => {
    const isWorkingNow = Boolean(attendance?.check_in && !attendance.check_out);
    if (!isWorkingNow) return;
    const interval = setInterval(() => setLiveSeconds((current) => current + 1), 1000);
    return () => clearInterval(interval);
  }, [attendance?.check_in, attendance?.check_out]);

  const isWorking = Boolean(attendance?.check_in && !attendance.check_out);
  const isCompleted = Boolean(attendance?.check_in && attendance.check_out);

  const stats = useMemo(() => {
    const totalSeconds = historyRecords.reduce((total, record) => {
      if (record.total_hours != null && record.total_hours !== "") {
        return total + (Number(record.total_hours) || 0) * 3600;
      }
      return total + (Number(record.duration_seconds) || 0);
    }, 0);
    const lateCount = historyRecords.filter((record) => record.status === "Late").length;
    const onTimeCount = historyRecords.length - lateCount;
    return {
      totalDays: historyRecords.length,
      totalHours: (totalSeconds / 3600).toFixed(1),
      averageHours: historyRecords.length
        ? (totalSeconds / 3600 / historyRecords.length).toFixed(1)
        : "0.0",
      lateCount,
      onTimeRate: historyRecords.length
        ? Math.round((onTimeCount / historyRecords.length) * 100)
        : 100,
    };
  }, [historyRecords]);

  const filteredRecords = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const previousDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const previousMonth = `${previousDate.getFullYear()}-${String(previousDate.getMonth() + 1).padStart(2, "0")}`;

    return historyRecords.filter((record) => {
      if (query) {
        const searchable = [record.date, record.notes, record.status]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!searchable.includes(query)) return false;
      }

      const recordWorking = Boolean(record.check_in && !record.check_out);
      const recordCompleted = Boolean(record.check_in && record.check_out);
      if (statusFilter === "Working" && !recordWorking) return false;
      if (statusFilter === "Completed" && !recordCompleted) return false;
      if (statusFilter === "Late" && record.status !== "Late") return false;
      if (statusFilter === "Present" && record.status === "Late") return false;

      const recordMonth = (record.date ?? "").slice(0, 7);
      if (monthFilter === "current" && recordMonth !== currentMonth) return false;
      if (monthFilter === "previous" && recordMonth !== previousMonth) return false;
      return true;
    });
  }, [historyRecords, monthFilter, searchTerm, statusFilter]);

  const setAvailability = async (requestedOnline: boolean) => {
    if (availabilityBusy || actionLoading) return;
    setAvailabilityBusy(true);
    try {
      const response = await api.patch("/delivery-partner/availability", {
        is_online: requestedOnline,
      });
      const root =
        typeof response.data === "object" && response.data !== null
          ? (response.data as Record<string, unknown>)
          : {};
      const data = (root.data ?? root) as {
        is_online?: boolean;
        attendance?: AttendanceRecord | null;
      };
      setIsOnline(data.is_online ?? requestedOnline);
      if (data.attendance) setAttendance(data.attendance);
      showAlert({
        title: requestedOnline ? "You are online" : "You are offline",
        message: requestedOnline
          ? "You are ready to receive delivery orders."
          : "You will not receive new delivery assignments.",
        variant: "success",
      });
      await loadTodayData();
    } catch (error: unknown) {
      console.error("Failed to update delivery availability:", error);
      showAlert({
        title: "Could not update availability",
        message: getApiErrorMessage(error, "Please try again."),
        variant: "error",
      });
    } finally {
      setAvailabilityBusy(false);
    }
  };

  const clockIn = async () => {
    if (actionLoading) return;
    setActionLoading(true);
    try {
      if (!isOnline) {
        await api.patch("/delivery-partner/availability", { is_online: true });
        setIsOnline(true);
      }
      const response = await api.post<AttendanceResponse>("/attendance/clock-in");
      const record = getPayload<AttendanceRecord>(response.data);
      if (!record) throw new Error("Clock-in response did not include attendance details.");
      setAttendance(record);
      setLiveSeconds(Number(record.duration_seconds) || 0);
      await loadHistory();
      showAlert({
        title: "Clocked in successfully",
        message: "Your shift has started. Have a productive day!",
        variant: "success",
      });
    } catch (error: unknown) {
      console.error("Failed to clock in delivery partner:", error);
      showAlert({
        title: "Unable to clock in",
        message: getApiErrorMessage(error, "Please try again."),
        variant: "error",
      });
      await loadTodayData();
    } finally {
      setActionLoading(false);
    }
  };

  const clockOut = async () => {
    setActionLoading(true);
    try {
      if (isOnline) {
        await api.patch("/delivery-partner/availability", {
          is_online: false,
          clock_out: true,
        });
      }
      const response = await api.post<AttendanceResponse>("/attendance/clock-out");
      const record = getPayload<AttendanceRecord>(response.data);
      if (!record) throw new Error("Clock-out response did not include attendance details.");
      setAttendance(record);
      setIsOnline(false);
      setLiveSeconds(Number(record.duration_seconds) || 0);
      await loadHistory();
      showAlert({
        title: "Clocked out successfully",
        message: `Total hours worked: ${record.total_hours ?? "—"}.`,
        variant: "success",
      });
    } catch (error: unknown) {
      console.error("Failed to clock out delivery partner:", error);
      showAlert({
        title: "Unable to clock out",
        message: getApiErrorMessage(error, "Please try again."),
        variant: "error",
      });
      await loadTodayData();
    } finally {
      setActionLoading(false);
    }
  };

  const confirmClockOut = () => {
    showAlert({
      title: "Clock out of your shift?",
      message: `Clocked in at ${formatTime(attendance?.check_in)}. Your recorded duration is ${formatDuration(liveSeconds)}. Clocking out also takes you offline.`,
      variant: "confirm",
      actions: [
        { text: "Cancel", style: "cancel" },
        { text: "Yes, clock out", style: "destructive", onPress: () => void clockOut() },
      ],
    });
  };

  const exportHistory = async () => {
    if (!historyRecords.length) {
      showAlert({
        title: "No attendance records",
        message: "There are no attendance records to export yet.",
        variant: "info",
      });
      return;
    }
    const headers = [
      "Date",
      "Shift Schedule",
      "Clock In",
      "Clock Out",
      "Duration (Hours)",
      "Status",
      "Notes",
    ];
    const rows = historyRecords.map((record) => [
      record.date ?? "",
      record.start_time
        ? `${record.start_time} to ${record.end_time ?? ""}`
        : "Regular",
      record.check_in ? formatTime(record.check_in) : "--",
      record.check_out ? formatTime(record.check_out) : record.check_in ? "Working" : "--",
      record.total_hours ??
        (record.duration_seconds
          ? (record.duration_seconds / 3600).toFixed(2)
          : "0"),
      record.status ?? "Present",
      record.notes ?? "",
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map(csvCell).join(","))
      .join("\n");
    try {
      await Share.share({
        title: "My attendance history",
        message: csv,
      });
    } catch (error: unknown) {
      console.error("Failed to share attendance history:", error);
      showAlert({
        title: "Could not export history",
        message: getApiErrorMessage(error, "Unable to share the attendance CSV."),
        variant: "error",
      });
    }
  };

  const todayFormatted = new Date().toLocaleDateString([], {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <ScrollView
      className="flex-1 bg-[#F5F7F3]"
      contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 16, paddingBottom: 28 }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => void refreshAll(true)}
          tintColor="#17663D"
        />
      }
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View className="mb-5 flex-row items-center justify-between">
        <View className="flex-1 pr-3">
          <View className="flex-row items-center self-start rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1">
            <Bike color="#17663D" size={14} />
            <Text className="ml-1.5 text-[10px] font-extrabold text-emerald-800">
              Delivery Partner · Attendance
            </Text>
          </View>
          <Text className="mt-2 text-xl font-black text-[#17251E]">
            Attendance & Shift Log
          </Text>
          <Text className="mt-1 text-xs leading-5 text-slate-500">
            Track your duty, working hours, and shift history.
          </Text>
        </View>
        <View className="flex-row">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Refresh attendance"
            className="mr-2 h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white"
            disabled={loading}
            onPress={() => void refreshAll(true)}
          >
            {loading ? (
              <ActivityIndicator color="#17663D" size="small" />
            ) : (
              <RefreshCw color="#53645A" size={16} />
            )}
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Export attendance history"
            className="h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white"
            onPress={() => void exportHistory()}
          >
            <Download color="#53645A" size={17} />
          </Pressable>
        </View>
      </View>

      {errorMessage ? (
        <View className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <Text className="text-sm font-bold text-amber-900">Attendance data notice</Text>
          <Text className="mt-1 text-sm leading-5 text-amber-800">{errorMessage}</Text>
        </View>
      ) : null}

      <View className="overflow-hidden rounded-[24px] border border-emerald-900/30 bg-[#10382F] p-5">
        <View className="flex-row items-start">
          <View className="mr-3 h-12 w-12 items-center justify-center rounded-2xl border border-white/20 bg-white/10">
            <Bike color={isWorking ? "#6EE7B7" : "#D1D5DB"} size={24} />
          </View>
          <View className="flex-1">
            <View
              className={`self-start rounded-full px-3 py-1 ${
                isWorking ? "bg-emerald-400/20" : "bg-white/10"
              }`}
            >
              <Text
                className={`text-[10px] font-extrabold uppercase tracking-wide ${
                  isWorking ? "text-emerald-200" : "text-slate-200"
                }`}
              >
                {isWorking ? "On duty · Shift active" : isCompleted ? "Shift completed" : "Check-in required"}
              </Text>
            </View>
            {attendance?.status ? (
              <Text className="mt-2 self-start rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-bold text-white">
                {attendance.status}
              </Text>
            ) : null}
            <Text className="mt-2 text-lg font-extrabold text-white">
              {isWorking
                ? "You are clocked in and on duty"
                : isCompleted
                  ? "Your shift for today has been logged"
                  : "Ready to start your shift?"}
            </Text>
            <Text className="mt-1 text-xs leading-5 text-emerald-100/80">
              {isWorking
                ? `Clocked in at ${formatTime(attendance?.check_in)}. Your working time is being recorded.`
                : isCompleted
                  ? `Clocked in at ${formatTime(attendance?.check_in)} and out at ${formatTime(attendance?.check_out)} (${attendance?.total_hours ?? "—"} hrs total).`
                  : shiftInfo?.start_time
                    ? `Your scheduled shift is ${formatShiftTime(shiftInfo.start_time)} to ${formatShiftTime(shiftInfo.end_time)}. Clock in to start duty.`
                    : "Clock in to start your shift and record your attendance."}
            </Text>
            <View className="mt-3 flex-row flex-wrap">
              <InfoPill label="Today" value={todayFormatted} />
              {shiftInfo?.start_time ? (
                <InfoPill
                  label="Scheduled"
                  value={`${formatShiftTime(shiftInfo.start_time)} – ${formatShiftTime(shiftInfo.end_time)}`}
                />
              ) : null}
              {attendance?.check_in ? (
                <InfoPill label="Clock in" value={formatTime(attendance.check_in)} />
              ) : null}
              {attendance?.check_out ? (
                <InfoPill label="Clock out" value={formatTime(attendance.check_out)} />
              ) : null}
            </View>
          </View>
        </View>

        <View className="mt-4 flex-row flex-wrap items-center gap-2">
          {isWorking ? (
            <>
              <View className="mr-1 min-h-11 flex-row items-center rounded-xl border border-emerald-400/30 bg-emerald-950/50 px-3 py-2">
                <Timer color="#6EE7B7" size={19} />
                <View className="ml-2">
                  <Text className="text-[9px] font-bold uppercase tracking-wide text-emerald-200">
                    Duty duration
                  </Text>
                  <Text className="font-mono text-sm font-extrabold text-white">
                    {formatDuration(liveSeconds)}
                  </Text>
                </View>
              </View>
              {isOnline ? (
                <ActionButton
                  label="Go offline"
                  Icon={Power}
                  disabled={availabilityBusy || actionLoading}
                  tone="amber"
                  onPress={() => void setAvailability(false)}
                />
              ) : (
                <ActionButton
                  label="Go online"
                  Icon={Zap}
                  disabled={availabilityBusy || actionLoading}
                  tone="green"
                  onPress={() => void setAvailability(true)}
                />
              )}
              <ActionButton
                label={actionLoading ? "Clocking out..." : "Clock out"}
                Icon={LogOut}
                disabled={actionLoading}
                tone="red"
                onPress={confirmClockOut}
              />
            </>
          ) : (
            <>
              {isCompleted ? (
                <ActionButton
                  label={actionLoading ? "Resuming..." : "Resume shift"}
                  Icon={RotateCcw}
                  disabled={actionLoading || availabilityBusy}
                  tone="green"
                  onPress={() => void clockIn()}
                />
              ) : (
                <ActionButton
                  label={actionLoading ? "Clocking in..." : "Clock in now"}
                  Icon={Play}
                  disabled={actionLoading || availabilityBusy || loading}
                  tone="green"
                  onPress={() => void clockIn()}
                />
              )}
              <ActionButton
                label={availabilityBusy ? "Updating..." : isOnline ? "Go offline" : "Go online"}
                Icon={isOnline ? Power : Zap}
                disabled={availabilityBusy || actionLoading}
                tone={isOnline ? "amber" : "dark"}
                onPress={() => void setAvailability(!isOnline)}
              />
            </>
          )}
        </View>
      </View>

      <View className="mt-4 flex-row flex-wrap justify-between">
        <StatCard title="Days present" value={String(stats.totalDays)} hint="Recorded shifts" Icon={CalendarDays} color="#22A65A" />
        <StatCard title="Total hours" value={`${stats.totalHours} hrs`} hint="Logged on duty" Icon={Clock3} color="#3979D4" />
        <StatCard title="Avg shift" value={`${stats.averageHours} hrs`} hint="Per logged shift" Icon={Timer} color="#8157D8" />
        <StatCard title="On-time rate" value={`${stats.onTimeRate}%`} hint="Punctuality score" Icon={CheckCircle2} color="#10A47A" />
        <StatCard title="Late arrivals" value={String(stats.lateCount)} hint="Past scheduled start" Icon={AlertCircle} color={stats.lateCount ? "#E59B14" : "#16A6B5"} />
      </View>

      <View className="mt-2 rounded-[24px] border border-[#E7E0D8] bg-white p-4">
        <View className="flex-row items-center">
          <View className="h-10 w-10 items-center justify-center rounded-xl bg-emerald-50">
            <History color="#17663D" size={20} />
          </View>
          <View className="ml-3 flex-1">
            <Text className="text-base font-extrabold text-slate-900">My attendance history</Text>
            <Text className="mt-0.5 text-[10px] leading-4 text-slate-500">
              Your shift dates, check-in/out times, duration, and status.
            </Text>
          </View>
        </View>

        <View className="mt-4">
          <View className="mb-3 flex-row items-center">
            <Filter color="#738078" size={15} />
            <Text className="ml-1.5 mr-2 text-xs font-bold text-slate-700">Status</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {statusOptions.map((option) => {
                const selected = statusFilter === option.value;
                return (
                  <Pressable
                    key={option.value}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    className={`mr-1.5 rounded-full px-3 py-2 ${
                      selected ? "bg-[#17663D]" : "bg-slate-100"
                    }`}
                    onPress={() => setStatusFilter(option.value)}
                  >
                    <Text className={`text-[10px] font-bold ${selected ? "text-white" : "text-slate-600"}`}>
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          <View className="mb-3 flex-row">
            {([
              ["All", "All months"],
              ["current", "This month"],
              ["previous", "Last month"],
            ] as const).map(([value, label]) => {
              const selected = monthFilter === value;
              return (
                <Pressable
                  key={value}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  className={`mr-2 rounded-xl border px-3 py-2 ${
                    selected ? "border-[#17663D] bg-[#EAF2E8]" : "border-slate-200 bg-white"
                  }`}
                  onPress={() => setMonthFilter(value)}
                >
                  <Text className={`text-[10px] font-bold ${selected ? "text-[#17663D]" : "text-slate-600"}`}>
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View className="min-h-11 flex-row items-center rounded-xl border border-slate-200 bg-slate-50 px-3">
            <Search color="#94A3B8" size={15} />
            <TextInput
              accessibilityLabel="Search attendance history"
              className="ml-2 min-h-11 flex-1 text-xs text-slate-900"
              onChangeText={setSearchTerm}
              placeholder="Search date, note, or status"
              placeholderTextColor="#94A3B8"
              value={searchTerm}
            />
            {searchTerm ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Clear attendance search"
                className="h-8 w-8 items-center justify-center"
                onPress={() => setSearchTerm("")}
              >
                <X color="#64748B" size={15} />
              </Pressable>
            ) : null}
          </View>
        </View>

        <Text className="mb-3 mt-4 text-[11px] font-semibold text-slate-500">
          Showing <Text className="font-extrabold text-slate-800">{filteredRecords.length}</Text> of{" "}
          {historyRecords.length} shifts
        </Text>

        {historyLoading ? (
          <View className="items-center py-10">
            <ActivityIndicator color="#17663D" />
            <Text className="mt-3 text-xs text-slate-500">Loading attendance history...</Text>
          </View>
        ) : historyError ? (
          <View className="items-center rounded-2xl bg-rose-50 px-4 py-8">
            <Text accessibilityRole="alert" className="text-center text-sm text-rose-800">
              {historyError}
            </Text>
            <Pressable
              accessibilityRole="button"
              className="mt-3 rounded-xl bg-rose-700 px-4 py-2"
              onPress={() => void loadHistory()}
            >
              <Text className="text-xs font-bold text-white">Try again</Text>
            </Pressable>
          </View>
        ) : filteredRecords.length === 0 ? (
          <View className="items-center rounded-2xl bg-slate-50 px-4 py-9">
            <AlertCircle color="#CBD5E1" size={26} />
            <Text className="mt-2 text-center text-sm font-bold text-slate-700">
              No attendance records match
            </Text>
            <Text className="mt-1 text-center text-xs leading-5 text-slate-500">
              {historyRecords.length === 0
                ? "Clock in today to create your first attendance record."
                : "Try adjusting the search or filters."}
            </Text>
          </View>
        ) : (
          filteredRecords.map((record, index) => {
            const recordWorking = Boolean(record.check_in && !record.check_out);
            const isToday =
              Boolean(record.date) &&
              new Date().toISOString().slice(0, 10) === String(record.date).slice(0, 10);
            const duration =
              record.total_hours != null && record.total_hours !== ""
                ? `${record.total_hours} hrs`
                : record.duration_seconds
                  ? formatShortDuration(record.duration_seconds)
                  : recordWorking
                    ? formatShortDuration(liveSeconds)
                    : "--";

            return (
              <View
                key={record.id ?? record.attendance_id ?? `${record.date}-${index}`}
                className="mb-3 rounded-2xl border border-slate-100 bg-slate-50 p-3.5"
              >
                <View className="flex-row items-center justify-between">
                  <View className="flex-1 flex-row flex-wrap items-center">
                    <Text className="text-sm font-extrabold text-slate-900">
                      {formatDate(record.date)}
                    </Text>
                    {isToday ? (
                      <Text className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-extrabold text-emerald-800">
                        Today
                      </Text>
                    ) : null}
                  </View>
                  <StatusBadge
                    status={recordWorking ? "Active duty" : record.status || "Present"}
                    isLate={record.status === "Late"}
                    isWorking={recordWorking}
                  />
                </View>
                <View className="mt-3 flex-row flex-wrap">
                  <RecordValue
                    label="Scheduled shift"
                    value={
                      record.start_time
                        ? `${formatShiftTime(record.start_time)} – ${formatShiftTime(record.end_time)}`
                        : "Regular"
                    }
                  />
                  <RecordValue
                    label="Clock in"
                    value={record.check_in ? formatTime(record.check_in) : "--:--"}
                    highlight={Boolean(record.check_in)}
                  />
                  <RecordValue
                    label="Clock out"
                    value={record.check_out ? formatTime(record.check_out) : recordWorking ? "On duty" : "--:--"}
                  />
                  <RecordValue label="Duration" value={duration} />
                </View>
                {record.notes ? (
                  <Text className="mt-3 border-t border-slate-200 pt-2 text-xs leading-5 text-slate-500">
                    {record.notes}
                  </Text>
                ) : null}
              </View>
            );
          })
        )}
      </View>
    </ScrollView>
  );
}

function InfoPill({ label, value }: { label: string; value: string }) {
  return (
    <View className="mb-2 mr-2 max-w-full rounded-lg border border-white/10 bg-white/10 px-2.5 py-1.5">
      <Text className="text-[9px] text-emerald-100/70">{label}</Text>
      <Text className="mt-0.5 text-[10px] font-bold text-white" numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function ActionButton({
  label,
  Icon,
  disabled,
  tone,
  onPress,
}: {
  label: string;
  Icon: typeof Play;
  disabled: boolean;
  tone: "green" | "amber" | "red" | "dark";
  onPress: () => void;
}) {
  const backgroundColor = {
    green: "#139B67",
    amber: "#F3B32A",
    red: "#DC3654",
    dark: "#475569",
  }[tone];
  const foregroundColor = tone === "amber" ? "#422D00" : "#FFFFFF";

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      className={`min-h-11 flex-row items-center justify-center rounded-xl px-3 ${
        disabled ? "opacity-60" : "active:opacity-80"
      }`}
      disabled={disabled}
      onPress={onPress}
      style={{ backgroundColor }}
    >
      {disabled && (tone === "green" || tone === "red") ? (
        <ActivityIndicator color={foregroundColor} size="small" />
      ) : (
        <Icon color={foregroundColor} size={15} />
      )}
      <Text className="ml-1.5 text-[11px] font-extrabold" style={{ color: foregroundColor }}>
        {label}
      </Text>
    </Pressable>
  );
}

function StatCard({
  title,
  value,
  hint,
  Icon,
  color,
}: {
  title: string;
  value: string;
  hint: string;
  Icon: typeof CalendarDays;
  color: string;
}) {
  return (
    <View
      className="mb-3 min-h-[126px] justify-between overflow-hidden rounded-2xl p-3.5"
      style={{ width: "48.5%", backgroundColor: color }}
    >
      <View className="flex-row items-start justify-between">
        <Text className="mr-2 flex-1 text-[10px] font-extrabold uppercase tracking-wide text-white/90">
          {title}
        </Text>
        <Icon color="#FFFFFF" size={19} />
      </View>
      <Text className="mt-2 text-[25px] font-black text-white" numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text className="mt-1 text-[9px] font-semibold text-white/80" numberOfLines={1}>
        {hint}
      </Text>
    </View>
  );
}

function RecordValue({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <View className="mb-2 w-1/2 pr-2">
      <Text className="text-[9px] text-slate-500">{label}</Text>
      <Text className={`mt-1 text-xs font-bold ${highlight ? "text-emerald-800" : "text-slate-800"}`}>
        {value}
      </Text>
    </View>
  );
}

function StatusBadge({
  status,
  isLate,
  isWorking,
}: {
  status: string;
  isLate: boolean;
  isWorking: boolean;
}) {
  const badgeClass = isLate
    ? "bg-amber-100 text-amber-900"
    : status === "Absent"
      ? "bg-rose-100 text-rose-800"
      : isWorking
        ? "bg-emerald-100 text-emerald-900"
        : "bg-emerald-50 text-emerald-800";

  return (
    <View className={`rounded-full px-2.5 py-1 ${badgeClass}`}>
      <Text className="text-[9px] font-extrabold uppercase">{status}</Text>
    </View>
  );
}
