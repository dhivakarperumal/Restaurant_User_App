import colors from "../../theme/colors.json";
import { Redirect, usePathname } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getStoredRole, getStoredToken } from "../../lib/api";
import { getDashboardRoute, type DashboardRoute } from "../../lib/auth";

type Destination = DashboardRoute | "/Auth/login";

export default function Index() {
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;
  const [destination, setDestination] = useState<Destination | null>(null);
  const [hasLoadError, setHasLoadError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    if (pathname !== "/UsersTab") return;
    let isMounted = true;

    const restoreSession = async () => {
      setHasLoadError(false);

      try {
        const token = await getStoredToken();
        if (!token) {
          if (isMounted && pathnameRef.current === "/UsersTab") {
            setDestination("/Auth/login");
          }
          return;
        }

        const role = await getStoredRole();
        const route = getDashboardRoute(role) ?? "/Auth/login";
        if (isMounted && pathnameRef.current === "/UsersTab") {
          setDestination(route);
        }
      } catch (error) {
        console.error("Failed to restore the saved login session:", error);
        if (isMounted && pathnameRef.current === "/UsersTab") {
          setHasLoadError(true);
        }
      }
    };

    void restoreSession();
    return () => {
      isMounted = false;
    };
  }, [pathname, retryCount]);

  if (pathname !== "/UsersTab") return null;

  if (destination) {
    return <Redirect href={destination} />;
  }

  return (
    <SafeAreaView className="flex-1 items-center justify-center bg-brand-surface-app px-8">
      {hasLoadError ? (
        <View className="items-center">
          <Text className="text-center text-base font-semibold text-slate-800">
            We couldn’t restore your session.
          </Text>
          <Pressable
            accessibilityRole="button"
            className="mt-4 rounded-xl bg-brand-green-muted-pale px-5 py-3"
            onPress={() => setRetryCount((count) => count + 1)}
          >
            <Text className="font-semibold text-white">Try again</Text>
          </Pressable>
        </View>
      ) : (
        <ActivityIndicator accessibilityLabel="Restoring session" color={colors["green-muted-pale"]} />
      )}
    </SafeAreaView>
  );
}
