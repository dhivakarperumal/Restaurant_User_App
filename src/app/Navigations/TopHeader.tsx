import colors from "../../theme/colors.json";
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
import { BlurTargetView, BlurView } from "expo-blur";
import type { ComponentRef } from "react";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  ImageBackground,
  Modal,
  Pressable,
  StyleSheet,
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
  const blurTarget = useRef<ComponentRef<typeof View> | null>(null);
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
      <View
        style={{ paddingTop: insets.top }}
        className="relative overflow-hidden border-b border-brand-gold-border px-5 py-1"
      >
        <BlurTargetView ref={blurTarget} style={StyleSheet.absoluteFill}>
          <ImageBackground
            source={require("../../../assets/images/userheader.png")}
            resizeMode="cover"
            style={StyleSheet.absoluteFill}
          />
        </BlurTargetView>
        <BlurView
          blurTarget={blurTarget}
          blurMethod="dimezisBlurViewSdk31Plus"
          intensity={10}
          tint="light"
          style={StyleSheet.absoluteFill}
        />
        <View
          accessibilityLabel={`${title} page header`}
          accessibilityRole="header"
          className="min-h-[56px] flex-row items-center justify-between px-1"
        >
          <View className="mr-2 flex-1 flex-row items-center">
            <Image
              accessible
              accessibilityLabel="Buy Food restaurant logo"
              className="mr-2 h-14 w-14 rounded-full border border-brand-gold-bright bg-white"
              resizeMode="contain"
              source={require("../../../assets/images/logo.png")}
            />
            <View className="flex-1">
              <Text
                className="text-base font-extrabold leading-5 text-brand-green-forest"
                numberOfLines={1}
              >
                BuyFood
              </Text>
              <Text className="text-[9px] leading-3 text-brand-neutral-text-warm">
                Fresh Food, Happy You
              </Text>
            </View>
          </View>

          <View className="flex-row items-center">
            <Pressable
              accessibilityLabel="Open your favorites"
              accessibilityRole="button"
              className="mr-1.5 h-10 w-10 items-center justify-center rounded-full border border-brand-neutral-border-cream bg-white active:bg-brand-rose-soft"
              onPress={() => router.push("/UsersTab/favorites")}
            >
              <Heart color={colors["heart"]} size={20} />
              <View className="absolute right-1 top-1 h-2 w-2 rounded-full border border-white bg-brand-heart" />
            </Pressable>
            <Pressable
              accessibilityLabel="Open your orders"
              accessibilityRole="button"
              className="mr-1.5 h-10 w-10 items-center justify-center rounded-full border border-brand-neutral-border-cream bg-white active:bg-brand-green-muted-surface"
              onPress={() => router.push("/UsersTab/orders")}
            >
              <ShoppingBag color={colors["green-secondary"]} size={20} />
              <View className="absolute right-1 top-1 h-2 w-2 rounded-full border border-white bg-brand-gold-bright" />
            </Pressable>
            <Pressable
              accessibilityLabel="Open profile menu"
              accessibilityRole="button"
              accessibilityState={{ expanded: isMenuVisible }}
              className="h-11 w-11 items-center justify-center rounded-full border border-brand-gold-bright bg-brand-green-muted-surface active:bg-brand-green-soft"
              disabled={isLoggingOut}
              onPress={() => setIsMenuVisible(true)}
            >
              {isLoggingOut ? (
                <ActivityIndicator color={colors["green-secondary"]} />
              ) : (
                <View className="flex-row items-center">
                  <Text className="text-sm font-extrabold text-brand-green-secondary">
                    {account.initial || "U"}
                  </Text>
                  <ChevronDown color={colors["green-secondary"]} size={14} />
                </View>
              )}
            </Pressable>
          </View>
        </View>
      </View>

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
            className="absolute right-3 overflow-hidden rounded-3xl border border-brand-neutral-border-cream bg-brand-surface-modal shadow-2xl"
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
                <View className="mr-3 h-11 w-11 items-center justify-center rounded-full border border-brand-green-border bg-brand-green-muted-surface">
                  <Text className="text-base font-extrabold text-brand-green-secondary">
                    {account.initial || "U"}
                  </Text>
                </View>
                <View className="flex-1">
                  <Text
                    className="text-sm font-extrabold text-brand-green-forest"
                    numberOfLines={1}
                  >
                    {account.name || "Your account"}
                  </Text>
                  <Text
                    className="mt-0.5 text-[10px] text-brand-neutral-text-warm"
                    numberOfLines={1}
                  >
                    {account.email || "Account details unavailable"}
                  </Text>
                </View>
              </View>
            </ImageBackground>

            <Pressable
              accessibilityRole="button"
              className="mx-2 mt-1 min-h-[46px] flex-row items-center rounded-xl px-2 active:bg-brand-green-muted-surface"
              onPress={() => {
                setIsMenuVisible(false);
                router.push("/UsersTab/profile");
              }}
            >
              <View className="mr-2 h-8 w-8 items-center justify-center rounded-full bg-brand-green-muted-surface">
                <UserRoundPen color={colors["green-secondary"]} size={17} />
              </View>
              <View className="flex-1">
                <Text className="text-xs font-bold text-brand-neutral-text-forest">My Account</Text>
                <Text className="mt-0.5 text-[9px] text-brand-neutral-text-warm">
                  View and edit your profile
                </Text>
              </View>
              <ChevronRight color={colors["neutral-text-warm"]} size={16} />
            </Pressable>
            <View className="mx-3 border-t border-brand-neutral-border" />
            <Pressable
              accessibilityRole="button"
              className="mx-2 min-h-[46px] flex-row items-center rounded-xl px-2 active:bg-brand-rose-muted"
              onPress={() => {
                setIsMenuVisible(false);
                router.push("/UsersTab/favorites");
              }}
            >
              <View className="mr-2 h-8 w-8 items-center justify-center rounded-full bg-brand-danger-surface-alt">
                <Heart color={colors["heart"]} size={17} />
              </View>
              <View className="flex-1">
                <Text className="text-xs font-bold text-brand-neutral-text-forest">My Favorites</Text>
                <Text className="mt-0.5 text-[9px] text-brand-neutral-text-warm">
                  View saved items
                </Text>
              </View>
              <ChevronRight color={colors["neutral-text-warm"]} size={16} />
            </Pressable>
            <View className="mx-3 border-t border-brand-neutral-border" />
            <Pressable
              accessibilityRole="button"
              className="mx-2 min-h-[46px] flex-row items-center rounded-xl px-2 active:bg-brand-green-muted-surface"
              onPress={() => {
                setIsMenuVisible(false);
                router.push("/UsersTab/orders");
              }}
            >
              <View className="mr-2 h-8 w-8 items-center justify-center rounded-full bg-brand-gold-soft">
                <ShoppingBag color={colors["green-secondary"]} size={17} />
              </View>
              <View className="flex-1">
                <Text className="text-xs font-bold text-brand-neutral-text-forest">My Orders</Text>
                <Text className="mt-0.5 text-[9px] text-brand-neutral-text-warm">
                  Check your order history
                </Text>
              </View>
              <ChevronRight color={colors["neutral-text-warm"]} size={16} />
            </Pressable>
            <View className="mx-3 border-t border-brand-neutral-border" />
            <Pressable
              accessibilityRole="button"
              className="mx-2 mb-2 mt-1 min-h-[48px] flex-row items-center rounded-xl bg-brand-warning-surface px-2 active:bg-brand-danger-soft"
              disabled={isLoggingOut}
              onPress={() => confirmLogout(showAlert, setIsLoggingOut)}
            >
              <View className="mr-2 h-8 w-8 items-center justify-center rounded-full bg-brand-danger-pale">
                <LogOut color={colors["danger-dark"]} size={17} />
              </View>
              <View className="flex-1">
                <Text className="text-xs font-bold text-brand-danger-strong">Log out</Text>
                <Text className="mt-0.5 text-[9px] text-brand-danger-text-muted">
                  Sign out from your account
                </Text>
              </View>
              <ChevronRight color={colors["danger-strong"]} size={16} />
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}
