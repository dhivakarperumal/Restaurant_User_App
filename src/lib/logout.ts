import { router } from "expo-router";
import type { CustomAlertOptions } from "../contexts/CustomAlertContext";
import { logoutUser } from "./api";

type LogoutStateHandler = (isLoggingOut: boolean) => void;
type ShowAlert = (options: CustomAlertOptions) => void;

export function confirmLogout(
  showAlert: ShowAlert,
  onStateChange?: LogoutStateHandler,
) {
  showAlert({
    title: "Log out?",
    message: "Are you sure you want to log out?",
    variant: "confirm",
    actions: [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log out",
        style: "destructive",
        onPress: () => {
          void performLogout(showAlert, onStateChange);
        },
      },
    ],
  });
}

async function performLogout(
  showAlert: ShowAlert,
  onStateChange?: LogoutStateHandler,
) {
  onStateChange?.(true);

  try {
    await logoutUser();
    router.replace("/Auth/login");
  } catch (error) {
    console.error("Failed to clear the user session during logout:", error);
    showAlert({
      title: "Unable to log out",
      message: "Your session could not be cleared. Please try again.",
      variant: "error",
    });
  } finally {
    onStateChange?.(false);
  }
}
