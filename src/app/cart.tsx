import { SafeAreaView, ScrollView, Text, View } from "react-native";

export default function CartScreen() {
  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView contentContainerStyle={{ padding: 24 }}>
        <Text className="text-3xl font-bold text-slate-900">Cart</Text>
        <Text className="mt-3 text-base text-slate-600">
          Review your items and continue to checkout when ready.
        </Text>

        <View className="mt-6 rounded-2xl bg-slate-100 px-5 py-4">
          <Text className="text-base font-medium text-slate-700">3 items in cart</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
