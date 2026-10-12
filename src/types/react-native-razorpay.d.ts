declare module "react-native-razorpay" {
  type RazorpayCheckoutOptions = {
    key: string;
    amount: string | number;
    currency: string;
    order_id: string;
    name: string;
    description?: string;
    image?: string;
    prefill?: {
      name?: string;
      email?: string;
      contact?: string;
    };
    notes?: Record<string, string>;
    theme?: { color: string };
  };

  type RazorpayPaymentSuccess = {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  };

  type RazorpayPaymentFailure = {
    code?: number;
    description?: string;
  };

  const RazorpayCheckout: {
    open(options: RazorpayCheckoutOptions): Promise<RazorpayPaymentSuccess>;
  };

  export type { RazorpayPaymentFailure, RazorpayPaymentSuccess };
  export default RazorpayCheckout;
}
