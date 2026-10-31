import colors from "../theme/colors.json";
import { LogOut } from "lucide-react-native";
import { useState } from "react";
import { ActivityIndicator, Pressable, Text } from "react-native";
import { useCustomAlert } from "../contexts/CustomAlertContext";
import { confirmLogout } from "../lib/logout";

export default function AuthLogoutButton() {
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const { showAlert } = useCustomAlert();

  return (
    <Pressable
      accessibilityRole="button"
      className="mt-6 min-h-14 flex-row items-center justify-center rounded-xl border border-red-200 bg-white px-5 active:opacity-80"
      disabled={isLoggingOut}
      onPress={() => confirmLogout(showAlert, setIsLoggingOut)}
    >
      {isLoggingOut ? (
        <ActivityIndicator color={colors["danger-red"]} />
      ) : (
        <>
          <LogOut color={colors["danger-red"]} size={19} />
          <Text className="ml-2 text-base font-semibold text-red-600">Log out</Text>
        </>
      )}
    </Pressable>
  );
}
