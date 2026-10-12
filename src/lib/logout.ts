import { router } from "expo-router";
import { Alert } from "react-native";
import { logoutUser } from "./api";

type LogoutStateHandler = (isLoggingOut: boolean) => void;

export function confirmLogout(onStateChange?: LogoutStateHandler) {
  Alert.alert("Log out?", "Are you sure you want to log out?", [
    { text: "Cancel", style: "cancel" },
    {
      text: "Log out",
      style: "destructive",
      onPress: () => {
        void performLogout(onStateChange);
      },
    },
  ]);
}

async function performLogout(onStateChange?: LogoutStateHandler) {
  onStateChange?.(true);

  try {
    await logoutUser();
    router.replace("/login");
  } catch (error) {
    console.error("Failed to clear the user session during logout:", error);
    Alert.alert(
      "Unable to log out",
      "Your session could not be cleared. Please try again.",
    );
  } finally {
    onStateChange?.(false);
  }
}
