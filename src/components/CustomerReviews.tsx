import { useCallback, useEffect, useMemo, useState } from "react";
import { Quote, Star, UsersRound } from "lucide-react-native";
import { Image, Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import api, { API_BASE_URL } from "../lib/api";

type CustomerReview = {
  id: string;
  reviewerName: string;
  productName: string;
  title: string;
  comment: string;
  photo: string;
  rating: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function textValue(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function normalizeReviews(payload: unknown): CustomerReview[] {
  if (!Array.isArray(payload)) {
    throw new Error("The published reviews response was invalid.");
  }

  return payload.filter(isRecord).map((review, index) => {
    const rawRating = Number(review.rating);
    const rating = Number.isFinite(rawRating)
      ? Math.max(0, Math.min(5, rawRating))
      : 0;

    return {
      id: textValue(review.id ?? review.review_id, `${index}`),
      reviewerName: textValue(review.reviewer_name, "Customer"),
      productName: textValue(review.product_name, "A happy dining experience"),
      title: textValue(review.title),
      comment: textValue(review.comment, "A happy dining experience."),
      photo: resolveReviewImage(review.review_photo),
      rating,
    };
  });
}

function resolveReviewImage(image: unknown): string {
  if (typeof image !== "string" || !image.trim()) return "";

  const value = image.trim();
  if (/^(data:|blob:|https?:\/\/)/i.test(value)) return value;

  const backendUrl = API_BASE_URL.replace(/\/api\/?$/i, "").replace(/\/+$/, "");
  return `${backendUrl}/${value.replace(/^\/+/, "")}`;
}

export default function CustomerReviews() {
  const { width: screenWidth } = useWindowDimensions();
  const [reviews, setReviews] = useState<CustomerReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const cardWidth = Math.max(0, screenWidth - 32);

  const fetchReviews = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await api.get("/reviews/published");
      const payload: unknown = response.data?.data ?? response.data;
      setReviews(normalizeReviews(payload));
    } catch (requestError) {
      console.error("Could not load customer reviews:", requestError);
      setError("Customer reviews could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchReviews();
  }, [fetchReviews]);

  const averageRating = useMemo(
    () =>
      reviews.length
        ? reviews.reduce((total, review) => total + review.rating, 0) / reviews.length
        : 0,
    [reviews],
  );
  const ratingBreakdown = useMemo(
    () =>
      [5, 4, 3, 2, 1].map((stars) => {
        const count = reviews.filter(
          (review) => Math.round(review.rating) === stars,
        ).length;
        return {
          stars,
          percentage: reviews.length
            ? Math.round((count / reviews.length) * 100)
            : 0,
        };
      }),
    [reviews],
  );

  if (!loading && !error && reviews.length === 0) return null;

  return (
    <View className="-mx-6 mt-10 bg-[#FBFAF5] px-4 py-8">
      <View className="mb-5 items-center">
        <Text className="text-[11px] font-extrabold uppercase tracking-[3px] text-[#163D2C]">
          Testimonials
        </Text>
        <Text className="mt-2 text-center text-2xl font-black text-[#0C3828]">
          What Our <Text className="font-serif italic text-[#BB8A2D]">Customers Say</Text>
        </Text>
        <Text className="mt-1 text-center text-xs text-[#69736E]">
          Real stories. Real flavours. Real happiness.
        </Text>
      </View>

      <View className="overflow-hidden rounded-[24px] bg-[#06402D] shadow-md">
        <View className="px-5 pb-5 pt-5">
          <Text className="text-[10px] font-bold uppercase tracking-[2px] text-white/90">
            Customer reviews
          </Text>
          <View className="mt-2 flex-row items-end">
            <Text className="font-serif text-5xl leading-[52px] text-white">
              {loading ? "—" : averageRating.toFixed(1)}
            </Text>
            <Text className="mb-1 ml-2 font-serif text-xl text-[#D5A233]">/ 5</Text>
          </View>
          <View
            accessibilityLabel={`${averageRating.toFixed(1)} out of 5 stars`}
            className="mt-2 flex-row"
          >
            {Array.from({ length: 5 }, (_, index) => (
              <Star
                key={index}
                color={index < Math.round(averageRating) ? "#E6A622" : "#FFFFFF"}
                fill={index < Math.round(averageRating) ? "#E6A622" : "transparent"}
                size={21}
                style={{ opacity: index < Math.round(averageRating) ? 1 : 0.3 }}
              />
            ))}
          </View>
          <Text className="mt-2 text-xs text-white/90">
            Based on {loading ? "…" : reviews.length} recent published{" "}
            {reviews.length === 1 ? "review" : "reviews"}
          </Text>
        </View>

        <View className="rounded-t-[22px] bg-[#FFFEF9] px-4 py-4">
          {ratingBreakdown.map(({ stars, percentage }) => (
            <View key={stars} className="mb-2 flex-row items-center">
              <Text className="w-12 text-xs text-[#18372B]">{stars} Star</Text>
              <View
                accessibilityLabel={`${stars} star reviews, ${percentage}%`}
                className="h-2.5 flex-1 overflow-hidden rounded-full bg-[#F2F0E6]"
              >
                <View
                  className="h-full rounded-full bg-[#DDAA32]"
                  style={{ width: `${percentage}%` }}
                />
              </View>
              <Text className="w-10 text-right text-xs font-semibold text-[#18372B]">
                {loading ? "—" : `${percentage}%`}
              </Text>
            </View>
          ))}
          <View className="mt-2 flex-row items-center rounded-2xl bg-[#F7F5E9] px-4 py-3">
            <UsersRound color="#D29A1E" size={30} />
            <View className="ml-3">
              <Text className="font-serif text-xl font-bold leading-6 text-[#18372B]">
                {loading ? "—" : reviews.length.toLocaleString()}
              </Text>
              <Text className="text-xs text-[#58645D]">Recent reviews</Text>
            </View>
          </View>
        </View>
      </View>

      {loading ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="mt-5"
          contentContainerStyle={{ gap: 12 }}
        >
          <View
            style={{ width: cardWidth }}
            className="h-[270px] rounded-[22px] border border-[#EFEEE7] bg-white p-5"
          >
            <View className="h-4 w-28 rounded bg-[#EDF1E9]" />
            <View className="mt-8 h-4 w-2/3 rounded bg-[#EDF1E9]" />
            <View className="mt-3 h-3 w-full rounded bg-[#EDF1E9]" />
            <View className="mt-2 h-3 w-4/5 rounded bg-[#EDF1E9]" />
          </View>
          <View
            style={{ width: cardWidth }}
            className="h-[270px] rounded-[22px] border border-[#EFEEE7] bg-white p-5"
          >
            <View className="h-4 w-28 rounded bg-[#EDF1E9]" />
            <View className="mt-8 h-4 w-2/3 rounded bg-[#EDF1E9]" />
            <View className="mt-3 h-3 w-full rounded bg-[#EDF1E9]" />
            <View className="mt-2 h-3 w-4/5 rounded bg-[#EDF1E9]" />
          </View>
        </ScrollView>
      ) : error ? (
        <View className="mt-5 items-center rounded-2xl border border-[#F2D4CA] bg-white p-5">
          <Text className="text-center text-sm text-[#8C3B27]">{error}</Text>
          <Pressable
            accessibilityRole="button"
            className="mt-3 rounded-xl bg-[#06402D] px-4 py-2"
            onPress={() => void fetchReviews()}
          >
            <Text className="text-xs font-bold text-white">Try again</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          horizontal
          pagingEnabled
          snapToInterval={cardWidth + 12}
          decelerationRate="fast"
          showsHorizontalScrollIndicator={false}
          className="mt-5"
          contentContainerStyle={{ gap: 12, paddingRight: 16 }}
        >
          {reviews.map((review) => {
            const initials = review.reviewerName
              .trim()
              .split(/\s+/)
              .slice(0, 2)
              .map((part) => part.charAt(0))
              .join("")
              .toUpperCase();

            return (
              <View
                key={review.id}
                style={{ width: cardWidth }}
                className="min-h-[270px] flex-col rounded-[22px] border border-[#F0EEE6] bg-white p-5 shadow-sm"
              >
                <View className="flex-row items-center justify-between">
                  <View
                    accessibilityLabel={`${review.rating.toFixed(1)} out of 5 stars`}
                    className="flex-row"
                  >
                    {Array.from({ length: 5 }, (_, index) => (
                      <Star
                        key={index}
                        color={index < review.rating ? "#DFA11D" : "#DEDED2"}
                        fill={index < review.rating ? "#DFA11D" : "transparent"}
                        size={17}
                      />
                    ))}
                  </View>
                  <Text className="text-sm font-bold text-[#153C2B]">
                    {review.rating.toFixed(1)}
                  </Text>
                </View>
                <View className="mt-6 flex-1">
                  <Quote color="#B7C69E" fill="#B7C69E" size={21} />
                  {review.title ? (
                    <Text numberOfLines={1} className="mt-1 text-sm font-bold text-[#25342B]">
                      {review.title}
                    </Text>
                  ) : null}
                  <Text
                    numberOfLines={5}
                    className="mt-1 text-[13px] leading-5 text-[#283C32]"
                  >
                    {review.comment}
                  </Text>
                </View>
                <View className="mt-4 flex-row items-center border-t border-[#EEECE3] pt-3">
                  <View className="h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-[#EAF3E5]">
                    {review.photo ? (
                      <Image
                        accessibilityLabel={`${review.reviewerName} profile`}
                        source={{ uri: review.photo }}
                        className="h-12 w-12"
                        resizeMode="cover"
                      />
                    ) : (
                      <Text className="text-sm font-extrabold uppercase text-[#075B2B]">
                        {initials || "C"}
                      </Text>
                    )}
                  </View>
                  <View className="ml-3 flex-1">
                    <Text
                      numberOfLines={1}
                      className="text-sm font-extrabold text-[#153C2B]"
                    >
                      {review.reviewerName}
                    </Text>
                    <Text numberOfLines={1} className="mt-1 text-xs text-[#68736E]">
                      {review.productName}
                    </Text>
                  </View>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}
