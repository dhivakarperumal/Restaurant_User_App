import { router } from "expo-router";
import {
  ArrowRight,
  CalendarDays,
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  LockKeyhole,
  LogOut,
  MapPin,
  Package,
  PartyPopper,
  Pencil,
  Plus,
  Save,
  ShieldCheck,
  Trash2,
  UserRound,
  X,
} from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import api, {
  getApiErrorMessage,
  getStoredToken,
  getStoredUser,
  saveUser,
} from "../lib/api";
import { confirmLogout } from "../lib/logout";
import type { CheckoutAddress } from "../lib/orderApi";

type AccountTab =
  | "profile"
  | "address"
  | "orders"
  | "reservations"
  | "event-orders"
  | "password";
type ApiRecord = Record<string, unknown>;
type AccountUser = ApiRecord & { userId: string };
type AccountAddress = CheckoutAddress & {
  customer_name?: string;
  mobile_number?: string;
};
type AccountOrder = ApiRecord & { order_id: string; item_count: number };
type Reservation = ApiRecord & { reservation_id: string };
type EventOrder = ApiRecord & { orderKey: string };
type AddressForm = {
  address_line1: string;
  address_line2: string;
  city: string;
  state: string;
  pincode: string;
  landmark: string;
};
type PasswordForm = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

const EMPTY_ADDRESS: AddressForm = {
  address_line1: "",
  address_line2: "",
  city: "",
  state: "Tamil Nadu",
  pincode: "",
  landmark: "",
};
const ACCOUNT_TABS: {
  id: AccountTab;
  label: string;
  detail: string;
  Icon: LucideIcon;
}[] = [
  { id: "profile", label: "Profile", detail: "Personal details", Icon: UserRound },
  { id: "address", label: "Addresses", detail: "Delivery locations", Icon: MapPin },
  { id: "orders", label: "Orders", detail: "Meals & delivery", Icon: Package },
  {
    id: "reservations",
    label: "Reservations",
    detail: "Table bookings",
    Icon: CalendarDays,
  },
  {
    id: "event-orders",
    label: "Event orders",
    detail: "Catering requests",
    Icon: PartyPopper,
  },
  {
    id: "password",
    label: "Password",
    detail: "Account security",
    Icon: LockKeyhole,
  },
];
const ORDER_FILTERS = [
  "All Orders",
  "Order Placed",
  "Preparing",
  "Ready",
  "Assigned",
  "Delivered",
  "Cancelled",
] as const;

function asRecord(value: unknown): ApiRecord | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as ApiRecord)
    : null;
}

function text(record: ApiRecord, keys: string[]): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" || typeof value === "number") {
      const result = String(value).trim();
      if (result) return result;
    }
  }
  return "";
}

function number(value: unknown): number {
  const result = Number(value);
  return Number.isFinite(result) ? result : 0;
}

function responseList(responseData: unknown, keys: string[] = ["data"]): unknown[] {
  if (Array.isArray(responseData)) return responseData;
  const body = asRecord(responseData);
  for (const key of keys) {
    if (Array.isArray(body?.[key])) return body[key] as unknown[];
  }
  return [];
}

function normalizeAddress(value: unknown): AccountAddress | null {
  const record = asRecord(value);
  if (!record) return null;
  const id = record.id ?? record.address_id;
  return {
    id: typeof id === "string" || typeof id === "number" ? id : undefined,
    address_line: text(record, ["address_line", "address_line1", "door_number"]),
    area_locality: text(record, ["area_locality", "address_line2", "street_name"]),
    city: text(record, ["city"]),
    state: text(record, ["state"]),
    pincode: text(record, ["pincode"]),
    landmark: text(record, ["landmark"]),
    customer_name: text(record, ["customer_name"]),
    mobile_number: text(record, ["mobile_number"]),
  };
}

function normalizeOrder(value: unknown): AccountOrder | null {
  const record = asRecord(value);
  if (!record) return null;
  const orderId = text(record, ["order_number", "order_id", "id"]);
  if (!orderId) return null;
  const items = Array.isArray(record.items) ? record.items : [];
  const itemCount =
    number(record.item_count) ||
    items.reduce((total, item) => total + (number(asRecord(item)?.quantity) || 1), 0);
  return { ...record, order_id: orderId, item_count: itemCount };
}

function normalizeReservation(value: unknown): Reservation | null {
  const record = asRecord(value);
  if (!record) return null;
  const reservationId = text(record, ["reservation_id", "id"]);
  return reservationId ? { ...record, reservation_id: reservationId } : null;
}

function normalizeEventOrder(value: unknown): EventOrder | null {
  const record = asRecord(value);
  if (!record) return null;
  const orderKey = text(record, ["id", "event_order_number", "order_number"]);
  return orderKey ? { ...record, orderKey } : null;
}

function getOrderStatusGroup(status: unknown): string {
  const normalized = String(status || "processing")
    .trim()
    .toLowerCase()
    .replace(/_/g, " ");
  if (["cancelled", "returned", "payment failed"].includes(normalized)) return "Cancelled";
  if (["delivered", "completed"].includes(normalized)) return "Delivered";
  if (["assigned", "out for delivery", "shipped"].includes(normalized)) return "Assigned";
  if (["ready", "ready to serve"].includes(normalized)) return "Ready";
  if (normalized === "preparing") return "Preparing";
  return "Order Placed";
}

function formatDate(value: unknown): string {
  if (!value) return "Date unavailable";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatTime(value: unknown): string {
  if (!value) return "";
  const [hours, minutes] = String(value).slice(0, 5).split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return String(value);
  return `${hours % 12 || 12}:${String(minutes).padStart(2, "0")} ${hours < 12 ? "AM" : "PM"}`;
}

function formatMoney(value: unknown): string {
  return number(value).toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

function InputField({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = "default",
  maxLength,
  secureTextEntry = false,
  rightAction,
}: {
  label: string;
  value: string;
  onChangeText?: (value: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "email-address" | "phone-pad" | "number-pad";
  maxLength?: number;
  secureTextEntry?: boolean;
  rightAction?: React.ReactNode;
}) {
  return (
    <View className="mb-4">
      <Text className="mb-1.5 text-xs font-bold uppercase tracking-wide text-[#59645E]">
        {label}
      </Text>
      <View className="min-h-12 flex-row items-center rounded-xl border border-[#E1E5DF] bg-[#F8FAF7] px-3.5">
        <TextInput
          autoCapitalize={keyboardType === "email-address" ? "none" : "sentences"}
          className="min-h-12 flex-1 py-2 text-sm text-[#183B2A]"
          editable={Boolean(onChangeText)}
          keyboardType={keyboardType}
          maxLength={maxLength}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#879087"
          secureTextEntry={secureTextEntry}
          value={value}
        />
        {rightAction}
      </View>
    </View>
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
    <View className="mb-5 flex-row items-center border-b border-[#E8EDE6] pb-4">
      <View className="mr-3 h-11 w-11 items-center justify-center rounded-xl bg-[#EFF5E9]">
        <Icon color="#1A6A3B" size={21} />
      </View>
      <View className="flex-1">
        <Text className="text-lg font-extrabold text-[#183B2A]">{title}</Text>
        <Text className="mt-0.5 text-xs leading-5 text-[#728071]">{detail}</Text>
      </View>
    </View>
  );
}

function Notice({
  message,
  tone = "error",
}: {
  message: string;
  tone?: "error" | "success" | "info";
}) {
  const styles = {
    error: "border-[#F3C9C5] bg-[#FFF4F2] text-[#A33424]",
    success: "border-[#CFE3C4] bg-[#EAF4E4] text-[#075B2B]",
    info: "border-[#D9E6D9] bg-[#F4F8F2] text-[#344035]",
  } as const;
  return (
    <View className={`mb-4 rounded-xl border p-3 ${styles[tone]}`}>
      <Text accessibilityRole="alert" className="text-sm leading-5">
        {message}
      </Text>
    </View>
  );
}

function ActionButton({
  label,
  onPress,
  Icon,
  busy = false,
  secondary = false,
  destructive = false,
}: {
  label: string;
  onPress: () => void;
  Icon?: LucideIcon;
  busy?: boolean;
  secondary?: boolean;
  destructive?: boolean;
}) {
  const className = destructive
    ? "border border-[#F3C9C5] bg-white active:bg-[#FFF4F2]"
    : secondary
      ? "border border-[#D9E6D9] bg-white active:bg-[#F4F8F2]"
      : "bg-[#183B2A] active:bg-[#14542E]";
  const textClass = destructive ? "text-[#A33424]" : secondary ? "text-[#1A6A3B]" : "text-white";
  return (
    <Pressable
      accessibilityRole="button"
      className={`min-h-12 flex-row items-center justify-center rounded-xl px-4 ${className}`}
      disabled={busy}
      onPress={onPress}
    >
      {busy ? (
        <ActivityIndicator color={destructive || secondary ? "#1A6A3B" : "#FFFFFF"} />
      ) : (
        <>
          {Icon ? <Icon color={destructive || secondary ? "#1A6A3B" : "#FFFFFF"} size={17} /> : null}
          <Text className={`text-sm font-bold ${Icon ? "ml-2" : ""} ${textClass}`}>
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}

export default function ProfileScreen() {
  const [activeTab, setActiveTab] = useState<AccountTab>("profile");
  const [account, setAccount] = useState<AccountUser | null>(null);
  const [profile, setProfile] = useState({ username: "", mobile_number: "", email: "" });
  const [addressForm, setAddressForm] = useState<AddressForm>(EMPTY_ADDRESS);
  const [addresses, setAddresses] = useState<AccountAddress[]>([]);
  const [orders, setOrders] = useState<AccountOrder[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [eventOrders, setEventOrders] = useState<EventOrder[]>([]);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [password, setPassword] = useState<PasswordForm>({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [respondingTo, setRespondingTo] = useState("");
  const [loadError, setLoadError] = useState("");
  const [formError, setFormError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [selectedEventOrder, setSelectedEventOrder] = useState<EventOrder | null>(null);
  const [rejectingOrder, setRejectingOrder] = useState<EventOrder | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [orderStatusFilter, setOrderStatusFilter] =
    useState<(typeof ORDER_FILTERS)[number]>("All Orders");

  const loadAccount = useCallback(async () => {
    setLoadError("");
    const token = await getStoredToken();
    if (!token) {
      setAccount(null);
      setIsLoading(false);
      setLoadError("Sign in to manage your profile and view your account.");
      return;
    }

    const stored = asRecord(await getStoredUser());
    const storedUser = asRecord(stored?.user) ?? asRecord(stored?.data) ?? stored;
    const userId = text(storedUser ?? {}, ["user_id", "userId", "id", "_id"]);
    if (!storedUser || !userId) {
      setAccount(null);
      setIsLoading(false);
      setLoadError("Your account details are unavailable. Please sign in again.");
      return;
    }
    const nextAccount = { ...storedUser, userId };
    setAccount(nextAccount);

    const results = await Promise.allSettled([
      api.get(`/users/profile/${encodeURIComponent(userId)}`),
      api.get("/orders/addresses"),
      api.get("/orders/mine"),
      api.get("/reservations/mine"),
      api.get("/event-orders/mine"),
    ]);

    const [profileResult, addressesResult, ordersResult, reservationsResult, eventsResult] =
      results;

    if (profileResult.status === "fulfilled") {
      const body = asRecord(profileResult.value.data);
      const profileData = asRecord(body?.data) ?? nextAccount;
      setProfile({
        username:
          text(profileData, ["username", "name", "full_name", "displayName"]) ||
          text(nextAccount, ["username", "name", "displayName"]),
        mobile_number:
          text(profileData, ["mobile_number", "phone", "phone_number"]) ||
          text(nextAccount, ["mobile_number", "phone"]),
        email: text(profileData, ["email", "email_address"]) || text(nextAccount, ["email"]),
      });
    } else {
      setProfile({
        username: text(nextAccount, ["username", "name", "displayName"]),
        mobile_number: text(nextAccount, ["mobile_number", "phone"]),
        email: text(nextAccount, ["email", "email_address"]),
      });
      console.error("Failed to load account profile:", profileResult.reason);
      setLoadError((current) => current || "Some account details could not be loaded.");
    }

    if (addressesResult.status === "fulfilled") {
      setAddresses(
        responseList(addressesResult.value.data).flatMap((item) => {
          const address = normalizeAddress(item);
          return address ? [address] : [];
        }),
      );
    } else {
      console.error("Failed to load saved addresses:", addressesResult.reason);
      setLoadError((current) => current || "Some saved addresses could not be loaded.");
    }

    if (ordersResult.status === "fulfilled") {
      const unique = new Map<string, AccountOrder>();
      responseList(ordersResult.value.data).forEach((item) => {
        const order = normalizeOrder(item);
        if (order && !unique.has(order.order_id)) unique.set(order.order_id, order);
      });
      setOrders([...unique.values()]);
    } else {
      console.error("Failed to load account orders:", ordersResult.reason);
      setLoadError((current) => current || "Your orders could not be loaded.");
    }

    if (reservationsResult.status === "fulfilled") {
      setReservations(
        responseList(reservationsResult.value.data, ["reservations", "data"]).flatMap(
          (item) => {
            const reservation = normalizeReservation(item);
            return reservation ? [reservation] : [];
          },
        ),
      );
    } else {
      console.error("Failed to load reservations:", reservationsResult.reason);
      setLoadError((current) => current || "Your reservations could not be loaded.");
    }

    if (eventsResult.status === "fulfilled") {
      setEventOrders(
        responseList(eventsResult.value.data).flatMap((item) => {
          const eventOrder = normalizeEventOrder(item);
          return eventOrder ? [eventOrder] : [];
        }),
      );
    } else {
      console.error("Failed to load event orders:", eventsResult.reason);
      setLoadError((current) => current || "Your event orders could not be loaded.");
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    let mounted = true;
    void Promise.resolve().then(async () => {
      if (!mounted) return;
      try {
        await loadAccount();
      } catch (error) {
        if (mounted) {
          console.error("Failed to load the customer account:", error);
          setLoadError(getApiErrorMessage(error, "Could not load your account."));
          setIsLoading(false);
        }
      }
    });
    return () => {
      mounted = false;
    };
  }, [loadAccount]);

  const filteredOrders = useMemo(
    () =>
      orderStatusFilter === "All Orders"
        ? orders
        : orders.filter(
            (order) => getOrderStatusGroup(order.order_status) === orderStatusFilter,
          ),
    [orderStatusFilter, orders],
  );

  const refresh = async () => {
    setIsRefreshing(true);
    try {
      await loadAccount();
    } catch (error) {
      setLoadError(getApiErrorMessage(error, "Could not refresh your account."));
    } finally {
      setIsRefreshing(false);
    }
  };

  const saveProfileDetails = async () => {
    setFormError("");
    setSuccessMessage("");
    const username = profile.username.trim();
    if (!account) {
      setFormError("Sign in to update your profile.");
      return;
    }
    if (!username || username.length > 100) {
      setFormError("Enter a name that is 1 to 100 characters long.");
      return;
    }
    if (profile.mobile_number && !/^[+()\d\s-]{7,32}$/.test(profile.mobile_number.trim())) {
      setFormError("Enter a valid phone number.");
      return;
    }
    setIsSaving(true);
    try {
      await api.put(`/users/profile/${encodeURIComponent(account.userId)}`, {
        username,
        mobile_number: profile.mobile_number.trim(),
      });
      const nextUser = {
        ...account,
        username,
        name: username,
        displayName: username,
        mobile_number: profile.mobile_number.trim(),
        phone: profile.mobile_number.trim(),
      };
      await saveUser(nextUser);
      setAccount({ ...nextUser, userId: account.userId });
      setSuccessMessage("Your profile details have been saved.");
    } catch (error) {
      setFormError(getApiErrorMessage(error, "Could not update your profile."));
    } finally {
      setIsSaving(false);
    }
  };

  const startAddressEdit = (saved: AccountAddress) => {
    setAddressForm({
      address_line1: saved.address_line,
      address_line2: saved.area_locality,
      city: saved.city,
      state: saved.state || "Tamil Nadu",
      pincode: saved.pincode,
      landmark: saved.landmark,
    });
    setEditingAddressId(String(saved.id ?? ""));
    setFormError("");
    setSuccessMessage("");
  };

  const cancelAddressEdit = () => {
    setAddressForm(EMPTY_ADDRESS);
    setEditingAddressId(null);
    setFormError("");
  };

  const saveAddress = async () => {
    setFormError("");
    setSuccessMessage("");
    if (
      !addressForm.address_line1.trim() ||
      !addressForm.address_line2.trim() ||
      !addressForm.city.trim() ||
      !addressForm.state.trim() ||
      !/^\d{6}$/.test(addressForm.pincode.trim())
    ) {
      setFormError("Complete the address, locality, city, state, and 6-digit pincode.");
      return;
    }
    setIsSaving(true);
    try {
      const payload = {
        address_line: addressForm.address_line1.trim(),
        area_locality: addressForm.address_line2.trim(),
        city: addressForm.city.trim(),
        state: addressForm.state.trim(),
        pincode: addressForm.pincode.trim(),
        landmark: addressForm.landmark.trim(),
      };
      const response = editingAddressId
        ? await api.put(
            `/orders/addresses/${encodeURIComponent(editingAddressId)}`,
            payload,
          )
        : await api.post("/orders/addresses", payload);
      const body = asRecord(response.data);
      const returnedAddress = asRecord(body?.data);
      const newAddress = normalizeAddress({
        ...payload,
        ...(returnedAddress ?? {}),
        id: returnedAddress?.id ?? returnedAddress?.address_id ?? editingAddressId,
      });
      if (newAddress) {
        setAddresses((current) => [
          newAddress,
          ...current.filter(
            (entry) => String(entry.id ?? "") !== String(newAddress.id ?? ""),
          ),
        ]);
      } else {
        const result = await api.get("/orders/addresses");
        setAddresses(
          responseList(result.data).flatMap((item) => {
            const address = normalizeAddress(item);
            return address ? [address] : [];
          }),
        );
      }
      setAddressForm(EMPTY_ADDRESS);
      setEditingAddressId(null);
      setSuccessMessage(
        body?.created === false ? "That address is already saved." : "Address saved.",
      );
    } catch (error) {
      setFormError(getApiErrorMessage(error, "Could not save the address."));
    } finally {
      setIsSaving(false);
    }
  };

  const deleteAddress = (address: AccountAddress) => {
    const addressId = address.id;
    if (addressId === undefined) {
      setFormError("This saved address has no ID, so it cannot be deleted.");
      return;
    }
    Alert.alert("Delete saved address?", "This address will be removed from your account.", [
      { text: "Keep address", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          void (async () => {
            setIsSaving(true);
            setFormError("");
            try {
              await api.delete(`/orders/addresses/${encodeURIComponent(String(addressId))}`);
              setAddresses((current) =>
                current.filter((entry) => String(entry.id) !== String(addressId)),
              );
              setSuccessMessage("Address deleted.");
            } catch (error) {
              setFormError(getApiErrorMessage(error, "Could not delete this address."));
            } finally {
              setIsSaving(false);
            }
          })();
        },
      },
    ]);
  };

  const changePassword = async () => {
    setFormError("");
    setSuccessMessage("");
    if (!password.currentPassword) {
      setFormError("Enter your current password.");
      return;
    }
    if (password.newPassword.length < 8) {
      setFormError("Your new password must be at least 8 characters.");
      return;
    }
    if (password.newPassword !== password.confirmPassword) {
      setFormError("Your new passwords do not match.");
      return;
    }
    setIsSaving(true);
    try {
      await api.put("/users/password", {
        currentPassword: password.currentPassword,
        newPassword: password.newPassword,
      });
      setPassword({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setSuccessMessage("Your password has been changed.");
    } catch (error) {
      setFormError(getApiErrorMessage(error, "Could not change your password."));
    } finally {
      setIsSaving(false);
    }
  };

  const respondToQuotation = async (
    order: EventOrder,
    action: "accept" | "reject",
    reason = "",
  ) => {
    setRespondingTo(order.orderKey);
    setFormError("");
    try {
      const response = await api.post(
        `/event-orders/${encodeURIComponent(order.orderKey)}/respond`,
        { action, reason },
      );
      const body = asRecord(response.data);
      if (body?.success !== true) {
        throw new Error(text(body ?? {}, ["message"]) || "Could not update the quotation.");
      }
      const nextStatus = action === "accept" ? "Confirmed" : "Cancelled";
      const nextAction = action === "accept" ? "accepted" : "rejected";
      setEventOrders((current) =>
        current.map((item) =>
          item.orderKey === order.orderKey
            ? {
                ...item,
                status: nextStatus,
                customer_action: nextAction,
                customer_action_reason: reason,
              }
            : item,
        ),
      );
      setRejectingOrder(null);
      setRejectReason("");
      setSuccessMessage(
        text(body, ["message"]) ||
          (action === "accept"
            ? "Quotation accepted. Your event order is confirmed."
            : "Quotation rejected. Your event order was cancelled."),
      );
    } catch (error) {
      setFormError(getApiErrorMessage(error, "Could not update the quotation."));
    } finally {
      setRespondingTo("");
    }
  };

  const displayName =
    profile.username || text(account ?? {}, ["name", "displayName", "username"]) || "Food lover";
  const activeTabConfig = ACCOUNT_TABS.find((tab) => tab.id === activeTab) ?? ACCOUNT_TABS[0];

  return (
    <View className="flex-1 bg-[#F3F4F3]">
      <ScrollView
        className="flex-1"
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
        <View className="mb-4 overflow-hidden rounded-3xl bg-[#183B2A] p-5">
          <View className="flex-row items-center">
            <View className="mr-3 h-14 w-14 items-center justify-center rounded-2xl bg-white/10">
              <Text className="text-2xl font-extrabold text-[#F7BD48]">
                {displayName.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View className="flex-1">
              <Text className="text-xs font-bold uppercase tracking-[2px] text-[#F7BD48]">
                Your account
              </Text>
              <Text className="mt-1 text-xl font-extrabold text-white" numberOfLines={1}>
                {displayName}
              </Text>
              <Text className="mt-0.5 text-xs text-[#D8E4D7]" numberOfLines={1}>
                {profile.email || "Manage your foodie details"}
              </Text>
            </View>
            <Pressable
              accessibilityLabel="Log out"
              accessibilityRole="button"
              className="h-10 w-10 items-center justify-center rounded-full bg-white/10"
              onPress={() => confirmLogout()}
            >
              <LogOut color="#FFE2D8" size={18} />
            </Pressable>
          </View>
          <View className="mt-5 flex-row gap-2">
            <SummaryPill Icon={Package} value={orders.length} label="Orders" />
            <SummaryPill Icon={CalendarDays} value={reservations.length} label="Bookings" />
            <SummaryPill Icon={MapPin} value={addresses.length} label="Addresses" />
          </View>
        </View>

        {loadError ? <Notice message={loadError} tone="info" /> : null}

        <ScrollView
          className="mb-4 max-h-16"
          contentContainerStyle={{ gap: 8, paddingRight: 4 }}
          horizontal
          showsHorizontalScrollIndicator={false}
        >
          {ACCOUNT_TABS.map(({ id, label, Icon }) => {
            const active = id === activeTab;
            return (
              <Pressable
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                className={`min-h-11 flex-row items-center rounded-xl border px-3.5 ${
                  active
                    ? "border-[#183B2A] bg-[#183B2A]"
                    : "border-[#E1E5DF] bg-white"
                }`}
                key={id}
                onPress={() => {
                  setActiveTab(id);
                  setFormError("");
                  setSuccessMessage("");
                }}
              >
                <Icon color={active ? "#FFFFFF" : "#1A6A3B"} size={16} />
                <Text
                  className={`ml-2 text-xs font-bold ${
                    active ? "text-white" : "text-[#344035]"
                  }`}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View className="rounded-2xl border border-[#E1E5DF] bg-white p-4">
          <SectionHeading
            Icon={activeTabConfig.Icon}
            title={activeTabConfig.label}
            detail={activeTabConfig.detail}
          />
          {formError ? <Notice message={formError} /> : null}
          {successMessage ? <Notice message={successMessage} tone="success" /> : null}
          {isLoading ? (
            <View className="items-center py-12">
              <ActivityIndicator color="#1A6A3B" size="large" />
              <Text className="mt-3 text-sm text-[#728071]">Loading your account…</Text>
            </View>
          ) : !account ? (
            <View className="items-center py-5">
              <ShieldCheck color="#1A6A3B" size={34} />
              <Text className="mt-3 text-center text-sm leading-5 text-[#59645E]">
                Sign in to view and update your account details.
              </Text>
              <View className="mt-4 w-full">
                <ActionButton
                  label="Sign in"
                  onPress={() => router.push("/login")}
                  Icon={ArrowRight}
                />
              </View>
            </View>
          ) : (
            <>
              {activeTab === "profile" ? (
                <View>
                  <InputField
                    label="Full name *"
                    maxLength={100}
                    onChangeText={(username) => setProfile((current) => ({ ...current, username }))}
                    placeholder="Your full name"
                    value={profile.username}
                  />
                  <InputField
                    label="Phone number"
                    keyboardType="phone-pad"
                    maxLength={32}
                    onChangeText={(mobile_number) =>
                      setProfile((current) => ({ ...current, mobile_number }))
                    }
                    placeholder="Your contact number"
                    value={profile.mobile_number}
                  />
                  <InputField
                    label="Email address"
                    value={profile.email}
                  />
                  <Text className="-mt-2 mb-4 text-xs leading-5 text-[#879087]">
                    Your email is linked to your sign-in and cannot be changed here.
                  </Text>
                  <ActionButton
                    label="Save details"
                    onPress={() => void saveProfileDetails()}
                    Icon={Save}
                    busy={isSaving}
                  />
                </View>
              ) : null}

              {activeTab === "address" ? (
                <View>
                  {addresses.length ? (
                    addresses.map((address, index) => (
                      <View
                        className="mb-3 rounded-xl border border-[#E8EDE6] bg-[#FFFEFB] p-3.5"
                        key={String(address.id ?? `${address.address_line}-${index}`)}
                      >
                        <View className="flex-row items-start">
                          <View className="mr-3 h-10 w-10 items-center justify-center rounded-xl bg-[#EAF2E8]">
                            <MapPin color="#1A6A3B" size={19} />
                          </View>
                          <View className="flex-1">
                            <Text className="text-[10px] font-extrabold uppercase tracking-wide text-[#728071]">
                              {index === 0 ? "Default address" : "Saved address"}
                            </Text>
                            <Text className="mt-1 text-sm font-bold text-[#183B2A]">
                              {profile.username || displayName}
                            </Text>
                            {profile.mobile_number ? (
                              <Text className="mt-0.5 text-xs text-[#59645E]">
                                {profile.mobile_number}
                              </Text>
                            ) : null}
                            <Text className="mt-2 text-xs leading-5 text-[#59645E]">
                              {[address.address_line, address.area_locality]
                                .filter(Boolean)
                                .join(", ")}
                              {"\n"}
                              {[address.city, address.state].filter(Boolean).join(", ")}
                              {address.pincode ? ` - ${address.pincode}` : ""}
                            </Text>
                            {address.landmark ? (
                              <Text className="mt-1 text-xs font-semibold text-[#1A6A3B]">
                                Landmark: {address.landmark}
                              </Text>
                            ) : null}
                          </View>
                        </View>
                        <View className="mt-3 flex-row gap-2">
                          <Pressable
                            accessibilityRole="button"
                            className="min-h-10 flex-1 flex-row items-center justify-center rounded-lg border border-[#D9E6D9] bg-white"
                            onPress={() => startAddressEdit(address)}
                          >
                            <Pencil color="#1A6A3B" size={15} />
                            <Text className="ml-1.5 text-xs font-bold text-[#1A6A3B]">Edit</Text>
                          </Pressable>
                          <Pressable
                            accessibilityRole="button"
                            className="min-h-10 flex-1 flex-row items-center justify-center rounded-lg border border-[#F3C9C5] bg-white"
                            disabled={isSaving}
                            onPress={() => deleteAddress(address)}
                          >
                            <Trash2 color="#A33424" size={15} />
                            <Text className="ml-1.5 text-xs font-bold text-[#A33424]">Delete</Text>
                          </Pressable>
                        </View>
                      </View>
                    ))
                  ) : (
                    <EmptyState
                      Icon={MapPin}
                      title="No saved addresses"
                      detail="Add an address to make your next delivery checkout faster."
                    />
                  )}
                  <View className="mt-2 rounded-xl border border-[#E8EDE6] bg-[#F8FAF7] p-3.5">
                    <Text className="mb-3 text-sm font-extrabold text-[#183B2A]">
                      {editingAddressId ? "Edit address" : "Add a delivery address"}
                    </Text>
                    <InputField
                      label="Address / door number *"
                      onChangeText={(value) =>
                        setAddressForm((current) => ({ ...current, address_line1: value }))
                      }
                      placeholder="House or building"
                      value={addressForm.address_line1}
                    />
                    <InputField
                      label="Area / locality *"
                      onChangeText={(value) =>
                        setAddressForm((current) => ({ ...current, address_line2: value }))
                      }
                      placeholder="Street, area, locality"
                      value={addressForm.address_line2}
                    />
                    <View className="flex-row">
                      <View className="mr-2 flex-1">
                        <InputField
                          label="City *"
                          onChangeText={(value) =>
                            setAddressForm((current) => ({ ...current, city: value }))
                          }
                          placeholder="City"
                          value={addressForm.city}
                        />
                      </View>
                      <View className="ml-2 flex-1">
                        <InputField
                          label="Pincode *"
                          keyboardType="number-pad"
                          maxLength={6}
                          onChangeText={(value) =>
                            setAddressForm((current) => ({
                              ...current,
                              pincode: value.replace(/[^\d]/g, ""),
                            }))
                          }
                          placeholder="6 digits"
                          value={addressForm.pincode}
                        />
                      </View>
                    </View>
                    <InputField
                      label="State *"
                      onChangeText={(value) =>
                        setAddressForm((current) => ({ ...current, state: value }))
                      }
                      placeholder="State"
                      value={addressForm.state}
                    />
                    <InputField
                      label="Landmark (optional)"
                      onChangeText={(value) =>
                        setAddressForm((current) => ({ ...current, landmark: value }))
                      }
                      placeholder="Nearby landmark"
                      value={addressForm.landmark}
                    />
                    <ActionButton
                      label={editingAddressId ? "Save address" : "Add address"}
                      onPress={() => void saveAddress()}
                      Icon={editingAddressId ? Save : Plus}
                      busy={isSaving}
                    />
                    {editingAddressId ? (
                      <Pressable
                        accessibilityRole="button"
                        className="mt-3 min-h-10 items-center justify-center"
                        onPress={cancelAddressEdit}
                      >
                        <Text className="text-sm font-semibold text-[#728071]">Cancel editing</Text>
                      </Pressable>
                    ) : null}
                  </View>
                </View>
              ) : null}

              {activeTab === "orders" ? (
                <View>
                  <View className="mb-4 flex-row items-center justify-between rounded-xl bg-[#F4F8F2] p-3.5">
                    <View className="flex-1 pr-2">
                      <Text className="text-sm font-extrabold text-[#183B2A]">
                        {orders.length} {orders.length === 1 ? "order" : "orders"}
                      </Text>
                      <Text className="mt-1 text-xs text-[#728071]">
                        Track meals, payments, and delivery updates.
                      </Text>
                    </View>
                    <Package color="#1A6A3B" size={22} />
                  </View>
                  <ScrollView
                    className="mb-3 max-h-12"
                    contentContainerStyle={{ gap: 8 }}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                  >
                    {ORDER_FILTERS.map((filter) => {
                      const count =
                        filter === "All Orders"
                          ? orders.length
                          : orders.filter(
                              (order) => getOrderStatusGroup(order.order_status) === filter,
                            ).length;
                      const selected = filter === orderStatusFilter;
                      return (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityState={{ selected }}
                          className={`rounded-full border px-3 py-2 ${
                            selected
                              ? "border-[#1A6A3B] bg-[#1A6A3B]"
                              : "border-[#E1E5DF] bg-white"
                          }`}
                          key={filter}
                          onPress={() => setOrderStatusFilter(filter)}
                        >
                          <Text
                            className={`text-[10px] font-bold ${
                              selected ? "text-white" : "text-[#344035]"
                            }`}
                          >
                            {filter} ({count})
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                  {filteredOrders.slice(0, 4).map((order) => (
                    <View
                      className="mb-2 flex-row items-center rounded-xl border border-[#E8EDE6] bg-[#FFFEFB] p-3"
                      key={order.order_id}
                    >
                      <View className="mr-3 h-10 w-10 items-center justify-center rounded-xl bg-[#EAF2E8]">
                        <Package color="#1A6A3B" size={18} />
                      </View>
                      <View className="flex-1">
                        <Text className="text-sm font-bold text-[#183B2A]">
                          #{order.order_id}
                        </Text>
                        <Text className="mt-0.5 text-xs text-[#728071]">
                          {order.item_count} {order.item_count === 1 ? "item" : "items"} ·{" "}
                          {formatDate(order.created_at ?? order.order_date)}
                        </Text>
                      </View>
                      <Text className="rounded-full bg-[#F4F8F2] px-2.5 py-1 text-[10px] font-bold text-[#1A6A3B]">
                        {getOrderStatusGroup(order.order_status)}
                      </Text>
                    </View>
                  ))}
                  {!filteredOrders.length ? (
                    <EmptyState
                      Icon={Package}
                      title={orders.length ? "No matching orders" : "No orders yet"}
                      detail={
                        orders.length
                          ? "Choose another status filter to view your orders."
                          : "Your orders will appear here after your first purchase."
                      }
                    />
                  ) : null}
                  <View className="mt-3">
                    <ActionButton
                      label="Open order tracking"
                      onPress={() => router.push("/orders")}
                      Icon={ArrowRight}
                      secondary
                    />
                  </View>
                </View>
              ) : null}

              {activeTab === "reservations" ? (
                <View>
                  <View className="mb-4 flex-row items-center justify-between">
                    <Text className="flex-1 pr-2 text-xs leading-5 text-[#728071]">
                      Table bookings associated with your account.
                    </Text>
                    <Pressable
                      accessibilityRole="button"
                      className="flex-row items-center rounded-lg bg-[#183B2A] px-3 py-2.5"
                      onPress={() => router.push("/reservations")}
                    >
                      <Plus color="#FFFFFF" size={14} />
                      <Text className="ml-1 text-[10px] font-bold text-white">
                        Book table
                      </Text>
                    </Pressable>
                  </View>
                  {reservations.length ? (
                    reservations.map((reservation) => (
                      <View
                        className="mb-3 rounded-xl border border-[#E8EDE6] bg-[#FFFEFB] p-3.5"
                        key={reservation.reservation_id}
                      >
                        <View className="flex-row items-center justify-between">
                          <Text className="text-base font-extrabold text-[#183B2A]">
                            {text(reservation, ["table_number"]) || "Table reservation"}
                          </Text>
                          <Text className="rounded-full border border-[#F1D889] bg-[#FFF6D8] px-2.5 py-1 text-[10px] font-bold text-[#A85B00]">
                            {text(reservation, ["status"]) || "Pending"}
                          </Text>
                        </View>
                        <View className="mt-3 flex-row flex-wrap">
                          <ReservationDetail
                            label="Date"
                            value={formatDate(reservation.reservation_date)}
                          />
                          <ReservationDetail
                            label="Time"
                            value={`${formatTime(reservation.start_time)}${
                              reservation.end_time
                                ? ` – ${formatTime(reservation.end_time)}`
                                : ""
                            }`}
                          />
                          <ReservationDetail
                            label="Guests"
                            value={`${text(reservation, ["guests", "guest_count"]) || "—"}`}
                          />
                        </View>
                        {reservation.notes ? (
                          <Text className="mt-2 text-xs leading-5 text-[#59645E]">
                            Special request: {String(reservation.notes)}
                          </Text>
                        ) : null}
                        <Text className="mt-3 border-t border-[#EEE8DD] pt-2 font-mono text-[10px] text-[#879087]">
                          Booking reference: {reservation.reservation_id}
                        </Text>
                      </View>
                    ))
                  ) : (
                    <EmptyState
                      Icon={CalendarDays}
                      title="No reservations yet"
                      detail="Your table bookings will appear here after you request a reservation."
                      action={
                        <ActionButton
                          label="Reserve a table"
                          onPress={() => router.push("/reservations")}
                          Icon={ArrowRight}
                        />
                      }
                    />
                  )}
                </View>
              ) : null}

              {activeTab === "event-orders" ? (
                <View>
                  <View className="mb-4 flex-row items-center justify-between">
                    <Text className="flex-1 pr-2 text-xs leading-5 text-[#728071]">
                      Track catering requests, event details, and quotations.
                    </Text>
                    <Pressable
                      accessibilityRole="button"
                      className="flex-row items-center rounded-lg bg-[#183B2A] px-3 py-2.5"
                      onPress={() => router.push("/event-orders")}
                    >
                      <Plus color="#FFFFFF" size={14} />
                      <Text className="ml-1 text-[10px] font-bold text-white">New event</Text>
                    </Pressable>
                  </View>
                  {eventOrders.length ? (
                    eventOrders.map((eventOrder) => (
                      <EventOrderCard
                        eventOrder={eventOrder}
                        isResponding={respondingTo === eventOrder.orderKey}
                        key={eventOrder.orderKey}
                        onDetails={() => setSelectedEventOrder(eventOrder)}
                        onAccept={() => void respondToQuotation(eventOrder, "accept")}
                        onReject={() => {
                          setSelectedEventOrder(null);
                          setRejectingOrder(eventOrder);
                          setRejectReason("");
                        }}
                      />
                    ))
                  ) : (
                    <EmptyState
                      Icon={PartyPopper}
                      title="No event orders yet"
                      detail="Request a catering quotation for your next celebration or gathering."
                      action={
                        <ActionButton
                          label="Request a quotation"
                          onPress={() => router.push("/event-orders")}
                          Icon={ArrowRight}
                        />
                      }
                    />
                  )}
                </View>
              ) : null}

              {activeTab === "password" ? (
                <View>
                  <View className="mb-4 flex-row rounded-xl border border-[#D9E6D9] bg-[#F4F8F2] p-3">
                    <ShieldCheck color="#1A6A3B" size={18} />
                    <Text className="ml-2 flex-1 text-xs leading-5 text-[#59645E]">
                      Choose a strong password with at least 8 characters.
                    </Text>
                  </View>
                  <PasswordField
                    label="Current password"
                    value={password.currentPassword}
                    visible={showPasswords.current}
                    onChangeText={(currentPassword) =>
                      setPassword((current) => ({ ...current, currentPassword }))
                    }
                    onToggle={() =>
                      setShowPasswords((current) => ({
                        ...current,
                        current: !current.current,
                      }))
                    }
                  />
                  <PasswordField
                    label="New password"
                    value={password.newPassword}
                    visible={showPasswords.new}
                    onChangeText={(newPassword) =>
                      setPassword((current) => ({ ...current, newPassword }))
                    }
                    onToggle={() =>
                      setShowPasswords((current) => ({ ...current, new: !current.new }))
                    }
                  />
                  <PasswordField
                    label="Confirm new password"
                    value={password.confirmPassword}
                    visible={showPasswords.confirm}
                    onChangeText={(confirmPassword) =>
                      setPassword((current) => ({ ...current, confirmPassword }))
                    }
                    onToggle={() =>
                      setShowPasswords((current) => ({
                        ...current,
                        confirm: !current.confirm,
                      }))
                    }
                  />
                  <ActionButton
                    label="Update password"
                    onPress={() => void changePassword()}
                    Icon={KeyRound}
                    busy={isSaving}
                  />
                </View>
              ) : null}
            </>
          )}
        </View>

        {account ? (
          <Pressable
            accessibilityRole="button"
            className="mt-4 min-h-12 flex-row items-center justify-center rounded-xl border border-[#F3C9C5] bg-white"
            onPress={() => confirmLogout()}
          >
            <LogOut color="#A33424" size={17} />
            <Text className="ml-2 text-sm font-bold text-[#A33424]">Sign out</Text>
          </Pressable>
        ) : null}
      </ScrollView>

      <Modal
        animationType="slide"
        onRequestClose={() => setSelectedEventOrder(null)}
        transparent
        visible={Boolean(selectedEventOrder)}
      >
        <View className="flex-1 justify-end bg-black/45">
          <View className="max-h-[88%] rounded-t-3xl bg-[#FFFCF6]">
            <View className="flex-row items-center justify-between border-b border-[#E7E0D8] px-5 py-4">
              <View className="flex-1 pr-3">
                <Text className="text-xs font-semibold uppercase tracking-widest text-[#728071]">
                  Event order details
                </Text>
                <Text className="mt-1 text-lg font-bold text-[#183B2A]">
                  #
                  {text(selectedEventOrder ?? {}, [
                    "event_order_number",
                    "order_number",
                  ]) || selectedEventOrder?.orderKey}
                </Text>
              </View>
              <Pressable
                accessibilityLabel="Close event order details"
                accessibilityRole="button"
                className="h-10 w-10 items-center justify-center rounded-full bg-[#F0EEE7]"
                onPress={() => setSelectedEventOrder(null)}
              >
                <X color="#183B2A" size={20} />
              </Pressable>
            </View>
            <ScrollView
              contentContainerStyle={{ padding: 18, paddingBottom: 32 }}
              showsVerticalScrollIndicator={false}
            >
              {selectedEventOrder ? (
                <EventOrderDetails
                  eventOrder={selectedEventOrder}
                  isResponding={respondingTo === selectedEventOrder.orderKey}
                  onAccept={() =>
                    void respondToQuotation(selectedEventOrder, "accept")
                  }
                  onReject={() => {
                    setRejectingOrder(selectedEventOrder);
                    setSelectedEventOrder(null);
                    setRejectReason("");
                  }}
                />
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        animationType="slide"
        onRequestClose={() => setRejectingOrder(null)}
        transparent
        visible={Boolean(rejectingOrder)}
      >
        <View className="flex-1 justify-end bg-black/45">
          <View className="rounded-t-3xl bg-[#FFFCF6] p-5 pb-8">
            <View className="mb-4 flex-row items-center justify-between">
              <View className="flex-1 pr-4">
                <Text className="text-lg font-extrabold text-[#183B2A]">
                  Decline quotation?
                </Text>
                <Text className="mt-1 text-xs leading-5 text-[#728071]">
                  This will cancel event order #
                  {text(rejectingOrder ?? {}, ["event_order_number", "order_number"]) ||
                    rejectingOrder?.orderKey}
                  . Add a reason if you wish.
                </Text>
              </View>
              <Pressable
                accessibilityLabel="Close rejection form"
                accessibilityRole="button"
                className="h-9 w-9 items-center justify-center rounded-full bg-[#F0EEE7]"
                onPress={() => setRejectingOrder(null)}
              >
                <X color="#344035" size={18} />
              </Pressable>
            </View>
            <TextInput
              className="min-h-24 rounded-xl border border-[#E1E5DF] bg-white px-3.5 py-3 text-sm text-[#183B2A]"
              multiline
              onChangeText={setRejectReason}
              placeholder="Reason (optional)"
              placeholderTextColor="#879087"
              textAlignVertical="top"
              value={rejectReason}
            />
            <View className="mt-4 flex-row">
              <View className="mr-2 flex-1">
                <ActionButton
                  label="Keep quotation"
                  onPress={() => setRejectingOrder(null)}
                  secondary
                />
              </View>
              <View className="ml-2 flex-1">
                <ActionButton
                  label="Reject quotation"
                  onPress={() => {
                    if (rejectingOrder) {
                      void respondToQuotation(
                        rejectingOrder,
                        "reject",
                        rejectReason.trim(),
                      );
                    }
                  }}
                  busy={Boolean(respondingTo)}
                  destructive
                />
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function SummaryPill({
  Icon,
  value,
  label,
}: {
  Icon: LucideIcon;
  value: number;
  label: string;
}) {
  return (
    <View className="min-h-14 flex-1 flex-row items-center rounded-xl bg-white/10 px-2.5">
      <Icon color="#F7BD48" size={16} />
      <View className="ml-2">
        <Text className="text-sm font-extrabold text-white">{value}</Text>
        <Text className="text-[10px] text-[#D8E4D7]">{label}</Text>
      </View>
    </View>
  );
}

function EmptyState({
  Icon,
  title,
  detail,
  action,
}: {
  Icon: LucideIcon;
  title: string;
  detail: string;
  action?: React.ReactNode;
}) {
  return (
    <View className="items-center rounded-xl border border-dashed border-[#DCE8D5] bg-[#FAFCF9] px-4 py-8">
      <View className="h-12 w-12 items-center justify-center rounded-2xl bg-[#EFF5E9]">
        <Icon color="#396F0B" size={23} />
      </View>
      <Text className="mt-3 text-base font-extrabold text-[#183B2A]">{title}</Text>
      <Text className="mt-1 text-center text-xs leading-5 text-[#728071]">{detail}</Text>
      {action ? <View className="mt-4 w-full">{action}</View> : null}
    </View>
  );
}

function ReservationDetail({ label, value }: { label: string; value: string }) {
  return (
    <View className="mb-2 mr-4">
      <Text className="text-[10px] font-bold uppercase tracking-wide text-[#879087]">
        {label}
      </Text>
      <Text className="mt-0.5 text-xs font-bold text-[#344035]">{value}</Text>
    </View>
  );
}

function PasswordField({
  label,
  value,
  visible,
  onChangeText,
  onToggle,
}: {
  label: string;
  value: string;
  visible: boolean;
  onChangeText: (value: string) => void;
  onToggle: () => void;
}) {
  return (
    <InputField
      label={label}
      maxLength={128}
      onChangeText={onChangeText}
      placeholder={label}
      secureTextEntry={!visible}
      value={value}
      rightAction={
        <Pressable
          accessibilityLabel={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          accessibilityRole="button"
          className="ml-2 h-10 w-9 items-center justify-center"
          onPress={onToggle}
        >
          {visible ? <EyeOff color="#728071" size={18} /> : <Eye color="#728071" size={18} />}
        </Pressable>
      }
    />
  );
}

function EventOrderCard({
  eventOrder,
  isResponding,
  onDetails,
  onAccept,
  onReject,
}: {
  eventOrder: EventOrder;
  isResponding: boolean;
  onDetails: () => void;
  onAccept: () => void;
  onReject: () => void;
}) {
  const orderNumber =
    text(eventOrder, ["event_order_number", "order_number"]) || eventOrder.orderKey;
  const status = text(eventOrder, ["status"]) || "Pending";
  const customerAction = text(eventOrder, ["customer_action"]).toLowerCase();
  const isPendingQuote = status.toLowerCase() === "quotation sent";
  const isQuoted = isPendingQuote || number(eventOrder.quoted_amount) > 0;
  return (
    <View
      className={`mb-3 rounded-xl border bg-[#FFFEFB] p-3.5 ${
        isPendingQuote
          ? "border-[#A8D7F0]"
          : customerAction === "accepted"
            ? "border-[#CFE3C4]"
            : customerAction === "rejected"
              ? "border-[#F3C9C5]"
              : "border-[#E8EDE6]"
      }`}
    >
      <View className="flex-row items-start justify-between">
        <View className="flex-1 pr-2">
          <Text className="font-mono text-[10px] font-bold text-[#1A6A3B]">
            {orderNumber}
          </Text>
          <Text className="mt-1 text-sm font-extrabold text-[#183B2A]">
            {text(eventOrder, ["event_type"]) || "Event catering"}
          </Text>
        </View>
        <Text className="rounded-full border border-[#E7E0D8] bg-[#F5EFE5] px-2.5 py-1 text-[10px] font-bold text-[#59645E]">
          {status === "Quotation Sent" ? "Quotation received" : status}
        </Text>
      </View>
      <View className="mt-3 flex-row flex-wrap">
        <ReservationDetail
          label="Event date"
          value={formatDate(eventOrder.event_date)}
        />
        <ReservationDetail
          label="Serving time"
          value={formatTime(eventOrder.event_time) || "—"}
        />
        <ReservationDetail
          label="Guests"
          value={`${text(eventOrder, ["guest_count"]) || "—"} people`}
        />
        <ReservationDetail
          label={isQuoted ? "Quoted amount" : "Estimate"}
          value={`₹${formatMoney(eventOrder.quoted_amount || eventOrder.total_estimated_amount)}`}
        />
      </View>
      {eventOrder.venue_address ? (
        <Text className="mb-2 text-xs leading-5 text-[#59645E]">
          {String(eventOrder.venue_address)}
        </Text>
      ) : null}
      <Pressable
        accessibilityRole="button"
        className="min-h-10 flex-row items-center justify-center rounded-lg border border-[#D9E6D9] bg-white"
        onPress={onDetails}
      >
        <Text className="text-xs font-bold text-[#1A6A3B]">View full event details</Text>
        <ArrowRight color="#1A6A3B" size={14} style={{ marginLeft: 6 }} />
      </Pressable>
      {customerAction === "accepted" || customerAction === "rejected" ? (
        <View className="mt-1 flex-row items-center border-t border-[#EEE8DD] pt-3">
          {customerAction === "accepted" ? (
            <CheckCircle2 color="#1A6A3B" size={16} />
          ) : (
            <X color="#A33424" size={16} />
          )}
          <Text className="ml-2 flex-1 text-xs font-semibold text-[#59645E]">
            Quotation {customerAction}.
            {eventOrder.customer_action_reason
              ? ` Reason: ${String(eventOrder.customer_action_reason)}`
              : ""}
          </Text>
        </View>
      ) : isPendingQuote ? (
        <View className="mt-2 flex-row">
          <View className="mr-2 flex-1">
            <ActionButton
              label="Accept quote"
              onPress={onAccept}
              Icon={Check}
              busy={isResponding}
            />
          </View>
          <View className="ml-2 flex-1">
            <ActionButton
              label="Reject"
              onPress={onReject}
              Icon={X}
              secondary
              busy={isResponding}
            />
          </View>
        </View>
      ) : null}
    </View>
  );
}

function EventOrderDetails({
  eventOrder,
  isResponding,
  onAccept,
  onReject,
}: {
  eventOrder: EventOrder;
  isResponding: boolean;
  onAccept: () => void;
  onReject: () => void;
}) {
  const items = Array.isArray(eventOrder.items)
    ? eventOrder.items.flatMap((item) => {
        const record = asRecord(item);
        return record ? [record] : [];
      })
    : [];
  const quoteAvailable =
    text(eventOrder, ["status"]).toLowerCase() === "quotation sent";
  return (
    <View>
      <View className="rounded-2xl border border-[#E7E0D8] bg-white p-4">
        <View className="flex-row flex-wrap justify-between">
          <ReservationDetail
            label="Occasion"
            value={text(eventOrder, ["event_type"]) || "Event"}
          />
          <ReservationDetail
            label="Status"
            value={text(eventOrder, ["status"]) || "Pending"}
          />
          <ReservationDetail
            label="Event date"
            value={formatDate(eventOrder.event_date)}
          />
          <ReservationDetail
            label="Serving time"
            value={formatTime(eventOrder.event_time) || "—"}
          />
          <ReservationDetail
            label="Guest count"
            value={`${text(eventOrder, ["guest_count"]) || "—"} people`}
          />
          <ReservationDetail
            label="Dietary preference"
            value={text(eventOrder, ["dietary_preference"]) || "Mixed"}
          />
        </View>
        {eventOrder.venue_address ? (
          <View className="mt-1 border-t border-[#EEE8DD] pt-3">
            <Text className="text-[10px] font-bold uppercase tracking-wide text-[#879087]">
              Venue
            </Text>
            <Text className="mt-1 text-sm leading-5 text-[#344035]">
              {String(eventOrder.venue_address)}
            </Text>
          </View>
        ) : null}
        {eventOrder.special_requests ? (
          <View className="mt-3 border-t border-[#EEE8DD] pt-3">
            <Text className="text-[10px] font-bold uppercase tracking-wide text-[#879087]">
              Special requests
            </Text>
            <Text className="mt-1 text-sm leading-5 text-[#344035]">
              {String(eventOrder.special_requests)}
            </Text>
          </View>
        ) : null}
        {eventOrder.admin_notes ? (
          <View className="mt-3 border-t border-[#EEE8DD] pt-3">
            <Text className="text-[10px] font-bold uppercase tracking-wide text-[#879087]">
              Restaurant notes
            </Text>
            <Text className="mt-1 text-sm leading-5 text-[#344035]">
              {String(eventOrder.admin_notes)}
            </Text>
          </View>
        ) : null}
      </View>

      <View className="mt-4 rounded-2xl border border-[#E7E0D8] bg-white p-4">
        <Text className="mb-2 text-base font-extrabold text-[#183B2A]">
          Menu items ({items.length})
        </Text>
        {items.length ? (
          items.map((item, index) => {
            const quantity = number(item.quantity) || 1;
            const unitPrice = number(item.unit_price);
            const discountedPrice =
              item.discounted_unit_price === null ||
              item.discounted_unit_price === undefined
                ? unitPrice
                : number(item.discounted_unit_price);
            return (
              <View
                className="flex-row items-start justify-between border-t border-[#F0EEE7] py-3"
                key={`${text(item, ["food_id", "id", "product_name"])}-${index}`}
              >
                <View className="flex-1 pr-3">
                  <Text className="text-sm font-bold text-[#183B2A]">
                    {text(item, ["product_name", "food_name", "name"]) || "Food item"}
                  </Text>
                  <Text className="mt-1 text-xs text-[#728071]">
                    {quantity} portions · ₹{formatMoney(discountedPrice)} each
                  </Text>
                  {item.notes ? (
                    <Text className="mt-1 text-xs italic text-[#879087]">
                      {String(item.notes)}
                    </Text>
                  ) : null}
                </View>
                <Text className="text-sm font-bold text-[#344035]">
                  ₹{formatMoney(discountedPrice * quantity)}
                </Text>
              </View>
            );
          })
        ) : (
          <Text className="py-3 text-sm text-[#728071]">
            Item details are not available for this request.
          </Text>
        )}
        <View className="border-t border-[#EEE8DD] pt-3">
          {number(eventOrder.discount_amount) > 0 ? (
            <CostRow
              label="Bulk discount"
              amount={-number(eventOrder.discount_amount)}
            />
          ) : null}
          {number(eventOrder.delivery_fee) > 0 ? (
            <CostRow label="Delivery fee" amount={number(eventOrder.delivery_fee)} />
          ) : null}
          <CostRow
            label={number(eventOrder.quoted_amount) > 0 ? "Quoted total" : "Estimated total"}
            amount={
              number(eventOrder.quoted_amount) ||
              number(eventOrder.total_estimated_amount)
            }
            emphasized
          />
        </View>
      </View>

      {quoteAvailable ? (
        <View className="mt-4 rounded-2xl border border-[#D5EAF6] bg-[#F1F9FD] p-4">
          <Text className="text-sm font-extrabold text-[#183B2A]">
            Quotation received: ₹{formatMoney(eventOrder.quoted_amount)}
          </Text>
          <Text className="mt-1 text-xs leading-5 text-[#59645E]">
            Review the menu and final amount, then choose whether to confirm the event order.
          </Text>
          <View className="mt-3 flex-row">
            <View className="mr-2 flex-1">
              <ActionButton
                label="Accept & confirm"
                onPress={onAccept}
                Icon={Check}
                busy={isResponding}
              />
            </View>
            <View className="ml-2 flex-1">
              <ActionButton
                label="Reject quote"
                onPress={onReject}
                Icon={X}
                secondary
                busy={isResponding}
              />
            </View>
          </View>
        </View>
      ) : null}
    </View>
  );
}

function CostRow({
  label,
  amount,
  emphasized = false,
}: {
  label: string;
  amount: number;
  emphasized?: boolean;
}) {
  return (
    <View className="mt-2 flex-row justify-between">
      <Text
        className={`text-sm ${
          emphasized ? "font-extrabold text-[#183B2A]" : "text-[#59645E]"
        }`}
      >
        {label}
      </Text>
      <Text
        className={`text-sm ${
          emphasized ? "font-extrabold text-[#1A6A3B]" : "text-[#59645E]"
        }`}
      >
        ₹{formatMoney(amount)}
      </Text>
    </View>
  );
}
