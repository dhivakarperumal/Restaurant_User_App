import colors from "../../theme/colors.json";
import { Tabs } from "expo-router";
import {
    House,
    PartyPopper,
    Search,
    ShoppingBag,
    ShoppingCart,
    Store,
    TableProperties,
    UserRound,
} from "lucide-react-native";
import { Platform, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCart } from "../../contexts/CartContext";
import TopHeader from "../Navigations/TopHeader";

const headerTitles: Record<string, string> = {
  home: "Home",
  explore: "Shop",
  shop: "Shop",
  favorites: "Favorites",
  cart: "Cart",
  "event-orders": "Event Orders",
  reservations: "Table Reservation",
  orders: "Orders",
  profile: "Profile",
};

export const unstable_settings = {
  anchor: "home",
};

export default function RootLayout() {
  return <RootTabs />;
}

function RootTabs() {
  const insets = useSafeAreaInsets();
  const { itemCount } = useCart();
  const tabIconContainerStyle = {
    width: 44,
    height: 44,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    borderRadius: 22,
  };
  const activeTabIconStyle = {
    backgroundColor: colors["gold-white"],
    borderColor: colors["gold-bright"],
    borderWidth: 2,
    shadowColor: colors["gold-bright"],
    shadowOpacity: 0.24,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 1 },
    elevation: 3,
  };

  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: Boolean(headerTitles[route.name]),
        header: () => (
          <TopHeader
            title={headerTitles[route.name] ?? route.name}
          />
        ),
        headerStyle: { backgroundColor: colors["surface-app"] },
        tabBarActiveTintColor: colors["green-action"],
        tabBarInactiveTintColor: colors["surface-cream-alt"],
        tabBarShowLabel: true,
        tabBarIndicatorStyle: { display: "none" },
        tabBarBackground: () => (
          <View
            style={[
              StyleSheet.absoluteFill,
              {
                backgroundColor: colors["surface-modal"],
              },
            ]}
          >
            <View
              style={{
                position: "absolute",
                top: 4,
                right: 3,
                bottom: insets.bottom + 4,
                left: 3,
                backgroundColor: colors["green"],
                borderColor: colors["gold-bright"],
                borderWidth: 2,
                borderRadius: 32,
              }}
            />
          </View>
        ),
        tabBarStyle: {
          display:
            route.name === "login" ||
            route.name === "register" ||
            route.name === "product/[id]" ||
            route.name === "delivery" ||
            route.name.startsWith("delivery/")
              ? "none"
              : "flex",
          backgroundColor: "transparent",
          borderTopWidth: 0,
          height: Platform.OS === "android" ? 94 + insets.bottom : 104 + insets.bottom,
          paddingBottom: Math.max(insets.bottom, 8),
          paddingTop: 2,
          elevation: 0,
        },
        tabBarItemStyle: {
          flex: 1,
          justifyContent: "center",
          paddingVertical: 4,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: "600",
          lineHeight: 14,
          marginTop: 3,
        },
        tabBarIconStyle: {
          height: 48,
          marginTop: 0,
          marginBottom: 0,
        },
        tabBarBadgeStyle: {
          backgroundColor: colors["gold"],
          color: colors["white"],
          fontSize: 10,
          minWidth: 18,
          height: 18,
          borderRadius: 9,
        },
        tabBarBadge:
          route.name === "cart" && itemCount > 0 ? String(itemCount) : undefined,
        tabBarIcon: ({ color, size, focused }) => {
          const commonProps = {
            color: focused ? colors["green-action"] : color,
            size,
            strokeWidth: focused ? 2.5 : 2,
          };

          switch (route.name) {
            case "home":
              return (
                <View
                  style={[
                    tabIconContainerStyle,
                    focused && activeTabIconStyle,
                  ]}
                >
                  <House {...commonProps} />
                </View>
              );
            case "explore":
              return (
                <View
                  style={[
                    tabIconContainerStyle,
                    focused && activeTabIconStyle,
                  ]}
                >
                  <Search {...commonProps} />
                </View>
              );
            case "shop":
              return (
                <View
                  style={[
                    tabIconContainerStyle,
                    focused && activeTabIconStyle,
                  ]}
                >
                  <Store {...commonProps} />
                </View>
              );
            case "cart":
              return (
                <View
                  style={[
                    tabIconContainerStyle,
                    focused && activeTabIconStyle,
                  ]}
                >
                  <ShoppingCart {...commonProps} />
                </View>
              );
            case "event-orders":
              return (
                <View
                  style={[
                    tabIconContainerStyle,
                    focused && activeTabIconStyle,
                  ]}
                >
                  <PartyPopper {...commonProps} />
                </View>
              );
            case "reservations":
              return (
                <View
                  style={[
                    tabIconContainerStyle,
                    focused && activeTabIconStyle,
                  ]}
                >
                  <TableProperties {...commonProps} />
                </View>
              );
            case "orders":
              return (
                <View
                  style={[
                    tabIconContainerStyle,
                    focused && activeTabIconStyle,
                  ]}
                >
                  <ShoppingBag {...commonProps} />
                </View>
              );
            case "profile":
              return (
                <View
                  style={[
                    tabIconContainerStyle,
                    focused && activeTabIconStyle,
                  ]}
                >
                  <UserRound {...commonProps} />
                </View>
              );
            default:
              return null;
          }
        },
        tabBarLabel: ({ color, focused }) => {
          const labels: Record<string, string> = {
            home: "Home",
            explore: "Shop",
            shop: "Shop",
            cart: "Cart",
            "event-orders": "Events",
            reservations: "Tables",
            profile: "Profile",
          };

          return (
            <Text
              style={{
                color: focused ? colors["gold-white"] : color,
                fontSize: 10,
                fontWeight: focused ? "700" : "600",
                lineHeight: 14,
                marginTop: 3,
              }}
            >
              {labels[route.name] ?? route.name}
            </Text>
          );
        },
      })}
    >
      <Tabs.Screen name="index" options={{ href: null }} />
      <Tabs.Screen name="home" options={{ title: "Home" }} />
      <Tabs.Screen name="explore" options={{ href: null }} />
      <Tabs.Screen name="shop" options={{ title: "Shop" }} />
      <Tabs.Screen name="favorites" options={{ href: null }} />
      <Tabs.Screen name="cart" options={{ title: "Cart" }} />
      <Tabs.Screen name="event-orders" options={{ title: "Events" }} />
      <Tabs.Screen name="reservations" options={{ title: "Tables" }} />
      <Tabs.Screen name="orders" options={{ tabBarButton: () => null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
      <Tabs.Screen name="product/[id]" options={{ title: "Product", href: null }} />
    </Tabs>
  );
}
