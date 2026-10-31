import { useEffect, useState } from "react";
import { router, usePathname } from "expo-router";
import { ActivityIndicator, Image, Modal, Pressable, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { LogOut, UserRound } from "lucide-react-native";
import { useCustomAlert } from "../../contexts/CustomAlertContext";
import { useAuth } from "../../contexts/AuthContext";
import { getStoredUser } from "../../lib/api";
import { confirmLogout } from "../../lib/logout";

type AccountDetails = {
  name: string;
  email: string;
  initial: string;
};

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

  return (
    <SafeAreaView
      className="z-20 border-b border-[#E7E0D8] bg-[#FFFCF6] px-5 pb-3 pt-2"
      edges={["top"]}
    >
      <View className="flex-row items-center justify-between">
        <View className="min-w-0 flex-1 flex-row items-center">
          <Image
            accessible
            accessibilityLabel="Buy Food logo"
            className="mr-3 h-10 w-10"
            resizeMode="contain"
            source={require("../../../assets/images/logo.png")}
          />
          <View className="min-w-0 flex-1">
            <Text
              className="text-[10px] font-bold uppercase tracking-[1.5px] text-[#39804F]"
              numberOfLines={1}
            >
              Delivery Partner
            </Text>
            <Text className="text-xl font-extrabold leading-6 text-[#183B2A]" numberOfLines={1}>
              {title}
            </Text>
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open delivery partner profile menu"
          accessibilityState={{ expanded: isMenuVisible }}
          className="ml-3 h-11 w-11 items-center justify-center rounded-full border border-[#D9E6D9] bg-[#EAF2E8] active:bg-[#DCEBDD]"
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
