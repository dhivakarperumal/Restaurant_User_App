import type { ComponentType } from "react";
import { CalendarCheck2, ClipboardList, UserRound, WalletCards } from "lucide-react-native";
import { ScrollView, Text, View } from "react-native";

const placeholderContent = {
  attendance: {
    title: "Attendance",
    description: "Your delivery shifts and attendance history will appear here.",
    Icon: CalendarCheck2,
  },
  orders: {
    title: "Orders",
    description: "Your assigned delivery orders will appear here.",
    Icon: ClipboardList,
  },
  earnings: {
    title: "Earning",
    description: "Your delivery earnings and payout summary will appear here.",
    Icon: WalletCards,
  },
  profile: {
    title: "Profile",
    description: "Your delivery partner account details will appear here.",
    Icon: UserRound,
  },
} satisfies Record<
  string,
  { title: string; description: string; Icon: ComponentType<{ color?: string; size?: number }> }
>;

export type DeliveryPlaceholderKey = keyof typeof placeholderContent;

export default function DeliveryPlaceholderScreen({
  page,
}: {
  page: DeliveryPlaceholderKey;
}) {
  const { title, description, Icon } = placeholderContent[page];

  return (
    <ScrollView
      className="flex-1 bg-[#F7F8F3]"
      contentContainerStyle={{ flexGrow: 1, padding: 24 }}
    >
      <View className="flex-1 justify-center">
        <View className="mb-6 h-16 w-16 items-center justify-center rounded-2xl bg-[#EAF2E8]">
          <Icon color="#17663D" size={30} />
        </View>
        <Text className="text-3xl font-black text-[#17251E]">{title}</Text>
        <View className="mt-5 rounded-2xl border border-[#E7E0D8] bg-white p-5">
          <Text className="text-base leading-6 text-slate-600">{description}</Text>
          <Text className="mt-3 text-sm font-semibold text-[#17663D]">
            This section is ready for the next dashboard update.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}
