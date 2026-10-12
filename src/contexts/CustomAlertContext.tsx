import {
  AlertCircle,
  CheckCircle2,
  Info,
  LogOut,
  TriangleAlert,
} from "lucide-react-native";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import {
  Modal,
  Pressable,
  Text,
  View,
} from "react-native";

export type AlertAction = {
  text: string;
  style?: "cancel" | "default" | "destructive";
  onPress?: () => void;
};

export type CustomAlertOptions = {
  title: string;
  message?: string;
  actions?: AlertAction[];
  variant?: "confirm" | "success" | "error" | "info";
};

type CustomAlertContextValue = {
  showAlert: (options: CustomAlertOptions) => void;
};

const CustomAlertContext = createContext<CustomAlertContextValue | null>(null);

const VARIANT_STYLES = {
  confirm: {
    Icon: TriangleAlert,
    iconColor: "#B7791F",
    iconBackground: "#FFF4D8",
    label: "PLEASE CONFIRM",
  },
  success: {
    Icon: CheckCircle2,
    iconColor: "#1A6A3B",
    iconBackground: "#EAF2E8",
    label: "ALL SET",
  },
  error: {
    Icon: AlertCircle,
    iconColor: "#1A6A3B",
    iconBackground: "#EAF2E8",
    label: "SOMETHING WENT WRONG",
  },
  info: {
    Icon: Info,
    iconColor: "#1A6A3B",
    iconBackground: "#EAF2E8",
    label: "A QUICK UPDATE",
  },
};

export function CustomAlertProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [alert, setAlert] = useState<CustomAlertOptions | null>(null);
  const showAlert = useCallback((options: CustomAlertOptions) => {
    setAlert(options);
  }, []);
  const contextValue = useMemo(() => ({ showAlert }), [showAlert]);
  const variant = alert?.variant ?? "info";
  const { Icon, iconColor, iconBackground, label } = VARIANT_STYLES[variant];
  const actions = alert?.actions?.length
    ? alert.actions
    : [{ text: "Got it", style: "default" as const }];

  const dismiss = () => setAlert(null);

  return (
    <CustomAlertContext.Provider value={contextValue}>
      {children}
      <Modal
        animationType="fade"
        onRequestClose={dismiss}
        transparent
        visible={alert !== null}
      >
        <View className="flex-1 items-center justify-center bg-black/50 px-6">
          <Pressable
            accessibilityLabel="Dismiss alert"
            className="absolute inset-0"
            onPress={dismiss}
          />
          <View
            accessibilityViewIsModal
            className="w-full max-w-[400px] overflow-hidden rounded-[28px] border border-[#F1EADF] bg-[#FFFCF6] px-6 pb-6 pt-7"
            style={{
              shadowColor: "#10271B",
              shadowOffset: { width: 0, height: 14 },
              shadowOpacity: 0.22,
              shadowRadius: 24,
              elevation: 18,
            }}
          >
            <View className="h-1.5 w-12 self-center rounded-full bg-[#E7E0D8]" />
            <View className="mt-6 h-14 w-14 items-center justify-center rounded-2xl" style={{ backgroundColor: iconBackground }}>
              <Icon color={iconColor} size={26} strokeWidth={2.2} />
            </View>
            <Text className="mt-5 text-[10px] font-extrabold tracking-[2px] text-[#8A8172]">
              {label}
            </Text>
            <Text className="mt-2 text-[23px] font-extrabold leading-7 text-[#183B2A]">
              {alert?.title}
            </Text>
            {alert?.message ? (
              <Text className="mt-2.5 text-[15px] leading-[22px] text-[#746F66]">
                {alert.message}
              </Text>
            ) : null}
            <View className="mt-7 flex-row gap-3">
              {actions.map((action, index) => {
                const isCancel = action.style === "cancel";
                const isDestructive = action.style === "destructive";
                const ButtonIcon =
                  isDestructive && action.text.toLowerCase().includes("log")
                    ? LogOut
                    : null;

                return (
                  <Pressable
                    accessibilityRole="button"
                    className={`min-h-[52px] flex-1 flex-row items-center justify-center rounded-2xl px-3 active:opacity-80 ${
                      isCancel
                        ? "border border-[#E7E0D8] bg-white"
                        : isDestructive
                          ? "bg-[#1A6A3B]"
                          : "bg-[#1A6A3B]"
                    }`}
                    key={`${action.text}-${index}`}
                    onPress={() => {
                      dismiss();
                      action.onPress?.();
                    }}
                  >
                    {ButtonIcon ? (
                      <ButtonIcon color="#FFFFFF" size={16} />
                    ) : null}
                    <Text
                      className={`text-sm font-bold ${
                        isCancel
                          ? "text-[#6E675D]"
                          : "text-white"
                      } ${ButtonIcon ? "ml-2" : ""}`}
                    >
                      {action.text}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>
    </CustomAlertContext.Provider>
  );
}

export function useCustomAlert() {
  const context = useContext(CustomAlertContext);
  if (!context) {
    throw new Error("useCustomAlert must be used within CustomAlertProvider.");
  }
  return context;
}
