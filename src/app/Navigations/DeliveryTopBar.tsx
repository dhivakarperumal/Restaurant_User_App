import { useEffect, useRef, useState } from "react";
import { router, usePathname } from "expo-router";
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Bell, LogOut, UserRound, X } from "lucide-react-native";
import { useCustomAlert } from "../../contexts/CustomAlertContext";
import { useAuth } from "../../contexts/AuthContext";
import api, { getStoredUser } from "../../lib/api";
import { confirmLogout } from "../../lib/logout";

type AccountDetails = {
  name: string;
  email: string;
  initial: string;
};

type OrderNotice = {
  id: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

const NEW_ORDER_STATUSES = new Set([
  "NEW",
  "NEW_ORDER",
  "PENDING",
  "ORDER_PLACED",
  "ASSIGNED",
]);

const deliveryTitles: Record<string, string> = {
  "/delivery": "Dashboard",
  "/delivery/attendance": "Attendance",
  "/delivery/orders": "Orders",
  "/delivery/earnings": "Earning",
  "/delivery/profile": "Profile",
};

function textValue(user: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = user[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function readProfile(value: unknown): AccountDetails {
  if (typeof value !== "object" || value === null) {
    return { name: "", email: "", initial: "" };
  }

  const root = value as Record<string, unknown>;
  const profile =
    typeof root.user === "object" && root.user !== null
      ? (root.user as Record<string, unknown>)
      : root;
  const firstName = textValue(profile, ["first_name", "firstName"]);
  const lastName = textValue(profile, ["last_name", "lastName"]);
  const email = textValue(profile, ["email", "email_address"]);
  const name =
    textValue(profile, ["name", "full_name", "fullName", "username"]) ||
    [firstName, lastName].filter(Boolean).join(" ");

  return { name, email, initial: (name || email).charAt(0).toUpperCase() };
}

export default function DeliveryTopBar() {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { showAlert } = useCustomAlert();
  const { logout } = useAuth();
  const [account, setAccount] = useState<AccountDetails>({
    name: "",
    email: "",
    initial: "",
  });
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [unreadOrderCount, setUnreadOrderCount] = useState(0);
  const [newOrderNotice, setNewOrderNotice] = useState<OrderNotice | null>(null);
  const knownOrderIds = useRef<Set<string> | null>(null);
  const isCheckingOrders = useRef(false);
  const title = deliveryTitles[pathname] ?? "Delivery Partner";

  useEffect(() => {
    let active = true;
    getStoredUser()
      .then((user) => {
        if (active) setAccount(readProfile(user));
      })
      .catch((error: unknown) => {
        console.error("Failed to load delivery partner account details:", error);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    const checkForNewOrders = async () => {
      if (isCheckingOrders.current) return;
      isCheckingOrders.current = true;

      try {
        const response = await api.get("/delivery-partner/orders");
        const root = asRecord(response.data);
        const nested = asRecord(root?.data);
        const ordersValue = Array.isArray(response.data)
          ? response.data
          : root?.orders ?? nested?.orders ?? root?.data;
        if (!Array.isArray(ordersValue)) {
          throw new Error("The assigned orders response was invalid.");
        }

        const eligibleOrders = ordersValue.flatMap((value) => {
          const order = asRecord(value);
          if (!order) return [];
          const id = String(order.order_id ?? order.id ?? order.order_number ?? "").trim();
          const status = String(order.order_status ?? order.status ?? "")
            .trim()
            .toUpperCase()
            .replace(/[\s-]+/g, "_");
          return id && NEW_ORDER_STATUSES.has(status) ? [{ id }] : [];
        });
        const currentIds = new Set(eligibleOrders.map((order) => order.id));

        if (!active) return;
        if (knownOrderIds.current === null) {
          knownOrderIds.current = currentIds;
          return;
        }

        const newOrders = eligibleOrders.filter(
          (order) => !knownOrderIds.current?.has(order.id),
        );
        for (const id of currentIds) knownOrderIds.current.add(id);
        if (newOrders.length) {
          setUnreadOrderCount((count) => count + newOrders.length);
          setNewOrderNotice(newOrders[newOrders.length - 1]);
        }
      } catch (error: unknown) {
        console.error("Failed to check for new delivery orders:", error);
      } finally {
        isCheckingOrders.current = false;
      }
    };

    void checkForNewOrders();
    const interval = setInterval(() => void checkForNewOrders(), 20000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  const openOrders = () => {
    setNewOrderNotice(null);
    setUnreadOrderCount(0);
    router.push("/DeliveryTab/orders");
  };

  return (
    <SafeAreaView
      className="z-20 overflow-hidden border-b border-white/15 bg-[#06452F] px-5 pb-3 pt-2"
      edges={["top"]}
    >
      <Image
        accessible={false}
        resizeMode="cover"
        source={require("../../../assets/images/deliveryheader.png")}
        style={[StyleSheet.absoluteFill, { top: -insets.top }]}
      />
      <View className="flex-row items-center justify-between">
        <View className="min-w-0 flex-1 flex-row items-center">
          <Image
            accessible
            accessibilityLabel="Buy Food logo"
            className="mr-3 h-10 w-10 rounded-full"
            resizeMode="contain"
            source={require("../../../assets/images/logo.png")}
            style={{ borderRadius: 20 }}
          />
          <View className="min-w-0 flex-1">
            <Text
              className="text-[10px] font-bold uppercase tracking-[1.5px] text-emerald-100"
              numberOfLines={1}
            >
              Delivery Partner
            </Text>
            <Text className="text-xl font-extrabold leading-6 text-white" numberOfLines={1}>
              {title}
            </Text>
          </View>
        </View>

        <View className="ml-3 flex-row items-center">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              unreadOrderCount
                ? `${unreadOrderCount} new delivery orders. Open orders`
                : "Open delivery orders"
            }
            className="mr-2 h-11 w-11 items-center justify-center rounded-full border border-white/40 bg-white/90 active:bg-white"
            onPress={openOrders}
          >
            <Bell color="#08734D" size={20} strokeWidth={2.2} />
            {unreadOrderCount > 0 ? (
              <View className="absolute -right-1 -top-1 min-h-5 min-w-5 items-center justify-center rounded-full border-2 border-[#06452F] bg-[#E5484D] px-1">
                <Text className="text-[9px] font-black text-white">
                  {unreadOrderCount > 9 ? "9+" : unreadOrderCount}
                </Text>
              </View>
            ) : null}
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open delivery partner profile menu"
            accessibilityState={{ expanded: isMenuVisible }}
            className="h-11 w-11 items-center justify-center rounded-full border border-[#D9E6D9] bg-[#EAF2E8] active:bg-[#DCEBDD]"
            disabled={isLoggingOut}
            onPress={() => setIsMenuVisible(true)}
          >
            {isLoggingOut ? (
              <ActivityIndicator color="#1A6A3B" />
            ) : (
              <Text className="text-base font-extrabold text-[#1A6A3B]">
                {account.initial || <UserRound color="#1A6A3B" size={20} />}
              </Text>
            )}
          </Pressable>
        </View>
      </View>

      <Modal
        animationType="fade"
        onRequestClose={() => setNewOrderNotice(null)}
        transparent
        visible={newOrderNotice !== null}
      >
        <View className="flex-1 items-center justify-center bg-black/50 px-6">
          <Pressable
            accessibilityLabel="Dismiss new order notification"
            className="absolute inset-0"
            onPress={() => setNewOrderNotice(null)}
          />
          <View
            accessibilityViewIsModal
            className="w-full max-w-[380px] rounded-3xl bg-white p-6"
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Dismiss notification"
              className="absolute right-3 top-3 z-10 h-10 w-10 items-center justify-center rounded-full bg-slate-100"
              onPress={() => setNewOrderNotice(null)}
            >
              <X color="#64748B" size={18} />
            </Pressable>
            <View className="h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100">
              <Bell color="#08734D" size={26} />
            </View>
            <Text className="mt-4 text-xs font-extrabold uppercase tracking-[2px] text-emerald-700">
              New delivery order
            </Text>
            <Text className="mt-2 text-xl font-black text-slate-900">
              Order #{newOrderNotice?.id}
            </Text>
            <Text className="mt-2 text-sm leading-5 text-slate-600">
              A new order is waiting for you. Open Orders to review the details.
            </Text>
            <Pressable
              accessibilityRole="button"
              className="mt-5 min-h-12 flex-row items-center justify-center rounded-xl bg-[#08734D] px-4 active:opacity-80"
              onPress={openOrders}
            >
              <Text className="font-extrabold text-white">View order</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        animationType="fade"
        onRequestClose={() => setIsMenuVisible(false)}
        transparent
        visible={isMenuVisible}
      >
        <View className="flex-1">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close delivery profile menu"
            className="absolute inset-0 bg-black/20"
            onPress={() => setIsMenuVisible(false)}
          />
          <View
            accessibilityViewIsModal
            className="absolute right-4 w-64 overflow-hidden rounded-2xl border border-[#E7E0D8] bg-[#FFFCF6] shadow-xl"
            style={{ top: insets.top + 60 }}
          >
            <View className="flex-row items-center border-b border-[#EEE8DD] bg-[#F5EFE5] px-4 py-3.5">
              <View className="mr-3 h-10 w-10 items-center justify-center rounded-full bg-white">
                {account.initial ? (
                  <Text className="text-base font-extrabold text-[#1A6A3B]">
                    {account.initial}
                  </Text>
                ) : (
                  <UserRound color="#1A6A3B" size={20} />
                )}
              </View>
              <View className="flex-1">
                <Text className="text-sm font-extrabold text-[#183B2A]">
                  {account.name || "Delivery partner"}
                </Text>
                <Text className="mt-0.5 text-xs text-[#81786B]" numberOfLines={1}>
                  {account.email || "Account details unavailable"}
                </Text>
              </View>
            </View>
            <Pressable
              accessibilityRole="button"
              className="min-h-12 flex-row items-center px-4 active:bg-[#F5EFE5]"
              onPress={() => {
                setIsMenuVisible(false);
                router.push("/DeliveryTab/profile");
              }}
            >
              <UserRound color="#1A6A3B" size={18} />
              <Text className="ml-3 text-sm font-semibold text-[#24372D]">
                My profile
              </Text>
            </Pressable>
            <View className="mx-4 border-t border-[#EEE8DD]" />
            <Pressable
              accessibilityRole="button"
              className="min-h-12 flex-row items-center px-4 active:bg-[#FFF1E8]"
              disabled={isLoggingOut}
              onPress={() => {
                setIsMenuVisible(false);
                confirmLogout(showAlert, logout, setIsLoggingOut);
              }}
            >
              <LogOut color="#C2412D" size={18} />
              <Text className="ml-3 text-sm font-semibold text-[#B83E2E]">Log out</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
