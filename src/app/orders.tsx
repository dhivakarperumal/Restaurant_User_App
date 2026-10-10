import { ScrollView, Text, View } from "react-native";

export default function OrdersScreen() {
  return (
    <ScrollView
      className="flex-1 bg-[#F3F4F3]"
      contentContainerStyle={{ padding: 24, paddingBottom: 120 }}
    >
      <Text className="text-base text-slate-600">
        Track active orders and review your recent purchases.
      </Text>

      <View className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4">
        <Text className="text-base font-medium text-slate-700">Current order status</Text>
      </View>
    </ScrollView>
  );
}
