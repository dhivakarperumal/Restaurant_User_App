import { LogOut } from "lucide-react-native";
import { useState } from "react";
import { ActivityIndicator, Pressable, Text } from "react-native";
import { confirmLogout } from "../lib/logout";

export default function AuthLogoutButton() {
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  return (
    <Pressable
      accessibilityRole="button"
      className="mt-6 min-h-14 flex-row items-center justify-center rounded-xl border border-red-200 bg-white px-5 active:opacity-80"
      disabled={isLoggingOut}
      onPress={() => confirmLogout(setIsLoggingOut)}
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
