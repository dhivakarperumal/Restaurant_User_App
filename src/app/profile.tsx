import { ScrollView, Text, View } from "react-native";
import AuthLogoutButton from "../components/AuthLogoutButton";

export default function ProfileScreen() {
  return (
    <ScrollView
      className="flex-1 bg-white"
      contentContainerStyle={{ padding: 24, paddingBottom: 120 }}
    >
        <Text className="text-base text-slate-600">
          Manage your account, preferences, and delivery details.
        </Text>

        <View className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4">
          <Text className="text-base font-medium text-slate-700">Account settings</Text>
        </View>

        <AuthLogoutButton />
    </ScrollView>
  );
}
