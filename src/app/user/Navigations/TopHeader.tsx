import { router } from "expo-router";
import { Settings } from "lucide-react-native";
import { Image, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type TopHeaderProps = {
  title: string;
};

export default function TopHeader({ title }: TopHeaderProps) {
  return (
    <SafeAreaView
      className="bg-[#F3F4F3] px-6 pb-4 pt-3"
      edges={["top"]}
    >
      <View className="flex-row items-center justify-between">
        <View className="flex-1 flex-row items-center">
          <Image
            accessible
            accessibilityLabel="Buy Food restaurant logo"
            className="mr-3 h-12 w-12"
            resizeMode="contain"
            source={require("../../../../assets/images/adminlogo.png")}
          />
          <Text
            className="flex-1 text-[28px] font-extrabold leading-8 text-slate-900"
            numberOfLines={1}
          >
            {title}
          </Text>
        </View>

        <Pressable
          accessibilityLabel="Open profile"
          accessibilityRole="button"
          className="ml-4 h-12 w-12 items-center justify-center rounded-full bg-white"
          onPress={() => router.push("/profile")}
        >
          <Settings color="#374151" size={22} strokeWidth={2.2} />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
