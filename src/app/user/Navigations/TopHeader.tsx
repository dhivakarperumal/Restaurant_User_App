import { router } from "expo-router";
import { LogOut, UserRound, UserRoundPen } from "lucide-react-native";
import { useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  Text,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { confirmLogout } from "../../../lib/logout";

type TopHeaderProps = {
  title: string;
};

export default function TopHeader({ title }: TopHeaderProps) {
  const insets = useSafeAreaInsets();
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  return (
    <SafeAreaView
      className="z-20 border-b border-[#E7E0D8] bg-[#FFFCF6] px-5 pb-3 pt-2"
      edges={["top"]}
    >
      <View className="flex-row items-center justify-between">
        <View className="flex-1 flex-row items-center">
          <Image
            accessible
            accessibilityLabel="Buy Food restaurant logo"
            className="mr-3 h-10 w-10"
            resizeMode="contain"
            source={require("../../../../assets/images/adminlogo.png")}
          />
          <Text
            className="flex-1 text-2xl font-extrabold leading-7 text-[#183B2A]"
            numberOfLines={1}
          >
            {title}
          </Text>
        </View>

        <Pressable
          accessibilityLabel="Open profile menu"
          accessibilityRole="button"
          accessibilityState={{ expanded: isMenuVisible }}
          className="ml-4 h-11 w-11 items-center justify-center rounded-full border border-[#D9E6D9] bg-[#EAF2E8] active:bg-[#DCEBDD]"
          disabled={isLoggingOut}
          onPress={() => setIsMenuVisible(true)}
        >
          {isLoggingOut ? (
            <ActivityIndicator color="#1A6A3B" />
          ) : (
            <UserRound color="#1A6A3B" size={21} strokeWidth={2.2} />
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
            accessibilityLabel="Close profile menu"
            accessibilityRole="button"
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
                <UserRound color="#1A6A3B" size={20} />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-extrabold text-[#183B2A]">
                  Your account
                </Text>
                <Text className="mt-0.5 text-xs text-[#81786B]">
                  Manage your profile
                </Text>
              </View>
            </View>
            <Pressable
              accessibilityRole="button"
              className="min-h-12 flex-row items-center px-4 active:bg-[#F5EFE5]"
              onPress={() => {
                setIsMenuVisible(false);
                router.push("/profile");
              }}
            >
              <UserRoundPen color="#1A6A3B" size={18} />
              <Text className="ml-3 text-sm font-semibold text-[#24372D]">
                My Account
              </Text>
            </Pressable>
            <View className="mx-4 border-t border-[#EEE8DD]" />
            <Pressable
              accessibilityRole="button"
              className="min-h-12 flex-row items-center px-4 active:bg-[#FFF1E8]"
              disabled={isLoggingOut}
              onPress={() => confirmLogout(setIsLoggingOut)}
            >
              <LogOut color="#C2412D" size={18} />
              <Text className="ml-3 text-sm font-semibold text-[#B83E2E]">
                Log out
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
