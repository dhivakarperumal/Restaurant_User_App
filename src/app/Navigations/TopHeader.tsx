import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import {
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
      <StatusBar style="light" />
      <ImageBackground
        source={require("../../../assets/images/userheader.png")}
        resizeMode="cover"
        style={{ paddingTop: insets.top }}
        imageStyle={{ width: "100%", height: "100%" }}
      >
        <View
          accessibilityLabel={`${title} page header`}
          accessibilityRole="header"
          className="flex-row items-center justify-between px-4 pb-2 pt-1"
        >
          <View className="mr-2 flex-1 flex-row items-center">
            <Image
              accessible
              accessibilityLabel="Buy Food restaurant logo"
              className="mr-2 h-9 w-9 rounded-full border border-[#E9BE45] bg-white"
              resizeMode="contain"
              source={require("../../../assets/images/logo.png")}
            />
            <View className="flex-1">
              <Text
                className="text-base font-extrabold leading-5 text-[#FFF8E7]"
                numberOfLines={1}
              >
                BuyFood
              </Text>
              <Text className="text-[9px] leading-3 text-[#E8E3C9]">
                Fresh Food, Happy You
              </Text>
            </View>
          </View>

          <View className="flex-row items-center">
            <Pressable
              accessibilityLabel="Open your favorites"
              accessibilityRole="button"
              className="mr-1.5 h-9 w-9 items-center justify-center rounded-full border border-white/40 bg-black/15 active:bg-black/30"
              onPress={() => router.push("/UsersTab/favorites")}
            >
              <Heart color="#FFF8E7" size={18} />
            </Pressable>
            <Pressable
              accessibilityLabel="Open your orders"
              accessibilityRole="button"
              className="mr-1.5 h-9 w-9 items-center justify-center rounded-full border border-white/40 bg-black/15 active:bg-black/30"
              onPress={() => router.push("/UsersTab/orders")}
            >
              <ShoppingBag color="#FFF8E7" size={18} />
            </Pressable>
            <Pressable
              accessibilityLabel="Open profile menu"
              accessibilityRole="button"
              accessibilityState={{ expanded: isMenuVisible }}
              className="h-10 w-10 items-center justify-center rounded-full border border-[#E9BE45] bg-[#075132] active:bg-[#0D6841]"
              disabled={isLoggingOut}
              onPress={() => setIsMenuVisible(true)}
            >
              {isLoggingOut ? (
                <ActivityIndicator color="#FFF8E7" />
              ) : (
                <Text className="text-sm font-extrabold text-[#FFF8E7]">
                  {account.initial || "U"}
                </Text>
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
            className="absolute right-3 w-72 overflow-hidden rounded-3xl border border-[#E9BE45] bg-[#FFFCF6] shadow-2xl"
            style={{ top: insets.top + 54 }}
          >
            <ImageBackground
              source={require("../../../assets/images/userheader.png")}
              resizeMode="cover"
              imageStyle={{ borderTopLeftRadius: 22, borderTopRightRadius: 22 }}
              className="flex-row items-center px-4 py-4"
            >
              <View className="mr-3 h-11 w-11 items-center justify-center rounded-full border border-[#E9BE45] bg-[#06452B]">
                <Text className="text-base font-extrabold text-[#FFF8E7]">
                  {account.initial || "U"}
                </Text>
              </View>
              <View className="flex-1">
                <Text
                  className="text-sm font-extrabold text-[#FFF8E7]"
                  numberOfLines={1}
                >
                  {account.name || "Your account"}
                </Text>
                <Text
                  className="mt-0.5 text-[10px] text-[#E8E3C9]"
                  numberOfLines={1}
                >
                  {account.email || "Account details unavailable"}
                </Text>
              </View>
            </ImageBackground>

            <Pressable
              accessibilityRole="button"
              className="mx-2 mt-2 min-h-11 flex-row items-center rounded-xl px-3 active:bg-[#EAF2E8]"
              onPress={() => {
                setIsMenuVisible(false);
                router.push("/UsersTab/profile");
              }}
            >
              <UserRoundPen color="#1A6A3B" size={18} />
              <Text className="ml-3 flex-1 text-xs font-semibold text-[#24372D]">
                My Account
              </Text>
              <ChevronRight color="#66806F" size={16} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              className="mx-2 min-h-11 flex-row items-center rounded-xl px-3 active:bg-[#FFF3F4]"
              onPress={() => {
                setIsMenuVisible(false);
                router.push("/UsersTab/favorites");
              }}
            >
              <Heart color="#E11D48" size={18} />
              <Text className="ml-3 flex-1 text-xs font-semibold text-[#24372D]">
                My Favorites
              </Text>
              <ChevronRight color="#66806F" size={16} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              className="mx-2 min-h-11 flex-row items-center rounded-xl px-3 active:bg-[#EAF2E8]"
              onPress={() => {
                setIsMenuVisible(false);
                router.push("/UsersTab/orders");
              }}
            >
              <ShoppingBag color="#1A6A3B" size={18} />
              <Text className="ml-3 flex-1 text-xs font-semibold text-[#24372D]">
                My Orders
              </Text>
              <ChevronRight color="#66806F" size={16} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              className="mx-2 mb-2 min-h-11 flex-row items-center rounded-xl bg-[#FFF0EC] px-3 active:bg-[#FFE2D9]"
              disabled={isLoggingOut}
              onPress={() => confirmLogout(showAlert, setIsLoggingOut)}
            >
              <LogOut color="#C2412D" size={18} />
              <Text className="ml-3 flex-1 text-xs font-semibold text-[#B83E2E]">
                Log out
              </Text>
              <ChevronRight color="#B83E2E" size={16} />
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}
