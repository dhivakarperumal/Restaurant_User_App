import { Bike, ClipboardList } from "lucide-react-native";
import { SafeAreaView, Text, View } from "react-native";
import AuthLogoutButton from "../../components/AuthLogoutButton";

export default function DeliveryPartnerScreen() {
  return (
    <SafeAreaView className="flex-1 bg-[#F7F8F3]">
      <View className="flex-1 justify-center px-6">
        <View className="mb-8 h-16 w-16 items-center justify-center rounded-2xl bg-[#8EA66B]">
          <Bike color="#FFFFFF" size={32} strokeWidth={2} />
        </View>
        <Text className="text-3xl font-bold text-slate-900">
          Delivery Partner
        </Text>
        <Text className="mt-3 text-base leading-6 text-slate-600">
          You’re signed in to the delivery partner experience.
        </Text>

        <View className="mt-8 flex-row items-center rounded-2xl border border-slate-200 bg-white p-5">
          <ClipboardList color="#8EA66B" size={22} />
          <Text className="ml-3 flex-1 text-base font-medium text-slate-700">
            Your delivery dashboard will appear here.
          </Text>
        </View>

        <AuthLogoutButton />
      </View>
    </SafeAreaView>
  );
}
