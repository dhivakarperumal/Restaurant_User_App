import { Redirect } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getStoredRole, getStoredToken } from "../lib/api";
import { getDashboardRoute, type DashboardRoute } from "../lib/auth";

type Destination = DashboardRoute | "/login";

export default function Index() {
  const [destination, setDestination] = useState<Destination | null>(null);
  const [hasLoadError, setHasLoadError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let isMounted = true;

    const restoreSession = async () => {
      setHasLoadError(false);

      try {
        const token = await getStoredToken();
        if (!token) {
          if (isMounted) setDestination("/login");
          return;
        }

        const role = await getStoredRole();
        const route = getDashboardRoute(role);
        if (isMounted) setDestination(route ?? "/login");
      } catch (error) {
        console.error("Failed to restore the saved login session:", error);
        if (isMounted) setHasLoadError(true);
      }
    };

    void restoreSession();
    return () => {
      isMounted = false;
    };
  }, [retryCount]);

  if (destination) {
    return <Redirect href={destination} />;
  }

  return (
    <SafeAreaView className="flex-1 items-center justify-center bg-[#F3F4F3] px-8">
      {hasLoadError ? (
        <View className="items-center">
          <Text className="text-center text-base font-semibold text-slate-800">
            We couldn’t restore your session.
          </Text>
          <Pressable
            accessibilityRole="button"
            className="mt-4 rounded-xl bg-[#8EA66B] px-5 py-3"
            onPress={() => setRetryCount((count) => count + 1)}
          >
            <Text className="font-semibold text-white">Try again</Text>
          </Pressable>
        </View>
      ) : (
        <ActivityIndicator accessibilityLabel="Restoring session" color="#8EA66B" />
      )}
    </SafeAreaView>
  );
}
