import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  MapPin,
  Minus,
  PartyPopper,
  Plus,
  Search,
  Send,
  Users,
  Utensils,
} from "lucide-react-native";
import api, {
  API_BASE_URL,
  getApiErrorMessage,
  getStoredToken,
  getStoredUser,
} from "../lib/api";
import type { FoodProduct } from "../types/food";

const EVENT_TYPES = [
  "Birthday Party",
  "Corporate Event",
  "Wedding / Reception",
  "Family Gathering",
  "Anniversary",
  "Housewarming / Puja",
  "College / School Event",
  "Festival Celebration",
  "Other Occasion",
];
const DIETARY_PREFERENCES = ["Mixed", "Pure Veg", "Non-Veg"];
const FOOD_FILTERS = ["All", "Veg", "Non-Veg"] as const;
type FoodFilter = (typeof FOOD_FILTERS)[number];

type EventForm = {
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  event_type: string;
  event_date: string;
  event_time: string;
  guest_count: string;
  dietary_preference: string;
  venue_address: string;
  special_requests: string;
};
type SelectedFood = { food: FoodProduct; quantity: number };
type EventOrder = Record<string, unknown> & { orderKey: string };

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
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function getFoodId(food: FoodProduct): string {
  return String(food.food_id ?? food.id ?? "");
}

function getFoodName(food: FoodProduct): string {
  return String(food.food_name ?? food.name ?? "Menu item");
}

function getFoodPrice(food: FoodProduct): number {
  return Math.max(0, getNumber(food.final_price || food.mrp || food.price || 0));
}

function getFoodImage(food: FoodProduct): string {
  const images = food.food_images;
  const image =
    (Array.isArray(images) ? images[0] : undefined) ??
    food.image ??
    food.product_image;
  if (typeof image !== "string" || !image.trim()) return "";
  if (/^(https?:\/\/|data:|blob:)/i.test(image)) return image;
  const baseUrl = API_BASE_URL.replace(/\/api\/?$/, "");
  return `${baseUrl}${image.startsWith("/") ? image : `/${image}`}`;
}

function getMinimumEventDate(): string {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return [
    tomorrow.getFullYear(),
    String(tomorrow.getMonth() + 1).padStart(2, "0"),
    String(tomorrow.getDate()).padStart(2, "0"),
  ].join("-");
}

function getProfileText(
  profile: Record<string, unknown>,
  keys: string[],
): string {
  return getText(profile, keys);
}

async function fetchBulkMenu(): Promise<FoodProduct[]> {
  const response = await api.get("/event-orders/menu");
  const body = asRecord(response.data);
  const data = Array.isArray(response.data)
    ? response.data
    : Array.isArray(body?.data)
      ? body.data
      : null;
  if (!data) throw new Error("The event menu response was invalid.");
  return data.flatMap((entry) => {
    const record = asRecord(entry);
    return record && getFoodId(record as FoodProduct)
      ? [record as FoodProduct]
      : [];
  });
}

async function fetchMyEventOrders(): Promise<EventOrder[]> {
  const response = await api.get("/event-orders/mine");
  const body = asRecord(response.data);
  const data = Array.isArray(body?.data) ? body.data : null;
  if (!data) throw new Error("The event orders response was invalid.");
  return data.flatMap((entry) => {
    const record = asRecord(entry);
    if (!record) return [];
    const orderKey = getText(record, ["id", "event_order_number", "order_number"]);
    return orderKey ? [{ ...record, orderKey }] : [];
  });
}

function FormField({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  multiline = false,
  maxLength,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  keyboardType?:
    | "default"
    | "email-address"
    | "number-pad"
    | "numbers-and-punctuation"
    | "phone-pad";
  multiline?: boolean;
  maxLength?: number;
}) {
  return (
    <View className="mb-3">
      <Text className="mb-1.5 text-xs font-bold uppercase tracking-wide text-[#59645E]">
        {label}
      </Text>
      <TextInput
        className={`rounded-xl border border-[#E1E5DF] bg-white px-3.5 text-sm text-[#183B2A] ${
          multiline ? "min-h-24 py-3" : "h-12"
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

function ChoiceRow({
  choices,
  selected,
  onSelect,
}: {
  choices: string[];
  selected: string;
  onSelect: (choice: string) => void;
}) {
  return (
    <ScrollView
      className="mb-1 max-h-11"
      contentContainerStyle={{ gap: 8, paddingRight: 4 }}
      horizontal
      showsHorizontalScrollIndicator={false}
    >
      {choices.map((choice) => {
        const active = choice === selected;
        return (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            className={`rounded-full border px-3.5 py-2 ${
              active
                ? "border-[#1A6A3B] bg-[#1A6A3B]"
                : "border-[#E1E5DF] bg-white"
            }`}
            key={choice}
            onPress={() => onSelect(choice)}
          >
            <Text className={`text-xs font-semibold ${active ? "text-white" : "text-[#344035]"}`}>
              {choice}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export default function EventOrdersScreen() {
  const [form, setForm] = useState<EventForm>({
    customer_name: "",
    customer_phone: "",
    customer_email: "",
    event_type: EVENT_TYPES[0],
    event_date: getMinimumEventDate(),
    event_time: "13:00",
    guest_count: "25",
    dietary_preference: DIETARY_PREFERENCES[0],
    venue_address: "",
    special_requests: "",
  });
  const [menu, setMenu] = useState<FoodProduct[]>([]);
  const [selectedFoods, setSelectedFoods] = useState<Record<string, SelectedFood>>({});
  const [orders, setOrders] = useState<EventOrder[]>([]);
  const [menuError, setMenuError] = useState("");
  const [ordersError, setOrdersError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [isMenuLoading, setIsMenuLoading] = useState(true);
  const [isOrdersLoading, setIsOrdersLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [respondingTo, setRespondingTo] = useState("");
  const [search, setSearch] = useState("");
  const [foodFilter, setFoodFilter] = useState<FoodFilter>("All");
  const [success, setSuccess] = useState<{ orderNumber: string; amount: number } | null>(null);

  const loadMenu = useCallback(async () => {
    setMenuError("");
    try {
      setMenu(await fetchBulkMenu());
    } catch (error) {
      setMenuError(getApiErrorMessage(error, "Could not load the full catering menu."));
    } finally {
      setIsMenuLoading(false);
    }
  }, []);

  const loadOrders = useCallback(async () => {
    try {
      const token = await getStoredToken();
      if (!token) {
        setOrders([]);
        setOrdersError("Sign in to see and respond to your event quotations.");
        return;
      }
      setOrdersError("");
      setOrders(await fetchMyEventOrders());
    } catch (error) {
      setOrdersError(getApiErrorMessage(error, "Could not load your event orders."));
    } finally {
      setIsOrdersLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => loadMenu());
    void (async () => {
      try {
        const token = await getStoredToken();
        if (!token) {
          if (active) {
            setOrdersError("Sign in to see and respond to your event quotations.");
          }
          return;
        }
        const customerOrders = await fetchMyEventOrders();
        if (active) {
          setOrders(customerOrders);
          setOrdersError("");
        }
      } catch (error) {
        if (active) {
          setOrdersError(getApiErrorMessage(error, "Could not load your event orders."));
        }
      } finally {
        if (active) setIsOrdersLoading(false);
      }
    })();
    void (async () => {
      try {
        const user = asRecord(await getStoredUser());
        if (!user || !active) return;
        const profile = asRecord(user.user) ?? user;
        const firstName = getProfileText(profile, ["first_name", "firstName"]);
        const lastName = getProfileText(profile, ["last_name", "lastName"]);
        setForm((current) => ({
          ...current,
          customer_name:
            current.customer_name ||
            getProfileText(profile, ["name", "full_name", "username"]) ||
            [firstName, lastName].filter(Boolean).join(" "),
          customer_phone:
            current.customer_phone ||
            getProfileText(profile, ["mobile_number", "phone", "customer_phone"]),
          customer_email:
            current.customer_email || getProfileText(profile, ["email", "email_address"]),
        }));
      } catch (error) {
        console.error("Failed to load event-order customer details:", error);
      }
    })();
    return () => {
      active = false;
    };
  }, [loadMenu]);

  const selectedList = useMemo(() => Object.values(selectedFoods), [selectedFoods]);
  const estimatedTotal = useMemo(
    () =>
      selectedList.reduce(
        (total, selection) => total + getFoodPrice(selection.food) * selection.quantity,
        0,
      ),
    [selectedList],
  );
  const visibleFoods = useMemo(() => {
    const query = search.trim().toLowerCase();
    return menu.filter((food) => {
      const matchesFoodType =
        foodFilter === "All" ||
        String(food.food_type ?? "").toLowerCase() === foodFilter.toLowerCase();
      const matchesQuery =
        !query ||
        [getFoodName(food), food.description, food.category_name, food.cuisine_name]
          .some((value) => String(value ?? "").toLowerCase().includes(query));
      return matchesFoodType && matchesQuery;
    });
  }, [foodFilter, menu, search]);

  const updateForm = (key: keyof EventForm, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
    setSubmitError("");
  };

  const setFoodQuantity = (food: FoodProduct, quantity: number) => {
    const foodId = getFoodId(food);
    if (!foodId) return;
    setSelectedFoods((current) => {
      const next = { ...current };
      if (!Number.isInteger(quantity) || quantity <= 0) {
        delete next[foodId];
      } else {
        next[foodId] = { food, quantity };
      }
      return next;
    });
  };

  const refreshScreen = async () => {
    setIsRefreshing(true);
    setIsOrdersLoading(true);
    await Promise.all([loadMenu(), loadOrders()]);
    setIsRefreshing(false);
  };

  const submitEventOrder = async () => {
    setSubmitError("");
    const trimmedName = form.customer_name.trim();
    const trimmedPhone = form.customer_phone.trim();
    const trimmedEmail = form.customer_email.trim();
    const guests = Number(form.guest_count);
    const [year, month, day] = form.event_date.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    const dateIsValid =
      date.getFullYear() === year &&
      date.getMonth() === month - 1 &&
      date.getDate() === day;
    const [minimumYear, minimumMonth, minimumDay] = getMinimumEventDate()
      .split("-")
      .map(Number);
    const minimumDate = new Date(minimumYear, minimumMonth - 1, minimumDay);

    if (!trimmedName || trimmedName.length > 150) {
      setSubmitError("Please enter a valid contact person name.");
      return;
    }
    if (!/^[+()\d\s-]{7,32}$/.test(trimmedPhone)) {
      setSubmitError("Please enter a valid phone number.");
      return;
    }
    if (
      trimmedEmail &&
      (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail) || trimmedEmail.length > 255)
    ) {
      setSubmitError("Please enter a valid email address.");
      return;
    }
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(form.event_date) ||
      Number.isNaN(date.getTime()) ||
      !dateIsValid ||
      date < minimumDate
    ) {
      setSubmitError("Choose an event date at least one day from today (YYYY-MM-DD).");
      return;
    }
    const [hours, minutes] = form.event_time.split(":").map(Number);
    if (
      !/^\d{2}:\d{2}$/.test(form.event_time) ||
      hours > 23 ||
      minutes > 59
    ) {
      setSubmitError("Enter the event serving time as HH:MM.");
      return;
    }
    if (!Number.isInteger(guests) || guests < 5) {
      setSubmitError("Event orders require a minimum of 5 guests.");
      return;
    }
    if (form.venue_address.trim().length < 5) {
      setSubmitError("Please enter the event venue or delivery address.");
      return;
    }
    if (!selectedList.length) {
      setSubmitError("Select at least one dish for your event menu.");
      return;
    }

    setIsSubmitting(true);
    try {
      const items = selectedList.map(({ food, quantity }) => {
        const unitPrice = getFoodPrice(food);
        const images = food.food_images;
        const image = Array.isArray(images) ? images[0] : food.image;
        return {
          food_id: food.food_id ?? food.id,
          product_name: getFoodName(food),
          product_image: typeof image === "string" ? image : "",
          category_name: String(food.category_name ?? ""),
          portion_size: String(food.portion_size ?? "Standard"),
          unit_price: unitPrice,
          quantity,
          total_price: Number((unitPrice * quantity).toFixed(2)),
          notes: "",
        };
      });
      const response = await api.post("/event-orders", {
        customer_name: trimmedName,
        customer_phone: trimmedPhone,
        customer_email: trimmedEmail || null,
        event_type: form.event_type,
        event_date: form.event_date,
        event_time: form.event_time,
        guest_count: guests,
        dietary_preference: form.dietary_preference,
        venue_address: form.venue_address.trim(),
        special_requests: form.special_requests.trim(),
        payment_method: "cod",
        total_estimated_amount: Number(estimatedTotal.toFixed(2)),
        items,
      });
      const body = asRecord(response.data);
      if (body?.success !== true) {
        throw new Error(getText(body ?? {}, ["message"]) || "Could not submit your event order.");
      }
      const data = asRecord(body.data);
      setSuccess({
        orderNumber: getText(data ?? {}, ["eventOrderNumber", "event_order_number", "order_number"]) || "Submitted",
        amount: estimatedTotal,
      });
      setSelectedFoods({});
      setSubmitError("");
      await loadOrders();
    } catch (error) {
      setSubmitError(getApiErrorMessage(error, "Could not submit your event order."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const respondToQuote = (order: EventOrder, action: "accept" | "reject") => {
    const orderLabel = getText(order, ["event_order_number", "order_number"]) || order.orderKey;
    Alert.alert(
      action === "accept" ? "Accept this quotation?" : "Reject this quotation?",
      action === "accept"
        ? "Your event order will be confirmed and sent to the kitchen."
        : "This will cancel the event order.",
      [
        { text: "Keep quotation", style: "cancel" },
        {
          text: action === "accept" ? "Accept quote" : "Reject quote",
          style: action === "reject" ? "destructive" : "default",
          onPress: () => {
            void (async () => {
              setRespondingTo(order.orderKey);
              setOrdersError("");
              try {
                const response = await api.post(
                  `/event-orders/${encodeURIComponent(order.orderKey)}/respond`,
                  { action },
                );
                const body = asRecord(response.data);
                if (body?.success !== true) {
                  throw new Error(
                    getText(body ?? {}, ["message"]) || "Could not update the quotation.",
                  );
                }
                await loadOrders();
                Alert.alert(
                  action === "accept" ? "Quotation accepted" : "Quotation rejected",
                  getText(body ?? {}, ["message"]) ||
                    `Event order #${orderLabel} was updated.`,
                );
              } catch (error) {
                setOrdersError(
                  getApiErrorMessage(error, "Could not update the quotation."),
                );
              } finally {
                setRespondingTo("");
              }
            })();
          },
        },
      ],
    );
  };

  return (
    <ScrollView
      className="flex-1 bg-[#F3F4F3]"
      contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl
          colors={["#1A6A3B"]}
          onRefresh={() => void refreshScreen()}
          refreshing={isRefreshing}
          tintColor="#1A6A3B"
        />
      }
      showsVerticalScrollIndicator={false}
    >
      <View className="mb-4 rounded-2xl bg-[#183B2A] p-4">
        <View className="flex-row items-center">
          <View className="mr-3 h-10 w-10 items-center justify-center rounded-xl bg-white/10">
            <PartyPopper color="#F7BD48" size={21} />
          </View>
          <View className="flex-1">
            <Text className="text-lg font-extrabold text-white">Catering & Event Orders</Text>
            <Text className="mt-1 text-xs leading-5 text-[#D8E4D7]">
              Plan your menu and request a custom quotation for groups of 5 or more.
            </Text>
          </View>
        </View>
        <View className="mt-4 flex-row rounded-xl bg-black/15 p-3">
          <Users color="#F7BD48" size={17} />
          <Text className="ml-2 flex-1 text-xs font-semibold text-white">
            Choose from the full catering menu. Final pricing is confirmed in your quotation.
          </Text>
        </View>
      </View>

      {success ? (
        <View className="mb-4 rounded-2xl border border-[#CFE3C4] bg-[#EAF4E4] p-4">
          <View className="flex-row items-center">
            <CheckCircle2 color="#075B2B" size={21} />
            <Text className="ml-2 flex-1 text-base font-extrabold text-[#075B2B]">
              Event request submitted
            </Text>
          </View>
          <Text className="mt-2 text-sm leading-5 text-[#344035]">
            Request #{success.orderNumber} is with our team for review. Your menu estimate is ₹
            {success.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}.
          </Text>
        </View>
      ) : null}

      <View className="mb-4 rounded-2xl border border-[#E1E5DF] bg-white p-4">
        <SectionTitle icon={<Users color="#1A6A3B" size={19} />} title="Contact & event details" />
        <FormField
          label="Organizer name *"
          onChangeText={(value) => updateForm("customer_name", value)}
          placeholder="Full name"
          value={form.customer_name}
        />
        <FormField
          keyboardType="phone-pad"
          label="Phone number *"
          onChangeText={(value) => updateForm("customer_phone", value)}
          placeholder="Contact phone number"
          value={form.customer_phone}
        />
        <FormField
          keyboardType="email-address"
          label="Email address (optional)"
          onChangeText={(value) => updateForm("customer_email", value)}
          placeholder="name@example.com"
          value={form.customer_email}
        />
        <Text className="mb-2 mt-1 text-xs font-bold uppercase tracking-wide text-[#59645E]">
          Occasion *
        </Text>
        <ChoiceRow
          choices={EVENT_TYPES}
          onSelect={(value) => updateForm("event_type", value)}
          selected={form.event_type}
        />
        <View className="mt-3 flex-row">
          <View className="mr-2 flex-1">
            <FormField
              keyboardType="numbers-and-punctuation"
              label="Event date *"
              maxLength={10}
              onChangeText={(value) => updateForm("event_date", value)}
              placeholder="YYYY-MM-DD"
              value={form.event_date}
            />
          </View>
          <View className="ml-2 flex-1">
            <FormField
              keyboardType="numbers-and-punctuation"
              label="Serving time *"
              maxLength={5}
              onChangeText={(value) => updateForm("event_time", value)}
              placeholder="HH:MM"
              value={form.event_time}
            />
          </View>
        </View>
        <FormField
          keyboardType="number-pad"
          label="Expected guests (minimum 5) *"
          onChangeText={(value) => updateForm("guest_count", value.replace(/[^\d]/g, ""))}
          placeholder="25"
          value={form.guest_count}
        />
        <Text className="mb-2 mt-1 text-xs font-bold uppercase tracking-wide text-[#59645E]">
          Dietary preference
        </Text>
        <ChoiceRow
          choices={DIETARY_PREFERENCES}
          onSelect={(value) => updateForm("dietary_preference", value)}
          selected={form.dietary_preference}
        />
        <FormField
          label="Event venue / delivery address *"
          multiline
          onChangeText={(value) => updateForm("venue_address", value)}
          placeholder="Street, area, city, and any helpful directions"
          value={form.venue_address}
        />
        <FormField
          label="Special requests (optional)"
          multiline
          onChangeText={(value) => updateForm("special_requests", value)}
          placeholder="Allergies, serving notes, or other requests"
          value={form.special_requests}
        />
      </View>

      <View className="mb-4 rounded-2xl border border-[#E1E5DF] bg-white p-4">
        <SectionTitle icon={<Utensils color="#1A6A3B" size={19} />} title="Choose your event menu" />
        <View className="mb-3 flex-row items-center rounded-xl border border-[#E1E5DF] bg-[#FAFAF7] px-3">
          <Search color="#59645E" size={17} />
          <TextInput
            accessibilityLabel="Search catering menu"
            className="h-11 flex-1 px-2.5 text-sm text-[#183B2A]"
            onChangeText={setSearch}
            placeholder="Search dishes"
            placeholderTextColor="#879087"
            returnKeyType="search"
            value={search}
          />
        </View>
        <ChoiceRow
          choices={[...FOOD_FILTERS]}
          onSelect={(value) => setFoodFilter(value as FoodFilter)}
          selected={foodFilter}
        />

        {isMenuLoading ? (
          <View className="items-center py-8">
            <ActivityIndicator color="#1A6A3B" />
            <Text className="mt-2 text-sm text-[#728071]">Loading the catering menu…</Text>
          </View>
        ) : menuError ? (
          <View className="mt-4 rounded-xl border border-[#F3C9C5] bg-[#FFF4F2] p-3">
            <Text accessibilityRole="alert" className="text-sm text-[#A33424]">
              {menuError}
            </Text>
            <Pressable className="mt-2 self-start" onPress={() => void loadMenu()}>
              <Text className="text-sm font-bold text-[#A33424]">Try again</Text>
            </Pressable>
          </View>
        ) : visibleFoods.length ? (
          visibleFoods.map((food) => (
            <MenuFoodRow
              food={food}
              key={getFoodId(food)}
              onQuantityChange={(quantity) => setFoodQuantity(food, quantity)}
              quantity={selectedFoods[getFoodId(food)]?.quantity ?? 0}
            />
          ))
        ) : (
          <Text className="py-8 text-center text-sm text-[#728071]">
            No dishes match your search or dietary filter.
          </Text>
        )}
      </View>

      <View className="mb-4 rounded-2xl border border-[#D9E6D9] bg-white p-4">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center">
            <PartyPopper color="#1A6A3B" size={19} />
            <Text className="ml-2 text-base font-extrabold text-[#183B2A]">
              Request summary
            </Text>
          </View>
          <Text className="text-xs font-bold text-[#728071]">
            {selectedList.length} {selectedList.length === 1 ? "dish" : "dishes"}
          </Text>
        </View>
        {selectedList.map(({ food, quantity }) => (
          <View className="mt-2 flex-row justify-between" key={getFoodId(food)}>
            <Text className="flex-1 pr-2 text-sm text-[#59645E]" numberOfLines={1}>
              {getFoodName(food)} × {quantity}
            </Text>
            <Text className="text-sm font-semibold text-[#344035]">
              ₹{(getFoodPrice(food) * quantity).toFixed(2)}
            </Text>
          </View>
        ))}
        <View className="mt-3 flex-row justify-between border-t border-[#EEE8DD] pt-3">
          <Text className="text-sm font-semibold text-[#59645E]">Estimated menu value</Text>
          <Text className="text-base font-extrabold text-[#1A6A3B]">
            ₹{estimatedTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </Text>
        </View>
        <Text className="mt-2 text-xs leading-5 text-[#728071]">
          This is an estimate only. Our team will review your quantities and send the final quotation.
        </Text>
        {submitError ? (
          <Text accessibilityRole="alert" className="mt-3 text-sm font-semibold text-[#A33424]">
            {submitError}
          </Text>
        ) : null}
        <Pressable
          accessibilityRole="button"
          className={`mt-4 min-h-12 flex-row items-center justify-center rounded-xl ${
            isSubmitting ? "bg-[#72937B]" : "bg-[#1A6A3B] active:bg-[#14542E]"
          }`}
          disabled={isSubmitting}
          onPress={() => void submitEventOrder()}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Send color="#FFFFFF" size={16} />
              <Text className="ml-2 text-sm font-extrabold text-white">
                Submit quotation request
              </Text>
            </>
          )}
        </Pressable>
      </View>

      <View className="rounded-2xl border border-[#E1E5DF] bg-white p-4">
        <SectionTitle
          icon={<CalendarDays color="#1A6A3B" size={19} />}
          title="Your event orders"
          subtitle="Review status and respond to quotations."
        />
        {ordersError ? (
          <Text className="mt-1 text-sm leading-5 text-[#728071]">{ordersError}</Text>
        ) : isOrdersLoading ? (
          <View className="items-center py-5">
            <ActivityIndicator color="#1A6A3B" />
          </View>
        ) : orders.length ? (
          orders.map((order) => (
            <EventOrderCard
              key={order.orderKey}
              order={order}
              isResponding={respondingTo === order.orderKey}
              onRespond={(action) => respondToQuote(order, action)}
            />
          ))
        ) : (
          <Text className="mt-1 text-sm text-[#728071]">
            Event requests submitted while signed in will appear here.
          </Text>
        )}
      </View>
    </ScrollView>
  );
}

function SectionTitle({
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
}) {
  return (
    <View className="mb-4 flex-row items-center">
      <View className="mr-2.5 h-9 w-9 items-center justify-center rounded-xl bg-[#EAF2E8]">
        {icon}
      </View>
      <View className="flex-1">
        <Text className="text-base font-extrabold text-[#183B2A]">{title}</Text>
        {subtitle ? <Text className="mt-0.5 text-xs text-[#728071]">{subtitle}</Text> : null}
      </View>
    </View>
  );
}

function MenuFoodRow({
  food,
  quantity,
  onQuantityChange,
}: {
  food: FoodProduct;
  quantity: number;
  onQuantityChange: (quantity: number) => void;
}) {
  const image = getFoodImage(food);
  return (
    <View className="mt-3 rounded-xl border border-[#EEE8DD] bg-[#FFFEFB] p-3">
      <View className="flex-row items-center">
        <View className="h-14 w-14 items-center justify-center overflow-hidden rounded-xl bg-[#F1F3EC]">
          {image ? (
            <Image
              accessibilityLabel={getFoodName(food)}
              className="h-full w-full"
              resizeMode="cover"
              source={{ uri: image }}
            />
          ) : (
            <Utensils color="#1A6A3B" size={20} />
          )}
        </View>
        <View className="ml-3 flex-1">
          <Text className="text-[10px] font-bold uppercase tracking-wide text-[#728071]">
            {String(food.category_name ?? "Dish")}
          </Text>
          <Text className="mt-0.5 text-sm font-extrabold text-[#183B2A]" numberOfLines={1}>
            {getFoodName(food)}
          </Text>
          <Text className="mt-0.5 text-xs font-semibold text-[#1A6A3B]">
            ₹{getFoodPrice(food).toFixed(2)} / {String(food.portion_size ?? "portion")}
          </Text>
        </View>
      </View>
      <View className="mt-3 flex-row items-center justify-between border-t border-[#EEE8DD] pt-3">
        {quantity === 0 ? (
          <Pressable
            accessibilityRole="button"
            className="min-h-10 flex-1 flex-row items-center justify-center rounded-lg border border-[#1A6A3B] bg-white active:bg-[#EAF2E8]"
            onPress={() => onQuantityChange(10)}
          >
            <Plus color="#1A6A3B" size={15} />
            <Text className="ml-1.5 text-xs font-bold text-[#1A6A3B]">Add 10 portions</Text>
          </Pressable>
        ) : (
          <>
            <Pressable
              accessibilityLabel={`Remove ten ${getFoodName(food)} portions`}
              accessibilityRole="button"
              className="h-9 w-9 items-center justify-center rounded-lg bg-[#F0EEE7]"
              onPress={() => onQuantityChange(quantity - 10)}
            >
              <Text className="text-[10px] font-extrabold text-[#344035]">-10</Text>
            </Pressable>
            <Pressable
              accessibilityLabel={`Remove five ${getFoodName(food)} portions`}
              accessibilityRole="button"
              className="h-9 w-9 items-center justify-center rounded-lg bg-[#F0EEE7]"
              onPress={() => onQuantityChange(quantity - 5)}
            >
              <Text className="text-[10px] font-extrabold text-[#344035]">-5</Text>
            </Pressable>
            <Pressable
              accessibilityLabel={`Remove one ${getFoodName(food)} portion`}
              accessibilityRole="button"
              className="h-9 w-8 items-center justify-center rounded-lg bg-[#F0EEE7]"
              onPress={() => onQuantityChange(quantity - 1)}
            >
              <Minus color="#344035" size={15} />
            </Pressable>
            <TextInput
              accessibilityLabel={`${getFoodName(food)} quantity`}
              className="mx-1 h-11 w-14 rounded-lg border border-[#D9E6D9] py-0 text-center text-sm font-bold text-[#183B2A]"
              keyboardType="number-pad"
              onChangeText={(value) =>
                onQuantityChange(value ? Math.max(0, Number(value.replace(/[^\d]/g, ""))) : 0)
              }
              textAlignVertical="center"
              value={String(quantity)}
            />
            <Pressable
              accessibilityLabel={`Add one ${getFoodName(food)} portion`}
              accessibilityRole="button"
              className="h-9 w-8 items-center justify-center rounded-lg bg-[#1A6A3B]"
              onPress={() => onQuantityChange(quantity + 1)}
            >
              <Plus color="#FFFFFF" size={15} />
            </Pressable>
            <Pressable
              accessibilityLabel={`Add five ${getFoodName(food)} portions`}
              accessibilityRole="button"
              className="h-9 w-9 items-center justify-center rounded-lg bg-[#1A6A3B]"
              onPress={() => onQuantityChange(quantity + 5)}
            >
              <Text className="text-[10px] font-extrabold text-white">+5</Text>
            </Pressable>
            <Pressable
              accessibilityLabel={`Add ten ${getFoodName(food)} portions`}
              accessibilityRole="button"
              className="h-9 w-9 items-center justify-center rounded-lg bg-[#1A6A3B]"
              onPress={() => onQuantityChange(quantity + 10)}
            >
              <Text className="text-[10px] font-extrabold text-white">+10</Text>
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

function EventOrderCard({
  order,
  isResponding,
  onRespond,
}: {
  order: EventOrder;
  isResponding: boolean;
  onRespond: (action: "accept" | "reject") => void;
}) {
  const orderNumber =
    getText(order, ["event_order_number", "order_number"]) || order.orderKey;
  const status = getText(order, ["status"]) || "Pending";
  const action = getText(order, ["customer_action"]).toLowerCase();
  const quotedAmount = getNumber(order.quoted_amount);
  const quoteAvailable =
    quotedAmount > 0 &&
    !action &&
    ["quotation sent", "quoted"].includes(status.toLowerCase());
  const date = getText(order, ["event_date"]);
  const eventType = getText(order, ["event_type"]) || "Event";
  const guestCount = getText(order, ["guest_count"]);
  return (
    <View className="mt-3 rounded-xl border border-[#EEE8DD] bg-[#FFFEFB] p-3">
      <View className="flex-row items-start justify-between">
        <View className="flex-1 pr-2">
          <Text className="text-xs font-bold uppercase tracking-wide text-[#728071]">
            Event order #{orderNumber}
          </Text>
          <Text className="mt-1 text-sm font-extrabold text-[#183B2A]">{eventType}</Text>
        </View>
        <Text className="rounded-full bg-[#F5EFE5] px-2.5 py-1 text-[10px] font-bold text-[#8A5A14]">
          {status}
        </Text>
      </View>
      <View className="mt-2 flex-row flex-wrap">
        {date ? (
          <View className="mr-3 mt-1 flex-row items-center">
            <Clock3 color="#728071" size={13} />
            <Text className="ml-1 text-xs text-[#59645E]">{date}</Text>
          </View>
        ) : null}
        {guestCount ? (
          <View className="mt-1 flex-row items-center">
            <Users color="#728071" size={13} />
            <Text className="ml-1 text-xs text-[#59645E]">{guestCount} guests</Text>
          </View>
        ) : null}
        {order.venue_address ? (
          <View className="mt-1 w-full flex-row items-center">
            <MapPin color="#728071" size={13} />
            <Text className="ml-1 flex-1 text-xs text-[#59645E]" numberOfLines={2}>
              {String(order.venue_address)}
            </Text>
          </View>
        ) : null}
      </View>
      {quotedAmount > 0 ? (
        <Text className="mt-3 text-sm font-extrabold text-[#1A6A3B]">
          Quoted total: ₹{quotedAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
        </Text>
      ) : null}
      {quoteAvailable ? (
        <View className="mt-3 flex-row">
          <Pressable
            accessibilityRole="button"
            className="mr-2 min-h-10 flex-1 items-center justify-center rounded-lg bg-[#1A6A3B] active:bg-[#14542E]"
            disabled={isResponding}
            onPress={() => onRespond("accept")}
          >
            <Text className="text-xs font-bold text-white">
              {isResponding ? "Updating…" : "Accept quotation"}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            className="min-h-10 flex-1 items-center justify-center rounded-lg border border-[#E7C6C1] bg-white active:bg-[#FFF4F2]"
            disabled={isResponding}
            onPress={() => onRespond("reject")}
          >
            <Text className="text-xs font-bold text-[#A33424]">Reject</Text>
          </Pressable>
        </View>
      ) : action ? (
        <Text className="mt-2 text-xs font-semibold text-[#59645E]">
          Quotation {action}.
        </Text>
      ) : null}
    </View>
  );
}
