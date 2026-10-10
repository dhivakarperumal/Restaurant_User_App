import { SafeAreaView, ScrollView, Text, View } from "react-native";

export default function ExploreScreen() {
  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView contentContainerStyle={{ padding: 24 }}>
        <Text className="text-3xl font-bold text-slate-900">Explore</Text>
        <Text className="mt-3 text-base text-slate-600">
          Browse restaurants, trending food, and fresh picks nearby.
        </Text>

        <View className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4">
          <Text className="text-base font-medium text-slate-700">Featured cuisines</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
