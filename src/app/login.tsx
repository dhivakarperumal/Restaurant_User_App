import { useEffect, useState } from "react";
import { router } from "expo-router";
import { Eye, EyeOff } from "lucide-react-native";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  getApiErrorMessage,
  getStoredRole,
  getStoredToken,
  isLoggedIn,
  loginWithIdentifier,
} from "../lib/api";
import { getDashboardRoute } from "../lib/auth";

export default function LoginScreen() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const checkExistingSession = async () => {
      try {
        const token = await getStoredToken();
        if (token) {
          const role = await getStoredRole();
          const target = getDashboardRoute(role) ?? "/home";
          if (isMounted) {
            router.replace(target);
            return;
          }
        }
      } catch (error) {
        console.error("Failed to check existing session on login screen:", error);
      } finally {
        if (isMounted) {
          setIsCheckingSession(false);
        }
      }
    };

    void checkExistingSession();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleLogin = async () => {
    const trimmedIdentifier = identifier.trim();

    if (!trimmedIdentifier || !password) {
      setErrorMessage("Enter your email or phone number and password.");
      return;
    }

    setErrorMessage("");
    setIsSubmitting(true);

    try {
      const result = await loginWithIdentifier(trimmedIdentifier, password);
      const role = result.user?.role ?? result.role;
      const dashboardRoute = getDashboardRoute(role);

      if (dashboardRoute) {
        router.replace(dashboardRoute);
      } else {
        if (await isLoggedIn()) {
          router.replace("/home");
        } else {
          setErrorMessage(
            role
              ? "This account type is not supported in the app."
              : "We couldn't identify your account type. Please try again or contact support.",
          );
        }
      }
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, "Unable to sign in. Please try again."));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isCheckingSession) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-[#F7F8F3]">
        <ActivityIndicator accessibilityLabel="Checking session" color="#8EA66B" size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-[#F7F8F3]">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 24 }}
          keyboardShouldPersistTaps="handled"
        >
          <View className="w-full self-center" style={{ maxWidth: 440 }}>
            <View className="mb-10 items-center">
              <Image
                accessible
                accessibilityLabel="Buy Food restaurant logo"
                className="mb-5 h-32 w-32"
                resizeMode="contain"
                source={require("../../assets/images/adminlogo.png")}
              />
              <Text className="text-3xl font-bold text-slate-900">Welcome back</Text>
              <Text className="mt-2 text-center text-base text-slate-500">
                Sign in to find something delicious.
              </Text>
            </View>

            <View className="rounded-3xl bg-white p-6 shadow-sm">
              <Text className="mb-2 text-sm font-semibold text-slate-700">
                Email or phone number
              </Text>
              <TextInput
                accessibilityLabel="Email or phone number"
                autoCapitalize="none"
                autoComplete="username"
                autoCorrect={false}
                className="mb-5 rounded-xl border border-slate-200 bg-white px-4 py-4 text-base text-slate-900"
                keyboardType="email-address"
                onChangeText={setIdentifier}
                onSubmitEditing={handleLogin}
                placeholder="you@example.com"
                placeholderTextColor="#94A3B8"
                returnKeyType="next"
                textContentType="username"
                value={identifier}
              />

              <Text className="mb-2 text-sm font-semibold text-slate-700">Password</Text>
              <View className="mb-4 flex-row items-center rounded-xl border border-slate-200 bg-white pr-4">
                <TextInput
                  accessibilityLabel="Password"
                  autoCapitalize="none"
                  autoComplete="password"
                  className="flex-1 px-4 py-4 text-base text-slate-900"
                  onChangeText={setPassword}
                  onSubmitEditing={handleLogin}
                  placeholder="Enter your password"
                  placeholderTextColor="#94A3B8"
                  returnKeyType="go"
                  secureTextEntry={!isPasswordVisible}
                  textContentType="password"
                  value={password}
                />
                <Pressable
                  accessibilityLabel={isPasswordVisible ? "Hide password" : "Show password"}
                  accessibilityRole="button"
                  hitSlop={10}
                  onPress={() => setIsPasswordVisible((visible) => !visible)}
                >
                  {isPasswordVisible ? (
                    <EyeOff color="#64748B" size={20} />
                  ) : (
                    <Eye color="#64748B" size={20} />
                  )}
                </Pressable>
              </View>

              {errorMessage ? (
                <Text accessibilityRole="alert" className="mb-4 text-sm text-red-600">
                  {errorMessage}
                </Text>
              ) : null}

              <Pressable
                accessibilityRole="button"
                className={`mt-2 min-h-14 flex-row items-center justify-center rounded-xl bg-[#8EA66B] px-5 ${
                  isSubmitting ? "opacity-70" : "active:opacity-80"
                }`}
                disabled={isSubmitting}
                onPress={handleLogin}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text className="text-base font-semibold text-white">Sign in</Text>
                )}
              </Pressable>
            </View>

            <Text className="mt-7 text-center text-sm text-slate-500">
              New to Buy Foods?{" "}
              <Text
                accessibilityRole="link"
                className="font-semibold text-[#1A6A3B]"
                onPress={() => router.push("/register")}
              >
                Create an account
              </Text>
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
