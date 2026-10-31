import colors from "../../../theme/colors.json";
import { router } from "expo-router";
import {
    ArrowLeft,
    CheckCircle2,
    MapPin,
    PackageCheck,
    ShoppingBag,
    UtensilsCrossed,
} from "lucide-react-native";
import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
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
import type {
    RazorpayPaymentFailure,
    RazorpayPaymentSuccess,
} from "react-native-razorpay";
import { SafeAreaView } from "react-native-safe-area-context";
import { useCart } from "../../../contexts/CartContext";
import { getCartAccount, type CartAccount } from "../../../lib/cartApi";
import { getFoodImage, getFoodName } from "../../../lib/foods";
import {
    clearCheckoutIdempotencyKey,
    createOrder,
    fetchSavedAddresses,
    getCheckoutIdempotencyKey,
    verifyOrderPayment,
    type CheckoutAddress,
    type CheckoutCustomer,
    type CheckoutPayload,
} from "../../../lib/orderApi";
import type { CartItem } from "../../../types/food";

const EMPTY_ADDRESS: CheckoutAddress = {
  address_line: "",
  area_locality: "",
  city: "",
  state: "",
  pincode: "",
  landmark: "",
};

const fieldClassName =
  "mt-2 min-h-12 rounded-xl border border-brand-neutral-border-warm bg-white px-4 py-3 text-base text-brand-neutral-text-primary";

function formatAddress(address: CheckoutAddress): string {
  return [
    address.address_line,
    address.area_locality,
    address.city,
    address.pincode,
  ]
    .filter(Boolean)
    .join(", ");
}

function isAddressComplete(address: CheckoutAddress): boolean {
  return Boolean(
    address.address_line.trim() &&
      address.area_locality.trim() &&
      address.city.trim() &&
      address.state.trim() &&
      /^\d{6}$/.test(address.pincode.trim()),
  );
}

function SectionHeading({
  icon,
  title,
  detail,
}: {
  icon: ReactNode;
  title: string;
  detail: string;
}) {
  return (
    <View className="mb-5 flex-row items-center">
      <View className="mr-3 h-10 w-10 items-center justify-center rounded-xl bg-brand-surface-cream">
        {icon}
      </View>
      <View className="flex-1">
        <Text className="text-lg font-extrabold text-brand-neutral-text-primary">{title}</Text>
        <Text className="mt-0.5 text-sm text-slate-500">{detail}</Text>
      </View>
    </View>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  autoCapitalize = "words",
  maxLength,
  required = false,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  keyboardType?: "default" | "email-address" | "phone-pad" | "number-pad";
  autoCapitalize?: "none" | "sentences" | "words";
  maxLength?: number;
  required?: boolean;
}) {
  return (
    <View className="mb-4">
      <Text className="text-sm font-bold text-brand-neutral-text-deep">
        {label}
        {required ? <Text className="text-brand-warning-rust"> *</Text> : null}
      </Text>
      <TextInput
        accessibilityLabel={label}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        className={fieldClassName}
        keyboardType={keyboardType}
        maxLength={maxLength}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors["neutral-placeholder"]}
        value={value}
      />
    </View>
  );
}

function OrderItems({ items }: { items: CartItem[] }) {
  return (
    <View>
      {items.map((item) => {
        const image = getFoodImage(item.food);
        const options = [
          ...item.selectedAddons,
          ...item.selectedCustomizations,
        ];

        return (
          <View
            className="mb-4 flex-row items-center"
            key={item.key}
          >
            <View className="h-14 w-14 items-center justify-center overflow-hidden rounded-xl bg-brand-surface-cream">
              {image ? (
                <Image
                  accessible
                  accessibilityLabel={getFoodName(item.food)}
                  className="h-full w-full"
                  resizeMode="cover"
                  source={{ uri: image }}
                />
              ) : (
                <UtensilsCrossed color={colors["gold-copper"]} size={21} />
              )}
            </View>
            <View className="ml-3 flex-1">
              <Text
                className="text-sm font-extrabold text-brand-neutral-text-primary"
                numberOfLines={1}
              >
                {getFoodName(item.food)}
              </Text>
              <Text className="mt-1 text-xs text-slate-500">
                Qty {item.quantity}
                {item.food.portion_size ? ` · ${item.food.portion_size}` : ""}
              </Text>
              {options.length > 0 ? (
                <Text className="mt-1 text-xs text-slate-500" numberOfLines={1}>
                  {options.map((option) => option.name).join(", ")}
                </Text>
              ) : null}
            </View>
            <Text className="ml-2 text-sm font-extrabold text-brand-neutral-text-primary">
              ₹{(item.unitPrice * item.quantity).toFixed(2)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

export default function CheckoutScreen() {
  const { items, itemCount, isHydrated, isCartLoading, refreshCart } = useCart();
  const [account, setAccount] = useState<CartAccount | null>(null);
  const [customer, setCustomer] = useState<CheckoutCustomer>({
    name: "",
    phone: "",
    email: "",
  });
  const [fulfillmentType, setFulfillmentType] =
    useState<CheckoutPayload["order_type"]>("home_delivery");
  const [paymentMethod, setPaymentMethod] =
    useState<CheckoutPayload["payment_method"]>("cod");
  const [address, setAddress] = useState<CheckoutAddress>(EMPTY_ADDRESS);
  const [savedAddresses, setSavedAddresses] = useState<CheckoutAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [addressNotice, setAddressNotice] = useState("");
  const [completedOrder, setCompletedOrder] = useState("");
  const [completionNotice, setCompletionNotice] = useState("");
  const submissionInProgress = useRef(false);

  useEffect(() => {
    let isMounted = true;

    const loadCheckoutData = async () => {
      try {
        const signedInAccount = await getCartAccount();
        if (!isMounted) return;
        setAccount(signedInAccount);
        if (signedInAccount) {
          setCustomer({
            name: signedInAccount.name,
            phone: signedInAccount.phone,
            email: signedInAccount.email,
          });
          try {
            const addresses = await fetchSavedAddresses();
            if (!isMounted) return;
            setSavedAddresses(addresses);
            const firstAddress = addresses[0];
            if (firstAddress) {
              setAddress(firstAddress);
              setSelectedAddressId(String(firstAddress.id ?? "saved-0"));
            }
          } catch (error) {
            console.error("Failed to load saved checkout addresses:", error);
            if (isMounted) {
              setAddressNotice(
                "Saved addresses could not be loaded. You can still enter a new address.",
              );
            }
          }
        }
      } catch (error) {
        console.error("Failed to load checkout account details:", error);
        if (isMounted) {
          setErrorMessage("Your account details could not be loaded. Please try again.");
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    void loadCheckoutData();
    return () => {
      isMounted = false;
    };
  }, []);

  const subtotal = useMemo(
    () => items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0),
    [items],
  );

  const updateAddress = (field: keyof CheckoutAddress, value: string) => {
    setSelectedAddressId(null);
    setAddress((current) => ({ ...current, [field]: value }));
  };

  const completeOrder = async (
    orderNumber: string,
    message: string,
    storageKey: string,
  ) => {
    let notice = message;
    try {
      await refreshCart();
    } catch (error) {
      console.error("Order was confirmed, but the cart could not be refreshed:", error);
      notice = `${notice} Your cart could not be refreshed.`;
    }
    try {
      await clearCheckoutIdempotencyKey(storageKey);
    } catch (error) {
      console.error("Could not clear the completed checkout request key:", error);
    }
    setCompletionNotice(notice);
    setCompletedOrder(orderNumber);
  };

  const openNativePayment = async (
    orderNumber: string,
    order: NonNullable<Awaited<ReturnType<typeof createOrder>>["data"]>,
    storageKey: string,
  ) => {
    if (Platform.OS === "web") {
      throw new Error("Online payment is only available in the iOS and Android apps.");
    }
    if (
      !order.razorpay?.key_id ||
      !order.razorpay.order_id ||
      !order.razorpay.amount ||
      !order.razorpay.currency
    ) {
      throw new Error("The payment details were incomplete. Please contact the restaurant.");
    }

    const { default: RazorpayCheckout } = await import("react-native-razorpay");
    let payment: RazorpayPaymentSuccess;
    try {
      payment = await RazorpayCheckout.open({
        key: order.razorpay.key_id,
        amount: order.razorpay.amount,
        currency: order.razorpay.currency,
        order_id: order.razorpay.order_id,
        name: "Restaurant",
        description: `Order ${orderNumber}`,
        prefill: {
          name: customer.name,
          email: customer.email,
          contact: customer.phone,
        },
        notes: { order_number: orderNumber },
        theme: { color: colors["green-primary"] },
      });
    } catch (error) {
      const paymentError = error as RazorpayPaymentFailure;
      if (paymentError.description) {
        throw new Error(paymentError.description);
      }
      throw new Error("Payment was not completed. Your cart is still available.");
    }

    const verification = await verifyOrderPayment({
      order_number: orderNumber,
      razorpay_order_id: payment.razorpay_order_id,
      razorpay_payment_id: payment.razorpay_payment_id,
      razorpay_signature: payment.razorpay_signature,
    });
    if (!verification.success) {
      throw new Error(
        verification.message || "Payment could not be verified. Please contact the restaurant.",
      );
    }

    await completeOrder(
      orderNumber,
      "Payment received. Your order is confirmed.",
      storageKey,
    );
  };

  const placeOrder = async () => {
    setErrorMessage("");
    if (!account) {
      router.replace("/Auth/login");
      return;
    }
    if (!items.length) {
      setErrorMessage("Your cart is empty.");
      return;
    }
    if (!customer.name.trim() || customer.name.trim().length > 150) {
      setErrorMessage("Enter your name (up to 150 characters).");
      return;
    }
    const phone = customer.phone.trim();
    const phoneDigits = phone.replace(/\D/g, "");
    if (
      !/^[+()\d\s-]{7,32}$/.test(phone) ||
      phoneDigits.length < 7 ||
      phoneDigits.length > 15
    ) {
      setErrorMessage("Enter a valid phone number.");
      return;
    }
    if (Platform.OS === "web" && paymentMethod === "online") {
      setErrorMessage("Online payment is only available in the iOS and Android apps.");
      return;
    }
    if (
      customer.email.trim() &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email.trim())
    ) {
      setErrorMessage("Enter a valid email address or leave it blank.");
      return;
    }
    if (fulfillmentType === "home_delivery" && !isAddressComplete(address)) {
      setErrorMessage("Complete the delivery address and enter a 6-digit pincode.");
      return;
    }
    if (submissionInProgress.current) return;

    submissionInProgress.current = true;
    setIsSubmitting(true);
    try {
      const payload: CheckoutPayload = {
        customer: {
          name: customer.name.trim(),
          phone: customer.phone.trim(),
          email: customer.email.trim(),
        },
        order_type: fulfillmentType,
        address: fulfillmentType === "home_delivery" ? address : null,
        payment_method: paymentMethod,
      };
      const requestKey = await getCheckoutIdempotencyKey(
        account.id,
        items,
        payload,
      );
      const result = await createOrder(payload, requestKey.idempotencyKey);
      if (!result.success || !result.data?.order_number) {
        throw new Error(result.message || "Your order could not be placed.");
      }

      const order = result.data;
      const orderPaymentMethod = order.payment_method ?? paymentMethod;
      if (orderPaymentMethod === "cod" || order.completed) {
        await completeOrder(
          order.order_number,
          "Order placed successfully.",
          requestKey.storageKey,
        );
      } else {
        await openNativePayment(order.order_number, order, requestKey.storageKey);
      }
    } catch (error) {
      console.error("Checkout failed:", error);
      const paymentError = error as RazorpayPaymentFailure & {
        message?: string;
        response?: { data?: { message?: string; error?: string } };
      };
      setErrorMessage(
        paymentError.response?.data?.message ||
          paymentError.response?.data?.error ||
          paymentError.description ||
          paymentError.message ||
          (error instanceof Error
            ? error.message
            : "Your order could not be placed. Please try again."),
      );
    } finally {
      setIsSubmitting(false);
      submissionInProgress.current = false;
    }
  };

  if (completedOrder) {
    return (
      <SafeAreaView className="flex-1 bg-brand-surface-app" edges={["bottom"]}>
        <View className="flex-1 items-center justify-center px-6">
          <View className="w-full max-w-lg items-center rounded-3xl border border-brand-neutral-border-warm bg-white p-7">
            <CheckCircle2 color={colors["green-success"]} size={58} />
            <Text className="mt-5 text-center text-xs font-extrabold uppercase tracking-[3px] text-brand-warning-rust">
              Order confirmed
            </Text>
            <Text className="mt-2 text-center text-2xl font-extrabold text-brand-neutral-text-primary">
              Thank you, {customer.name}!
            </Text>
            <Text className="mt-3 text-center text-sm text-slate-500">
              Your order reference is
            </Text>
            <Text className="mt-1 text-center text-base font-extrabold text-brand-neutral-text-primary">
              {completedOrder}
            </Text>
            {completionNotice ? (
              <Text className="mt-3 text-center text-sm text-emerald-700">
                {completionNotice}
              </Text>
            ) : null}
            <Pressable
              accessibilityRole="button"
              className="mt-7 min-h-12 w-full flex-row items-center justify-center rounded-xl bg-brand-green-primary px-5 active:bg-brand-green-action-hover"
              onPress={() => router.replace("/UsersTab/shop")}
            >
              <ShoppingBag color="white" size={18} />
              <Text className="ml-2 font-extrabold text-white">
                Continue browsing
              </Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (isLoading || !isHydrated || isCartLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-brand-surface-app">
        <ActivityIndicator color={colors["green-primary"]} size="large" />
        <Text className="mt-3 text-sm font-semibold text-slate-600">
          Preparing checkout…
        </Text>
      </View>
    );
  }

  if (!account) {
    return (
      <View className="flex-1 items-center justify-center bg-brand-surface-app px-6">
        <ShoppingBag color={colors["green-primary"]} size={42} />
        <Text className="mt-4 text-center text-2xl font-extrabold text-brand-neutral-text-primary">
          Log in to checkout
        </Text>
        <Text className="mt-2 text-center text-sm text-slate-500">
          Sign in to save your address and place your order.
        </Text>
        <Pressable
          accessibilityRole="button"
          className="mt-6 min-h-12 justify-center rounded-xl bg-brand-green-primary px-6"
          onPress={() => router.replace("/Auth/login")}
        >
          <Text className="font-extrabold text-white">Log in</Text>
        </Pressable>
      </View>
    );
  }

  if (items.length === 0) {
    return (
      <View className="flex-1 items-center justify-center bg-brand-surface-app px-6">
        <ShoppingBag color={colors["green-primary"]} size={42} />
        <Text className="mt-4 text-center text-2xl font-extrabold text-brand-neutral-text-primary">
          Your cart is empty
        </Text>
        <Text className="mt-2 text-center text-sm text-slate-500">
          Add something delicious before checking out.
        </Text>
        <Pressable
          accessibilityRole="button"
          className="mt-6 min-h-12 justify-center rounded-xl bg-brand-green-primary px-6"
          onPress={() => router.replace("/UsersTab/shop")}
        >
          <Text className="font-extrabold text-white">Browse food</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-brand-surface-app"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        className="flex-1"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
      >
        <Pressable
          accessibilityRole="button"
          className="mb-5 self-start flex-row items-center py-2"
          onPress={() => router.back()}
        >
          <ArrowLeft color={colors["neutral-slate"]} size={18} />
          <Text className="ml-2 text-sm font-bold text-slate-600">
            Back to cart
          </Text>
        </Pressable>

        <Text className="text-xs font-extrabold uppercase tracking-[3px] text-brand-warning-rust">
          Almost there
        </Text>
        <Text className="mt-1 text-3xl font-extrabold text-brand-neutral-text-primary">
          Checkout
        </Text>
        <Text className="mt-2 text-sm text-slate-500">
          Your details, your food, and the finishing touch.
        </Text>

        <View className="mt-6 rounded-2xl border border-brand-neutral-border-warm bg-white p-5">
          <SectionHeading
            detail="Who should we contact about your order?"
            icon={<ShoppingBag color={colors["gold-copper"]} size={19} />}
            title="Customer details"
          />
          <Field
            label="Full name"
            maxLength={150}
            onChangeText={(name) => setCustomer((current) => ({ ...current, name }))}
            placeholder="Your name"
            required
            value={customer.name}
          />
          <Field
            label="Phone number"
            keyboardType="phone-pad"
            maxLength={32}
            onChangeText={(phone) => setCustomer((current) => ({ ...current, phone }))}
            placeholder="+91 98765 43210"
            required
            value={customer.phone}
          />
          <Field
            autoCapitalize="none"
            label="Email address (optional)"
            keyboardType="email-address"
            maxLength={255}
            onChangeText={(email) => setCustomer((current) => ({ ...current, email }))}
            placeholder="you@example.com"
            value={customer.email}
          />
        </View>

        <View className="mt-4 rounded-2xl border border-brand-neutral-border-warm bg-white p-5">
          <SectionHeading
            detail="Choose how you would like to receive your order."
            icon={<MapPin color={colors["gold-copper"]} size={19} />}
            title="Fulfilment"
          />
          <View className="flex-row rounded-xl bg-brand-surface-cream p-1">
            {[
              { value: "home_delivery" as const, label: "Home delivery" },
              { value: "pickup" as const, label: "Pickup" },
            ].map((option) => {
              const isSelected = fulfillmentType === option.value;
              return (
                <Pressable
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSelected }}
                  className={`min-h-11 flex-1 items-center justify-center rounded-lg px-2 ${
                    isSelected ? "bg-white shadow-sm" : ""
                  }`}
                  key={option.value}
                  onPress={() => setFulfillmentType(option.value)}
                >
                  <Text
                    className={`text-sm font-bold ${
                      isSelected ? "text-brand-green-primary" : "text-slate-600"
                    }`}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {fulfillmentType === "home_delivery" ? (
            <View className="mt-5 border-t border-slate-100 pt-5">
              {addressNotice ? (
                <Text className="mb-3 text-sm text-amber-700">{addressNotice}</Text>
              ) : null}
              {savedAddresses.length > 0 ? (
                <View className="mb-4">
                  <Text className="mb-2 text-sm font-bold text-brand-neutral-text-deep">
                    Saved addresses
                  </Text>
                  {savedAddresses.map((saved, index) => {
                    const id = String(saved.id ?? `saved-${index}`);
                    const isSelected = selectedAddressId === id;
                    return (
                      <Pressable
                        accessibilityRole="radio"
                        accessibilityState={{ selected: isSelected }}
                        className={`mb-2 rounded-xl border p-3 ${
                          isSelected
                            ? "border-brand-green-primary bg-brand-green-surface"
                            : "border-brand-neutral-border-warm bg-white"
                        }`}
                        key={id}
                        onPress={() => {
                          setAddress(saved);
                          setSelectedAddressId(id);
                        }}
                      >
                        <Text className="text-sm font-bold text-brand-neutral-text-deep">
                          {formatAddress(saved) || "Saved delivery address"}
                        </Text>
                        <Text className="mt-1 text-xs text-slate-500">
                          {[saved.state, saved.landmark].filter(Boolean).join(" · ")}
                        </Text>
                      </Pressable>
                    );
                  })}
                  <Pressable
                    accessibilityRole="button"
                    className={`rounded-xl border p-3 ${
                      selectedAddressId === null
                        ? "border-brand-green-primary bg-brand-green-surface"
                        : "border-brand-neutral-border-warm bg-white"
                    }`}
                    onPress={() => {
                      setAddress(EMPTY_ADDRESS);
                      setSelectedAddressId(null);
                    }}
                  >
                    <Text className="text-sm font-bold text-brand-neutral-text-deep">
                      Enter a different address
                    </Text>
                  </Pressable>
                </View>
              ) : null}

              <Field
                label="Door / street address"
                maxLength={255}
                onChangeText={(value) => updateAddress("address_line", value)}
                placeholder="House no., street, building"
                required
                value={address.address_line}
              />
              <Field
                label="Area / locality"
                maxLength={180}
                onChangeText={(value) => updateAddress("area_locality", value)}
                placeholder="Area or neighbourhood"
                required
                value={address.area_locality}
              />
              <View className="flex-row">
                <View className="mr-2 flex-1">
                  <Field
                    label="City"
                    maxLength={120}
                    onChangeText={(value) => updateAddress("city", value)}
                    placeholder="City"
                    required
                    value={address.city}
                  />
                </View>
                <View className="ml-2 flex-1">
                  <Field
                    label="Pincode"
                    keyboardType="number-pad"
                    maxLength={6}
                    onChangeText={(value) =>
                      updateAddress("pincode", value.replace(/\D/g, "").slice(0, 6))
                    }
                    placeholder="6 digits"
                    required
                    value={address.pincode}
                  />
                </View>
              </View>
              <Field
                label="State"
                maxLength={120}
                onChangeText={(value) => updateAddress("state", value)}
                placeholder="State or union territory"
                required
                value={address.state}
              />
              <Field
                label="Landmark (optional)"
                maxLength={180}
                onChangeText={(value) => updateAddress("landmark", value)}
                placeholder="Nearby landmark"
                value={address.landmark}
              />
              <Text className="text-xs leading-5 text-slate-500">
                We save each unique address once to your account for faster future checkouts.
              </Text>
            </View>
          ) : null}
        </View>

        <View className="mt-4 rounded-2xl border border-brand-neutral-border-warm bg-white p-5">
          <SectionHeading
            detail="Choose how you want to pay."
            icon={<PackageCheck color={colors["gold-copper"]} size={19} />}
            title="Payment method"
          />
          {[
            {
              value: "cod" as const,
              label: "Cash on delivery",
              detail: "Pay when your order arrives or at pickup.",
            },
            {
              value: "online" as const,
              label: "Online payment",
              detail: "Secure checkout powered by Razorpay.",
            },
          ].map((method) => {
            const isSelected = paymentMethod === method.value;
            return (
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ selected: isSelected }}
                className={`mb-3 rounded-xl border p-4 ${
                  isSelected
                    ? "border-brand-warning-rust bg-brand-surface-warm"
                    : "border-brand-neutral-border-warm"
                }`}
                key={method.value}
                onPress={() => setPaymentMethod(method.value)}
              >
                <Text className="text-sm font-extrabold text-brand-neutral-text-deep">
                  {method.label}
                </Text>
                <Text className="mt-1 text-xs text-slate-500">
                  {method.detail}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View className="mt-4 rounded-2xl border border-brand-neutral-border-warm bg-white p-5">
          <SectionHeading
            detail={`${itemCount} item${itemCount === 1 ? "" : "s"} in your order`}
            icon={<UtensilsCrossed color={colors["gold-copper"]} size={19} />}
            title="Your food"
          />
          <OrderItems items={items} />
          <View className="border-t border-slate-100 pt-4">
            <View className="flex-row justify-between">
              <Text className="text-sm font-semibold text-slate-600">Subtotal</Text>
              <Text className="text-sm font-bold text-slate-800">
                ₹{subtotal.toFixed(2)}
              </Text>
            </View>
            <View className="mt-3 flex-row justify-between">
              <Text className="text-base font-extrabold text-brand-neutral-text-primary">Total</Text>
              <Text className="text-base font-extrabold text-brand-green-primary">
                ₹{subtotal.toFixed(2)}
              </Text>
            </View>
          </View>
        </View>

        {errorMessage ? (
          <View className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4">
            <Text accessibilityRole="alert" className="text-sm font-semibold text-rose-800">
              {errorMessage}
            </Text>
          </View>
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: isSubmitting }}
          className={`mt-5 min-h-14 flex-row items-center justify-center rounded-xl px-5 ${
            isSubmitting ? "bg-brand-green-muted-dark" : "bg-brand-green-primary active:bg-brand-green-action-hover"
          }`}
          disabled={isSubmitting}
          onPress={() => void placeOrder()}
        >
          {isSubmitting ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-base font-extrabold text-white">
              {paymentMethod === "online"
                ? "Continue to Razorpay"
                : "Place order"}
            </Text>
          )}
        </Pressable>
        <Text className="mt-3 text-center text-xs leading-5 text-slate-500">
          Your order details are securely submitted.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
