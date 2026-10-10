import { Settings } from "lucide-react-native";
import { SafeAreaView, ScrollView, Text, View } from "react-native";

export default function HomeScreen() {
  return (
    <SafeAreaView className="flex-1 bg-[#F3F4F3]">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 24,
          paddingTop: 12,
          paddingBottom: 120,
        }}
      >
        <View className="mb-5 flex-row items-start justify-between">
          <Text className="max-w-[250px] text-[42px] font-black leading-[0.95] tracking-[-1.4px] text-slate-900">
            Restaurant Home
          </Text>

          <View className="mt-1 h-16 w-16 items-center justify-center rounded-full bg-[#D7D7D7]">
            <Settings size={28} color="#4B5563" strokeWidth={2.2} />
          </View>
        </View>

        <Text className="text-[22px] leading-[1.35] tracking-[-0.5px] text-slate-600">
          Welcome back. Discover fresh dishes and favorites near you.
        </Text>

        <View className="mt-7 overflow-hidden rounded-[26px] bg-[#B8C89D] px-5 py-5">
          <Text className="text-[28px] font-black leading-tight tracking-[-0.8px] text-slate-900">
            Hot Picks Today
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
