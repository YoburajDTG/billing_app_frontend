import { useAppTheme } from "@/context/ThemeContext";
import { inventoryDbService } from "@/services/dbService";
import { KEYS, Storage } from "@/services/storage";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import Animated, { FadeInUp, Layout } from "react-native-reanimated";
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
  const { t, isDark, language, primaryColor } = useAppTheme();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    loadVegetables();
  }, []);

  const loadVegetables = async () => {
    // Fetch all vegetables with their latest pricing from local database
    try {
      const res = await inventoryDbService.getAll();
      if (res.data && res.data.length > 0) {
        const data = res.data.map((v: any) => {
           const retailPrice = v.retail_price || v.base_price || v.last_logged_price || 0;
           const wholesalePrice = v.wholesale_price || Math.floor(retailPrice * 0.75);
           
           return {
              ...v,
              id: v.id,
              price: retailPrice,
              wholesalePrice: wholesalePrice,
              retailPrice: retailPrice,
              tamilName: v.tamil_name || v.tamilName,
              name: v.name,
           };
        });

        // Priority Sorting based on user request
        const priorityTamilNames = ["பச்சை மிளகாய்", "தக்காளி", "வெங்காயம்", "உருளை", "கேரட்", "பீன்ஸ்"];
        
        const sortedData = [...data].sort((a, b) => {
          const aIndex = priorityTamilNames.indexOf(a.tamilName);
          const bIndex = priorityTamilNames.indexOf(b.tamilName);
          
          if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
          if (aIndex !== -1) return -1;
          if (bIndex !== -1) return 1;
          
          return (a.name || "").localeCompare(b.name || "");
        });

        setVegetables(sortedData);
        Storage.setItem(KEYS.VEGETABLES, sortedData);
      } else {
        const cached = (await Storage.getItem(KEYS.VEGETABLES)) || [];
        setVegetables(cached);
      }
    } catch (e) {
      console.error("Load price error:", e);
      const cached = (await Storage.getItem(KEYS.VEGETABLES)) || [];
      setVegetables(cached);
    }
  };

  const updatePrice = (
    id: string,
    type: "wholesale" | "retail",
    value: string,
  ) => {
    const sanitized = value.replace(/[^0-9.]/g, '');
    const parts = sanitized.split('.');
    const finalVal = parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : sanitized;
    const numVal = parseFloat(finalVal) || 0;

    setVegetables((prev) =>
      prev.map((v) =>
        v.id === id
          ? {
              ...v,
              [type === "wholesale" ? "wholesalePrice" : "retailPrice"]: numVal,
              // Keep the base price synced with retail for backwards compatibility
              price: type === "retail" ? numVal : v.price,
            }
          : v,
      ),
    );
  };

  const handleSave = async () => {
    // Validation
    const hasNegative = vegetables.some(v => (v.wholesalePrice || 0) < 0 || (v.retailPrice || 0) < 0);
    if (hasNegative) {
      Alert.alert(
        language === 'Tamil' ? 'பிழை' : 'Invalid Price',
        language === 'Tamil' ? 'விலை எதிர்மறையாக இருக்கக்கூடாது' : 'Prices cannot be negative'
      );
      return;
    }

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
  const primaryCol = primaryColor;
  const borderCol = isDark ? "#2C2C2E" : "#E2E8F0";

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: bgCol }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <LinearGradient
        colors={isDark ? ["#1A1A1A", "#1A1A1A"] : [primaryColor, primaryColor]}
        style={[
          styles.header,
          { 
            paddingTop: insets.top + (Platform.OS === "android" ? verticalScale(15) : verticalScale(10)),
            shadowColor: primaryColor,
            shadowOpacity: 0.2,
            shadowOffset: { width: 0, height: 10 },
            shadowRadius: 15,
          },
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
        <View style={styles.headerPillContainer}>
            <View style={[styles.typePill, { backgroundColor: '#3B82F615' }]}>
                <Text style={[styles.typePillText, { color: '#3B82F6' }]}>
                    {language === "Tamil" ? "மொத்த" : "Ws"}
                </Text>
            </View>
        </View>
        <View style={styles.headerPillContainer}>
            <View style={[styles.typePill, { backgroundColor: primaryCol + '15' }]}>
                <Text style={[styles.typePillText, { color: primaryCol }]}>
                    {language === "Tamil" ? "சில்லறை" : "Ret"}
                </Text>
            </View>
        </View>
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
                <View style={[styles.inputPrefixBox, { backgroundColor: '#3B82F615' }]}>
                  <Ionicons name="business" size={moderateScale(12)} color="#3B82F6" />
                </View>
                <TextInput
                  style={[
                      styles.priceInput, 
                      { 
                          backgroundColor: isDark ? "#121212" : "#F8FAFC", 
                          color: textCol, 
                          borderColor: '#3B82F640',
                          borderWidth: 1 
                      }
                  ]}
                  keyboardType="numeric"
                  defaultValue={v.wholesalePrice?.toString()}
                  onChangeText={(val) => updatePrice(v.id, "wholesale", val)}
                  placeholder="0"
                  placeholderTextColor={subText}
                  selectTextOnFocus
                />
              </View>

              <View style={styles.inputGroup}>
                <View style={[styles.inputPrefixBox, { backgroundColor: primaryCol + '15' }]}>
                  <Ionicons name="cart" size={moderateScale(12)} color={primaryCol} />
                </View>
                <TextInput
                  style={[
                      styles.priceInput, 
                      { 
                          backgroundColor: isDark ? "#121212" : "#F8FAFC", 
                          color: textCol, 
                          borderColor: primaryCol + '50', 
                          borderWidth: 1.5 
                      }
                  ]} 
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
                colors={[primaryColor, primaryColor]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.saveButton, { shadowColor: primaryColor, shadowOffset: { width: 0, height: 6 } }]}
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
    paddingBottom: verticalScale(30),
    borderBottomLeftRadius: scale(32),
    borderBottomRightRadius: scale(32),
    elevation: 8,
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
    fontSize: moderateScale(11),
    fontWeight: "800",
    textAlign: "center",
    textTransform: "uppercase",
    letterSpacing: 1
  },
  headerPillContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingRight: scale(10)
  },
  typePill: {
    paddingHorizontal: scale(10),
    paddingVertical: verticalScale(4),
    borderRadius: scale(8),
    alignItems: 'center',
    justifyContent: 'center',
  },
  typePillText: {
    fontSize: moderateScale(10),
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  
  scroll: { padding: scale(20), paddingBottom: verticalScale(120), paddingTop: 10 },
  cardRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: verticalScale(12),
    padding: scale(12),
    borderRadius: scale(20),
    borderWidth: 1,
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
  },
  nameContainer: {
    flex: 1.6,
    justifyContent: "center",
    paddingRight: scale(6)
  },
  tamilName: { fontSize: moderateScale(16), fontWeight: "800", marginBottom: 2 },
  englishName: { fontSize: moderateScale(11), fontWeight: "600" },
  
  inputsRow: {
    flexDirection: "row",
    flex: 2.2,
    gap: scale(10),
    justifyContent: "flex-end",
  },
  inputGroup: {
    flex: 1,
    position: 'relative',
  },
  inputPrefixBox: {
    position: 'absolute',
    left: scale(6),
    top: verticalScale(6),
    zIndex: 10,
    width: scale(22),
    height: scale(22),
    borderRadius: scale(6),
    alignItems: 'center',
    justifyContent: 'center',
  },
  priceInput: {
    width: "100%",
    height: verticalScale(46),
    borderRadius: scale(12),
    paddingLeft: scale(10),
    paddingTop: verticalScale(12),
    textAlign: "center",
    fontSize: moderateScale(16),
    fontWeight: "900",
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
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  saveText: { color: "#fff", fontSize: moderateScale(16), fontWeight: "800", letterSpacing: 0.5 },
});
