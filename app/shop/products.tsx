import { useAppTheme } from "@/context/ThemeContext";
import { vegetableRepository } from "@/database/repositories/vegetableRepository";
import { Vegetable } from "@/database/schema/vegetables";
import { getVegetableImage } from "@/utils/imageHelper";
import { moderateScale, scale, verticalScale } from "@/utils/responsive";
import { Feather, Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Image,
    KeyboardAvoidingView,
    Modal,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function ProductsScreen() {
  const [products, setProducts] = useState<Vegetable[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Vegetable | null>(null);

  const [name, setName] = useState("");
  const [tamilName, setTamilName] = useState("");
  const [category, setCategory] = useState("");
  const [imageUrl, setImageUrl] = useState("");

  const { isDark, language } = useAppTheme();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    setIsLoading(true);
    try {
      const data = await vegetableRepository.getAll();
      setProducts(data);
    } catch (e) {
      console.error(e);
      Alert.alert(
        language === "Tamil" ? "பிழை" : "Error",
        language === "Tamil"
          ? "பொருட்களை ஏற்றுவதில் தோல்வி"
          : "Failed to load products",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert(
        language === "Tamil" ? "சரிபார்ப்பு பிழை" : "Validation Error",
        language === "Tamil"
          ? "பொருள் பெயர் அவசியம்"
          : "Product Name is required",
      );
      return;
    }

    try {
      if (editingProduct) {
        await vegetableRepository.update(editingProduct.id, {
          name,
          tamil_name: tamilName,
          category: category,
          image_url: imageUrl,
        });
      } else {
        await vegetableRepository.create({
          name,
          tamil_name: tamilName,
          category: category,
          image_url: imageUrl,
        });
      }
      setModalVisible(false);
      resetForm();
      fetchProducts();
    } catch (e) {
      console.error(e);
      Alert.alert(
        language === "Tamil" ? "பிழை" : "Error",
        language === "Tamil"
          ? "பொருளைச் சேமிப்பதில் தோல்வி"
          : "Failed to save product",
      );
    }
  };

  const handleDelete = (id: string) => {
    Alert.alert(
      language === "Tamil" ? "நீக்க உறுதிப்படுத்தவும்" : "Confirm Delete",
      language === "Tamil"
        ? "இந்த பொருளை நீக்க விரும்புகிறீர்களா?"
        : "Are you sure you want to delete this product?",
      [
        { text: language === "Tamil" ? "ரத்து" : "Cancel", style: "cancel" },
        {
          text: language === "Tamil" ? "நீக்கு" : "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await vegetableRepository.delete(id);
              fetchProducts();
            } catch (e) {
              Alert.alert(
                language === "Tamil" ? "பிழை" : "Error",
                language === "Tamil"
                  ? "பொருளை நீக்குவதில் தோல்வி"
                  : "Failed to delete product",
              );
            }
          },
        },
      ],
    );
  };

  const resetForm = () => {
    setName("");
    setTamilName("");
    setCategory("");
    setImageUrl("");
    setEditingProduct(null);
  };

  const openAddModal = () => {
    resetForm();
    setModalVisible(true);
  };

  const openEditModal = (product: Vegetable) => {
    setEditingProduct(product);
    setName(product.name);
    setTamilName(product.tamil_name || "");
    setCategory(product.category || "");
    setImageUrl(product.image_url || "");
    setModalVisible(true);
  };

  const background = isDark ? "#0F0F0F" : "#F8FAFC";
  const cardBg = isDark ? "#1E1E1E" : "#FFFFFF";
  const textColor = isDark ? "#FFF" : "#1E293B";
  const subTextColor = isDark ? "#94A3B8" : "#64748B";
  const primaryColor = "#FF8C00";

  const renderItem = ({ item, index }: { item: Vegetable; index: number }) => (
    <Animated.View
      entering={FadeInUp.delay(30 * index).duration(400)}
      style={[styles.card, { backgroundColor: cardBg }]}
    >
      <View style={styles.cardContent}>
        <Image
          source={getVegetableImage(item.image_url || "", item.name)}
          style={styles.productImage}
        />
        <View style={styles.productInfo}>
          <Text style={[styles.tamilTitle, { color: textColor }]}>
            {item.tamil_name || item.name}
          </Text>
          <Text style={[styles.engTitle, { color: subTextColor }]}>
            {item.name}
          </Text>
          {item.category ? (
            <View
              style={[
                styles.catBadge,
                { backgroundColor: primaryColor + "10" },
              ]}
            >
              <Text style={[styles.catBadgeText, { color: primaryColor }]}>
                {item.category}
              </Text>
            </View>
          ) : null}
        </View>
        <View style={styles.actionGroup}>
          <TouchableOpacity
            onPress={() => openEditModal(item)}
            style={styles.iconBtn}
          >
            <Feather name="edit-2" size={18} color="#94A3B8" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => item.id && handleDelete(item.id)}
            style={styles.iconBtn}
          >
            <Feather name="trash-2" size={18} color="#EF4444" />
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );

  return (
    <View style={[styles.container, { backgroundColor: background }]}>
      <StatusBar style="light" backgroundColor="#FF8C00" />

      <LinearGradient
        colors={["#FF8C00", "#FFA500"]}
        style={[styles.header, { paddingTop: insets.top + verticalScale(20) }]}
      >
        <View style={styles.headerDecor} />
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.headerTitle}>
              {language === "Tamil" ? "பொருட்கள்" : "Products"}
            </Text>
            <Text style={styles.headerSubtitle}>
              {products.length}{" "}
              {language === "Tamil"
                ? "பொருட்கள் பட்டியலில் உள்ளன"
                : "items in inventory"}
            </Text>
          </View>
          <TouchableOpacity style={styles.addTrigger} onPress={openAddModal}>
            <Ionicons name="add" size={28} color="#FF8C00" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {isLoading ? (
        <View style={styles.loaderBox}>
          <ActivityIndicator size="large" color={primaryColor} />
        </View>
      ) : products.length === 0 ? (
        <View style={styles.emptyBox}>
          <View style={styles.emptyIconCircle}>
            <Feather name="box" size={40} color="#CBD5E1" />
          </View>
          <Text style={[styles.emptyTitle, { color: textColor }]}>
            {language === "Tamil"
              ? "பொருட்கள் எதுவும் இல்லை"
              : "No products yet"}
          </Text>
          <Text style={[styles.emptyDesc, { color: subTextColor }]}>
            {language === "Tamil"
              ? "விற்பனையைத் தொடங்க உங்கள் சரக்கு பொருட்களை இங்கே சேர்க்கவும்."
              : "Add your inventory items to start billing them on the PoS screen."}
          </Text>
          <TouchableOpacity
            style={[styles.emptyAddBtn, { backgroundColor: primaryColor }]}
            onPress={openAddModal}
          >
            <Text style={styles.emptyAddBtnText}>
              {language === "Tamil"
                ? "முதல் பொருளைச் சேர்க்கவும்"
                : "Add First Product"}
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={products}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={[
            styles.listContainer,
            {
              flexGrow: 1,
              paddingBottom: Math.max(insets.bottom, verticalScale(30)),
            },
          ]}
          showsVerticalScrollIndicator={false}
        />
      )}

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalShade}
        >
          <TouchableOpacity
            style={styles.modalBlur}
            activeOpacity={1}
            onPress={() => setModalVisible(false)}
          />
          <Animated.View
            entering={FadeInDown.duration(300)}
            style={[
              styles.sheet,
              {
                backgroundColor: cardBg,
                paddingBottom:
                  Math.max(insets.bottom, verticalScale(20)) + scale(10),
              },
            ]}
          >
            <View style={styles.sheetHandle} />
            <Text style={[styles.sheetTitle, { color: textColor }]}>
              {editingProduct
                ? language === "Tamil"
                  ? "பொருளைப் புதுப்பி"
                  : "Update Product"
                : language === "Tamil"
                  ? "புதிய பொருள்"
                  : "New Product"}
            </Text>

            <View style={styles.inputWrapper}>
              <Text style={[styles.inputLabel, { color: subTextColor }]}>
                {language === "Tamil"
                  ? "பொருள் பெயர் (ஆங்கிலம்)"
                  : "Product Name (English)"}
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    color: textColor,
                    borderColor: isDark ? "#333" : "#E2E8F0",
                    backgroundColor: isDark ? "#2C2C2C" : "#F8FAFC",
                  },
                ]}
                value={name}
                onChangeText={setName}
                placeholder={
                  language === "Tamil" ? "எ.கா. தக்காளி" : "e.g. Tomato"
                }
                placeholderTextColor="#94A3B8"
              />
            </View>

            <View style={styles.inputWrapper}>
              <Text style={[styles.inputLabel, { color: subTextColor }]}>
                {language === "Tamil"
                  ? "பொருள் பெயர் (தமிழ்)"
                  : "Regional Name (Tamil)"}
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    color: textColor,
                    borderColor: isDark ? "#333" : "#E2E8F0",
                    backgroundColor: isDark ? "#2C2C2C" : "#F8FAFC",
                  },
                ]}
                value={tamilName}
                onChangeText={setTamilName}
                placeholder={
                  language === "Tamil" ? "எ.கா. தக்காளி" : "எ.கா. தக்காளி"
                }
                placeholderTextColor="#94A3B8"
              />
            </View>

            <View style={styles.inputWrapper}>
              <Text style={[styles.inputLabel, { color: subTextColor }]}>
                {language === "Tamil" ? "வகை" : "Category"}
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    color: textColor,
                    borderColor: isDark ? "#333" : "#E2E8F0",
                    backgroundColor: isDark ? "#2C2C2C" : "#F8FAFC",
                  },
                ]}
                value={category}
                onChangeText={setCategory}
                placeholder={
                  language === "Tamil"
                    ? "காய்கறிகள், கீரைகள் போன்றவை..."
                    : "Essentials, Roots, etc."
                }
                placeholderTextColor="#94A3B8"
              />
            </View>

            <View style={styles.sheetActions}>
              <TouchableOpacity
                style={[styles.sheetBtn, styles.closeSheetBtn]}
                onPress={() => setModalVisible(false)}
              >
                <Text style={[styles.closeSheetText, { color: subTextColor }]}>
                  {language === "Tamil" ? "ரத்து" : "Cancel"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.sheetBtn,
                  styles.saveSheetBtn,
                  { backgroundColor: primaryColor },
                ]}
                onPress={handleSave}
              >
                <Text style={styles.saveSheetText}>
                  {editingProduct
                    ? language === "Tamil"
                      ? "புதுப்பிக்கவும்"
                      : "Update"
                    : language === "Tamil"
                      ? "சேர்க்கவும்"
                      : "Add Item"}
                </Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: scale(25),
    paddingBottom: verticalScale(30),
    borderBottomLeftRadius: scale(32),
    borderBottomRightRadius: scale(32),
    overflow: "hidden",
  },
  headerDecor: {
    position: "absolute",
    width: scale(240),
    height: scale(240),
    borderRadius: scale(120),
    backgroundColor: "rgba(255,255,255,0.1)",
    top: -scale(100),
    right: -scale(60),
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: moderateScale(28),
    fontWeight: "900",
    color: "#FFF",
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: moderateScale(14),
    color: "rgba(255,255,255,0.8)",
    fontWeight: "600",
    marginTop: verticalScale(2),
  },
  addTrigger: {
    width: scale(52),
    height: scale(52),
    borderRadius: scale(26),
    backgroundColor: "#FFF",
    alignItems: "center",
    justifyContent: "center",
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
  },
  loaderBox: { flex: 1, alignItems: "center", justifyContent: "center" },
  listContainer: { padding: scale(20), paddingBottom: verticalScale(40) },
  card: {
    borderRadius: scale(20),
    padding: scale(12),
    marginBottom: verticalScale(14),
    elevation: 3,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  cardContent: { flexDirection: "row", alignItems: "center" },
  productImage: {
    width: scale(56),
    height: scale(56),
    borderRadius: scale(14),
    backgroundColor: "#F8FAFC",
    marginRight: scale(14),
  },
  productInfo: { flex: 1 },
  tamilTitle: {
    fontSize: moderateScale(17),
    fontWeight: "800",
    marginBottom: 1,
  },
  engTitle: {
    fontSize: moderateScale(12),
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: verticalScale(6),
  },
  catBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: scale(8),
    paddingVertical: verticalScale(3),
    borderRadius: scale(6),
  },
  catBadgeText: {
    fontSize: moderateScale(10),
    fontWeight: "800",
    textTransform: "uppercase",
  },
  actionGroup: { flexDirection: "row", gap: scale(2) },
  iconBtn: { padding: scale(8) },
  emptyBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: scale(40),
  },
  emptyIconCircle: {
    width: scale(100),
    height: scale(100),
    borderRadius: scale(50),
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: verticalScale(20),
  },
  emptyTitle: {
    fontSize: moderateScale(20),
    fontWeight: "800",
    marginBottom: verticalScale(8),
  },
  emptyDesc: {
    fontSize: moderateScale(14),
    textAlign: "center",
    lineHeight: moderateScale(22),
    marginBottom: verticalScale(30),
  },
  emptyAddBtn: {
    paddingHorizontal: scale(30),
    paddingVertical: verticalScale(15),
    borderRadius: scale(16),
    elevation: 5,
  },
  emptyAddBtnText: {
    color: "#FFF",
    fontWeight: "800",
    fontSize: moderateScale(16),
  },
  modalShade: { flex: 1, justifyContent: "flex-end" },
  modalBlur: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  sheet: {
    borderTopLeftRadius: scale(32),
    borderTopRightRadius: scale(32),
    padding: scale(25),
    paddingBottom: verticalScale(Platform.OS === "ios" ? 40 : 25),
  },
  sheetHandle: {
    width: scale(40),
    height: verticalScale(5),
    backgroundColor: "#E2E8F0",
    borderRadius: 3,
    alignSelf: "center",
    marginBottom: verticalScale(20),
  },
  sheetTitle: {
    fontSize: moderateScale(22),
    fontWeight: "900",
    marginBottom: verticalScale(25),
  },
  inputWrapper: { marginBottom: verticalScale(18) },
  inputLabel: {
    fontSize: moderateScale(13),
    fontWeight: "700",
    marginBottom: verticalScale(8),
    letterSpacing: 0.3,
  },
  input: {
    height: verticalScale(52),
    borderRadius: scale(16),
    borderWidth: 1.5,
    paddingHorizontal: scale(18),
    fontSize: moderateScale(16),
    fontWeight: "600",
  },
  sheetActions: {
    flexDirection: "row",
    gap: scale(15),
    marginTop: verticalScale(10),
  },
  sheetBtn: {
    flex: 1,
    height: verticalScale(58),
    borderRadius: scale(20),
    alignItems: "center",
    justifyContent: "center",
  },
  closeSheetBtn: { backgroundColor: "transparent" },
  saveSheetBtn: {
    elevation: 8,
    shadowColor: "#FF8C00",
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
  },
  closeSheetText: { fontSize: moderateScale(16), fontWeight: "700" },
  saveSheetText: {
    color: "#FFF",
    fontSize: moderateScale(18),
    fontWeight: "800",
  },
});
