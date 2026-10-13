import { useEffect, useState } from "react";
import { router } from "expo-router";
import { ArrowRight, Eye, EyeOff, LockKeyhole, UserRound } from "lucide-react-native";
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
    <SafeAreaView className="flex-1 bg-[#F6F5E9]">
      <View pointerEvents="none" className="absolute inset-0 overflow-hidden">
        <View className="absolute -left-20 -top-24 h-64 w-64 rounded-full bg-[#174D32]" />
        <View className="absolute -right-24 -top-28 h-56 w-56 rounded-full bg-[#DDE8C7]" />
        <View className="absolute -bottom-28 -right-20 h-64 w-64 rounded-full bg-[#174D32]" />
        <View className="absolute -bottom-16 -left-16 h-40 w-40 rounded-full bg-[#E6EBCF]" />
      </View>
      <View pointerEvents="none" className="absolute inset-0 overflow-hidden">
        <Image
          accessible={false}
          className="absolute -left-7 -top-6 h-44 w-36"
          resizeMode="contain"
          source={require("../../assets/images/login1.png")}
        />
        <Image
          accessible={false}
          className="absolute -right-7 -top-7 h-44 w-36"
          resizeMode="contain"
          source={require("../../assets/images/login2.png")}
        />
        <Image
          accessible={false}
          className="absolute -bottom-6 -left-7 h-40 w-40"
          resizeMode="contain"
          source={require("../../assets/images/login1.png")}
        />
        <Image
          accessible={false}
          className="absolute -bottom-6 -right-7 h-40 w-40"
          resizeMode="contain"
          source={require("../../assets/images/login1.png")}
        />
      </View>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: "center", paddingHorizontal: 24, paddingVertical: 28 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View className="w-full self-center" style={{ maxWidth: 480 }}>
            <View className="mb-6 items-center">
              <Image
                accessible
                accessibilityLabel="Buy Food restaurant logo"
                className="h-[76px] w-[76px] rounded-full"
                resizeMode="contain"
                source={require("../../assets/images/adminlogo.png")}
              />
              <Text className="mt-1 text-[25px] font-black tracking-tight text-[#145333]">
                Buy Foods
              </Text>
              <Text className="mt-1 text-[10px] font-bold uppercase tracking-[4px] text-[#397653]">
                Good food · Good mood
              </Text>
              <Text className="mt-5 text-center text-[34px] font-black leading-[40px] text-[#102D20]">
                Welcome Back
              </Text>
              <Text className="mt-1 max-w-[320px] text-center text-base leading-6 text-[#62655F]">
                Sign in to enjoy your favourite food, anytime, anywhere.
              </Text>
            </View>

            <View className="rounded-[30px] border border-white/80 bg-white/95 p-5 shadow-xl shadow-[#173B27]/10">
              <View className="mb-3 flex-row items-center rounded-2xl bg-[#F0F4E9] px-4">
                <UserRound color="#35433B" size={21} />
                <TextInput
                  accessibilityLabel="Email or phone number"
                  autoCapitalize="none"
                  autoComplete="username"
                  autoCorrect={false}
                  className="ml-3 min-h-[62px] flex-1 py-3 text-base text-slate-900"
                  keyboardType="email-address"
                  onChangeText={setIdentifier}
                  onSubmitEditing={handleLogin}
                  placeholder="Email or phone number"
                  placeholderTextColor="#858A83"
                  returnKeyType="next"
                  textContentType="username"
                  value={identifier}
                />
              </View>

              <View className="mb-4 flex-row items-center rounded-2xl bg-[#F0F4E9] px-4">
                <LockKeyhole color="#35433B" size={21} />
                <TextInput
                  accessibilityLabel="Password"
                  autoCapitalize="none"
                  autoComplete="password"
                  className="ml-3 min-h-[62px] flex-1 py-3 text-base text-slate-900"
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
                  className="h-11 w-9 items-center justify-center"
                  hitSlop={8}
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
                <Text accessibilityRole="alert" className="mb-4 px-1 text-sm font-medium text-red-600">
                  {errorMessage}
                </Text>
              ) : null}

              <Pressable
                accessibilityRole="button"
                className={`min-h-[62px] flex-row items-center justify-center rounded-full bg-[#17663D] px-5 shadow-lg shadow-[#145333]/20 ${
                  isSubmitting ? "opacity-70" : "active:opacity-80"
                }`}
                disabled={isSubmitting}
                onPress={handleLogin}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Text className="text-lg font-extrabold text-white">Sign in</Text>
                    <ArrowRight color="#FFFFFF" size={23} strokeWidth={2.5} style={{ marginLeft: 12 }} />
                  </>
                )}
              </Pressable>
            </View>

            <View className="mt-6 items-center">
              <Text className="text-base text-[#62655F]">New to Buy Foods?</Text>
              <Pressable
                accessibilityRole="link"
                className="mt-1 min-h-11 flex-row items-center justify-center px-3"
                onPress={() => router.push("/register")}
              >
                <Text className="text-lg font-extrabold text-[#145333]">Create an account</Text>
                <ArrowRight color="#145333" size={19} strokeWidth={2.5} style={{ marginLeft: 7 }} />
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
