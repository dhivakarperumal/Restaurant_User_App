import { router } from "expo-router";
import {
  ArrowRight,
  CalendarDays,
  PartyPopper,
  ShoppingBag,
  TableProperties,
} from "lucide-react-native";
import { Pressable, Text, View } from "react-native";
import colors from "../theme/colors.json";

type Promotion = "events" | "reservations" | "menu";

const promotionContent = {
  events: {
    label: "CELEBRATE TOGETHER",
    title: "Planning an event?",
    description: "Build a menu everyone will remember.",
    action: "Plan an event",
    href: "/UsersTab/event-orders",
  },
  reservations: {
    label: "YOUR TABLE AWAITS",
    title: "Save a seat for everyone",
    description: "Choose a table and a time that works for you.",
    action: "Book a table",
    href: "/UsersTab/reservations",
  },
  menu: {
    label: "FRESH FROM OUR KITCHEN",
    title: "Find your next favorite",
    description: "Explore the full menu and order something delicious.",
    action: "Explore menu",
    href: "/UsersTab/shop",
  },
} as const;

const promotionIcons = {
  events: PartyPopper,
  reservations: TableProperties,
  menu: ShoppingBag,
} as const;

export default function HomePromotionBanner({
  promotion,
}: {
  promotion: Promotion;
}) {
  const content = promotionContent[promotion];
  const Icon = promotionIcons[promotion];

  if (promotion === "events") {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${content.action}: ${content.title}`}
        className="mt-7 overflow-hidden rounded-3xl bg-brand-green-forest p-5"
        onPress={() => router.push(content.href)}
        style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}
      >
        <View className="absolute -right-7 -top-10 h-36 w-36 rounded-full border-[20px] border-white/10" />
        <View className="flex-row items-start justify-between">
          <View className="flex-1 pr-3">
            <Text className="text-[10px] font-extrabold tracking-[1.5px] text-brand-gold-bright">
              {content.label}
            </Text>
            <Text className="mt-2 text-xl font-black text-white">
              {content.title}
            </Text>
            <Text className="mt-1 text-xs leading-5 text-white/80">
              {content.description}
            </Text>
          </View>
          <View className="h-12 w-12 items-center justify-center rounded-2xl border border-white/20 bg-white/10">
            <Icon color={colors["gold-bright"]} size={24} />
          </View>
        </View>
        <View className="mt-4 self-start flex-row items-center rounded-xl bg-brand-gold-bright px-4 py-2.5">
          <Text className="text-xs font-extrabold text-brand-green-forest">
            {content.action}
          </Text>
          <ArrowRight
            color={colors["green-forest"]}
            size={15}
            className="ml-2"
          />
        </View>
      </Pressable>
    );
  }

  if (promotion === "reservations") {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${content.action}: ${content.title}`}
        className="mt-7 flex-row items-center overflow-hidden rounded-3xl border border-brand-neutral-border-warm bg-brand-surface-modal p-4"
        onPress={() => router.push(content.href)}
        style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}
      >
        <View className="mr-4 h-14 w-14 items-center justify-center rounded-2xl border border-brand-gold-muted bg-brand-gold-light">
          <Icon color={colors["green-primary"]} size={25} />
        </View>
        <View className="min-w-0 flex-1">
          <Text className="text-[9px] font-extrabold tracking-[1.2px] text-brand-gold-dark">
            {content.label}
          </Text>
          <Text className="mt-1 text-base font-extrabold text-brand-neutral-text-primary">
            {content.title}
          </Text>
          <Text className="mt-1 text-xs leading-4 text-brand-neutral-text-secondary">
            {content.description}
          </Text>
          <View className="mt-3 self-start flex-row items-center rounded-full bg-brand-green-primary px-3 py-2">
            <Text className="text-[10px] font-bold text-white">
              {content.action}
            </Text>
            <ArrowRight color={colors.white} size={13} className="ml-1.5" />
          </View>
        </View>
        <CalendarDays
          color={colors["gold-muted"]}
          size={25}
          className="ml-2 self-start"
        />
      </Pressable>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${content.action}: ${content.title}`}
      className="mt-7 overflow-hidden rounded-3xl border border-brand-gold-muted bg-brand-gold-light p-5"
      onPress={() => router.push(content.href)}
      style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}
    >
      <View className="flex-row items-center">
        <View className="min-w-0 flex-1 pr-3">
          <Text className="text-[9px] font-extrabold tracking-[1.3px] text-brand-green-primary">
            {content.label}
          </Text>
          <Text className="mt-2 text-xl font-black leading-6 text-brand-green-forest">
            {content.title}
          </Text>
          <Text className="mt-1.5 text-xs leading-5 text-brand-neutral-text-secondary">
            {content.description}
          </Text>
        </View>
        <View className="h-[68px] w-[68px] items-center justify-center rounded-full border-[5px] border-white/70 bg-brand-green-primary">
          <Icon color={colors["gold-bright"]} size={27} />
        </View>
      </View>
      <View className="mt-4 flex-row items-center self-start rounded-xl bg-white px-4 py-2.5">
        <Text className="text-xs font-extrabold text-brand-green-primary">
          {content.action}
        </Text>
        <ArrowRight
          color={colors["green-primary"]}
          size={15}
          className="ml-2"
        />
      </View>
    </Pressable>
  );
}
