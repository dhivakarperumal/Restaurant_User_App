import { router } from "expo-router";
import { LogOut } from "lucide-react-native";
import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, Text } from "react-native";
import { logoutUser } from "../lib/api";

export default function AuthLogoutButton() {
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);

    try {
      await logoutUser();
      router.replace("/login");
    } catch {
      Alert.alert(
        "Unable to log out",
        "Your session could not be cleared. Please try again.",
      );
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <Pressable
      accessibilityRole="button"
      className="mt-6 min-h-14 flex-row items-center justify-center rounded-xl border border-red-200 bg-white px-5 active:opacity-80"
      disabled={isLoggingOut}
      onPress={handleLogout}
    >
      {isLoggingOut ? (
        <ActivityIndicator color="#DC2626" />
      ) : (
        <>
          <LogOut color="#DC2626" size={19} />
          <Text className="ml-2 text-base font-semibold text-red-600">Log out</Text>
        </>
      )}
    </Pressable>
  );
}
