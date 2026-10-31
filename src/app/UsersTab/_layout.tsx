import { NavigationBar } from "expo-navigation-bar";
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
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import { CartProvider, useCart } from "../../contexts/CartContext";
import { CustomAlertProvider } from "../../contexts/CustomAlertContext";
import "../../../global.css";
import TopHeader from "../Navigations/TopHeader";

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
};

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <CustomAlertProvider>
        <NavigationBar style="dark" />
        <CartProvider>
          <RootTabs />
        </CartProvider>
      </CustomAlertProvider>
    </SafeAreaProvider>
  );
}

function RootTabs() {
  const insets = useSafeAreaInsets();
  const { itemCount } = useCart();
  const tabIconContainerStyle = {
    width: 50,
    height: 50,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    borderRadius: 25,
  };
  const activeTabIconStyle = {
    backgroundColor: "#FFF8E7",
    borderColor: "#E9BE45",
    borderWidth: 2,
    shadowColor: "#E9BE45",
    shadowOpacity: 0.24,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 1 },
    elevation: 3,
  };

  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: Boolean(headerTitles[route.name]),
        header: () => <TopHeader title={headerTitles[route.name] ?? route.name} />,
        headerStyle: { backgroundColor: "#F3F4F3" },
        tabBarActiveTintColor: "#155A32",
        tabBarInactiveTintColor: "#F8F3E4",
        tabBarShowLabel: true,
        tabBarIndicatorStyle: { display: "none" },
        tabBarBackground: () => (
          <View
            style={[
              StyleSheet.absoluteFill,
              {
                marginHorizontal: 3,
                marginTop: 4,
                marginBottom: 4,
                backgroundColor: "#084A2B",
                borderColor: "#E9BE45",
                borderWidth: 2,
                borderRadius: 32,
              },
            ]}
          />
        ),
        tabBarStyle: {
          display:
            route.name === "login" ||
            route.name === "register" ||
            route.name === "checkout" ||
            route.name === "product/[id]" ||
            route.name === "delivery" ||
            route.name.startsWith("delivery/")
              ? "none"
              : "flex",
          backgroundColor: "transparent",
          borderTopWidth: 0,
          height: Platform.OS === "android" ? 72 + insets.bottom : 82 + insets.bottom,
          paddingBottom: Math.max(insets.bottom, 8),
          paddingTop: 4,
          elevation: 0,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: "600",
          marginTop: 1,
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
                color,
                fontSize: 10,
                fontWeight: focused ? "700" : "600",
                marginTop: focused ? -16 : 1,
              }}
            >
              {labels[route.name] ?? route.name}
            </Text>
          );
        },
      })}
    >
      <Tabs.Screen name="index" options={{ href: null }} />
      <Tabs.Screen name="login" options={{ title: "Login", href: null }} />
      <Tabs.Screen name="register" options={{ title: "Register", href: null }} />
      <Tabs.Screen
        name="delivery"
        options={{ title: "Delivery", href: null }}
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
      <Tabs.Screen name="product/[id]" options={{ title: "Product", href: null }} />
    </Tabs>
  );
}
