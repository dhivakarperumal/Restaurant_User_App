import { ScrollView, Text, View } from "react-native";

export default function CartScreen() {
  return (
    <ScrollView
      className="flex-1 bg-[#F3F4F3]"
      contentContainerStyle={{ padding: 24, paddingBottom: 120 }}
    >
      <Text className="text-base text-slate-600">
        Review your items and continue to checkout when ready.
      </Text>

      <View className="mt-6 rounded-2xl bg-slate-100 px-5 py-4">
        <Text className="text-base font-medium text-slate-700">3 items in cart</Text>
      </View>
    </ScrollView>
  );
}
