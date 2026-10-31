import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import DateTimePicker, {
  DateTimePickerAndroid,
} from "@react-native-community/datetimepicker";
import {
  CalendarDays,
  CheckCheck,
  IndianRupee,
  RefreshCw,
  WalletCards,
} from "lucide-react-native";
import api, { getApiErrorMessage } from "../../../lib/api";

const DATE_RANGES = [
  { value: "all", label: "All" },
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "this-week", label: "This week" },
  { value: "last-week", label: "Last week" },
  { value: "this-month", label: "This month" },
  { value: "last-month", label: "Last month" },
  { value: "this-year", label: "This year" },
  { value: "last-year", label: "Last year" },
  { value: "custom", label: "Custom" },
] as const;

type DateRange = (typeof DATE_RANGES)[number]["value"];
type EarningsRecord = Record<string, unknown>;
type EarningsData = {
  summary: Record<string, unknown>;
  entries: EarningsRecord[];
};
type EarningsMetric = {
  label: string;
  value: unknown;
  caption: string;
  color: string;
  Icon: typeof IndianRupee;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function firstDefined(record: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    if (record[key] !== null && record[key] !== undefined && record[key] !== "") {
      return record[key];
    }
  }
  return undefined;
}

function formatMoney(value: unknown): string {
  if (value == null || value === "") return "—";
  const amount = Number(value);
  return Number.isFinite(amount)
    ? `₹${amount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`
    : "—";
}

function formatDate(value: unknown): string {
  if (typeof value !== "string" || !value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
}

function getDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function parseDateValue(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12);
  return getDateKey(date) === value ? date : null;
}

function formatSelectedDate(value: string): string {
  const date = parseDateValue(value);
  return date
    ? date.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "Choose date";
}

function rowsFrom(value: unknown): EarningsRecord[] {
  if (Array.isArray(value)) return value.flatMap((row) => {
    const record = asRecord(row);
    return record ? [record] : [];
  });
  const record = asRecord(value);
  if (!record) return [];
  for (const key of ["entries", "history", "rows", "items", "data"]) {
    if (Array.isArray(record[key])) return rowsFrom(record[key]);
  }
  return [];
}

function parseEarningsResponse(value: unknown): EarningsData {
  const root = asRecord(value);
  const payload = asRecord(root?.data) ?? root;
  const nestedPayload = asRecord(payload?.data) ?? payload;
  if (!nestedPayload) throw new Error("The earnings response was invalid.");
  const summary =
    asRecord(nestedPayload.summary) ??
    asRecord(nestedPayload.earnings) ??
    nestedPayload;
  const entries = rowsFrom(
    nestedPayload.entries ??
      nestedPayload.history ??
      nestedPayload.rows ??
      nestedPayload.items,
  );
  return { summary, entries };
}

function EarningsMetricCard({
  metric,
  loading,
}: {
  metric: EarningsMetric;
  loading: boolean;
}) {
  const { Icon } = metric;
  return (
    <View
      className="mb-3 w-[48%] min-h-[140px] justify-between overflow-hidden rounded-[22px] p-4"
      style={{ backgroundColor: metric.color }}
    >
      <View className="flex-row items-start justify-between">
        <Text className="flex-1 pr-2 text-[10px] font-extrabold uppercase tracking-wide text-white/90">
          {metric.label}
        </Text>
        <View className="h-9 w-9 items-center justify-center rounded-xl border border-white/30 bg-white/15">
          <Icon color="#FFFFFF" size={18} />
        </View>
      </View>
      {loading ? (
        <ActivityIndicator className="self-start" color="#FFFFFF" />
      ) : (
        <Text className="text-2xl font-black text-white" numberOfLines={1}>
          {formatMoney(metric.value)}
        </Text>
      )}
      <Text className="text-[10px] font-semibold text-white/75">{metric.caption}</Text>
    </View>
  );
}

export default function DeliveryEarningsScreen() {
  const [range, setRange] = useState<DateRange>("this-month");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [appliedFrom, setAppliedFrom] = useState("");
  const [appliedTo, setAppliedTo] = useState("");
  const [data, setData] = useState<EarningsData>({ summary: {}, entries: [] });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");
  const [pickerMode, setPickerMode] = useState<"from" | "to" | null>(null);
  const [pickerDraft, setPickerDraft] = useState(new Date());

  useEffect(() => {
    let active = true;
    const loadEarnings = async () => {
      try {
        const response = await api.get("/delivery-partner/earnings", {
          params: {
            range,
            ...(range === "custom"
              ? { from: appliedFrom, to: appliedTo }
              : {}),
          },
        });
        const parsed = parseEarningsResponse(response.data);
        if (!active) return;
        setData(parsed);
        setErrorMessage("");
      } catch (error: unknown) {
        console.error("Failed to load delivery partner earnings:", error);
        if (active) {
          setData({ summary: {}, entries: [] });
          setErrorMessage(
            getApiErrorMessage(error, "Your earnings are temporarily unavailable."),
          );
        }
      } finally {
        if (active) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    };

    void loadEarnings();
    return () => {
      active = false;
    };
  }, [appliedFrom, appliedTo, range, refreshVersion]);

  const refresh = useCallback(() => {
    if (loading || refreshing) return;
    setRefreshing(true);
    setRefreshVersion((current) => current + 1);
  }, [loading, refreshing]);

  const summary = data.summary;
  const metrics: EarningsMetric[] = useMemo(
    () => [
      {
        label: "Today's earnings",
        value: firstDefined(summary, ["today_earnings", "todayEarnings"]),
        caption: "Today",
        color: "#18A982",
        Icon: IndianRupee,
      },
      {
        label: "This week",
        value: firstDefined(summary, ["week_earnings", "weekEarnings"]),
        caption: "Week to date",
        color: "#6256D9",
        Icon: IndianRupee,
      },
      {
        label: "This month",
        value: firstDefined(summary, ["month_earnings", "monthEarnings"]),
        caption: "Month to date",
        color: "#C72D91",
        Icon: IndianRupee,
      },
      {
        label: "Total earnings",
        value: firstDefined(summary, ["total_earnings", "totalEarnings"]),
        caption: "Lifetime",
        color: "#E9A319",
        Icon: WalletCards,
      },
      {
        label: "Completed deliveries",
        value: firstDefined(summary, [
          "completed_deliveries",
          "completedDeliveries",
        ]),
        caption: "Completed",
        color: "#24975A",
        Icon: CheckCheck,
      },
      {
        label: "Cash collected",
        value: firstDefined(summary, ["cash_collected", "cashCollected"]),
        caption: "Collected from customers",
        color: "#256448",
        Icon: WalletCards,
      },
    ],
    [summary],
  );
  const parsedFrom = parseDateValue(from);
  const parsedTo = parseDateValue(to);
  const canApplyDateRange = Boolean(
    parsedFrom && parsedTo && parsedFrom.getTime() <= parsedTo.getTime(),
  );

  const applyPickedDate = (mode: "from" | "to", value: Date) => {
    const dateKey = getDateKey(value);
    if (mode === "from") setFrom(dateKey);
    else setTo(dateKey);
  };

  const openDatePicker = (mode: "from" | "to") => {
    const currentValue = mode === "from" ? from : to;
    const value = parseDateValue(currentValue) ?? new Date();
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

  return (
    <View className="flex-1">
      <ScrollView
        className="flex-1 bg-[#F7F8F3]"
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 24 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor="#17663D" />
        }
        showsVerticalScrollIndicator={false}
      >
      <View className="mb-5 flex-row items-center justify-between">
        <View className="mr-3 flex-1">
          <Text className="text-[10px] font-extrabold uppercase tracking-[1.6px] text-[#39754A]">
            Payouts
          </Text>
          <Text className="mt-1 text-2xl font-black text-[#17251E]">Earnings</Text>
          <Text className="mt-1 text-xs leading-5 text-slate-500">
            Delivery pay and payout history for your account.
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Refresh earnings"
          className="h-11 w-11 items-center justify-center rounded-xl border border-[#E1E8E1] bg-white"
          disabled={loading || refreshing}
          onPress={refresh}
        >
          {loading || refreshing ? (
            <ActivityIndicator color="#17663D" size="small" />
          ) : (
            <RefreshCw color="#53645A" size={18} />
          )}
        </Pressable>
      </View>
      {errorMessage ? (
        <View className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <Text className="text-sm font-extrabold text-amber-900">Earnings unavailable</Text>
          <Text className="mt-1 text-sm leading-5 text-amber-800">{errorMessage}</Text>
          <Text className="mt-2 text-xs leading-5 text-amber-800">
            Earnings are loaded only from your delivery-partner account.
          </Text>
          <Pressable
            accessibilityRole="button"
            className="mt-3 min-h-10 flex-row items-center self-start rounded-xl bg-[#17663D] px-4"
            onPress={refresh}
          >
            <RefreshCw color="#FFFFFF" size={15} />
            <Text className="ml-2 text-xs font-bold text-white">Try again</Text>
          </Pressable>
        </View>
      ) : null}

      <View className="mb-2 flex-row flex-wrap justify-between">
        {metrics.map((metric) => (
          <EarningsMetricCard
            key={metric.label}
            metric={metric}
            loading={loading && !errorMessage}
          />
        ))}
      </View>

      <View className="mb-4">
        <View className="mb-2 flex-row items-center">
          <CalendarDays color="#448052" size={16} />
          <Text className="ml-2 text-xs font-bold text-[#39483F]">Earnings period</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {DATE_RANGES.map((option) => {
            const active = range === option.value;
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                className={`mr-2 min-h-10 justify-center rounded-full border px-4 ${
                  active
                    ? "border-[#17663D] bg-[#17663D]"
                    : "border-[#E1E8E1] bg-white"
                }`}
                key={option.value}
                onPress={() => {
                  setLoading(true);
                  setErrorMessage("");
                  setRange(option.value);
                }}
              >
                <Text className={`text-xs font-bold ${active ? "text-white" : "text-[#526057]"}`}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
        {range === "custom" ? (
          <View className="mt-2">
            {Platform.OS === "web" ? (
              <View className="flex-row">
                <TextInput
                  accessibilityLabel="Earnings from date"
                  className="mr-2 min-h-11 flex-1 rounded-xl border border-[#E1E8E1] bg-white px-3 text-xs text-[#17251E]"
                  onChangeText={setFrom}
                  placeholder="From · YYYY-MM-DD"
                  placeholderTextColor="#98A199"
                  value={from}
                />
                <TextInput
                  accessibilityLabel="Earnings to date"
                  className="min-h-11 flex-1 rounded-xl border border-[#E1E8E1] bg-white px-3 text-xs text-[#17251E]"
                  onChangeText={setTo}
                  placeholder="To · YYYY-MM-DD"
                  placeholderTextColor="#98A199"
                  value={to}
                />
              </View>
            ) : (
              <View className="flex-row">
                {(["from", "to"] as const).map((mode) => {
                  const value = mode === "from" ? from : to;
                  const label = mode === "from" ? "From date" : "To date";
                  return (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Choose ${label.toLowerCase()}`}
                      className={`min-h-12 flex-1 flex-row items-center rounded-xl border border-[#E1E8E1] bg-white px-3 ${
                        mode === "from" ? "mr-2" : ""
                      }`}
                      key={mode}
                      onPress={() => openDatePicker(mode)}
                    >
                      <CalendarDays color="#39754A" size={16} />
                      <View className="ml-2">
                        <Text className="text-[9px] font-bold uppercase text-slate-400">
                          {label}
                        </Text>
                        <Text className="mt-0.5 text-xs font-semibold text-[#17251E]">
                          {formatSelectedDate(value)}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            )}
            <Pressable
              accessibilityRole="button"
              className="mt-2 min-h-10 items-center justify-center rounded-xl bg-[#17663D]"
              disabled={!canApplyDateRange}
              onPress={() => {
                setLoading(true);
                setErrorMessage("");
                setAppliedFrom(from);
                setAppliedTo(to);
              }}
              style={{ opacity: canApplyDateRange ? 1 : 0.55 }}
            >
              <Text className="text-xs font-extrabold text-white">Apply date range</Text>
            </Pressable>
            {from && to && !canApplyDateRange ? (
              <Text className="mt-1.5 text-[10px] font-semibold text-rose-600">
                Choose valid dates and make sure the start date is not after the end date.
              </Text>
            ) : null}
          </View>
        ) : null}
      </View>

      <View className="overflow-hidden rounded-2xl border border-[#E1E8E1] bg-white">
        <View className="border-b border-[#EEF0EC] px-4 py-4">
          <Text className="text-base font-extrabold text-[#17251E]">Earnings history</Text>
          <Text className="mt-1 text-xs text-slate-500">
            Per-delivery amounts and payment status
          </Text>
        </View>
        {loading ? (
          <View className="items-center px-4 py-10">
            <ActivityIndicator color="#17663D" />
            <Text className="mt-3 text-xs font-semibold text-slate-500">
              Loading earnings…
            </Text>
          </View>
        ) : errorMessage ? (
          <Text className="px-4 py-8 text-center text-xs leading-5 text-slate-500">
            Earnings history could not be loaded.
          </Text>
        ) : data.entries.length === 0 ? (
          <View className="items-center px-4 py-10">
            <WalletCards color="#8A9A8E" size={25} />
            <Text className="mt-3 text-sm font-bold text-[#39483F]">No earnings yet</Text>
            <Text className="mt-1 text-center text-xs leading-5 text-slate-500">
              Earnings history will appear after completed deliveries.
            </Text>
          </View>
        ) : (
          data.entries.map((entry, index) => (
            <View
              className="border-b border-[#EEF0EC] px-4 py-4"
              key={String(firstDefined(entry, ["id", "order_id"]) ?? index)}
            >
              <View className="flex-row items-start justify-between">
                <View className="mr-3 flex-1">
                  <Text className="text-xs font-extrabold text-[#26352B]">
                    Order {String(firstDefined(entry, ["order_id", "id"]) ?? "—")}
                  </Text>
                  <Text className="mt-1 text-[10px] text-slate-500">
                    {formatDate(firstDefined(entry, ["date", "created_at"]))}
                  </Text>
                </View>
                <Text className="text-sm font-black text-[#17663D]">
                  {formatMoney(firstDefined(entry, ["total_earnings", "total"]))}
                </Text>
              </View>
              <View className="mt-3 flex-row flex-wrap">
                <Text className="mr-4 text-[10px] text-slate-500">
                  Distance: {String(firstDefined(entry, ["distance_km", "distance"]) ?? "—")} km
                </Text>
                <Text className="mr-4 text-[10px] text-slate-500">
                  Base: {formatMoney(entry.base_charge)}
                </Text>
                <Text className="text-[10px] text-slate-500">
                  Extra: {formatMoney(entry.extra_charge)}
                </Text>
              </View>
              <View className="mt-2 flex-row items-center justify-between">
                <Text className="text-[10px] text-slate-500">
                  Incentive: {formatMoney(entry.incentive)}
                </Text>
                <View className="rounded-full bg-emerald-50 px-2.5 py-1">
                  <Text className="text-[10px] font-bold text-emerald-700">
                    {String(entry.payment_status ?? "Payment status unavailable")}
                  </Text>
                </View>
              </View>
            </View>
          ))
        )}
      </View>
      </ScrollView>
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
