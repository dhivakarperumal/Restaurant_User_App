import colors from "../theme/colors.json";
import { router } from "expo-router";
import * as Location from "expo-location";
import {
    ArrowLeft,
    CheckCircle2,
    LocateFixed,
    MapPin,
    PackageCheck,
    ShoppingBag,
    Store,
    Truck,
    UtensilsCrossed,
} from "lucide-react-native";
import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { StatusBar } from "expo-status-bar";
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
import { useCart } from "../contexts/CartContext";
import { getCartAccount, type CartAccount } from "../lib/cartApi";
import { getFoodImage, getFoodName } from "../lib/foods";
import {
    clearCheckoutIdempotencyKey,
    createOrder,
    fetchDeliveryQuote,
    fetchSavedAddresses,
    getCheckoutIdempotencyKey,
    verifyOrderPayment,
    type CheckoutAddress,
    type CheckoutCustomer,
    type CheckoutLocation,
    type CheckoutPayload,
    type DeliveryQuote,
} from "../lib/orderApi";
import type { CartItem } from "../types/food";

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

function getAddressFingerprint(address: CheckoutAddress): string {
  return [
    address.address_line,
    address.area_locality,
    address.city,
    address.state,
    address.pincode,
  ]
    .map((part) => part.trim())
    .join("|");
}

async function getCoordinatesFromAddress(
  address: CheckoutAddress,
  signal: AbortSignal,
): Promise<CheckoutLocation> {
  const searchParts = [
    address.address_line,
    address.area_locality,
    address.city,
    address.state,
    address.pincode,
    "India",
  ].filter(Boolean);
  const query = new URLSearchParams({
    format: "jsonv2",
    limit: "1",
    countrycodes: "in",
    q: searchParts.join(", "),
  });
  const response = await fetch(
    `https://nominatim.openstreetmap.org/search?${query}`,
    { signal },
  );
  if (!response.ok) {
    throw new Error(
      "Address search is temporarily unavailable. Please try current location.",
    );
  }

  const results: unknown = await response.json();
  if (!Array.isArray(results) || !results.length) {
    throw new Error(
      "We could not locate that address. Check the address details or use current location.",
    );
  }
  const result = results[0] as Record<string, unknown>;
  const latitude = Number(result.lat);
  const longitude = Number(result.lon);
  if (
    !Number.isFinite(latitude) ||
    latitude < -90 ||
    latitude > 90 ||
    !Number.isFinite(longitude) ||
    longitude < -180 ||
    longitude > 180
  ) {
    throw new Error("The address location was invalid. Please try again.");
  }

  return { latitude, longitude };
}

async function getAddressFromCoordinates(
  location: CheckoutLocation,
): Promise<Partial<CheckoutAddress>> {
  const results = await Location.reverseGeocodeAsync(location);
  const result = results[0];
  if (!result) {
    throw new Error(
      "No address details were found for your location. Please enter the address manually.",
    );
  }

  const street = [result.streetNumber, result.street].filter(Boolean).join(" ");
  const address = {
    address_line: street || result.name || "",
    area_locality: result.district || result.subregion || "",
    city: result.city || result.subregion || result.district || "",
    state: result.region === "NCT of Delhi" ? "Delhi" : result.region || "",
    pincode: (result.postalCode || "").replace(/\s/g, "").slice(0, 6),
  };
  if (
    !address.address_line &&
    !address.area_locality &&
    !address.city &&
    !address.state
  ) {
    throw new Error(
      "No address details were found for your location. Please enter the address manually.",
    );
  }
  return address;
}

type FingerprintedDeliveryQuote = DeliveryQuote & { fingerprint: string };

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
    useState<CheckoutPayload["payment_method"]>("online");
  const [address, setAddress] = useState<CheckoutAddress>(EMPTY_ADDRESS);
  const [deliveryLocation, setDeliveryLocation] =
    useState<CheckoutLocation | null>(null);
  const [deliveryQuote, setDeliveryQuote] =
    useState<FingerprintedDeliveryQuote | null>(null);
  const [deliveryQuoteError, setDeliveryQuoteError] = useState<{
    fingerprint: string;
    message: string;
  } | null>(null);
  const [isQuotingDelivery, setIsQuotingDelivery] = useState(false);
  const [isFetchingLocation, setIsFetchingLocation] = useState(false);
  const [isGeocodingAddress, setIsGeocodingAddress] = useState(false);
  const [addressGeocodingError, setAddressGeocodingError] = useState<{
    fingerprint: string;
    message: string;
  } | null>(null);
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
  const addressFingerprint = getAddressFingerprint(address);
  const quoteFingerprint = [
    fulfillmentType,
    subtotal.toFixed(2),
    deliveryLocation?.latitude ?? "",
    deliveryLocation?.longitude ?? "",
  ].join(":");
  const currentDeliveryQuote =
    deliveryQuote?.fingerprint === quoteFingerprint ? deliveryQuote : null;
  const currentDeliveryQuoteError =
    deliveryQuoteError?.fingerprint === quoteFingerprint
      ? deliveryQuoteError.message
      : "";
  const currentAddressGeocodingError =
    addressGeocodingError?.fingerprint === addressFingerprint
      ? addressGeocodingError.message
      : "";

  useEffect(() => {
    if (
      fulfillmentType !== "home_delivery" ||
      deliveryLocation ||
      !isAddressComplete(address)
    ) {
      setIsGeocodingAddress(false);
      return;
    }

    let active = true;
    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      setIsGeocodingAddress(true);
      setAddressGeocodingError(null);
      try {
        const location = await getCoordinatesFromAddress(
          address,
          controller.signal,
        );
        if (active) setDeliveryLocation(location);
      } catch (error) {
        if (active) {
          console.error("Could not locate the delivery address:", error);
          setAddressGeocodingError({
            fingerprint: addressFingerprint,
            message:
              error instanceof Error
                ? error.message
                : "The address could not be located.",
          });
        }
      } finally {
        if (active) setIsGeocodingAddress(false);
      }
    }, 900);

    return () => {
      active = false;
      clearTimeout(timeout);
      controller.abort();
    };
  }, [address, addressFingerprint, deliveryLocation, fulfillmentType]);

  useEffect(() => {
    if (fulfillmentType !== "home_delivery" || !deliveryLocation) {
      setDeliveryQuote(null);
      setDeliveryQuoteError(null);
      setIsQuotingDelivery(false);
      return;
    }

    let active = true;
    setDeliveryQuote(null);
    setDeliveryQuoteError(null);
    setIsQuotingDelivery(true);
    void fetchDeliveryQuote(deliveryLocation, subtotal)
      .then((quote) => {
        if (active) {
          setDeliveryQuote({ ...quote, fingerprint: quoteFingerprint });
        }
      })
      .catch((error: unknown) => {
        if (active) {
          console.error("Delivery charge could not be calculated:", error);
          const message =
            typeof error === "object" &&
            error !== null &&
            "message" in error &&
            typeof error.message === "string"
              ? error.message
              : "The delivery charge could not be calculated.";
          setDeliveryQuoteError({ fingerprint: quoteFingerprint, message });
        }
      })
      .finally(() => {
        if (active) setIsQuotingDelivery(false);
      });

    return () => {
      active = false;
    };
  }, [deliveryLocation, fulfillmentType, quoteFingerprint, subtotal]);

  const updateAddress = (field: keyof CheckoutAddress, value: string) => {
    setSelectedAddressId(null);
    setDeliveryLocation(null);
    setAddressGeocodingError(null);
    setAddressNotice("");
    setAddress((current) => ({ ...current, [field]: value }));
  };

  const useCurrentLocation = async () => {
    setAddressNotice("");
    setAddressGeocodingError(null);
    setDeliveryQuoteError(null);
    setIsFetchingLocation(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") {
        throw new Error(
          "Location permission was denied. Allow location access or enter your address manually.",
        );
      }
      if (!(await Location.hasServicesEnabledAsync())) {
        if (Platform.OS === "android") {
          await Location.enableNetworkProviderAsync();
        }
        if (!(await Location.hasServicesEnabledAsync())) {
          throw new Error(
            Platform.OS === "android"
              ? "Location is still turned off. Enable it in the system prompt or enter your address manually."
              : "Location services are turned off. Turn them on in your device settings or enter your address manually.",
          );
        }
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      const location = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };
      setDeliveryLocation(location);
      setDeliveryQuote(null);
      setAddress(EMPTY_ADDRESS);
      setSelectedAddressId(null);

      try {
        const detectedAddress = await getAddressFromCoordinates(location);
        setAddress({ ...EMPTY_ADDRESS, ...detectedAddress });
        setAddressNotice(
          "Location found. Review the detected address and complete any missing details.",
        );
      } catch (error) {
        setAddressNotice(
          error instanceof Error
            ? `${error.message} You can still enter the address manually.`
            : "Your location was found. Enter the delivery address manually.",
        );
      }
    } catch (error) {
      setAddressNotice(
        error instanceof Error
          ? error.message
          : "Your current location could not be detected. Enter your address manually.",
      );
    } finally {
      setIsFetchingLocation(false);
    }
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
    if (fulfillmentType === "home_delivery" && !deliveryLocation) {
      setErrorMessage(
        currentAddressGeocodingError ||
          "Enter a complete delivery address or use current location to calculate the delivery charge.",
      );
      return;
    }
    if (fulfillmentType === "home_delivery" && !currentDeliveryQuote) {
      setErrorMessage(
        currentDeliveryQuoteError ||
          "Wait for the delivery charge to finish calculating before placing your order.",
      );
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
        delivery_location:
          fulfillmentType === "home_delivery" ? deliveryLocation : null,
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
      <SafeAreaView className="flex-1 bg-brand-surface-app" edges={["top", "bottom"]}>
        <StatusBar style="dark" />
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
      <SafeAreaView
        className="flex-1 items-center justify-center bg-brand-surface-app"
        edges={["top", "bottom"]}
      >
        <StatusBar style="dark" />
        <ActivityIndicator color={colors["green-primary"]} size="large" />
        <Text className="mt-3 text-sm font-semibold text-slate-600">
          Preparing checkout…
        </Text>
      </SafeAreaView>
    );
  }

  if (!account) {
    return (
      <SafeAreaView
        className="flex-1 items-center justify-center bg-brand-surface-app px-6"
        edges={["top", "bottom"]}
      >
        <StatusBar style="dark" />
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
      </SafeAreaView>
    );
  }

  if (items.length === 0) {
    return (
      <SafeAreaView
        className="flex-1 items-center justify-center bg-brand-surface-app px-6"
        edges={["top", "bottom"]}
      >
        <StatusBar style="dark" />
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
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      className="flex-1 bg-brand-green-primary"
      edges={["top", "bottom"]}
    >
      <StatusBar style="light" />
      <Pressable
        accessibilityRole="button"
        className="min-h-12 flex-row items-center px-5"
        onPress={() => router.back()}
      >
        <ArrowLeft color={colors.white} size={18} />
        <Text className="ml-2 text-sm font-bold text-white">
          Back to cart
        </Text>
      </Pressable>

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
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{
                selected: fulfillmentType === "home_delivery",
              }}
              className={`min-h-11 flex-1 items-center justify-center rounded-lg px-2 ${
                fulfillmentType === "home_delivery"
                  ? "bg-white shadow-sm"
                  : ""
              }`}
              onPress={() => setFulfillmentType("home_delivery")}
            >
              <Text
                className={`text-sm font-bold ${
                  fulfillmentType === "home_delivery"
                    ? "text-brand-green-primary"
                    : "text-slate-600"
                }`}
              >
                Home delivery
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ selected: fulfillmentType === "pickup" }}
              className={`min-h-11 flex-1 items-center justify-center rounded-lg px-2 ${
                fulfillmentType === "pickup" ? "bg-white shadow-sm" : ""
              }`}
              onPress={() => setFulfillmentType("pickup")}
            >
              <Text
                className={`text-sm font-bold ${
                  fulfillmentType === "pickup"
                    ? "text-brand-green-primary"
                    : "text-slate-600"
                }`}
              >
                Pickup
              </Text>
            </Pressable>
          </View>

          {fulfillmentType === "home_delivery" ? (
            <View className="mt-5 border-t border-slate-100 pt-5">
              {addressNotice ? (
                <Text className="mb-3 text-sm text-brand-gold-dark">{addressNotice}</Text>
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
                          setDeliveryLocation(null);
                          setAddressGeocodingError(null);
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
                      setDeliveryLocation(null);
                      setAddressGeocodingError(null);
                      setSelectedAddressId(null);
                    }}
                  >
                    <Text className="text-sm font-bold text-brand-neutral-text-deep">
                      Enter a different address
                    </Text>
                  </Pressable>
                </View>
              ) : null}

              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: isFetchingLocation }}
                className="mb-4 min-h-12 flex-row items-center justify-center rounded-xl border border-brand-gold-muted bg-brand-gold-pale px-4"
                disabled={isFetchingLocation}
                onPress={() => void useCurrentLocation()}
              >
                {isFetchingLocation ? (
                  <ActivityIndicator color={colors["green-primary"]} />
                ) : (
                  <LocateFixed color={colors["green-primary"]} size={18} />
                )}
                <Text className="ml-2 text-sm font-bold text-brand-green-primary">
                  {isFetchingLocation ? "Finding your location…" : "Use current location"}
                </Text>
              </Pressable>
              <Text className="mb-4 text-xs leading-5 text-slate-500">
                Use your device location or enter the full address to calculate the delivery fee.
              </Text>
              {deliveryLocation ? (
                <View className="mb-4 flex-row items-center rounded-xl bg-brand-green-surface px-3 py-2.5">
                  <MapPin color={colors["green-primary"]} size={16} />
                  <Text className="ml-2 flex-1 text-xs font-semibold text-brand-green-primary">
                    Delivery location captured. Review your address before placing the order.
                  </Text>
                </View>
              ) : null}
              {isGeocodingAddress ? (
                <View className="mb-4 flex-row items-center">
                  <ActivityIndicator color={colors["green-primary"]} size="small" />
                  <Text className="ml-2 text-xs text-slate-500">
                    Finding the address location…
                  </Text>
                </View>
              ) : null}
              {currentAddressGeocodingError ? (
                <Text className="mb-4 text-xs leading-5 text-brand-danger">
                  {currentAddressGeocodingError}
                </Text>
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
              <View className="mt-4 rounded-xl border border-brand-neutral-border-warm bg-brand-surface-cream p-3">
                {isQuotingDelivery ? (
                  <View className="flex-row items-center">
                    <ActivityIndicator color={colors["green-primary"]} size="small" />
                    <Text className="ml-2 text-sm font-semibold text-brand-neutral-text-deep">
                      Calculating delivery charge…
                    </Text>
                  </View>
                ) : currentDeliveryQuote ? (
                  <>
                    <View className="flex-row items-center justify-between">
                      <Text className="text-sm font-bold text-brand-neutral-text-deep">
                        Delivery charge
                      </Text>
                      <Text className="text-sm font-extrabold text-brand-green-primary">
                        {currentDeliveryQuote.free_delivery
                          ? "Free"
                          : `₹${currentDeliveryQuote.delivery_charge.toFixed(2)}`}
                      </Text>
                    </View>
                    <Text className="mt-1 text-xs text-slate-500">
                      {currentDeliveryQuote.distance_km.toFixed(1)} km from the restaurant
                    </Text>
                  </>
                ) : currentDeliveryQuoteError ? (
                  <View>
                    <Text className="text-sm font-semibold text-brand-danger">
                      {currentDeliveryQuoteError}
                    </Text>
                    {deliveryLocation ? (
                      <Pressable
                        accessibilityRole="button"
                        className="mt-2 self-start py-1"
                        onPress={() =>
                          setDeliveryLocation((location) =>
                            location ? { ...location } : null,
                          )
                        }
                      >
                        <Text className="text-sm font-bold text-brand-green-primary">
                          Try again
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>
                ) : (
                  <Text className="text-sm text-slate-500">
                    Delivery charge will appear after your address is located.
                  </Text>
                )}
              </View>
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
              <Text className="text-sm font-semibold text-slate-600">
                Delivery charge
              </Text>
              <Text className="text-sm font-bold text-slate-800">
                {fulfillmentType === "pickup"
                  ? "Free"
                  : currentDeliveryQuote
                    ? currentDeliveryQuote.free_delivery
                      ? "Free"
                      : `₹${currentDeliveryQuote.delivery_charge.toFixed(2)}`
                    : isQuotingDelivery
                      ? "Calculating…"
                      : "—"}
              </Text>
            </View>
            <View className="mt-3 flex-row justify-between">
              <Text className="text-base font-extrabold text-brand-neutral-text-primary">Total</Text>
              <Text className="text-base font-extrabold text-brand-green-primary">
                {fulfillmentType === "pickup"
                  ? `₹${subtotal.toFixed(2)}`
                  : currentDeliveryQuote
                    ? `₹${currentDeliveryQuote.total_amount.toFixed(2)}`
                    : "—"}
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
    </SafeAreaView>
  );
}
