import { ScrollView, Text, View } from "react-native";

export default function HomeScreen() {
  return (
    <ScrollView
      className="flex-1 bg-[#F3F4F3]"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{
        paddingHorizontal: 24,
        paddingTop: 20,
        paddingBottom: 120,
      }}
    >
      <Text className="text-[22px] leading-[1.35] tracking-[-0.5px] text-slate-600">
        Welcome back. Discover fresh dishes and favorites near you.
      </Text>

      <View className="mt-7 overflow-hidden rounded-[26px] bg-[#B8C89D] px-5 py-5">
        <Text className="text-[28px] font-black leading-tight tracking-[-0.8px] text-slate-900">
          Hot Picks Today
        </Text>
      </View>
    </ScrollView>
  );
}
