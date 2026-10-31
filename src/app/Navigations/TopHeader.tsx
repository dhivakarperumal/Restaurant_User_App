import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import {
  ChevronDown,
  ChevronRight,
  Heart,
  LogOut,
  ShoppingBag,
  UserRoundPen,
} from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  ImageBackground,
  Modal,
  Pressable,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCustomAlert } from "../../contexts/CustomAlertContext";
import { getStoredUser } from "../../lib/api";
import { confirmLogout } from "../../lib/logout";

type TopHeaderProps = {
  title: string;
};

type AccountDetails = {
  name: string;
  email: string;
  initial: string;
};

function getTextValue(user: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = user[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
}

export default function TopHeader({ title }: TopHeaderProps) {
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const { showAlert } = useCustomAlert();
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [account, setAccount] = useState<AccountDetails>({
    name: "",
    email: "",
    initial: "",
  });

  useEffect(() => {
    let isMounted = true;

    const loadAccountDetails = async () => {
      try {
        const storedUser = await getStoredUser();
        if (!isMounted || !storedUser || typeof storedUser !== "object") {
          return;
        }

        const profile =
          "user" in storedUser &&
          storedUser.user &&
          typeof storedUser.user === "object"
            ? (storedUser.user as Record<string, unknown>)
            : (storedUser as Record<string, unknown>);
        const firstName = getTextValue(profile, ["first_name", "firstName"]);
        const lastName = getTextValue(profile, ["last_name", "lastName"]);
        const email = getTextValue(profile, ["email", "email_address"]);
        const name =
          getTextValue(profile, ["name", "full_name", "fullName", "username"]) ||
          [firstName, lastName].filter(Boolean).join(" ");
        const initial = (name || email).charAt(0).toUpperCase();

        setAccount({ name, email, initial });
      } catch (error) {
        console.error("Failed to load the stored account details:", error);
      }
    };

    void loadAccountDetails();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <>
      <StatusBar style="dark" />
      <ImageBackground
        source={require("../../../assets/images/userheader.png")}
        resizeMode="cover"
        style={{ paddingTop: insets.top }}
        className="border-b border-[#B88A2E] px-5 py-1"
      >
        <View
          accessibilityLabel={`${title} page header`}
          accessibilityRole="header"
          className="min-h-[56px] flex-row items-center justify-between px-1"
        >
          <View className="mr-2 flex-1 flex-row items-center">
            <Image
              accessible
              accessibilityLabel="Buy Food restaurant logo"
              className="mr-2 h-14 w-14 rounded-full border border-[#E9BE45] bg-white"
              resizeMode="contain"
              source={require("../../../assets/images/logo.png")}
            />
            <View className="flex-1">
              <Text
                className="text-base font-extrabold leading-5 text-[#183B2A]"
                numberOfLines={1}
              >
                BuyFood
              </Text>
              <Text className="text-[9px] leading-3 text-[#81786B]">
                Fresh Food, Happy You
              </Text>
            </View>
          </View>

          <View className="flex-row items-center">
            <Pressable
              accessibilityLabel="Open your favorites"
              accessibilityRole="button"
              className="mr-1.5 h-10 w-10 items-center justify-center rounded-full border border-[#E9DDC7] bg-white active:bg-[#FFF1F2]"
              onPress={() => router.push("/UsersTab/favorites")}
            >
              <Heart color="#D83C55" size={20} />
              <View className="absolute right-1 top-1 h-2 w-2 rounded-full border border-white bg-[#D83C55]" />
            </Pressable>
            <Pressable
              accessibilityLabel="Open your orders"
              accessibilityRole="button"
              className="mr-1.5 h-10 w-10 items-center justify-center rounded-full border border-[#E9DDC7] bg-white active:bg-[#EAF2E8]"
              onPress={() => router.push("/UsersTab/orders")}
            >
              <ShoppingBag color="#17663D" size={20} />
              <View className="absolute right-1 top-1 h-2 w-2 rounded-full border border-white bg-[#E9BE45]" />
            </Pressable>
            <Pressable
              accessibilityLabel="Open profile menu"
              accessibilityRole="button"
              accessibilityState={{ expanded: isMenuVisible }}
              className="h-11 w-11 items-center justify-center rounded-full border border-[#E9BE45] bg-[#EAF2E8] active:bg-[#DCEBDD]"
              disabled={isLoggingOut}
              onPress={() => setIsMenuVisible(true)}
            >
              {isLoggingOut ? (
                <ActivityIndicator color="#17663D" />
              ) : (
                <View className="flex-row items-center">
                  <Text className="text-sm font-extrabold text-[#17663D]">
                    {account.initial || "U"}
                  </Text>
                  <ChevronDown color="#17663D" size={14} />
                </View>
              )}
            </Pressable>
          </View>
        </View>
      </ImageBackground>

      <Modal
        animationType="fade"
        onRequestClose={() => setIsMenuVisible(false)}
        transparent
        visible={isMenuVisible}
      >
        <View className="flex-1">
          <Pressable
            accessibilityLabel="Close profile menu"
            accessibilityRole="button"
            className="absolute inset-0 bg-black/35"
            onPress={() => setIsMenuVisible(false)}
          />
          <View
            accessibilityViewIsModal
            className="absolute right-3 overflow-hidden rounded-3xl border border-[#E9DDC7] bg-[#FFFCF6] shadow-2xl"
            style={{
              top: insets.top + 68,
              right: windowWidth * 0.1,
              width: Math.min(288, windowWidth * 0.64),
              maxHeight: "82%",
            }}
          >
            <ImageBackground
              source={require("../../../assets/images/userheader.png")}
              resizeMode="cover"
              className="overflow-hidden"
            >
              <View
                style={{ backgroundColor: "rgba(255, 250, 242, 0.76)" }}
                className="flex-row items-center px-4 py-3"
              >
                <View className="mr-3 h-11 w-11 items-center justify-center rounded-full border border-[#D9E6D9] bg-[#EAF2E8]">
                  <Text className="text-base font-extrabold text-[#17663D]">
                    {account.initial || "U"}
                  </Text>
                </View>
                <View className="flex-1">
                  <Text
                    className="text-sm font-extrabold text-[#183B2A]"
                    numberOfLines={1}
                  >
                    {account.name || "Your account"}
                  </Text>
                  <Text
                    className="mt-0.5 text-[10px] text-[#81786B]"
                    numberOfLines={1}
                  >
                    {account.email || "Account details unavailable"}
                  </Text>
                </View>
              </View>
            </ImageBackground>

            <Pressable
              accessibilityRole="button"
              className="mx-2 mt-1 min-h-[46px] flex-row items-center rounded-xl px-2 active:bg-[#EAF2E8]"
              onPress={() => {
                setIsMenuVisible(false);
                router.push("/UsersTab/profile");
              }}
            >
              <View className="mr-2 h-8 w-8 items-center justify-center rounded-full bg-[#E3F0E7]">
                <UserRoundPen color="#17663D" size={17} />
              </View>
              <View className="flex-1">
                <Text className="text-xs font-bold text-[#24372D]">My Account</Text>
                <Text className="mt-0.5 text-[9px] text-[#81786B]">
                  View and edit your profile
                </Text>
              </View>
              <ChevronRight color="#81786B" size={16} />
            </Pressable>
            <View className="mx-3 border-t border-[#EEE8DD]" />
            <Pressable
              accessibilityRole="button"
              className="mx-2 min-h-[46px] flex-row items-center rounded-xl px-2 active:bg-[#FFF3F4]"
              onPress={() => {
                setIsMenuVisible(false);
                router.push("/UsersTab/favorites");
              }}
            >
              <View className="mr-2 h-8 w-8 items-center justify-center rounded-full bg-[#FDE7E8]">
                <Heart color="#D83C55" size={17} />
              </View>
              <View className="flex-1">
                <Text className="text-xs font-bold text-[#24372D]">My Favorites</Text>
                <Text className="mt-0.5 text-[9px] text-[#81786B]">
                  View saved items
                </Text>
              </View>
              <ChevronRight color="#81786B" size={16} />
            </Pressable>
            <View className="mx-3 border-t border-[#EEE8DD]" />
            <Pressable
              accessibilityRole="button"
              className="mx-2 min-h-[46px] flex-row items-center rounded-xl px-2 active:bg-[#EAF2E8]"
              onPress={() => {
                setIsMenuVisible(false);
                router.push("/UsersTab/orders");
              }}
            >
              <View className="mr-2 h-8 w-8 items-center justify-center rounded-full bg-[#FFF0C8]">
                <ShoppingBag color="#17663D" size={17} />
              </View>
              <View className="flex-1">
                <Text className="text-xs font-bold text-[#24372D]">My Orders</Text>
                <Text className="mt-0.5 text-[9px] text-[#81786B]">
                  Check your order history
                </Text>
              </View>
              <ChevronRight color="#81786B" size={16} />
            </Pressable>
            <View className="mx-3 border-t border-[#EEE8DD]" />
            <Pressable
              accessibilityRole="button"
              className="mx-2 mb-2 mt-1 min-h-[48px] flex-row items-center rounded-xl bg-[#FFF0EC] px-2 active:bg-[#FFE2D9]"
              disabled={isLoggingOut}
              onPress={() => confirmLogout(showAlert, setIsLoggingOut)}
            >
              <View className="mr-2 h-8 w-8 items-center justify-center rounded-full bg-[#FADAD3]">
                <LogOut color="#C2412D" size={17} />
              </View>
              <View className="flex-1">
                <Text className="text-xs font-bold text-[#B83E2E]">Log out</Text>
                <Text className="mt-0.5 text-[9px] text-[#98756E]">
                  Sign out from your account
                </Text>
              </View>
              <ChevronRight color="#B83E2E" size={16} />
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}
