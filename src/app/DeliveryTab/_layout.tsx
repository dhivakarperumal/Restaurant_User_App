import { Slot } from "expo-router";
import { View } from "react-native";
import { CustomAlertProvider } from "../../contexts/CustomAlertContext";
import DeliveryBottomBar from "../../components/delivery/DeliveryBottomBar";
import DeliveryTopBar from "../../components/delivery/DeliveryTopBar";
import RequireAuth from "../../components/RequireAuth";

export default function DeliveryLayout() {
  return (
    <CustomAlertProvider>
      <RequireAuth role="delivery_partner">
        <View className="flex-1">
          <DeliveryTopBar />
          <View className="flex-1">
            <Slot />
          </View>
          <DeliveryBottomBar />
        </View>
      </RequireAuth>
    </CustomAlertProvider>
  );
}
