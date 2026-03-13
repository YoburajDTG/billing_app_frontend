import { useAppTheme } from "@/context/ThemeContext";
import { inventoryDbService } from "@/services/dbService";
import { KEYS, Storage } from "@/services/storage";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import Animated, { FadeInDown, FadeInUp, Layout } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { verticalScale, scale, moderateScale } from "@/utils/responsive";
import {
    Alert,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
    KeyboardAvoidingView,
} from "react-native";

export default function SetPricesScreen() {
  const [vegetables, setVegetables] = useState<any[]>([]);
  const router = useRouter();
  const { t, isDark, language } = useAppTheme();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    loadVegetables();
  }, []);

  const loadVegetables = async () => {
    // Fetch fresh data from local database
    try {
      const res = await inventoryDbService.getAll();
      if (res.data && res.data.length > 0) {
        const data = res.data.map((v: any) => ({
          ...v,
          id: v.vegetable_id || v.id,
          price: v.price || 0,
          wholesalePrice: v.wholesale_price || 0,
          retailPrice: v.retail_price || 0,
          tamilName: v.tamil_name || v.tamilName,
          name: v.name,
        }));
        setVegetables(data);
        Storage.setItem(KEYS.VEGETABLES, data);
      } else {
        const cached = (await Storage.getItem(KEYS.VEGETABLES)) || [];
        setVegetables(cached);
      }
    } catch (e) {
      const cached = (await Storage.getItem(KEYS.VEGETABLES)) || [];
      setVegetables(cached);
    }
  };

  const updatePrice = (
    id: string,
    type: "wholesale" | "retail",
    value: string,
  ) => {
    setVegetables((prev) =>
      prev.map((v) =>
        v.id === id
          ? {
              ...v,
              [type === "wholesale" ? "wholesalePrice" : "retailPrice"]:
                parseFloat(value) || 0,
              // Keep the base price synced with retail for backwards compatibility
              price: type === "retail" ? parseFloat(value) || 0 : v.price,
            }
          : v,
      ),
    );
  };

  const handleSave = async () => {
    try {
      // Save each vegetable's price to database
      for (const v of vegetables) {
        const vegetableId = v.id || v.vegetable_id;
        
        // Update Inventory Log
        await inventoryDbService.dailyPricing({
          vegetable_id: vegetableId,
          price: v.retailPrice || v.price || 0, 
          stock_quantity: 100, // Default
          unit: "kg",
          date: new Date().toISOString().split("T")[0],
        });

        // Crucial: Update the actual vegetables table too so it reflects in POS
        await inventoryDbService.update(vegetableId, {
            wholesale_price: v.wholesalePrice || 0,
            retail_price: v.retailPrice || 0,
            price: v.retailPrice || v.price || 0,
        });
      }

      // Update local storage with new values for faster boot
      await Storage.setItem(KEYS.VEGETABLES, vegetables);

      Alert.alert(
        t.APP_NAME,
        language === "Tamil"
          ? "விலைகள் சேமிக்கப்பட்டன!"
          : "Prices published successfully!",
      );
      router.back();
    } catch (error: any) {
      console.error("Save error:", error);
      Alert.alert(t.APP_NAME, "Failed to publish prices. Try again.");
    }
  };

  const bgCol = isDark ? "#0F0F0F" : "#F8FAFC";
  const cardBg = isDark ? "#1E1E1E" : "#FFFFFF";
  const textCol = isDark ? "#FFFFFF" : "#1E293B";
  const subText = isDark ? "#A1A1AA" : "#64748B";
  const primaryCol = "#FF8C00";
  const borderCol = isDark ? "#2C2C2E" : "#E2E8F0";

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: bgCol }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <LinearGradient
        colors={isDark ? ["#1A1A1A", "#1A1A1A"] : ["#FF8C00", "#FF8C00"]}
        style={[
          styles.header,
          { paddingTop: insets.top + (Platform.OS === "android" ? verticalScale(10) : 0) },
        ]}
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons
            name="arrow-back"
            size={moderateScale(24)}
            color={isDark ? textCol : "#FFF"}
          />
        </TouchableOpacity>
        <View style={styles.headerTextContainer}>
            <Text style={[styles.headerTitle, { color: isDark ? textCol : "#FFF" }]}>
                {language === "Tamil" ? "விலைப்பட்டியல் திருத்தம்" : "Edit Pricing"}
            </Text>
            <Text style={[styles.headerSubtitle, { color: isDark ? subText : "rgba(255,255,255,0.8)" }]}>
                {vegetables.length} {language === "Tamil" ? "பொருட்கள்" : "Items available"}
            </Text>
        </View>
      </LinearGradient>

      <View style={[styles.tableHeaderRow, { borderBottomColor: borderCol }]}>
        <Text style={[styles.headerCol, { color: subText, flex: 1.8, textAlign: 'left', paddingLeft: scale(20) }]}>
          {language === "Tamil" ? "பொருள்" : "Item"}
        </Text>
        <Text style={[styles.headerCol, { color: subText, paddingRight: scale(10) }]}>
          {language === "Tamil" ? "மொத்த" : "Wholesale"}
        </Text>
        <Text style={[styles.headerCol, { color: subText, paddingRight: scale(30) }]}>
          {language === "Tamil" ? "சில்லறை" : "Retail"}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {vegetables.map((v, index) => (
          <Animated.View 
              key={v.id} 
              entering={FadeInUp.delay(50 * Math.min(index, 10)).springify()} 
              layout={Layout.springify()}
              style={[
                  styles.cardRow, 
                  { backgroundColor: cardBg, borderColor: borderCol }
              ]}
          >
            <View style={styles.nameContainer}>
               <Text numberOfLines={1} style={[styles.tamilName, { color: textCol }]}>{v.tamilName || "பொருள்"}</Text>
               <Text numberOfLines={1} style={[styles.englishName, { color: subText }]}>
                 {v.name}
               </Text>
            </View>

            <View style={styles.inputsRow}>
              <View style={styles.inputGroup}>
                <Text style={styles.currencyPrefix}>₹</Text>
                <TextInput
                  style={[styles.priceInput, { backgroundColor: isDark ? "#2C2C2E" : "#F1F5F9", color: textCol, borderColor: borderCol }]}
                  keyboardType="numeric"
                  defaultValue={v.wholesalePrice?.toString()}
                  onChangeText={(val) => updatePrice(v.id, "wholesale", val)}
                  placeholder="0"
                  placeholderTextColor={subText}
                  selectTextOnFocus
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.currencyPrefix}>₹</Text>
                <TextInput
                  style={[styles.priceInput, { backgroundColor: isDark ? "#2C2C2E" : "#F1F5F9", color: primaryCol, borderColor: primaryCol, borderWidth: 1 }]} 
                  keyboardType="numeric"
                  defaultValue={v.retailPrice?.toString()}
                  onChangeText={(val) => updatePrice(v.id, "retail", val)}
                  placeholder="0"
                  placeholderTextColor={subText}
                  selectTextOnFocus
                />
              </View>
            </View>
          </Animated.View>
        ))}
      </ScrollView>

      <View
        style={[
          styles.bottomBar,
          { 
              backgroundColor: bgCol,
              borderTopColor: borderCol,
              borderTopWidth: 1,
              paddingBottom: Math.max(insets.bottom, verticalScale(15))
          },
        ]}
      >
        <TouchableOpacity activeOpacity={0.8} onPress={handleSave}>
            <LinearGradient
                colors={['#FF8C00', '#FFA500']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.saveButton}
            >
                <Text style={styles.saveText}>{language === 'Tamil' ? 'மாற்றங்களைச் சேமி' : 'Publish Prices'}</Text>
                <Ionicons
                    name="cloud-upload-outline"
                    size={moderateScale(20)}
                    color="#FFF"
                    style={{ marginLeft: scale(8) }}
                />
            </LinearGradient>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: scale(20),
    paddingBottom: verticalScale(15),
    borderBottomLeftRadius: scale(25),
    borderBottomRightRadius: scale(25),
    elevation: 5,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    zIndex: 10,
  },
  backBtn: {
    width: moderateScale(40),
    height: moderateScale(40),
    justifyContent: "center",
    alignItems: "flex-start",
  },
  headerTextContainer: { flex: 1 },
  headerTitle: { fontSize: moderateScale(22), fontWeight: "800", letterSpacing: 0.5 },
  headerSubtitle: { fontSize: moderateScale(13), fontWeight: "600", marginTop: 2 },
  
  tableHeaderRow: {
    flexDirection: "row",
    paddingVertical: verticalScale(15),
    borderBottomWidth: 1,
  },
  headerCol: {
    flex: 1,
    fontSize: moderateScale(11),
    fontWeight: "800",
    textAlign: "center",
    textTransform: "uppercase",
    letterSpacing: 1
  },
  
  scroll: { padding: scale(20), paddingBottom: verticalScale(120), paddingTop: 10 },
  cardRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: verticalScale(12),
    padding: scale(16),
    borderRadius: scale(20),
    borderWidth: 1,
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
  },
  nameContainer: {
    flex: 1.8,
    justifyContent: "center",
    paddingRight: scale(10)
  },
  tamilName: { fontSize: moderateScale(17), fontWeight: "800", marginBottom: 2 },
  englishName: { fontSize: moderateScale(12), fontWeight: "600" },
  
  inputsRow: {
    flexDirection: "row",
    flex: 2,
    gap: scale(12),
    justifyContent: "flex-end",
  },
  inputGroup: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    justifyContent: "flex-end",
  },
  currencyPrefix: {
    fontSize: moderateScale(14),
    fontWeight: "700",
    color: "#94A3B8",
    position: "absolute",
    left: scale(8),
    zIndex: 1,
  },
  priceInput: {
    width: "100%",
    height: verticalScale(42),
    borderWidth: 1,
    borderRadius: scale(12),
    paddingLeft: scale(22),
    paddingRight: scale(8),
    textAlign: "center",
    fontSize: moderateScale(16),
    fontWeight: "800",
  },
  
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: scale(20),
    paddingTop: verticalScale(15),
  },
  saveButton: {
    height: verticalScale(56),
    borderRadius: scale(20),
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    elevation: 4,
    shadowColor: "#FF8C00",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  saveText: { color: "#fff", fontSize: moderateScale(16), fontWeight: "800", letterSpacing: 0.5 },
});
