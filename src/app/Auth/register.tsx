import { useState } from "react";
import { router } from "expo-router";
import {
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  Phone,
  UserRound,
} from "lucide-react-native";
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
import { registerUser } from "../../lib/api";
import { getDashboardRoute } from "../../lib/auth";

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
        router.replace(getDashboardRoute(result.user.role) ?? "/UsersTab/home");
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
      <SafeAreaView className="flex-1 items-center justify-center bg-[#F6F5E9] px-6">
        <View className="w-full max-w-[440px] items-center rounded-[30px] border border-white/80 bg-white/95 p-7 shadow-xl shadow-[#173B27]/10">
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
            className="mt-6 min-h-[60px] w-full flex-row items-center justify-center rounded-full bg-[#17663D] px-5"
            onPress={() => router.replace("/Auth/login")}
          >
            <Text className="text-base font-extrabold text-white">Go to sign in</Text>
            <ArrowRight color="#FFFFFF" size={20} strokeWidth={2.5} style={{ marginLeft: 8 }} />
          </Pressable>
        </View>
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
          source={require("../../../assets/images/login1.png")}
        />
        <Image
          accessible={false}
          className="absolute right-0 -top-2 h-44 w-36"
          resizeMode="contain"
          source={require("../../../assets/images/login2.png")}
        />
        <Image
          accessible={false}
          className="absolute bottom-0 left-0 h-40 w-40"
          resizeMode="contain"
          source={require("../../../assets/images/login4.png")}
        />
        <Image
          accessible={false}
          className="absolute bottom-0 right-0 h-40 w-40"
          resizeMode="contain"
          source={require("../../../assets/images/login5.png")}
        />
      </View>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: "center",
            paddingHorizontal: 24,
            paddingVertical: 24,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View className="w-full self-center" style={{ maxWidth: 480 }}>
            <View className="mb-5 items-center">
              <Image
                accessible
                accessibilityLabel="Buy Food restaurant logo"
                className="h-[68px] w-[68px] rounded-full"
                resizeMode="contain"
                source={require("../../../assets/images/logo.png")}
              />
              <Text className="mt-1 text-[24px] font-black tracking-tight text-[#145333]">
                Buy Food
              </Text>
              <Text className="mt-1 text-[10px] font-bold uppercase tracking-[4px] text-[#397653]">
                Good food · Good mood
              </Text>
              <Text className="mt-4 text-center text-[32px] font-black leading-[36px] text-[#102D20]">
                Create Your Account
              </Text>
              <Text className="mt-1 max-w-[330px] text-center text-base leading-6 text-[#62655F]">
                Join us and explore delicious food, special offers and more!
              </Text>
            </View>

            <View className="rounded-[30px] border border-white/80 bg-white/95 p-4 shadow-xl shadow-[#173B27]/10">
              <FormField
                error={errors.name}
                icon={<UserRound color="#145333" size={22} />}
              >
                <TextInput
                  accessibilityLabel="Full name"
                  autoCapitalize="words"
                  autoComplete="name"
                  className="ml-3 min-h-[62px] flex-1 py-3 text-base text-slate-900"
                  onChangeText={(value) => updateField("name", value)}
                  placeholder="Enter your full name"
                  placeholderTextColor="#92978F"
                  returnKeyType="next"
                  textContentType="name"
                  value={name}
                />
              </FormField>

              <FormField
                error={errors.email}
                icon={<Mail color="#145333" size={22} />}
              >
                <TextInput
                  accessibilityLabel="Email address"
                  autoCapitalize="none"
                  autoComplete="email"
                  autoCorrect={false}
                  className="ml-3 min-h-[62px] flex-1 py-3 text-base text-slate-900"
                  keyboardType="email-address"
                  onChangeText={(value) => updateField("email", value)}
                  placeholder="you@example.com"
                  placeholderTextColor="#92978F"
                  returnKeyType="next"
                  textContentType="emailAddress"
                  value={email}
                />
              </FormField>

              <FormField
                error={errors.phone}
                icon={<Phone color="#145333" size={22} />}
              >
                <TextInput
                  accessibilityLabel="Phone number"
                  autoComplete="tel"
                  className="ml-3 min-h-[62px] flex-1 py-3 text-base text-slate-900"
                  keyboardType="phone-pad"
                  onChangeText={(value) => updateField("phone", value)}
                  placeholder="Enter your phone number"
                  placeholderTextColor="#92978F"
                  returnKeyType="next"
                  textContentType="telephoneNumber"
                  value={phone}
                />
              </FormField>

              <FormField
                error={errors.password}
                icon={<LockKeyhole color="#145333" size={22} />}
              >
                <TextInput
                  accessibilityLabel="Password"
                  autoCapitalize="none"
                  autoComplete="new-password"
                  className="ml-3 min-h-[62px] flex-1 py-3 text-base text-slate-900"
                  onChangeText={(value) => updateField("password", value)}
                  placeholder="At least 6 characters"
                  placeholderTextColor="#92978F"
                  returnKeyType="next"
                  secureTextEntry={!isPasswordVisible}
                  textContentType="newPassword"
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
              </FormField>

              <FormField
                error={errors.confirmPassword}
                icon={<LockKeyhole color="#145333" size={22} />}
              >
                <TextInput
                  accessibilityLabel="Confirm password"
                  autoCapitalize="none"
                  autoComplete="new-password"
                  className="ml-3 min-h-[62px] flex-1 py-3 text-base text-slate-900"
                  onChangeText={(value) => updateField("confirmPassword", value)}
                  onSubmitEditing={handleRegister}
                  placeholder="Re-enter your password"
                  placeholderTextColor="#92978F"
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
                  className="h-11 w-9 items-center justify-center"
                  hitSlop={8}
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
                <Text accessibilityRole="alert" className="mb-3 px-1 text-sm font-medium text-red-600">
                  {errorMessage}
                </Text>
              ) : null}

              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: isSubmitting }}
                className={`mt-1 min-h-[60px] flex-row items-center justify-center rounded-full bg-[#17663D] px-5 shadow-lg shadow-[#145333]/20 ${
                  isSubmitting ? "opacity-70" : "active:opacity-80"
                }`}
                disabled={isSubmitting}
                onPress={handleRegister}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Text className="text-base font-extrabold text-white">Create Account</Text>
                    <ArrowRight color="#FFFFFF" size={21} strokeWidth={2.5} style={{ marginLeft: 9 }} />
                  </>
                )}
              </Pressable>
            </View>

            <View className="mt-5 flex-row flex-wrap items-center justify-center">
              <Text className="text-sm text-[#62655F]">Already have an account?</Text>
              <Pressable
                accessibilityRole="link"
                className="min-h-11 flex-row items-center justify-center px-2"
                onPress={() => router.replace("/Auth/login")}
              >
                <Text className="text-base font-extrabold text-[#145333]">Sign in</Text>
                <ArrowRight color="#145333" size={17} strokeWidth={2.5} style={{ marginLeft: 5 }} />
              </Pressable>
            </View>
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
}: {
  children: React.ReactNode;
  error?: string;
  icon: React.ReactNode;
}) {
  return (
    <View className="mb-3">
      <View
        className={`min-h-[62px] flex-row items-center rounded-2xl px-4 ${
          error ? "border border-red-400 bg-red-50" : "bg-[#F0F4E9]"
        }`}
      >
        {icon}
        <View className="min-w-0 flex-1 flex-row items-center">{children}</View>
      </View>
      {error ? (
        <Text accessibilityRole="alert" className="mt-1 text-xs text-red-600">
          {error}
        </Text>
      ) : null}
    </View>
  );
}
