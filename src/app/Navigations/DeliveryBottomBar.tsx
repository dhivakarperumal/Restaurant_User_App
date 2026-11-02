import {
  CalendarCheck2,
  ClipboardList,
  LayoutDashboard,
  UserRound,
  WalletCards,
} from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router, usePathname } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const tabItems = [
  { href: "/DeliveryTab", label: "Dashboard", Icon: LayoutDashboard },
  { href: "/DeliveryTab/attendance", label: "Attendance", Icon: CalendarCheck2 },
  { href: "/DeliveryTab/orders", label: "Orders", Icon: ClipboardList },
  { href: "/DeliveryTab/earnings", label: "Earning", Icon: WalletCards },
  { href: "/DeliveryTab/profile", label: "Profile", Icon: UserRound },
] as const;

function isTabFocused(pathname: string, href: string) {
  const currentPath = pathname.replace(/\/+$/, "") || "/";
  const tabPath = href.replace(/\/+$/, "") || "/";

  return tabPath === "/DeliveryTab"
    ? currentPath === tabPath
    : currentPath === tabPath || currentPath.startsWith(`${tabPath}/`);
}

export default function DeliveryBottomBar() {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();

  return (
    <View
      style={[
        styles.container,
        { paddingBottom: Math.max(insets.bottom, 8) },
      ]}
    >
      {tabItems.map(({ href, label, Icon }) => {
        const focused = isTabFocused(pathname, href);
        const iconColor = focused ? "#FFFFFF" : "#829087";
        const labelColor = focused ? "#17663D" : "#829087";

        return (
          <Pressable
            key={href}
            accessibilityRole="tab"
            accessibilityLabel={label}
            accessibilityState={{ selected: focused }}
            onPress={() => {
              if (!focused) router.replace(href);
            }}
            style={styles.tab}
          >
            <View style={[styles.icon, focused && styles.activeIcon]}>
              <Icon color={iconColor} size={21} strokeWidth={focused ? 2.5 : 2} />
            </View>
            <Text
              numberOfLines={1}
              style={[
                styles.label,
                { color: labelColor },
                focused && styles.activeLabel,
              ]}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingTop: 8,
    paddingHorizontal: 4,
    backgroundColor: "#FFFCF6",
    borderTopColor: "#E7E0D8",
    borderTopWidth: StyleSheet.hairlineWidth,
    shadowColor: "#183B2A",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: -3 },
    elevation: 8,
  },
  tab: {
    flex: 1,
    minWidth: 0,
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 3,
    borderRadius: 14,
  },
  icon: {
    width: 44,
    height: 44,
    minWidth: 44,
    maxWidth: 44,
    minHeight: 44,
    maxHeight: 44,
    flexShrink: 0,
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
  },
  activeIcon: {
    backgroundColor: "#17663D",
    borderRadius: 22,
    overflow: "hidden",
  },
  label: {
    marginTop: 2,
    fontSize: 10,
    fontWeight: "600",
  },
  activeLabel: {
    fontWeight: "800",
  },
});
