import { SafeAreaView, ScrollView, Text, View } from "react-native";

export default function OrdersScreen() {
  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView contentContainerStyle={{ padding: 24 }}>
        <Text className="text-3xl font-bold text-slate-900">Orders</Text>
        <Text className="mt-3 text-base text-slate-600">
          Track active orders and review your recent purchases.
        </Text>

        <View className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4">
          <Text className="text-base font-medium text-slate-700">Current order status</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
