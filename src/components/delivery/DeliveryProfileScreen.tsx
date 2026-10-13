import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  Bike,
  CheckCircle2,
  LockKeyhole,
  LogOut,
  Mail,
  MapPin,
  Phone,
  RefreshCw,
  ShieldCheck,
  UserRound,
  WalletCards,
  X,
} from "lucide-react-native";
import { useCustomAlert } from "../../contexts/CustomAlertContext";
import api, { getApiErrorMessage, getStoredUser } from "../../lib/api";
import { confirmLogout } from "../../lib/logout";

type ProfileData = Record<string, unknown>;
type ProfileForm = {
  full_name: string;
  phone_number: string;
  email: string;
  address: string;
  vehicle_type: string;
  vehicle_number: string;
};
type PasswordForm = {
  current_password: string;
  new_password: string;
  confirm_password: string;
};
type BankForm = {
  account_holder_name: string;
  bank_name: string;
  account_number: string;
  ifsc_code: string;
  upi_id: string;
};

const EMPTY_PROFILE_FORM: ProfileForm = {
  full_name: "",
  phone_number: "",
  email: "",
  address: "",
  vehicle_type: "",
  vehicle_number: "",
};
const EMPTY_PASSWORD_FORM: PasswordForm = {
  current_password: "",
  new_password: "",
  confirm_password: "",
};
const EMPTY_BANK_FORM: BankForm = {
  account_holder_name: "",
  bank_name: "",
  account_number: "",
  ifsc_code: "",
  upi_id: "",
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function firstText(record: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" || typeof value === "number") {
      const normalized = String(value).trim();
      if (normalized) return normalized;
    }
  }
  return "";
}

function extractProfile(value: unknown): ProfileData {
  const root = asRecord(value);
  const payload = asRecord(root?.data) ?? root;
  const resource = asRecord(payload?.profile) ?? asRecord(payload?.partner) ?? payload;
  if (!resource) throw new Error("The profile response was invalid.");
  return resource;
}

function getImageUri(profile: ProfileData): string {
  return firstText(profile, ["profile_photo_url", "photo_url", "avatar_url"]);
}

function getProfileForm(profile: ProfileData, user: ProfileData): ProfileForm {
  return {
    full_name:
      firstText(profile, ["full_name", "name", "username"]) ||
      firstText(user, ["displayName", "name", "full_name", "username"]),
    phone_number:
      firstText(profile, ["phone_number", "phone", "mobile"]) ||
      firstText(user, ["phone", "phone_number", "mobile"]),
    email:
      firstText(profile, ["email", "email_address"]) ||
      firstText(user, ["email", "email_address"]),
    address: firstText(profile, ["address", "street_address"]),
    vehicle_type: firstText(profile, ["vehicle_type", "vehicle"]),
    vehicle_number: firstText(profile, ["vehicle_number", "registration_number"]),
  };
}

function ProfileField({
  label,
  value,
  Icon,
}: {
  label: string;
  value: string;
  Icon: typeof UserRound;
}) {
  return (
    <View className="min-h-[72px] flex-row items-center border-b border-[#EEF0EC] py-3">
      <View className="mr-3 h-9 w-9 items-center justify-center rounded-xl bg-[#EEF5EB]">
        <Icon color="#39754A" size={17} />
      </View>
      <View className="flex-1">
        <Text className="text-[10px] font-semibold text-slate-400">{label}</Text>
        <Text className="mt-1 text-sm font-semibold text-[#26352B]">
          {value || "Not provided"}
        </Text>
      </View>
    </View>
  );
}

function AccountField({
  label,
  value,
  onChangeText,
  secureTextEntry = false,
  keyboardType,
  autoCapitalize,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  secureTextEntry?: boolean;
  keyboardType?: "default" | "email-address" | "phone-pad" | "numeric";
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
}) {
  return (
    <View className="mb-3">
      <Text className="mb-1.5 text-xs font-bold text-[#536057]">{label}</Text>
      <TextInput
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        className="min-h-12 rounded-xl border border-[#E1E8E1] bg-white px-3 text-sm text-[#17251E]"
        keyboardType={keyboardType}
        onChangeText={onChangeText}
        placeholder={label}
        placeholderTextColor="#98A199"
        secureTextEntry={secureTextEntry}
        value={value}
      />
    </View>
  );
}

function ScreenDialog({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible>
      <View className="flex-1 justify-end bg-black/45">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Close ${title.toLowerCase()}`}
          className="absolute inset-0"
          onPress={onClose}
        />
        <View className="max-h-[90%] rounded-t-[28px] bg-[#FFFCF6] px-5 pb-8 pt-4">
          <View className="mb-4 h-1.5 w-12 self-center rounded-full bg-[#DED8CE]" />
          <View className="mb-4 flex-row items-center justify-between">
            <Text className="text-lg font-black text-[#17251E]">{title}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Close ${title.toLowerCase()}`}
              className="h-10 w-10 items-center justify-center rounded-full bg-[#F1F3EE]"
              onPress={onClose}
            >
              <X color="#53645A" size={18} />
            </Pressable>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export default function DeliveryProfileScreen() {
  const { showAlert } = useCustomAlert();
  const [profile, setProfile] = useState<ProfileData>({});
  const [storedUser, setStoredUser] = useState<ProfileData>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");
  const [editing, setEditing] = useState(false);
  const [profileForm, setProfileForm] = useState<ProfileForm>(EMPTY_PROFILE_FORM);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [showBankDialog, setShowBankDialog] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [bankForm, setBankForm] = useState<BankForm>(EMPTY_BANK_FORM);
  const [passwordForm, setPasswordForm] = useState<PasswordForm>(EMPTY_PASSWORD_FORM);
  const [isSavingBank, setIsSavingBank] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    let active = true;
    getStoredUser()
      .then((user) => {
        if (active) setStoredUser(asRecord(user) ?? {});
      })
      .catch((error: unknown) => {
        console.error("Failed to load stored delivery partner account:", error);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    const loadProfile = async () => {
      try {
        const response = await api.get("/delivery-partner/profile");
        const result = extractProfile(response.data);
        if (!active) return;
        setProfile(result);
        setErrorMessage("");
      } catch (error: unknown) {
        console.error("Failed to load delivery partner profile:", error);
        if (active) {
          setErrorMessage(
            getApiErrorMessage(error, "Your profile is temporarily unavailable."),
          );
        }
      } finally {
        if (active) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    };

    void loadProfile();
    return () => {
      active = false;
    };
  }, [refreshVersion]);

  const refresh = useCallback(() => {
    if (loading || refreshing) return;
    setRefreshing(true);
    setRefreshVersion((current) => current + 1);
  }, [loading, refreshing]);

  const displayForm = useMemo(
    () => getProfileForm(profile, storedUser),
    [profile, storedUser],
  );
  const displayName =
    firstText(profile, ["full_name", "name", "username"]) ||
    displayForm.full_name ||
    "Delivery Partner";
  const accountStatus = firstText(profile, ["account_status", "status"]) || "Account details";
  const profileImage = getImageUri(profile);
  const bankLastFour = firstText(profile, ["bank_account_last4", "account_last_four"]);

  const startEditing = () => {
    setProfileForm(getProfileForm(profile, storedUser));
    setEditing(true);
  };

  const saveProfile = async () => {
    if (!profileForm.full_name.trim()) {
      showAlert({
        title: "Name is required",
        message: "Enter your full name before saving your profile.",
        variant: "error",
      });
      return;
    }
    setIsSavingProfile(true);
    try {
      const payload: ProfileForm = {
        ...profileForm,
        full_name: profileForm.full_name.trim(),
        phone_number: profileForm.phone_number.trim(),
        email: profileForm.email.trim(),
        address: profileForm.address.trim(),
        vehicle_type: profileForm.vehicle_type.trim(),
        vehicle_number: profileForm.vehicle_number.trim(),
      };
      const response = await api.patch("/delivery-partner/profile", payload);
      const root = asRecord(response.data);
      const responsePayload = asRecord(root?.data) ?? root;
      const updatedProfile =
        asRecord(responsePayload?.profile) ??
        asRecord(responsePayload?.partner) ??
        responsePayload ??
        {};
      setProfile((current) => ({ ...current, ...updatedProfile, ...payload }));
      setEditing(false);
      showAlert({
        title: "Profile updated",
        message: "Your delivery partner details have been saved.",
        variant: "success",
      });
    } catch (error: unknown) {
      console.error("Failed to update delivery partner profile:", error);
      showAlert({
        title: "Profile update failed",
        message: getApiErrorMessage(error, "Your profile could not be updated."),
        variant: "error",
      });
    } finally {
      setIsSavingProfile(false);
    }
  };

  const saveBankDetails = async () => {
    const requiredValues = [
      bankForm.account_holder_name,
      bankForm.bank_name,
      bankForm.account_number,
      bankForm.ifsc_code,
    ];
    if (requiredValues.some((value) => !value.trim())) {
      showAlert({
        title: "Complete the required details",
        message: "Enter account holder, bank name, account number, and IFSC code.",
        variant: "error",
      });
      return;
    }
    setIsSavingBank(true);
    try {
      await api.patch("/delivery-partner/profile/bank", {
        ...bankForm,
        account_holder_name: bankForm.account_holder_name.trim(),
        bank_name: bankForm.bank_name.trim(),
        account_number: bankForm.account_number.trim(),
        ifsc_code: bankForm.ifsc_code.trim().toUpperCase(),
        upi_id: bankForm.upi_id.trim(),
      });
      setShowBankDialog(false);
      setBankForm(EMPTY_BANK_FORM);
      showAlert({
        title: "Bank details updated",
        message: "Your payout information was sent securely.",
        variant: "success",
      });
      refresh();
    } catch (error: unknown) {
      console.error("Failed to update delivery partner bank details:", error);
      showAlert({
        title: "Bank details not updated",
        message: getApiErrorMessage(error, "Please try again."),
        variant: "error",
      });
    } finally {
      setIsSavingBank(false);
    }
  };

  const savePassword = async () => {
    if (!passwordForm.current_password) {
      showAlert({
        title: "Current password required",
        message: "Enter your current password to continue.",
        variant: "error",
      });
      return;
    }
    if (passwordForm.new_password.length < 8) {
      showAlert({
        title: "Password is too short",
        message: "Your new password must be at least 8 characters.",
        variant: "error",
      });
      return;
    }
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      showAlert({
        title: "Passwords do not match",
        message: "Confirm the same new password before continuing.",
        variant: "error",
      });
      return;
    }
    setIsSavingPassword(true);
    try {
      await api.post("/delivery-partner/password", {
        current_password: passwordForm.current_password,
        new_password: passwordForm.new_password,
      });
      setShowPasswordDialog(false);
      setPasswordForm(EMPTY_PASSWORD_FORM);
      showAlert({
        title: "Password updated",
        message: "Your password has been changed.",
        variant: "success",
      });
    } catch (error: unknown) {
      console.error("Failed to change delivery partner password:", error);
      showAlert({
        title: "Password not updated",
        message: getApiErrorMessage(error, "Please try again."),
        variant: "error",
      });
    } finally {
      setIsSavingPassword(false);
    }
  };

  const initials = displayName.charAt(0).toUpperCase();

  return (
    <View className="flex-1 bg-[#F7F8F3]">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 28 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor="#17663D" />
        }
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View className="mb-5 flex-row items-center justify-between">
          <View className="mr-3 flex-1">
            <Text className="text-[10px] font-extrabold uppercase tracking-[1.6px] text-[#39754A]">
              Your account
            </Text>
            <Text className="mt-1 text-2xl font-black text-[#17251E]">Profile</Text>
            <Text className="mt-1 text-xs leading-5 text-slate-500">
              Personal and vehicle information for your delivery account.
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Refresh delivery profile"
            className="h-11 w-11 items-center justify-center rounded-xl border border-[#E1E8E1] bg-white"
            disabled={loading || refreshing}
            onPress={refresh}
          >
            {loading || refreshing ? (
              <ActivityIndicator color="#17663D" size="small" />
            ) : (
              <RefreshCw color="#53645A" size={18} />
            )}
          </Pressable>
        </View>

        {errorMessage ? (
          <View className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <Text className="text-sm font-extrabold text-amber-900">Profile unavailable</Text>
            <Text className="mt-1 text-sm leading-5 text-amber-800">{errorMessage}</Text>
            <Text className="mt-2 text-xs leading-5 text-amber-800">
              This profile is loaded from your delivery-partner account only.
            </Text>
            <Pressable
              accessibilityRole="button"
              className="mt-3 min-h-10 flex-row items-center self-start rounded-xl bg-[#17663D] px-4"
              onPress={refresh}
            >
              <RefreshCw color="#FFFFFF" size={15} />
              <Text className="ml-2 text-xs font-bold text-white">Try again</Text>
            </Pressable>
          </View>
        ) : null}

        {loading && !displayForm.full_name && !profileImage ? (
          <View className="mb-4 items-center rounded-2xl border border-[#E7EDE7] bg-white px-5 py-8">
            <ActivityIndicator color="#17663D" />
            <Text className="mt-3 text-xs font-semibold text-slate-500">
              Loading your profile…
            </Text>
          </View>
        ) : (
          <>
            <View className="mb-4 rounded-2xl border border-[#E1E8E1] bg-white p-4">
              <View className="flex-row items-center">
                <View className="mr-3 h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-[#E5F2E8]">
                  {profileImage ? (
                    <Image
                      accessibilityLabel={`${displayName} profile photo`}
                      className="h-14 w-14"
                      resizeMode="cover"
                      source={{ uri: profileImage }}
                    />
                  ) : (
                    <Text className="text-xl font-black text-[#23633A]">{initials}</Text>
                  )}
                </View>
                <View className="flex-1">
                  <Text className="text-base font-extrabold text-[#17251E]">{displayName}</Text>
                  <Text className="mt-1 text-xs text-slate-500">{accountStatus}</Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  className="min-h-10 justify-center rounded-xl border border-[#DCE6DE] px-3"
                  onPress={() => (editing ? setEditing(false) : startEditing())}
                >
                  <Text className="text-xs font-bold text-[#21643A]">
                    {editing ? "Cancel" : "Edit"}
                  </Text>
                </Pressable>
              </View>

              {editing ? (
                <View className="mt-5">
                  <AccountField
                    label="Full name"
                    value={profileForm.full_name}
                    onChangeText={(value) =>
                      setProfileForm((current) => ({ ...current, full_name: value }))
                    }
                    autoCapitalize="words"
                  />
                  <AccountField
                    label="Mobile number"
                    value={profileForm.phone_number}
                    onChangeText={(value) =>
                      setProfileForm((current) => ({ ...current, phone_number: value }))
                    }
                    keyboardType="phone-pad"
                  />
                  <AccountField
                    label="Email"
                    value={profileForm.email}
                    onChangeText={(value) =>
                      setProfileForm((current) => ({ ...current, email: value }))
                    }
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                  <AccountField
                    label="Address"
                    value={profileForm.address}
                    onChangeText={(value) =>
                      setProfileForm((current) => ({ ...current, address: value }))
                    }
                  />
                  <AccountField
                    label="Vehicle type"
                    value={profileForm.vehicle_type}
                    onChangeText={(value) =>
                      setProfileForm((current) => ({ ...current, vehicle_type: value }))
                    }
                  />
                  <AccountField
                    label="Vehicle number"
                    value={profileForm.vehicle_number}
                    onChangeText={(value) =>
                      setProfileForm((current) => ({ ...current, vehicle_number: value }))
                    }
                    autoCapitalize="characters"
                  />
                  <Pressable
                    accessibilityRole="button"
                    className="mt-1 min-h-12 flex-row items-center justify-center rounded-xl bg-[#17663D]"
                    disabled={isSavingProfile}
                    onPress={() => void saveProfile()}
                    style={{ opacity: isSavingProfile ? 0.7 : 1 }}
                  >
                    {isSavingProfile ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <>
                        <CheckCircle2 color="#FFFFFF" size={17} />
                        <Text className="ml-2 text-sm font-extrabold text-white">
                          Save profile
                        </Text>
                      </>
                    )}
                  </Pressable>
                </View>
              ) : (
                <View className="mt-3">
                  <ProfileField
                    label="Full name"
                    value={displayForm.full_name}
                    Icon={UserRound}
                  />
                  <ProfileField
                    label="Mobile number"
                    value={displayForm.phone_number}
                    Icon={Phone}
                  />
                  <ProfileField
                    label="Email"
                    value={displayForm.email}
                    Icon={Mail}
                  />
                  <ProfileField
                    label="Address"
                    value={displayForm.address}
                    Icon={MapPin}
                  />
                  <ProfileField
                    label="Vehicle type"
                    value={displayForm.vehicle_type}
                    Icon={Bike}
                  />
                  <ProfileField
                    label="Vehicle number"
                    value={displayForm.vehicle_number}
                    Icon={Bike}
                  />
                </View>
              )}
            </View>

            <View className="mb-4 rounded-2xl border border-[#E1E8E1] bg-white p-4">
              <View className="flex-row items-center">
                <View className="mr-3 h-9 w-9 items-center justify-center rounded-xl bg-[#EEF5EB]">
                  <ShieldCheck color="#39754A" size={18} />
                </View>
                <Text className="text-sm font-extrabold text-[#17251E]">Verification</Text>
              </View>
              <Text className="mt-3 text-xs leading-5 text-slate-600">
                Driving license and identity documents are kept private and are not displayed here.
              </Text>
              <Text className="mt-3 text-xs font-bold text-slate-500">
                Account status: {firstText(profile, ["account_status", "status"]) || "—"}
              </Text>
            </View>

            <View className="mb-4 rounded-2xl border border-[#E1E8E1] bg-white p-4">
              <View className="flex-row items-center">
                <View className="mr-3 h-9 w-9 items-center justify-center rounded-xl bg-[#EEF5EB]">
                  <WalletCards color="#39754A" size={18} />
                </View>
                <Text className="text-sm font-extrabold text-[#17251E]">Bank details</Text>
              </View>
              <Text className="mt-3 text-xs leading-5 text-slate-600">
                {bankLastFour
                  ? `Payout account ending in •••• ${bankLastFour}`
                  : "Bank details are securely stored."}
              </Text>
              <Pressable
                accessibilityRole="button"
                className="mt-3 min-h-10 flex-row items-center self-start rounded-xl bg-[#EEF5EB] px-3"
                onPress={() => {
                  setBankForm(EMPTY_BANK_FORM);
                  setShowBankDialog(true);
                }}
              >
                <LockKeyhole color="#17663D" size={15} />
                <Text className="ml-2 text-xs font-bold text-[#17663D]">
                  Update bank details
                </Text>
              </Pressable>
            </View>

            <Pressable
              accessibilityRole="button"
              className="mb-3 min-h-12 flex-row items-center rounded-2xl border border-[#E1E8E1] bg-white px-4"
              onPress={() => {
                setPasswordForm(EMPTY_PASSWORD_FORM);
                setShowPasswordDialog(true);
              }}
            >
              <LockKeyhole color="#53645A" size={18} />
              <Text className="ml-3 flex-1 text-sm font-bold text-[#39483F]">
                Change password
              </Text>
              <Text className="text-lg text-slate-400">›</Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              className="min-h-12 flex-row items-center rounded-2xl border border-rose-200 bg-white px-4"
              disabled={isLoggingOut}
              onPress={() => confirmLogout(showAlert, setIsLoggingOut)}
            >
              {isLoggingOut ? (
                <ActivityIndicator color="#B83E2E" />
              ) : (
                <>
                  <LogOut color="#B83E2E" size={18} />
                  <Text className="ml-3 flex-1 text-sm font-bold text-[#B83E2E]">Log out</Text>
                </>
              )}
            </Pressable>
          </>
        )}
      </ScrollView>

      {showBankDialog ? (
        <ScreenDialog title="Update bank details" onClose={() => setShowBankDialog(false)}>
          <View className="mb-4 flex-row items-start rounded-xl bg-[#EEF5EB] p-3">
            <LockKeyhole color="#39754A" size={16} />
            <Text className="ml-2 flex-1 text-xs leading-5 text-[#536057]">
              Account number is hidden while typing and sent only to the secure profile service.
            </Text>
          </View>
          <AccountField
            label="Account holder"
            value={bankForm.account_holder_name}
            onChangeText={(value) =>
              setBankForm((current) => ({ ...current, account_holder_name: value }))
            }
            autoCapitalize="words"
          />
          <AccountField
            label="Bank name"
            value={bankForm.bank_name}
            onChangeText={(value) =>
              setBankForm((current) => ({ ...current, bank_name: value }))
            }
            autoCapitalize="words"
          />
          <AccountField
            label="Account number"
            value={bankForm.account_number}
            onChangeText={(value) =>
              setBankForm((current) => ({ ...current, account_number: value }))
            }
            keyboardType="numeric"
            secureTextEntry
          />
          <AccountField
            label="IFSC code"
            value={bankForm.ifsc_code}
            onChangeText={(value) =>
              setBankForm((current) => ({ ...current, ifsc_code: value }))
            }
            autoCapitalize="characters"
          />
          <AccountField
            label="UPI ID (optional)"
            value={bankForm.upi_id}
            onChangeText={(value) =>
              setBankForm((current) => ({ ...current, upi_id: value }))
            }
            autoCapitalize="none"
          />
          <Pressable
            accessibilityRole="button"
            className="mt-1 min-h-12 flex-row items-center justify-center rounded-xl bg-[#17663D]"
            disabled={isSavingBank}
            onPress={() => void saveBankDetails()}
            style={{ opacity: isSavingBank ? 0.7 : 1 }}
          >
            {isSavingBank ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text className="text-sm font-extrabold text-white">Save securely</Text>
            )}
          </Pressable>
        </ScreenDialog>
      ) : null}

      {showPasswordDialog ? (
        <ScreenDialog title="Change password" onClose={() => setShowPasswordDialog(false)}>
          <AccountField
            label="Current password"
            value={passwordForm.current_password}
            onChangeText={(value) =>
              setPasswordForm((current) => ({ ...current, current_password: value }))
            }
            secureTextEntry
            autoCapitalize="none"
          />
          <AccountField
            label="New password"
            value={passwordForm.new_password}
            onChangeText={(value) =>
              setPasswordForm((current) => ({ ...current, new_password: value }))
            }
            secureTextEntry
            autoCapitalize="none"
          />
          <AccountField
            label="Confirm new password"
            value={passwordForm.confirm_password}
            onChangeText={(value) =>
              setPasswordForm((current) => ({ ...current, confirm_password: value }))
            }
            secureTextEntry
            autoCapitalize="none"
          />
          <Pressable
            accessibilityRole="button"
            className="mt-1 min-h-12 flex-row items-center justify-center rounded-xl bg-[#17663D]"
            disabled={isSavingPassword}
            onPress={() => void savePassword()}
            style={{ opacity: isSavingPassword ? 0.7 : 1 }}
          >
            {isSavingPassword ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text className="text-sm font-extrabold text-white">Update password</Text>
            )}
          </Pressable>
        </ScreenDialog>
      ) : null}
    </View>
  );
}
