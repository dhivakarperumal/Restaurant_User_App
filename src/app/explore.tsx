import { useLocalSearchParams } from "expo-router";
import { ScrollView, Text, View } from "react-native";

export default function ExploreScreen() {
  const { category, cuisine } = useLocalSearchParams<{
    category?: string;
    cuisine?: string;
  }>();
  const selectedCategory = Array.isArray(category) ? category[0] : category;
  const selectedCuisine = Array.isArray(cuisine) ? cuisine[0] : cuisine;

  return (
    <ScrollView
      className="flex-1 bg-[#F3F4F3]"
      contentContainerStyle={{ padding: 24, paddingBottom: 120 }}
    >
      <Text className="text-base text-slate-600">
        {selectedCuisine
          ? `Browse ${selectedCuisine} cuisine and fresh picks nearby.`
          : selectedCategory
          ? `Browse ${selectedCategory} dishes and fresh picks nearby.`
          : "Browse restaurants, trending food, and fresh picks nearby."}
      </Text>

      <View className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4">
        <Text className="text-base font-medium text-slate-700">
          {selectedCuisine
            ? `${selectedCuisine} cuisine`
            : selectedCategory
            ? `${selectedCategory} dishes`
            : "Featured cuisines"}
        </Text>
      </View>
    </ScrollView>
  );
}
