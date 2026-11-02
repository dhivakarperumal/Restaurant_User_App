import colors from "../theme/colors.json";
import { Stack } from "expo-router";
import { NavigationBar } from "expo-navigation-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "../contexts/AuthContext";
import { CartProvider } from "../contexts/CartContext";
import { CustomAlertProvider } from "../contexts/CustomAlertContext";
import "../../global.css";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <CustomAlertProvider>
          <CartProvider>
            <NavigationBar style="dark" />
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: colors["surface-app"] },
              }}
            />
          </CartProvider>
        </CustomAlertProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
