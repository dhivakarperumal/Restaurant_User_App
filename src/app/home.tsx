import { SafeAreaView, ScrollView, Text, View } from "react-native";

export default function HomeScreen() {
  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView contentContainerStyle={{ padding: 24 }}>
        <Text className="text-3xl font-bold text-slate-900">Restaurant Home</Text>
        <Text className="mt-3 text-base text-slate-600">
          Welcome back. Discover fresh dishes and favorites near you.
        </Text>

        <View className="mt-6 rounded-2xl bg-[#8EA66B] px-5 py-4">
          <Text className="text-lg font-semibold text-white">Hot Picks Today</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
