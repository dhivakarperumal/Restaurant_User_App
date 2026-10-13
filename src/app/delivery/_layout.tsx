import { Slot } from "expo-router";
import { View } from "react-native";
import DeliveryBottomBar from "../../components/delivery/DeliveryBottomBar";

export default function DeliveryLayout() {
  return (
    <View className="flex-1">
      <Slot />
      <DeliveryBottomBar />
    </View>
  );
}
