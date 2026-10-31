import { ScrollView } from "react-native";
import HomeBanner from "../../components/HomeBanner";
import HomeCategories from "../../components/HomeCategories";
import HomeCuisines from "../../components/HomeCuisines";
import HomeProducts from "../../components/HomeProducts";
import CustomerReviews from "../../components/CustomerReviews";

export default function HomeScreen() {
  return (
    <ScrollView
      className="flex-1 bg-brand-surface-app"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{
        paddingHorizontal: 24,
        paddingTop: 20,
        paddingBottom: 120,
      }}
    >
      <HomeBanner />
      <HomeCategories />
      <HomeCuisines />
      <HomeProducts />
      <CustomerReviews />
    </ScrollView>
  );
}
