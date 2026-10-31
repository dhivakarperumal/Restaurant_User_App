import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { useAuth } from "../contexts/AuthContext";
import { getDashboardRoute, type AuthRole } from "../lib/auth";

export default function RequireAuth({
  role,
  children,
}: {
  role: AuthRole;
  children: React.ReactNode;
}) {
  const { isLoading, isAuthenticated, userRole } = useAuth();

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-[#F3F4F3]">
        <ActivityIndicator accessibilityLabel="Restoring session" color="#17663D" />
      </View>
    );
  }

  if (!isAuthenticated || !userRole) {
    return <Redirect href="/Auth/login" />;
  }

  if (userRole !== role) {
    const dashboard = getDashboardRoute(userRole);
    return dashboard ? <Redirect href={dashboard} /> : <Redirect href="/Auth/login" />;
  }

  return children;
}
