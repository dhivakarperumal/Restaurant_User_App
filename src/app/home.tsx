import { ScrollView } from "react-native";
import HomeBanner from "../components/HomeBanner";

export default function HomeScreen() {
  return (
    <ScrollView
      className="flex-1 bg-[#F3F4F3]"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{
        paddingHorizontal: 24,
        paddingTop: 20,
        paddingBottom: 120,
      }}
    >
      <HomeBanner />
    </ScrollView>
  );
}
