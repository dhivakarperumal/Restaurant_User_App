import { router } from "expo-router";
import { Settings } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";

type TopHeaderProps = {
  title: string;
};

export default function TopHeader({ title }: TopHeaderProps) {
  return (
    <View className="bg-[#F3F4F3] px-6 pb-4 pt-3">
      <View className="flex-row items-center justify-between">
        <View className="flex-1">
          <Text className="text-[11px] font-bold uppercase tracking-[2px] text-[#82966A]">
            Restaurant
          </Text>
          <Text
            className="mt-0.5 text-[28px] font-extrabold leading-8 text-slate-900"
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
    </View>
  );
}
