import { Tabs } from "expo-router";
import {
  House,
  Search,
  ShoppingBag,
  ShoppingCart,
  UserRound,
} from "lucide-react-native";
import { Platform, Text } from "react-native";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import TopHeader from "./user/Navigations/TopHeader";
import "../../global.css";

const cartItems = 3;
const headerTitles: Record<string, string> = {
  home: "Home",
  explore: "Explore",
  cart: "Cart",
  orders: "Orders",
  profile: "Profile",
  "delivery/index": "Delivery",
};

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <RootTabs />
    </SafeAreaProvider>
  );
}

function RootTabs() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: Boolean(headerTitles[route.name]),
        header: () => <TopHeader title={headerTitles[route.name] ?? route.name} />,
        headerStyle: { backgroundColor: "#F3F4F3" },
        tabBarActiveTintColor: "#374151",
        tabBarInactiveTintColor: "#6B7280",
        tabBarShowLabel: true,
        tabBarIndicatorStyle: { display: "none" },
        tabBarStyle: {
          display:
            route.name === "login" || route.name.startsWith("delivery/")
              ? "none"
              : "flex",
          backgroundColor: "#FFFFFF",
          borderTopWidth: 0,
          borderTopColor: "transparent",
          height: Platform.OS === "android" ? 72 + insets.bottom : 82 + insets.bottom,
          paddingBottom: Math.max(insets.bottom, 8),
          paddingTop: 8,
          elevation: 0,
          shadowColor: "#000000",
          shadowOpacity: 0,
          shadowRadius: 0,
          shadowOffset: { width: 0, height: 0 },
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
          backgroundColor: "#6B7280",
          color: "#FFFFFF",
          fontSize: 10,
          minWidth: 18,
          height: 18,
          borderRadius: 9,
        },
        tabBarBadge:
          route.name === "cart" && cartItems > 0 ? String(cartItems) : undefined,
        tabBarIcon: ({ color, size, focused }) => {
          const commonProps = {
            color,
            size,
            strokeWidth: focused ? 2.5 : 2,
          };

          switch (route.name) {
            case "home":
              return <House {...commonProps} />;
            case "explore":
              return <Search {...commonProps} />;
            case "cart":
              return <ShoppingCart {...commonProps} />;
            case "orders":
              return <ShoppingBag {...commonProps} />;
            case "profile":
              return <UserRound {...commonProps} />;
            default:
              return null;
          }
        },
        tabBarLabel: ({ color }) => {
          const labels: Record<string, string> = {
            home: "Home",
            explore: "Explore",
            cart: "Cart",
            orders: "Orders",
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
      <Tabs.Screen name="login" options={{ title: "Login", href: null }} />
      <Tabs.Screen name="index" options={{ href: null }} />
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
      <Tabs.Screen name="explore" options={{ title: "Explore" }} />
      <Tabs.Screen name="cart" options={{ title: "Cart" }} />
      <Tabs.Screen name="orders" options={{ title: "Orders" }} />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
    </Tabs>
  );
}
