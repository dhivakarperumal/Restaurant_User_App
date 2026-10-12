import { Tabs } from "expo-router";
import {
  House,
  PartyPopper,
  Search,
  ShoppingBag,
  ShoppingCart,
  TableProperties,
  UserRound,
} from "lucide-react-native";
import { NavigationBar } from "expo-navigation-bar";
import { Platform, StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import { CartProvider, useCart } from "../contexts/CartContext";
import TopHeader from "./user/Navigations/TopHeader";
import "../../global.css";

const headerTitles: Record<string, string> = {
  home: "Home",
  explore: "Shop",
  shop: "Shop",
  favorites: "Favorites",
  cart: "Cart",
  "event-orders": "Event Orders",
  reservations: "Table Reservation",
  checkout: "Checkout",
  orders: "Orders",
  profile: "Profile",
  "delivery/index": "Delivery",
};

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <NavigationBar style="dark" />
      <CartProvider>
        <RootTabs />
      </CartProvider>
    </SafeAreaProvider>
  );
}

function RootTabs() {
  const insets = useSafeAreaInsets();
  const { itemCount } = useCart();
  const tabIconContainerStyle = {
    width: 42,
    height: 30,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    borderRadius: 12,
  };

  return (
    <Tabs
      initialRouteName="index"
      screenOptions={({ route }) => ({
        headerShown: Boolean(headerTitles[route.name]),
        header: () => <TopHeader title={headerTitles[route.name] ?? route.name} />,
        headerStyle: { backgroundColor: "#F3F4F3" },
        tabBarActiveTintColor: "#1A6A3B",
        tabBarInactiveTintColor: "#8A8172",
        tabBarShowLabel: true,
        tabBarIndicatorStyle: { display: "none" },
        tabBarBackground: () => (
          <View
            style={[
              StyleSheet.absoluteFill,
              {
                backgroundColor: "#FFFCF6",
                borderTopColor: "#E7E0D8",
                borderTopWidth: StyleSheet.hairlineWidth,
              },
            ]}
          >
            <View
              style={{
                position: "absolute",
                right: 0,
                bottom: 0,
                left: 0,
                height: insets.bottom,
                backgroundColor: "#FFFCF6",
              }}
            />
          </View>
        ),
        tabBarStyle: {
          display:
            route.name === "login" ||
            route.name === "checkout" ||
            route.name.startsWith("delivery/")
              ? "none"
              : "flex",
          backgroundColor: "#FFFCF6",
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: "#E7E0D8",
          height: Platform.OS === "android" ? 72 + insets.bottom : 82 + insets.bottom,
          paddingBottom: Math.max(insets.bottom, 8),
          paddingTop: 8,
          elevation: 0,
          shadowColor: "#183B2A",
          shadowOpacity: 0.08,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: -3 },
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
          marginTop: 2,
        },
        tabBarIconStyle: {
          marginTop: 2,
        },
        tabBarBadgeStyle: {
          backgroundColor: "#E86D16",
          color: "#FFFFFF",
          fontSize: 10,
          minWidth: 18,
          height: 18,
          borderRadius: 9,
        },
        tabBarBadge:
          route.name === "cart" && itemCount > 0 ? String(itemCount) : undefined,
        tabBarIcon: ({ color, size, focused }) => {
          const commonProps = {
            color,
            size,
            strokeWidth: focused ? 2.5 : 2,
          };

          switch (route.name) {
            case "home":
              return (
                <View
                  style={[
                    tabIconContainerStyle,
                    focused && { backgroundColor: "#EAF2E8" },
                  ]}
                >
                  <House {...commonProps} />
                </View>
              );
            case "explore":
            case "shop":
              return (
                <View
                  style={[
                    tabIconContainerStyle,
                    focused && { backgroundColor: "#EAF2E8" },
                  ]}
                >
                  <Search {...commonProps} />
                </View>
              );
            case "cart":
              return (
                <View
                  style={[
                    tabIconContainerStyle,
                    focused && { backgroundColor: "#EAF2E8" },
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
                    focused && { backgroundColor: "#EAF2E8" },
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
                    focused && { backgroundColor: "#EAF2E8" },
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
                    focused && { backgroundColor: "#EAF2E8" },
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
                    focused && { backgroundColor: "#EAF2E8" },
                  ]}
                >
                  <UserRound {...commonProps} />
                </View>
              );
            default:
              return null;
          }
        },
        tabBarLabel: ({ color }) => {
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
            <Text style={{ color, fontSize: 11, fontWeight: "600", marginTop: 2 }}>
              {labels[route.name] ?? route.name}
            </Text>
          );
        },
      })}
    >
      <Tabs.Screen name="index" options={{ href: null }} />
      <Tabs.Screen name="login" options={{ title: "Login", href: null }} />
      <Tabs.Screen
        name="delivery/index"
        options={{ title: "Delivery", href: null }}
      />
      <Tabs.Screen
        name="delivery/Navigations/Bottombar"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="delivery/Navigations/TopHeader"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="user/Navigations/Bottombar"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="user/Navigations/TopHeader"
        options={{ href: null }}
      />
      <Tabs.Screen name="home" options={{ title: "Home" }} />
      <Tabs.Screen name="explore" options={{ href: null }} />
      <Tabs.Screen name="shop" options={{ title: "Shop" }} />
      <Tabs.Screen name="favorites" options={{ href: null }} />
      <Tabs.Screen name="cart" options={{ title: "Cart" }} />
      <Tabs.Screen name="event-orders" options={{ title: "Events" }} />
      <Tabs.Screen name="reservations" options={{ title: "Tables" }} />
      <Tabs.Screen name="checkout" options={{ href: null }} />
      <Tabs.Screen name="orders" options={{ href: null }} />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
    </Tabs>
  );
}
