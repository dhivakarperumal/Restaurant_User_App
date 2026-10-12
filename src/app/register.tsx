import { useState } from "react";
import { router } from "expo-router";
import { Check, Eye, EyeOff, LockKeyhole, Mail, Phone, UserRound } from "lucide-react-native";
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
import { registerUser } from "../lib/api";
import { getDashboardRoute } from "../lib/auth";

type RegistrationField = "name" | "email" | "phone" | "password" | "confirmPassword";
type RegistrationErrors = Partial<Record<RegistrationField, string>>;

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function RegisterScreen() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<RegistrationErrors>({});
  const [errorMessage, setErrorMessage] = useState("");
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isConfirmPasswordVisible, setIsConfirmPasswordVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRegistered, setIsRegistered] = useState(false);

  const updateField = (field: RegistrationField, value: string) => {
    const setters = {
      name: setName,
      email: setEmail,
      phone: setPhone,
      password: setPassword,
      confirmPassword: setConfirmPassword,
    };
    setters[field](value);
    setErrors((current) => ({ ...current, [field]: undefined }));
    setErrorMessage("");
  };

  const validate = (): RegistrationErrors => {
    const nextErrors: RegistrationErrors = {};
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    const trimmedPhone = phone.trim();

    if (!trimmedName) nextErrors.name = "Enter your full name.";
    else if (trimmedName.length > 100) nextErrors.name = "Name must be 100 characters or fewer.";
    if (!trimmedEmail) nextErrors.email = "Enter your email address.";
    else if (!emailPattern.test(trimmedEmail)) nextErrors.email = "Enter a valid email address.";
    if (!trimmedPhone) nextErrors.phone = "Enter your phone number.";
    else if (trimmedPhone.length > 32) nextErrors.phone = "Phone number must be 32 characters or fewer.";
    if (!password) nextErrors.password = "Create a password.";
    else if (password.length < 6) nextErrors.password = "Password must be at least 6 characters.";
    if (!confirmPassword) nextErrors.confirmPassword = "Confirm your password.";
    else if (password !== confirmPassword) nextErrors.confirmPassword = "Passwords do not match.";

    return nextErrors;
  };

  const handleRegister = async () => {
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setErrors({});
    setErrorMessage("");
    setIsSubmitting(true);

    try {
      const result = await registerUser({
        username: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        password,
      });

      if (result.token && result.user) {
        router.replace(getDashboardRoute(result.user.role) ?? "/home");
      } else {
        setIsRegistered(true);
      }
    } catch (error) {
      const message =
        typeof error === "object" && error !== null && "message" in error
          ? String(error.message)
          : "Unable to create your account. Please try again.";
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isRegistered) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-[#F7F8F3] px-6">
        <View className="w-full max-w-[440px] items-center rounded-3xl bg-white p-7 shadow-sm">
          <View className="h-16 w-16 items-center justify-center rounded-full bg-emerald-50">
            <Check color="#16803C" size={32} />
          </View>
          <Text className="mt-5 text-center text-2xl font-bold text-slate-900">
            Account created
          </Text>
          <Text className="mt-2 text-center text-sm leading-5 text-slate-500">
            Your account is ready. Sign in to start exploring the menu.
          </Text>
          <Pressable
            accessibilityRole="button"
            className="mt-6 min-h-14 w-full items-center justify-center rounded-xl bg-[#1A6A3B] px-5"
            onPress={() => router.replace("/login")}
          >
            <Text className="text-base font-semibold text-white">Go to sign in</Text>
          </Pressable>
        </View>
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
          showsVerticalScrollIndicator={false}
        >
          <View className="w-full self-center" style={{ maxWidth: 440 }}>
            <View className="mb-7 items-center">
              <Image
                accessible
                accessibilityLabel="Buy Food restaurant logo"
                className="mb-4 h-24 w-24"
                resizeMode="contain"
                source={require("../../assets/images/adminlogo.png")}
              />
              <Text className="text-3xl font-bold text-slate-900">Create account</Text>
              <Text className="mt-2 text-center text-sm text-slate-500">
                Join Buy Foods for fresh food and easy ordering.
              </Text>
            </View>

            <View className="rounded-3xl bg-white p-6 shadow-sm">
              <FormField
                error={errors.name}
                icon={<UserRound color="#64748B" size={18} />}
                label="Full name"
              >
                <TextInput
                  accessibilityLabel="Full name"
                  autoCapitalize="words"
                  autoComplete="name"
                  className="flex-1 py-4 text-base text-slate-900"
                  onChangeText={(value) => updateField("name", value)}
                  placeholder="Enter your full name"
                  placeholderTextColor="#94A3B8"
                  returnKeyType="next"
                  textContentType="name"
                  value={name}
                />
              </FormField>

              <FormField
                error={errors.email}
                icon={<Mail color="#64748B" size={18} />}
                label="Email address"
              >
                <TextInput
                  accessibilityLabel="Email address"
                  autoCapitalize="none"
                  autoComplete="email"
                  autoCorrect={false}
                  className="flex-1 py-4 text-base text-slate-900"
                  keyboardType="email-address"
                  onChangeText={(value) => updateField("email", value)}
                  placeholder="you@example.com"
                  placeholderTextColor="#94A3B8"
                  returnKeyType="next"
                  textContentType="emailAddress"
                  value={email}
                />
              </FormField>

              <FormField
                error={errors.phone}
                icon={<Phone color="#64748B" size={18} />}
                label="Phone number"
              >
                <TextInput
                  accessibilityLabel="Phone number"
                  autoComplete="tel"
                  className="flex-1 py-4 text-base text-slate-900"
                  keyboardType="phone-pad"
                  onChangeText={(value) => updateField("phone", value)}
                  placeholder="Enter your phone number"
                  placeholderTextColor="#94A3B8"
                  returnKeyType="next"
                  textContentType="telephoneNumber"
                  value={phone}
                />
              </FormField>

              <FormField
                error={errors.password}
                icon={<LockKeyhole color="#64748B" size={18} />}
                label="Password"
              >
                <TextInput
                  accessibilityLabel="Password"
                  autoCapitalize="none"
                  autoComplete="new-password"
                  className="flex-1 py-4 text-base text-slate-900"
                  onChangeText={(value) => updateField("password", value)}
                  placeholder="At least 6 characters"
                  placeholderTextColor="#94A3B8"
                  returnKeyType="next"
                  secureTextEntry={!isPasswordVisible}
                  textContentType="newPassword"
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
              </FormField>

              <FormField
                error={errors.confirmPassword}
                icon={<LockKeyhole color="#64748B" size={18} />}
                label="Confirm password"
              >
                <TextInput
                  accessibilityLabel="Confirm password"
                  autoCapitalize="none"
                  autoComplete="new-password"
                  className="flex-1 py-4 text-base text-slate-900"
                  onChangeText={(value) => updateField("confirmPassword", value)}
                  onSubmitEditing={handleRegister}
                  placeholder="Re-enter your password"
                  placeholderTextColor="#94A3B8"
                  returnKeyType="go"
                  secureTextEntry={!isConfirmPasswordVisible}
                  textContentType="newPassword"
                  value={confirmPassword}
                />
                <Pressable
                  accessibilityLabel={
                    isConfirmPasswordVisible ? "Hide confirm password" : "Show confirm password"
                  }
                  accessibilityRole="button"
                  hitSlop={10}
                  onPress={() => setIsConfirmPasswordVisible((visible) => !visible)}
                >
                  {isConfirmPasswordVisible ? (
                    <EyeOff color="#64748B" size={20} />
                  ) : (
                    <Eye color="#64748B" size={20} />
                  )}
                </Pressable>
              </FormField>

              {errorMessage ? (
                <Text accessibilityRole="alert" className="mb-3 text-sm text-red-600">
                  {errorMessage}
                </Text>
              ) : null}

              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: isSubmitting }}
                className={`mt-2 min-h-14 flex-row items-center justify-center rounded-xl bg-[#1A6A3B] px-5 ${
                  isSubmitting ? "opacity-70" : "active:opacity-80"
                }`}
                disabled={isSubmitting}
                onPress={handleRegister}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text className="text-base font-semibold text-white">Create account</Text>
                )}
              </Pressable>
            </View>

            <Text className="mt-6 text-center text-sm text-slate-500">
              Already have an account?{" "}
              <Text
                accessibilityRole="link"
                className="font-semibold text-[#1A6A3B]"
                onPress={() => router.replace("/login")}
              >
                Sign in
              </Text>
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function FormField({
  children,
  error,
  icon,
  label,
}: {
  children: React.ReactNode;
  error?: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <View className="mb-4">
      <Text className="mb-2 text-sm font-semibold text-slate-700">{label}</Text>
      <View
        className={`flex-row items-center rounded-xl border bg-white px-4 ${
          error ? "border-red-400" : "border-slate-200"
        }`}
      >
        <View className="mr-3">{icon}</View>
        {children}
      </View>
      {error ? (
        <Text accessibilityRole="alert" className="mt-1 text-xs text-red-600">
          {error}
        </Text>
      ) : null}
    </View>
  );
}
