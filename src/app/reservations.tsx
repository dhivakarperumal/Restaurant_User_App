import { router } from "expo-router";
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  MapPin,
  Minus,
  Plus,
  RefreshCw,
  TableProperties,
  Users,
} from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import api, {
  API_BASE_URL,
  getApiErrorMessage,
  getStoredToken,
  getStoredUser,
} from "../lib/api";

type ApiRecord = Record<string, unknown>;
type ReservationTable = {
  table_id: string;
  table_number: string;
  no_of_seats: number;
  image_url: string;
};
type Reservation = ApiRecord & { reservation_id: string };

const TIME_SLOTS = Array.from({ length: 25 }, (_, index) => {
  const totalMinutes = 10 * 60 + index * 30;
  const hour = Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
});

function asRecord(value: unknown): ApiRecord | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as ApiRecord)
    : null;
}

function getText(record: ApiRecord, keys: string[]): string {
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
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function localDateString(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

function minimumDateString(): string {
  const date = new Date();
  return localDateString(date);
}

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

function formatDate(value: unknown): string {
  if (!value) return "Date unavailable";
  const raw = String(value).slice(0, 10);
  if (!validDate(raw)) return raw;
  const [year, month, day] = raw.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatTime(value: unknown): string {
  if (!value) return "Time unavailable";
  const [hourValue, minuteValue] = String(value).slice(0, 5).split(":").map(Number);
  if (!Number.isFinite(hourValue) || !Number.isFinite(minuteValue)) {
    return String(value);
  }
  return `${hourValue % 12 || 12}:${String(minuteValue).padStart(2, "0")} ${
    hourValue < 12 ? "AM" : "PM"
  }`;
}

function normalizeTable(value: unknown): ReservationTable | null {
  const record = asRecord(value);
  if (!record) return null;
  const tableId = getText(record, ["table_id"]);
  if (!tableId) return null;
  return {
    table_id: tableId,
    table_number: getText(record, ["table_number"]) || tableId,
    no_of_seats: getNumber(record.no_of_seats),
    image_url: getText(record, ["image_url"]),
  };
}

function normalizeReservation(value: unknown): Reservation | null {
  const record = asRecord(value);
  if (!record) return null;
  const id = getText(record, ["reservation_id", "id"]);
  return id ? { ...record, reservation_id: id } : null;
}

function imageUrl(value: string): string {
  if (!value) return "";
  if (/^(https?:\/\/|data:|blob:)/i.test(value)) return value;
  const baseUrl = API_BASE_URL.replace(/\/api\/?$/, "");
  return `${baseUrl}${value.startsWith("/") ? value : `/${value}`}`;
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = "default",
  maxLength,
  multiline = false,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  keyboardType?: "default" | "email-address" | "phone-pad" | "number-pad";
  maxLength?: number;
  multiline?: boolean;
}) {
  return (
    <View className="mb-3">
      <Text className="mb-1.5 text-xs font-bold uppercase tracking-wide text-[#59645E]">
        {label}
      </Text>
      <TextInput
        autoCapitalize={keyboardType === "email-address" ? "none" : "sentences"}
        className={`rounded-xl border border-[#E1E5DF] bg-white px-3.5 text-sm text-[#183B2A] ${
          multiline ? "min-h-20 py-3" : "h-12"
        }`}
        keyboardType={keyboardType}
        maxLength={maxLength}
        multiline={multiline}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#879087"
        textAlignVertical={multiline ? "top" : "center"}
        value={value}
      />
    </View>
  );
}

export default function ReservationsScreen() {
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [date, setDate] = useState(minimumDateString());
  const [time, setTime] = useState("19:00");
  const [guests, setGuests] = useState("2");
  const [notes, setNotes] = useState("");
  const [tables, setTables] = useState<ReservationTable[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [selectedTableId, setSelectedTableId] = useState("");
  const [hasSearched, setHasSearched] = useState(false);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [isLoadingTables, setIsLoadingTables] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadReservations = useCallback(async () => {
    const response = await api.get("/reservations/mine");
    const body = asRecord(response.data);
    if (body?.success !== true || !Array.isArray(body.reservations)) {
      throw new Error("The reservation history response was invalid.");
    }
    const results = body.reservations.flatMap((item) => {
      const reservation = normalizeReservation(item);
      return reservation ? [reservation] : [];
    });
    setReservations(results);
  }, []);

  useEffect(() => {
    let mounted = true;
    void Promise.resolve().then(async () => {
      try {
        const token = await getStoredToken();
        if (!mounted) return;
        if (!token) {
          setIsSignedIn(false);
          return;
        }
        setIsSignedIn(true);
        const stored = asRecord(await getStoredUser());
        const user = asRecord(stored?.user) ?? asRecord(stored?.data) ?? stored;
        if (user && mounted) {
          const firstName = getText(user, ["first_name", "firstName"]);
          const lastName = getText(user, ["last_name", "lastName"]);
          setName(
            getText(user, ["name", "username", "full_name", "displayName"]) ||
              [firstName, lastName].filter(Boolean).join(" "),
          );
          setEmail(getText(user, ["email", "email_address"]));
          setPhone(getText(user, ["mobile_number", "phone", "phone_number"]));
        }
        if (mounted) await loadReservations();
      } catch (loadError) {
        if (mounted) {
          console.error("Failed to load table reservation details:", loadError);
          setError(
            getApiErrorMessage(loadError, "Could not load your reservation details."),
          );
        }
      } finally {
        if (mounted) setIsLoadingProfile(false);
      }
    });
    return () => {
      mounted = false;
    };
  }, [loadReservations]);

  const parsedGuests = Number(guests);
  const selectedTable = useMemo(
    () => tables.find((table) => table.table_id === selectedTableId) ?? null,
    [selectedTableId, tables],
  );

  const searchTables = async () => {
    setError("");
    setSuccess("");
    setSelectedTableId("");
    if (!validDate(date) || date < minimumDateString()) {
      setError("Choose a valid reservation date today or later.");
      return;
    }
    if (!TIME_SLOTS.includes(time)) {
      setError("Choose a reservation time between 10:00 AM and 10:00 PM.");
      return;
    }
    if (date === minimumDateString()) {
      const [hour, minute] = time.split(":").map(Number);
      const now = new Date();
      if (hour * 60 + minute <= now.getHours() * 60 + now.getMinutes()) {
        setError("For today, choose a time later than the current time.");
        return;
      }
    }
    if (!Number.isInteger(parsedGuests) || parsedGuests < 1 || parsedGuests > 20) {
      setError("Guest count must be between 1 and 20.");
      return;
    }
    setIsLoadingTables(true);
    setHasSearched(true);
    try {
      const response = await api.get("/reservations/available-tables", {
        params: { date, time, guests: parsedGuests },
      });
      const body = asRecord(response.data);
      if (body?.success !== true || !Array.isArray(body.tables)) {
        throw new Error("The available tables response was invalid.");
      }
      setTables(
        body.tables.flatMap((item) => {
          const table = normalizeTable(item);
          return table ? [table] : [];
        }),
      );
    } catch (requestError) {
      setTables([]);
      setError(
        getApiErrorMessage(requestError, "Could not find available tables."),
      );
    } finally {
      setIsLoadingTables(false);
    }
  };

  const submitReservation = async () => {
    setError("");
    setSuccess("");
    if (!isSignedIn) {
      setError("Please sign in before requesting a table reservation.");
      return;
    }
    if (!name.trim() || name.trim().length > 150) {
      setError("Enter your name (up to 150 characters).");
      return;
    }
    if (
      !email.trim() ||
      email.trim().length > 255 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
    ) {
      setError("Enter a valid email address.");
      return;
    }
    if (!phone.trim() || phone.trim().length > 32) {
      setError("Enter a valid phone number.");
      return;
    }
    if (!selectedTable) {
      setError("Check availability and select a table before submitting.");
      return;
    }
    if (notes.length > 1000) {
      setError("Special requests must be no more than 1000 characters.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await api.post("/reservations", {
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        date,
        time,
        table_id: selectedTable.table_id,
        guests: parsedGuests,
        notes: notes.trim(),
      });
      const body = asRecord(response.data);
      if (body?.success !== true) {
        throw new Error(
          getText(body ?? {}, ["message"]) || "Could not send your reservation request.",
        );
      }
      const reservation = normalizeReservation(body.reservation);
      if (reservation) {
        setReservations((current) => [reservation, ...current]);
      } else {
        await loadReservations();
      }
      setSuccess(
        getText(body, ["message"]) ||
          "Reservation request sent. Our team will confirm it shortly.",
      );
      setTables([]);
      setSelectedTableId("");
      setHasSearched(false);
      setNotes("");
    } catch (requestError) {
      setError(
        getApiErrorMessage(requestError, "Could not submit your reservation request."),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const refresh = async () => {
    setIsRefreshing(true);
    setError("");
    try {
      if (isSignedIn) await loadReservations();
      if (hasSearched) await searchTables();
    } catch (requestError) {
      setError(
        getApiErrorMessage(requestError, "Could not refresh your reservations."),
      );
    } finally {
      setIsRefreshing(false);
    }
  };

  const updateGuests = (value: string) => {
    const digits = value.replace(/[^\d]/g, "").slice(0, 2);
    setGuests(digits);
    setTables([]);
    setSelectedTableId("");
    setHasSearched(false);
  };

  const updateDate = (value: string) => {
    setDate(value);
    setTables([]);
    setSelectedTableId("");
    setHasSearched(false);
  };

  const updateTime = (value: string) => {
    setTime(value);
    setTables([]);
    setSelectedTableId("");
    setHasSearched(false);
  };

  if (isLoadingProfile) {
    return (
      <View className="flex-1 items-center justify-center bg-[#F3F4F3]">
        <ActivityIndicator color="#1A6A3B" size="large" />
        <Text className="mt-3 text-sm text-[#728071]">Loading table booking…</Text>
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-[#F3F4F3]"
      contentContainerStyle={{ padding: 16, paddingBottom: 36 }}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl
          colors={["#1A6A3B"]}
          onRefresh={() => void refresh()}
          refreshing={isRefreshing}
          tintColor="#1A6A3B"
        />
      }
      showsVerticalScrollIndicator={false}
    >
      <View className="mb-4 rounded-2xl bg-[#183B2A] p-4">
        <View className="flex-row items-center">
          <View className="mr-3 h-11 w-11 items-center justify-center rounded-xl bg-white/10">
            <TableProperties color="#F7BD48" size={22} />
          </View>
          <View className="flex-1">
            <Text className="text-lg font-extrabold text-white">Reserve a table</Text>
            <Text className="mt-1 text-xs leading-5 text-[#D8E4D7]">
              Pick a time and group size to see tables that are free.
            </Text>
          </View>
        </View>
      </View>

      {!isSignedIn ? (
        <View className="mb-4 rounded-xl border border-[#F1D889] bg-[#FFF6D8] p-3.5">
          <Text className="text-sm font-bold text-[#80500A]">
            Sign in to reserve a table
          </Text>
          <Text className="mt-1 text-xs leading-5 text-[#80500A]">
            Reservation requests are linked to your customer account.
          </Text>
          <Pressable
            accessibilityRole="button"
            className="mt-3 self-start rounded-lg bg-[#183B2A] px-4 py-2.5"
            onPress={() => router.push("/login")}
          >
            <Text className="text-xs font-bold text-white">Sign in</Text>
          </Pressable>
        </View>
      ) : null}

      {error ? (
        <View className="mb-4 rounded-xl border border-[#F3C9C5] bg-[#FFF4F2] p-3">
          <Text accessibilityRole="alert" className="text-sm leading-5 text-[#A33424]">
            {error}
          </Text>
        </View>
      ) : null}
      {success ? (
        <View className="mb-4 flex-row rounded-xl border border-[#CFE3C4] bg-[#EAF4E4] p-3">
          <CheckCircle2 color="#075B2B" size={18} />
          <Text className="ml-2 flex-1 text-sm leading-5 text-[#075B2B]">{success}</Text>
        </View>
      ) : null}

      <View className="mb-4 rounded-2xl border border-[#E1E5DF] bg-white p-4">
        <SectionHeading
          Icon={Users}
          title="Reservation details"
          detail="Bookings are for one-hour time slots."
        />
        <Field
          label="Name *"
          maxLength={150}
          onChangeText={setName}
          placeholder="Your name"
          value={name}
        />
        <Field
          label="Email *"
          keyboardType="email-address"
          maxLength={255}
          onChangeText={setEmail}
          placeholder="you@example.com"
          value={email}
        />
        <Field
          label="Phone *"
          keyboardType="phone-pad"
          maxLength={32}
          onChangeText={setPhone}
          placeholder="Contact phone number"
          value={phone}
        />
        <Field
          label="Reservation date *"
          maxLength={10}
          onChangeText={updateDate}
          placeholder="YYYY-MM-DD"
          value={date}
        />
        <View className="mb-2 flex-row items-center">
          <Clock3 color="#59645E" size={15} />
          <Text className="ml-2 text-xs font-bold uppercase tracking-wide text-[#59645E]">
            Reservation time *
          </Text>
        </View>
        <ScrollView
          className="mb-3 max-h-11"
          contentContainerStyle={{ gap: 8, paddingRight: 4 }}
          horizontal
          showsHorizontalScrollIndicator={false}
        >
          {TIME_SLOTS.map((slot) => {
            const selected = slot === time;
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected }}
                className={`rounded-full border px-3.5 py-2 ${
                  selected
                    ? "border-[#1A6A3B] bg-[#1A6A3B]"
                    : "border-[#E1E5DF] bg-white"
                }`}
                key={slot}
                onPress={() => updateTime(slot)}
              >
                <Text
                  className={`text-xs font-semibold ${
                    selected ? "text-white" : "text-[#344035]"
                  }`}
                >
                  {formatTime(slot)}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
        <View className="mb-3">
          <Text className="mb-1.5 text-xs font-bold uppercase tracking-wide text-[#59645E]">
            Guests (1–20) *
          </Text>
          <View className="h-12 flex-row items-center justify-between rounded-xl border border-[#E1E5DF] bg-white px-2">
            <Pressable
              accessibilityLabel="Remove one guest"
              accessibilityRole="button"
              className="h-9 w-9 items-center justify-center rounded-lg bg-[#F0EEE7]"
              onPress={() =>
                updateGuests(String(Math.max(1, (Number(guests) || 1) - 1)))
              }
            >
              <Minus color="#344035" size={16} />
            </Pressable>
            <TextInput
              accessibilityLabel="Number of guests"
              className="h-10 w-20 py-0 text-center text-base font-extrabold text-[#183B2A]"
              keyboardType="number-pad"
              maxLength={2}
              onChangeText={updateGuests}
              textAlignVertical="center"
              value={guests}
            />
            <Pressable
              accessibilityLabel="Add one guest"
              accessibilityRole="button"
              className="h-9 w-9 items-center justify-center rounded-lg bg-[#1A6A3B]"
              onPress={() =>
                updateGuests(String(Math.min(20, (Number(guests) || 0) + 1)))
              }
            >
              <Plus color="#FFFFFF" size={16} />
            </Pressable>
          </View>
        </View>
        <Field
          label="Special requests (optional)"
          maxLength={1000}
          multiline
          onChangeText={setNotes}
          placeholder="Allergies, seating preferences, or other notes"
          value={notes}
        />
        <Pressable
          accessibilityRole="button"
          className={`min-h-12 flex-row items-center justify-center rounded-xl ${
            isLoadingTables ? "bg-[#72937B]" : "bg-[#183B2A] active:bg-[#14542E]"
          }`}
          disabled={isLoadingTables || !isSignedIn}
          onPress={() => void searchTables()}
        >
          {isLoadingTables ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <RefreshCw color="#FFFFFF" size={16} />
              <Text className="ml-2 text-sm font-extrabold text-white">
                Check available tables
              </Text>
            </>
          )}
        </Pressable>
      </View>

      {hasSearched ? (
        <View className="mb-4 rounded-2xl border border-[#E1E5DF] bg-white p-4">
          <SectionHeading
            Icon={TableProperties}
            title="Available tables"
            detail={`${parsedGuests || "—"} guests · ${formatDate(date)} · ${formatTime(time)}`}
          />
          {isLoadingTables ? (
            <View className="items-center py-8">
              <ActivityIndicator color="#1A6A3B" />
              <Text className="mt-2 text-sm text-[#728071]">Checking table availability…</Text>
            </View>
          ) : tables.length ? (
            tables.map((table) => {
              const selected = table.table_id === selectedTableId;
              const image = imageUrl(table.image_url);
              return (
                <Pressable
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  className={`mb-3 flex-row items-center rounded-xl border p-3 ${
                    selected
                      ? "border-[#1A6A3B] bg-[#F4F8F2]"
                      : "border-[#E8EDE6] bg-[#FFFEFB]"
                  }`}
                  key={table.table_id}
                  onPress={() => setSelectedTableId(table.table_id)}
                >
                  <View className="h-16 w-16 items-center justify-center overflow-hidden rounded-xl bg-[#EAF2E8]">
                    {image ? (
                      <Image
                        accessibilityLabel={`Table ${table.table_number}`}
                        className="h-full w-full"
                        resizeMode="cover"
                        source={{ uri: image }}
                      />
                    ) : (
                      <TableProperties color="#1A6A3B" size={25} />
                    )}
                  </View>
                  <View className="ml-3 flex-1">
                    <Text className="text-base font-extrabold text-[#183B2A]">
                      Table {table.table_number}
                    </Text>
                    <View className="mt-1 flex-row items-center">
                      <Users color="#728071" size={14} />
                      <Text className="ml-1.5 text-xs text-[#59645E]">
                        Seats up to {table.no_of_seats}
                      </Text>
                    </View>
                    <Text className="mt-1 text-[10px] font-semibold text-[#1A6A3B]">
                      {selected ? "Selected for your reservation" : "Available"}
                    </Text>
                  </View>
                  <View
                    className={`h-6 w-6 items-center justify-center rounded-full border ${
                      selected ? "border-[#1A6A3B] bg-[#1A6A3B]" : "border-[#D4DBD1]"
                    }`}
                  >
                    {selected ? <CheckCircle2 color="#FFFFFF" size={16} /> : null}
                  </View>
                </Pressable>
              );
            })
          ) : (
            <View className="items-center rounded-xl border border-dashed border-[#DCE8D5] bg-[#FAFCF9] px-4 py-7">
              <TableProperties color="#789078" size={28} />
              <Text className="mt-3 text-base font-bold text-[#183B2A]">
                No tables available
              </Text>
              <Text className="mt-1 text-center text-xs leading-5 text-[#728071]">
                Try a different time or reduce the number of guests.
              </Text>
            </View>
          )}
          {selectedTable ? (
            <View className="mt-1">
              <Pressable
                accessibilityRole="button"
                className={`min-h-12 flex-row items-center justify-center rounded-xl ${
                  isSubmitting ? "bg-[#72937B]" : "bg-[#1A6A3B] active:bg-[#14542E]"
                }`}
                disabled={isSubmitting}
                onPress={() => void submitReservation()}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <CheckCircle2 color="#FFFFFF" size={17} />
                    <Text className="ml-2 text-sm font-extrabold text-white">
                      Request Table {selectedTable.table_number}
                    </Text>
                  </>
                )}
              </Pressable>
            </View>
          ) : null}
        </View>
      ) : null}

      {isSignedIn ? (
        <View className="rounded-2xl border border-[#E1E5DF] bg-white p-4">
          <SectionHeading
            Icon={CalendarDays}
            title="My reservations"
            detail="See the status of your table booking requests."
          />
          {reservations.length ? (
            reservations.map((reservation) => (
              <ReservationCard
                key={reservation.reservation_id}
                reservation={reservation}
              />
            ))
          ) : (
            <View className="items-center rounded-xl border border-dashed border-[#DCE8D5] bg-[#FAFCF9] px-4 py-7">
              <CalendarDays color="#789078" size={27} />
              <Text className="mt-3 text-base font-bold text-[#183B2A]">
                No reservations yet
              </Text>
              <Text className="mt-1 text-center text-xs leading-5 text-[#728071]">
                Once you request a table, its status will appear here.
              </Text>
            </View>
          )}
        </View>
      ) : null}
    </ScrollView>
  );
}

function SectionHeading({
  Icon,
  title,
  detail,
}: {
  Icon: LucideIcon;
  title: string;
  detail: string;
}) {
  return (
    <View className="mb-4 flex-row items-center border-b border-[#E8EDE6] pb-3">
      <View className="mr-3 h-10 w-10 items-center justify-center rounded-xl bg-[#EFF5E9]">
        <Icon color="#1A6A3B" size={19} />
      </View>
      <View className="flex-1">
        <Text className="text-base font-extrabold text-[#183B2A]">{title}</Text>
        <Text className="mt-0.5 text-xs leading-5 text-[#728071]">{detail}</Text>
      </View>
    </View>
  );
}

function ReservationCard({ reservation }: { reservation: Reservation }) {
  const status = getText(reservation, ["status"]) || "Pending";
  const statusStyle =
    status === "Confirmed"
      ? "border-[#CFE3C4] bg-[#EAF4E4] text-[#075B2B]"
      : status === "Declined" || status === "Cancelled"
        ? "border-[#F3C9C5] bg-[#FFF4F2] text-[#A33424]"
        : "border-[#F1D889] bg-[#FFF6D8] text-[#A85B00]";
  return (
    <View className="mb-3 rounded-xl border border-[#E8EDE6] bg-[#FFFEFB] p-3.5">
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center">
          <TableProperties color="#1A6A3B" size={17} />
          <Text className="ml-2 text-sm font-extrabold text-[#183B2A]">
            Table {getText(reservation, ["table_number"])}
          </Text>
        </View>
        <Text className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${statusStyle}`}>
          {status}
        </Text>
      </View>
      <View className="mt-3 flex-row flex-wrap">
        <View className="mb-2 mr-4 flex-row items-center">
          <CalendarDays color="#728071" size={14} />
          <Text className="ml-1.5 text-xs text-[#59645E]">
            {formatDate(reservation.reservation_date)}
          </Text>
        </View>
        <View className="mb-2 mr-4 flex-row items-center">
          <Clock3 color="#728071" size={14} />
          <Text className="ml-1.5 text-xs text-[#59645E]">
            {formatTime(reservation.start_time)}
            {reservation.end_time ? ` – ${formatTime(reservation.end_time)}` : ""}
          </Text>
        </View>
        <View className="mb-2 flex-row items-center">
          <Users color="#728071" size={14} />
          <Text className="ml-1.5 text-xs text-[#59645E]">
            {getText(reservation, ["guests", "guest_count"])} guests
          </Text>
        </View>
      </View>
      {reservation.notes ? (
        <View className="mt-1 flex-row border-t border-[#EEE8DD] pt-2">
          <MapPin color="#728071" size={14} />
          <Text className="ml-1.5 flex-1 text-xs leading-5 text-[#59645E]">
            {String(reservation.notes)}
          </Text>
        </View>
      ) : null}
      <Text className="mt-2 border-t border-[#EEE8DD] pt-2 font-mono text-[10px] text-[#879087]">
        Ref: {reservation.reservation_id}
      </Text>
    </View>
  );
}
