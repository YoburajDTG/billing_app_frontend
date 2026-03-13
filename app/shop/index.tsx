import { SOUTHERN_VEGETABLES } from "@/constants/Vegetables";
import { useAuth } from "@/context/AuthContext";
import { useAppTheme } from "@/context/ThemeContext";
import { inventoryDbService, vegetableDbService } from "@/services/dbService";
import { KEYS, Storage } from "@/services/storage";
import { getVegetableImage } from "@/utils/imageHelper";
import { generateBillPDF } from "@/utils/pdfGenerator";
import { moderateScale, scale, verticalScale } from "@/utils/responsive";
import { SyncManager } from "@/utils/syncManager";
import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  Image,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import Animated, { FadeInDown, SlideInUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Data Types
type Vegetable = {
  id: string;
  name: string;
  tamilName: string;
  image: string;
  price: number;
  category?: string;
  wholesalePrice?: number;
  retailPrice?: number;
  vegetableId?: number;
};

type BillItem = Vegetable & {
  quantity: number; // in kg
  total: number;
  isCustom?: boolean;
  itemDiscount?: number;
};

const CATEGORIES = [
  "All Items",
  "Favourites",
  "Essentials",
  "Root Veggies",
  "Greens",
  "Gourds",
  "Others",
];

export default function ShopScreen() {
  const { user } = useAuth();
  const navigation = useNavigation();
  const router = useRouter();
  const { mode } = useLocalSearchParams<{ mode: string }>();
  const [isWholesale, setIsWholesale] = useState(mode === "wholesale");
  const [viewMode, setViewMode] = useState<"list" | "card">("list");
  const insets = useSafeAreaInsets();

  const { t, theme, isDark, toggleTheme, language } = useAppTheme();

  // States
  const [allVegetables, setAllVegetables] = useState<Vegetable[]>([]);
  const [cart, setCart] = useState<BillItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All Items");
  const [settingsMenuVisible, setSettingsMenuVisible] = useState(false);

  // Modal States
  const [modalVisible, setModalVisible] = useState(false);
  const [billPreviewVisible, setBillPreviewVisible] = useState(false);
  const [selectedVeg, setSelectedVeg] = useState<Vegetable | null>(null);
  const [qtyInput, setQtyInput] = useState("");
  const [priceInput, setPriceInput] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [discount, setDiscount] = useState(0);

  useEffect(() => {
    // Hide default header
    navigation.setOptions({ headerShown: false });
    loadVegetables();
  }, []);

  useEffect(() => {
    if (
      user?.top_selling_vegetables &&
      user.top_selling_vegetables.length > 0
    ) {
      setSelectedCategory("Favourites");
    }
  }, [user]);

  // Helper to assign mock categories based on name for sorting demo
  const assignCategory = (veg: any) => {
    if (!veg || !veg.name) return "Others";
    const name = veg.name.toLowerCase();
    if (
      ["onion", "tomato", "potato", "green chilli", "ginger"].some((k) =>
        name.includes(k),
      )
    )
      return "Essentials";
    if (
      ["carrot", "beetroot", "radish", "yam", "taro", "colocasia"].some((k) =>
        name.includes(k),
      )
    )
      return "Root Veggies";
    if (
      ["spinach", "coriander", "curry leaves", "mint", "greens"].some((k) =>
        name.includes(k),
      )
    )
      return "Greens";
    if (["gourd", "pumpkin", "cucumber"].some((k) => name.includes(k)))
      return "Gourds";
    return "Others";
  };

  const getRealImage = (name: string, defaultImage: string) => {
    if (!name) return defaultImage;
    const searchName = name.toLowerCase();
    const match = SOUTHERN_VEGETABLES.find((v) => {
      const vName = (v.name || "").toLowerCase();
      return vName === searchName || searchName.includes(vName);
    });
    return match ? match.image : defaultImage;
  };

  const loadVegetables = async () => {
    try {
      // Fetch from local SQLite database
      const res = await inventoryDbService.getAll();

      if (res && res.data && res.data.length > 0) {
        const validated = res.data.map((v: any) => {
          const name = v.name || "Unknown Item";
          return {
            id: v.vegetable_id || v.id,
            name: name,
            tamilName: v.tamil_name || "",
            image: getRealImage(
              name,
              "https://cdn-icons-png.flaticon.com/512/135/135687.png",
            ),
            category: v.category || assignCategory(v),
            price: v.price || 0,
          };
        });
        setAllVegetables(validated);
        Storage.setItem(KEYS.VEGETABLES, validated);
      } else {
        // If no inventory data, load vegetables and use default prices
        const vegetables = await vegetableDbService.getAll();
        if (vegetables && vegetables.data && vegetables.data.length > 0) {
          const validated = vegetables.data.map((v: any) => {
            const name = v.name || "Unknown Item";
            return {
              id: v.id,
              name: name,
              tamilName: v.tamil_name || "",
              image: getRealImage(
                name,
                "https://cdn-icons-png.flaticon.com/512/135/135687.png",
              ),
              category: v.category || assignCategory(v),
              price: 30, // Default price
            };
          });
          setAllVegetables(validated);
          Storage.setItem(KEYS.VEGETABLES, validated);
        }
      }
    } catch (error) {
      console.error("Error loading vegetables:", error);
      // Fallback to cache
      try {
        const cached = await Storage.getItem(KEYS.VEGETABLES);
        if (cached && Array.isArray(cached)) {
          const withCategories = cached.map((v: any) => ({
            ...v,
            name: v.name || "Unknown Item",
            category: v.category || assignCategory(v),
          }));
          setAllVegetables(withCategories);
        }
      } catch (storageError) {
        console.error("Storage fallback failed:", storageError);
      }
    }
  };

  // Derived Logic
  const displayVegetables = useMemo(() => {
    return allVegetables.map((v) => ({
      ...v,
      price: isWholesale
        ? v.wholesalePrice || Math.floor(v.price * 0.75)
        : v.price,
    }));
  }, [allVegetables, isWholesale]);

  const filteredData = useMemo(() => {
    let data = displayVegetables;

    // Search Filter
    if (searchQuery) {
      data = data.filter(
        (v) =>
          v.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          v.tamilName.includes(searchQuery),
      );
    }

    // Category Filter
    if (selectedCategory === "Favourites") {
      if (
        user?.top_selling_vegetables &&
        user.top_selling_vegetables.length > 0
      ) {
        data = data.filter((v) => user.top_selling_vegetables?.includes(v.id));
      } else {
        data = [];
      }
    } else if (selectedCategory !== "All Items") {
      data = data.filter((v) => v.category === selectedCategory);
    }

    // Apply Priority Sorting
    const priorityItems = [
      "Green Chilli",
      "Tomato",
      "Onion",
      "Potato",
      "Green Beans",
      "Carrot",
    ];
    return [...data].sort((a, b) => {
      const aIdx = priorityItems.indexOf(a.name);
      const bIdx = priorityItems.indexOf(b.name);

      if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
      if (aIdx !== -1) return -1;
      if (bIdx !== -1) return 1;
      return 0;
    });
  }, [displayVegetables, searchQuery, selectedCategory, user]);

  const cartTotal = cart.reduce((sum, item) => sum + item.total, 0);

  // Cart Logic
  const handleUpdateCart = (veg: Vegetable, change: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const existingIdx = cart.findIndex((i) => i.id === veg.id);
    let newCart = [...cart];

    if (existingIdx >= 0) {
      const currentItem = newCart[existingIdx];
      const newQty = Math.max(
        0,
        parseFloat((currentItem.quantity + change).toFixed(2)),
      );

      if (newQty === 0) {
        newCart.splice(existingIdx, 1);
      } else {
        newCart[existingIdx] = {
          ...currentItem,
          quantity: newQty,
          total: newQty * currentItem.price,
        };
      }
    } else if (change > 0) {
      // Add new item
      newCart.push({
        ...veg,
        quantity: change,
        itemDiscount: 0,
        total: change * veg.price,
      });
    }
    setCart(newCart);
  };

  const handleItemPress = (veg: Vegetable) => {
    const existing = cart.find((i) => i.id === veg.id);
    if (existing) {
      // Item is already in cart, remove it
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const filtered = cart.filter((i) => i.id !== veg.id);
      setCart(filtered);
    } else {
      // Item not in cart, open manual entry modal
      handleManualEntry(veg);
    }
  };

  const handleManualEntry = (veg: Vegetable) => {
    setSelectedVeg(veg);
    setQtyInput("");
    const existing = cart.find((i) => i.id === veg.id);
    setPriceInput(existing ? existing.price.toString() : veg.price.toString());
    setModalVisible(true);
  };

  const confirmManualEntry = () => {
    if (!selectedVeg || !qtyInput) return;
    const qty = parseFloat(qtyInput);
    const price = parseFloat(priceInput);

    if (isNaN(qty) || isNaN(price)) return;

    const newItem: BillItem = {
      ...selectedVeg,
      quantity: qty,
      price: price, // Allow price override
      itemDiscount: 0,
      total: qty * price,
    };

    // remove existing if any to replace
    const filtered = cart.filter((i) => i.id !== selectedVeg.id);
    setCart([...filtered, newItem]);
    setModalVisible(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleCheckout = () => {
    if (cart.length === 0) return;
    setBillPreviewVisible(true);
  };

  const finalizeBill = async () => {
    // Proceed to print/save
    try {
      const [mName, mNumber] = await Promise.all([
        Storage.getItem(KEYS.MERCHANT_NAME),
        Storage.getItem(KEYS.MERCHANT_NUMBER),
      ]);

      const billData = {
        shopName: mName || "சுஜி காய்கறி கடை",
        logo: "Logo_bill.png",
        phone: mNumber || "9095938085",
        address: "", // Leave blank to use Tamil default in generator
        userName: customerName || (language === 'Tamil' ? 'வாடிக்கையாளர்' : 'Walk-in Customer'),
        billNumber: `BILL-${Date.now()}`,
        date: new Date().toLocaleString("en-IN"),
        mode: isWholesale ? "Wholesale" : "Retail",
        language: language,
        items: cart.map((item) => ({
          id: item.id,
          name: item.tamilName || item.name,
          tamilName: item.tamilName,
          quantity: item.quantity,
          price: item.price,
          discount: item.itemDiscount || 0,
          total: parseFloat(item.total.toFixed(2)),
        })),
        subTotal: parseFloat(cartTotal.toFixed(2)),
        discount: parseFloat(discount.toString()) || 0,
        grandTotal: parseFloat((cartTotal - (parseFloat(discount.toString()) || 0)).toFixed(2)),
      } as any;

      await SyncManager.queueBill(billData);
      await generateBillPDF(billData);
      Alert.alert("Success", "Bill Generated Successfully");
      setCart([]);
      setBillPreviewVisible(false);
      setCustomerName("");
      setDiscount(0);
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Could not generate bill");
    }
  };

  const updateCartItemInPreview = (
    id: string,
    newQty: string,
    newPrice: string,
    newDisc: string = "0",
  ) => {
    const qty = parseFloat(newQty);
    const price = parseFloat(newPrice);
    const disc = parseFloat(newDisc) || 0;

    if (isNaN(qty) || isNaN(price)) return;

    setCart((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              quantity: qty,
              price: price,
              itemDiscount: disc,
              total: qty * price - disc,
            }
          : item,
      ),
    );
  };

  const getItemQty = (id: string) => {
    const item = cart.find((i) => i.id === id);
    return item ? item.quantity : 0;
  };

  const navigateToSettings = (type: "profile" | "pricing" | "customers") => {
    setSettingsMenuVisible(false);
    if (type === "pricing") {
      router.push("/shop/prices");
    } else if (type === "profile") {
      router.push("/shop/profile");
    } else if (type === "customers") {
      router.push("/shop/customers");
    }
  };

  // UI Components
  const renderCartBadge = () => (
    <View style={styles.cartBadge}>
      <Text style={styles.cartBadgeText}>{cart.length}</Text>
    </View>
  );

  const primaryColor = "#FF8C00";
  const accentColor = "#FFA000";
  const textColor = isDark ? "#FFFFFF" : "#1A1C1E";
  const labelColor = isDark ? "#BBB" : "#6B7280";
  const cardBg = isDark ? "#1E1E1E" : "#FFFFFF";
  const bg = isDark ? "#0F0F0F" : "#F0F2F5";
  const borderCol = isDark ? "#2C2C2E" : "#E5E7EB";

  const renderCard = ({ item }: { item: Vegetable }) => {
    const qty = getItemQty(item.id);
    const isSelected = qty > 0;

    return (
      <TouchableOpacity
        activeOpacity={0.9}
        style={[
          styles.card,
          {
            backgroundColor: cardBg,
            borderColor: isSelected ? primaryColor : borderCol,
            borderWidth: isSelected ? scale(2) : scale(1),
          },
        ]}
        onPress={() => handleItemPress(item)}
      >
        {isSelected && (
          <View style={styles.checkBadge}>
            <Feather name="check" size={12} color="#FFF" />
          </View>
        )}

        <Image
          source={getVegetableImage(item.image, item.name)}
          style={styles.cardInfoImage}
        />

        <View style={styles.cardDetails}>
          <Text
            numberOfLines={1}
            style={[styles.cardTamilName, { color: textColor }]}
          >
            {item.tamilName}{" "}
            <Text
              style={{
                fontSize: moderateScale(11),
                fontWeight: "600",
                opacity: 0.7,
              }}
            >
              ({item.name})
            </Text>
          </Text>

          <View style={[styles.priceRow, isSelected ? { flexDirection: 'column', alignItems: 'stretch', gap: 4, marginTop: verticalScale(4) } : {}]}>
            <Text style={[styles.priceText, { color: primaryColor }, isSelected ? { marginBottom: verticalScale(6) } : {}]}>
              ₹{item.price}
              <Text style={[styles.unitText, { color: labelColor }]}>/kg</Text>
            </Text>

            {!isSelected ? (
              <TouchableOpacity
                style={[
                  styles.addBtn,
                  {
                    backgroundColor: primaryColor + "15",
                    borderColor: primaryColor + "30",
                    borderWidth: 1,
                  },
                ]}
                onPress={(e) => {
                  e.stopPropagation(); // prevent card click
                  handleUpdateCart(item, isWholesale ? 1 : 0.25);
                }}
              >
                <MaterialCommunityIcons
                  name="plus"
                  size={24}
                  color={primaryColor}
                />
              </TouchableOpacity>
            ) : (
              <View
                style={[
                  styles.stepper,
                  {
                    backgroundColor: isDark ? "#2C2C2E" : "#F3F4F6",
                    borderColor: borderCol,
                    borderWidth: 1,
                    width: "100%",
                    justifyContent: "space-between",
                    paddingHorizontal: scale(4)
                  },
                ]}
              >
                <TouchableOpacity
                  style={styles.stepBtn}
                  onPress={(e) => {
                    e.stopPropagation();
                    handleUpdateCart(item, isWholesale ? -0.5 : -0.25);
                  }}
                >
                  <Feather name="minus" size={16} color={textColor} />
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={(e) => {
                    e.stopPropagation();
                    handleManualEntry(item);
                  }}
                >
                  <Text style={[styles.stepVal, { color: textColor }]}>
                    {qty}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.stepBtn, { backgroundColor: primaryColor }]}
                  onPress={(e) => {
                    e.stopPropagation();
                    handleUpdateCart(item, isWholesale ? 0.5 : 0.25);
                  }}
                >
                  <Feather name="plus" size={16} color="#FFF" />
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderListItem = ({ item }: { item: Vegetable }) => {
    const qty = getItemQty(item.id);
    const isSelected = qty > 0;

    return (
      <TouchableOpacity
        activeOpacity={0.9}
        style={[
          styles.listItem,
          {
            backgroundColor: cardBg,
            borderColor: isSelected ? primaryColor : borderCol,
            borderWidth: isSelected ? scale(2) : scale(1),
          },
        ]}
        onPress={() => handleItemPress(item)}
      >
        {isSelected && (
          <View
            style={[styles.checkBadge, { top: -scale(6), right: -scale(6) }]}
          >
            <Feather name="check" size={12} color="#FFF" />
          </View>
        )}

        <Image
          source={getVegetableImage(item.image, item.name)}
          style={styles.listImage}
        />

        <View style={styles.listDetails}>
          <Text
            numberOfLines={1}
            style={[styles.listTamilName, { color: textColor }]}
          >
            {item.tamilName}{" "}
            <Text
              style={{
                fontSize: moderateScale(11),
                fontWeight: "600",
                opacity: 0.7,
              }}
            >
              ({item.name})
            </Text>
          </Text>

          <View style={styles.listPriceRow}>
            <Text style={[styles.listPriceText, { color: primaryColor }]}>
              ₹{item.price}
              <Text style={[styles.listUnitText, { color: labelColor }]}>
                /kg
              </Text>
            </Text>
          </View>
        </View>

        <View style={styles.listActionCol}>
          {!isSelected ? (
            <TouchableOpacity
              style={[
                styles.addBtn,
                {
                  backgroundColor: primaryColor + "15",
                  borderColor: primaryColor + "30",
                  borderWidth: 1,
                },
              ]}
              onPress={(e) => {
                e.stopPropagation();
                handleUpdateCart(item, isWholesale ? 1 : 0.25);
              }}
            >
              <MaterialCommunityIcons
                name="plus"
                size={24}
                color={primaryColor}
              />
            </TouchableOpacity>
          ) : (
            <View
              style={[
                styles.stepper,
                {
                  backgroundColor: isDark ? "#2C2C2E" : "#F3F4F6",
                  borderColor: borderCol,
                  borderWidth: 1,
                  paddingHorizontal: scale(4),
                  minWidth: scale(105),
                  justifyContent: "space-between",
                },
              ]}
            >
              <TouchableOpacity
                style={styles.stepBtnSmall}
                onPress={(e) => {
                  e.stopPropagation();
                  handleUpdateCart(item, isWholesale ? -0.5 : -0.25);
                }}
              >
                <Feather name="minus" size={14} color={textColor} />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={(e) => {
                  e.stopPropagation();
                  handleManualEntry(item);
                }}
              >
                <Text style={[styles.stepVal, { color: textColor }]}>
                  {qty}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.stepBtnSmall, { backgroundColor: primaryColor }]}
                onPress={(e) => {
                  e.stopPropagation();
                  handleUpdateCart(item, isWholesale ? 0.5 : 0.25);
                }}
              >
                <Feather name="plus" size={14} color="#FFF" />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <StatusBar
        style={isDark ? "light" : "light"}
        backgroundColor={isDark ? "#1A1A1A" : "#FF8C00"}
      />

      {/* Header */}
      <LinearGradient
        colors={isDark ? ["#1A1A1A", "#1A1A1A"] : ["#FF8C00", "#FF8C00"]}
        style={[
          styles.header,
          { paddingTop: insets.top + (Platform.OS === "android" ? 10 : 0) },
        ]}
      >
        <View>
          <Text
            style={[styles.shopTitle, { color: isDark ? textColor : "#FFF" }]}
          >
            {user?.shopName || "Vegetable Shop"}
          </Text>
          <Text
            style={[
              styles.shopSubtitle,
              { color: isDark ? labelColor : "rgba(255,255,255,0.85)" },
            ]}
          >
            Point of Sale
          </Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={[
              styles.headerIconBtn,
              { backgroundColor: isDark ? "#333" : "rgba(255,255,255,0.2)" },
            ]}
            onPress={() => router.push("/shop/history")}
          >
            <MaterialCommunityIcons
              name="history"
              size={22}
              color={isDark ? textColor : "#FFF"}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.headerIconBtn,
              { backgroundColor: isDark ? "#333" : "rgba(255,255,255,0.2)" },
            ]}
            onPress={() => setSettingsMenuVisible(!settingsMenuVisible)}
          >
            <Ionicons
              name="settings-outline"
              size={22}
              color={isDark ? textColor : "#FFF"}
            />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* Settings Menu Overlay */}
      {settingsMenuVisible && (
        <TouchableWithoutFeedback onPress={() => setSettingsMenuVisible(false)}>
          <View style={styles.menuOverlay}>
            <TouchableWithoutFeedback>
              <Animated.View
                entering={FadeInDown.duration(200)}
                style={[
                  styles.menuContainer,
                  { backgroundColor: isDark ? "#1E1E1E" : "#FFF" },
                ]}
              >
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => navigateToSettings("profile")}
                >
                  <Ionicons name="person-outline" size={20} color={textColor} />
                  <Text style={[styles.menuText, { color: textColor }]}>
                    Edit Profile
                  </Text>
                </TouchableOpacity>
                <View
                  style={[
                    styles.menuDivider,
                    { backgroundColor: isDark ? "#333" : "#F0F0F0" },
                  ]}
                />
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => navigateToSettings("pricing")}
                >
                  <Ionicons
                    name="pricetag-outline"
                    size={20}
                    color={textColor}
                  />
                  <Text style={[styles.menuText, { color: textColor }]}>
                    {language === "Tamil" ? "விலை நிர்ணயம்" : "Edit Pricing"}
                  </Text>
                </TouchableOpacity>
                <View
                  style={[
                    styles.menuDivider,
                    { backgroundColor: isDark ? "#333" : "#F0F0F0" },
                  ]}
                />
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => navigateToSettings("customers")}
                >
                  <Ionicons
                    name="people-outline"
                    size={20}
                    color={textColor}
                  />
                  <Text style={[styles.menuText, { color: textColor }]}>
                    {language === "Tamil" ? "வாடிக்கையாளர் விவரங்கள்" : "Customer Details"}
                  </Text>
                </TouchableOpacity>
              </Animated.View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      )}

      {/* Controls: Mode & View */}
      <View style={styles.controlsRow}>
        {/* Wholesale / Retail Toggle */}
        <View
          style={[
            styles.segmentControl,
            { backgroundColor: isDark ? "#1E1E1E" : "#E5E7EB" },
          ]}
        >
          <TouchableOpacity
            style={[
              styles.segmentBtn,
              !isWholesale && styles.segmentBtnActive,
              !isWholesale && { backgroundColor: cardBg },
            ]}
            onPress={() => {
              Haptics.selectionAsync();
              setIsWholesale(false);
            }}
          >
            <Text
              style={[
                styles.segmentText,
                !isWholesale
                  ? { color: primaryColor, fontWeight: "800" }
                  : { color: labelColor },
              ]}
            >
              Retail
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.segmentBtn,
              isWholesale && styles.segmentBtnActive,
              isWholesale && { backgroundColor: cardBg },
            ]}
            onPress={() => {
              Haptics.selectionAsync();
              setIsWholesale(true);
            }}
          >
            <Text
              style={[
                styles.segmentText,
                isWholesale
                  ? { color: primaryColor, fontWeight: "800" }
                  : { color: labelColor },
              ]}
            >
              Wholesale
            </Text>
          </TouchableOpacity>
        </View>

        {/* View Mode Toggle */}
        <View style={styles.viewToggleGroup}>
          <TouchableOpacity
            style={[
              styles.viewToggleBtn,
              {
                backgroundColor:
                  viewMode === "list"
                    ? primaryColor
                    : isDark
                      ? "#1E1E1E"
                      : "#FFF",
                borderColor:
                  viewMode === "list"
                    ? primaryColor
                    : isDark
                      ? "#333"
                      : "#E5E7EB",
              },
            ]}
            onPress={() => {
              Haptics.selectionAsync();
              setViewMode("list");
            }}
          >
            <Feather
              name="list"
              size={18}
              color={viewMode === "list" ? "#FFF" : labelColor}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.viewToggleBtn,
              {
                backgroundColor:
                  viewMode === "card"
                    ? primaryColor
                    : isDark
                      ? "#1E1E1E"
                      : "#FFF",
                borderColor:
                  viewMode === "card"
                    ? primaryColor
                    : isDark
                      ? "#333"
                      : "#E5E7EB",
              },
            ]}
            onPress={() => {
              Haptics.selectionAsync();
              setViewMode("card");
            }}
          >
            <Feather
              name="grid"
              size={18}
              color={viewMode === "card" ? "#FFF" : labelColor}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchSection}>
        <View
          style={[
            styles.searchBar,
            { backgroundColor: cardBg, borderColor: borderCol },
          ]}
        >
          <Feather name="search" size={20} color="#9DA3B4" />
          <TextInput
            style={[styles.searchInput, { color: textColor }]}
            placeholder="Search vegetables..."
            placeholderTextColor="#9DA3B4"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      {/* Categories */}
      <View style={{ height: 50, marginBottom: verticalScale(10) }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.catScroll}
        >
          {CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[
                styles.catPill,
                selectedCategory === cat && styles.catPillActive,
                {
                  backgroundColor:
                    selectedCategory === cat ? primaryColor : cardBg,
                  borderColor: borderCol,
                },
              ]}
              onPress={() => {
                Haptics.selectionAsync();
                setSelectedCategory(cat);
              }}
            >
              <Text
                style={[
                  styles.catText,
                  selectedCategory === cat
                    ? { color: "#FFF" }
                    : { color: labelColor },
                ]}
              >
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Grid / List */}
      <FlatList
        key={viewMode}
        data={filteredData}
        keyExtractor={(item) => item.id}
        renderItem={viewMode === "card" ? renderCard : renderListItem}
        numColumns={viewMode === "card" ? 2 : 1}
        contentContainerStyle={styles.gridContent}
        columnWrapperStyle={
          viewMode === "card" ? { gap: scale(15) } : undefined
        }
        showsVerticalScrollIndicator={false}
        ListFooterComponent={<View style={{ height: 120 }} />}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={5}
        removeClippedSubviews={true}
      />

      {/* Bottom Floating Bar */}
      {cart.length > 0 && (
        <Animated.View entering={SlideInUp} style={styles.floatBarContainer}>
          <View
            style={[
              styles.floatBar,
              {
                backgroundColor: cardBg,
                borderColor: borderCol,
                borderWidth: 1,
              },
            ]}
          >
            <View style={styles.cartInfo}>
              <View style={styles.basketIconBox}>
                <View
                  style={[styles.cartIconBg, { backgroundColor: primaryColor }]}
                >
                  <Feather name="shopping-bag" size={20} color="#FFF" />
                </View>
                {renderCartBadge()}
              </View>
              <View style={{ marginLeft: 12 }}>
                <Text style={styles.barLabel}>
                  TOTAL BILL ({cart.length} Items)
                </Text>
                <Text style={styles.barTotal}>₹{cartTotal.toFixed(2)}</Text>
              </View>
            </View>
            <TouchableOpacity
              style={[styles.nextBtn, { backgroundColor: primaryColor }]}
              onPress={handleCheckout}
            >
              <Text style={styles.nextBtnText}>Next</Text>
              <Feather name="arrow-right" size={20} color="#FFF" />
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}

      {/* Manual Entry Modal */}
      <Modal visible={modalVisible} transparent animationType="fade">
        <TouchableWithoutFeedback onPress={() => setModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={[styles.modalContent, { backgroundColor: cardBg }]}>
                {/* Modal Header */}
                <View style={styles.modalHeader}>
                  <View style={styles.modalHeaderContent}>
                    <View style={[styles.itemIconBox, { backgroundColor: primaryColor + '15' }]}>
                      <Feather name="shopping-bag" size={20} color={primaryColor} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.modalTitle, { color: textColor }]}>
                        {selectedVeg?.tamilName || selectedVeg?.name}
                      </Text>
                      <Text style={[styles.modalSubtitle, { color: labelColor }]}>
                        {selectedVeg?.name !== selectedVeg?.tamilName ? selectedVeg?.name : 'Enter quantity & price'}
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={[styles.modalCloseBtn, { backgroundColor: isDark ? '#333' : '#F3F4F6' }]}
                    onPress={() => setModalVisible(false)}
                  >
                    <Ionicons name="close" size={20} color={labelColor} />
                  </TouchableOpacity>
                </View>

                {/* Input Fields */}
                <View style={styles.inputsContainer}>
                  <View style={styles.inputField}>
                    <View style={styles.inputHeader}>
                      <Feather name="package" size={16} color={primaryColor} />
                      <Text style={[styles.inputLabel, { color: labelColor }]}>
                        Quantity
                      </Text>
                    </View>
                    <View style={styles.inputWrapper}>
                      <TextInput
                        style={[
                          styles.modalInput,
                          {
                            color: textColor,
                            borderColor: borderCol,
                            backgroundColor: isDark ? "#2C2C2E" : "#FAFAFA",
                            paddingRight: scale(40),
                            flex: 1
                          },
                        ]}
                        keyboardType="numeric"
                        value={qtyInput}
                        onChangeText={setQtyInput}
                        autoFocus
                        placeholder="0.00"
                        placeholderTextColor={labelColor}
                      />
                      <Text style={[styles.inputUnit, { color: labelColor }]}>kg</Text>
                    </View>
                  </View>

                  <View style={styles.inputField}>
                    <View style={styles.inputHeader}>
                      <Feather name="dollar-sign" size={16} color={primaryColor} />
                      <Text style={[styles.inputLabel, { color: labelColor }]}>
                        Price per kg
                      </Text>
                    </View>
                    <View style={styles.inputWrapper}>
                      <Text style={[styles.currencySymbol, { color: labelColor }]}>₹</Text>
                      <TextInput
                        style={[
                          styles.modalInput,
                          {
                            color: textColor,
                            borderColor: borderCol,
                            backgroundColor: isDark ? "#2C2C2E" : "#FAFAFA",
                            paddingLeft: scale(35),
                            flex: 1,
                          },
                        ]}
                        keyboardType="numeric"
                        value={priceInput}
                        onChangeText={setPriceInput}
                        placeholder="0.00"
                        placeholderTextColor={labelColor}
                      />
                    </View>
                  </View>

                  {/* Total Preview */}
                  {qtyInput && priceInput && (
                    <View style={styles.totalPreview}>
                      <Text style={[styles.totalLabel, { color: labelColor }]}>
                        Total Amount:
                      </Text>
                      <Text style={[styles.totalValue, { color: primaryColor }]}>
                        ₹{(parseFloat(qtyInput || '0') * parseFloat(priceInput || '0')).toFixed(2)}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Action Buttons */}
                <View style={styles.modalButtonsRow}>
                  <TouchableOpacity
                    style={[styles.cancelBtn, { borderColor: borderCol }]}
                    onPress={() => setModalVisible(false)}
                  >
                    <Text style={[styles.cancelBtnText, { color: labelColor }]}>
                      Cancel
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.confirmBtn, { backgroundColor: primaryColor }]}
                    onPress={confirmManualEntry}
                  >
                    <Text style={styles.confirmBtnText}>Add to Cart</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Bill Invoice Preview Modal */}
      <Modal
        visible={billPreviewVisible}
        animationType="slide"
        transparent={false}
      >
        <SafeAreaView style={[styles.invoiceContainer, { backgroundColor: bg }]}>
          <StatusBar style={isDark ? 'light' : 'light'} backgroundColor={isDark ? '#1A1A1A' : primaryColor} />
          
          <LinearGradient
            colors={isDark ? ["#1A1A1A", "#1A1A1A"] : ["#FF8C00", "#FF8C00"]}
            style={[
              styles.fixedHeader,
              { paddingTop: insets.top + (Platform.OS === 'android' ? 15 : 10) }
            ]}
          >
            <View style={styles.invoiceHeaderNav}>
              <TouchableOpacity
                onPress={() => setBillPreviewVisible(false)}
                style={styles.closeBtnCircle}
              >
                <Ionicons name="close" size={24} color="#FFF" />
              </TouchableOpacity>
              <View style={{ alignItems: 'center' }}>
                <Text style={styles.invoiceHeaderTitle}>
                  {language === 'Tamil' ? 'பில் முன்னோட்டம்' : 'Invoice Preview'}
                </Text>
                <View style={styles.headerStatusBadge}>
                  <View style={styles.statusDot} />
                  <Text style={styles.statusText}>{language === 'Tamil' ? 'தயாராக உள்ளது' : 'Ready to Generate'}</Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={finalizeBill}
                style={styles.confirmHeaderBtn}
              >
                <Feather name="check" size={20} color={primaryColor} />
                <Text style={[styles.confirmHeaderText, { color: primaryColor }]}>{language === 'Tamil' ? 'உறுதி' : 'Confirm'}</Text>
              </TouchableOpacity>
            </View>
          </LinearGradient>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ flexGrow: 1 }}
          >
            {/* ── HERO BANNER (Dashboard Style) ── */}
            <LinearGradient
              colors={isDark ? ['#1A1A1A', '#121212'] : ['#FF8C00', '#FF7F50']}
              style={styles.hero}
            >
              <View style={[styles.decor1, { opacity: isDark ? 0.03 : 0.1 }]} />
              <View style={[styles.decor2, { opacity: isDark ? 0.02 : 0.08 }]} />

              <Animated.View entering={FadeInDown.delay(100).duration(500)}>
                <LinearGradient
                  colors={isDark ? ['#252525', '#1E1E1E'] : ['rgba(255,255,255,0.25)', 'rgba(255,255,255,0.15)']}
                  style={styles.revenueBanner}
                >
                  <View style={styles.revenueItem}>
                    <Text style={[styles.revenueLabel, { color: isDark ? labelColor : 'rgba(255,255,255,0.8)' }]}>
                      {language === 'Tamil' ? 'மொத்த தொகை' : 'Grand Total'}
                    </Text>
                    <Text style={[styles.revenueValue, { color: '#FFF' }]}>
                      ₹{(cartTotal - (parseFloat(discount.toString()) || 0)).toFixed(0)}
                    </Text>
                  </View>
                  <View style={[styles.revenueDivider, { backgroundColor: isDark ? borderCol : 'rgba(255,255,255,0.3)' }]} />
                  <View style={styles.revenueItem}>
                    <Text style={[styles.revenueLabel, { color: isDark ? labelColor : 'rgba(255,255,255,0.8)' }]}>
                      {language === 'Tamil' ? 'தள்ளுபடி (Extra)' : 'Discount'}
                    </Text>
                    <View style={styles.discountInputWrapper}>
                      <Text style={{ color: '#FFF', fontWeight: '900', fontSize: 18 }}>₹</Text>
                      <TextInput
                        keyboardType="numeric"
                        style={styles.dashboardDiscountInput}
                        value={discount.toString()}
                        selectTextOnFocus
                        onChangeText={(v) => setDiscount(parseFloat(v) || 0)}
                      />
                    </View>
                  </View>
                </LinearGradient>
              </Animated.View>
            </LinearGradient>

            <View style={styles.body}>
              {/* ── QUICK STATS ── */}
              <Animated.View entering={FadeInDown.delay(200)} style={styles.quickStatsRow}>
                <View style={[styles.quickStatCard, { backgroundColor: cardBg, borderColor: borderCol }]}>
                  <View style={[styles.quickStatIcon, { backgroundColor: '#3B82F615' }]}>
                    <MaterialCommunityIcons name="pound" size={20} color="#3B82F6" />
                  </View>
                  <Text style={[styles.quickStatValue, { color: textColor }]}>#{Date.now().toString().slice(-4)}</Text>
                  <Text style={[styles.quickStatLabel, { color: labelColor }]}>{language === 'Tamil' ? 'பில் எண்' : 'Bill No'}</Text>
                </View>

                <View style={[styles.quickStatCard, { backgroundColor: cardBg, borderColor: borderCol }]}>
                  <View style={[styles.quickStatIcon, { backgroundColor: '#10B98115' }]}>
                    <MaterialCommunityIcons name="calendar" size={20} color="#10B981" />
                  </View>
                  <Text style={[styles.quickStatValue, { color: textColor, fontSize: 16 }]}>{new Date().toLocaleDateString('en-IN')}</Text>
                  <Text style={[styles.quickStatLabel, { color: labelColor }]}>{language === 'Tamil' ? 'தேதி' : 'Date'}</Text>
                </View>

                <View style={[styles.quickStatCard, { backgroundColor: cardBg, borderColor: borderCol }]}>
                  <View style={[styles.quickStatIcon, { backgroundColor: primaryColor + '15' }]}>
                    <MaterialCommunityIcons name="basket" size={20} color={primaryColor} />
                  </View>
                  <Text style={[styles.quickStatValue, { color: textColor }]}>{cart.length}</Text>
                  <Text style={[styles.quickStatLabel, { color: labelColor }]}>{language === 'Tamil' ? 'பொருட்கள்' : 'Items'}</Text>
                </View>
              </Animated.View>

              {/* ── CUSTOMER INFO ── */}
              <Animated.View entering={FadeInDown.delay(300)}>
                <Text style={[styles.sectionTitle, { color: textColor }]}>{language === 'Tamil' ? 'வாடிக்கையாளர்' : 'Customer'}</Text>
                <View style={[styles.dashboardInvoiceCard, { backgroundColor: cardBg, borderColor: borderCol, padding: scale(15) }]}>
                  <View style={[styles.dashboardIconBox, { backgroundColor: '#3B82F615' }]}>
                    <MaterialCommunityIcons name="account" size={24} color="#3B82F6" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <TextInput
                      style={[styles.dashboardCustomerInput, { color: textColor }]}
                      placeholder={language === 'Tamil' ? "வாடிக்கையாளர் பெயரை உள்ளிடவும்" : "Enter Customer Name"}
                      placeholderTextColor={labelColor}
                      value={customerName}
                      onChangeText={setCustomerName}
                    />
                  </View>
                  <Ionicons name="pencil" size={16} color={labelColor} />
                </View>
              </Animated.View>

              {/* ── ITEMS LIST ── */}
              <Animated.View entering={FadeInDown.delay(400)} style={{ marginTop: 10 }}>
                <View style={[styles.sectionRow, { marginBottom: 10 }]}>
                    <Text style={[styles.sectionTitle, { color: textColor, marginBottom: 0 }]}>{language === 'Tamil' ? 'பொருட்கள் விவரம்' : 'Bill Items'}</Text>
                    <Text style={{ color: labelColor, fontWeight: '700' }}>{language === 'Tamil' ? 'விலை திருத்தலாம்' : 'Editable'}</Text>
                </View>

                {cart.map((item, index) => (
                  <Animated.View
                    key={item.id}
                    entering={FadeInDown.delay(450 + index * 50)}
                    style={[styles.dashboardInvoiceCard, { backgroundColor: cardBg, borderColor: borderCol }]}
                  >
                    <View style={[styles.dashboardIconBox, { backgroundColor: primaryColor + '15' }]}>
                      <MaterialCommunityIcons name="food-apple" size={22} color={primaryColor} />
                    </View>
                    <View style={{ flex: 1.5 }}>
                      <Text style={[styles.trTamil, { color: textColor }]} numberOfLines={1}>{item.tamilName}</Text>
                      <Text style={[styles.trEng, { color: labelColor }]} numberOfLines={1}>{item.name}</Text>
                    </View>
                    
                    <View style={{ flex: 2, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                       <View style={{ alignItems: 'center' }}>
                         <Text style={styles.dashboardValLabel}>{language === 'Tamil' ? 'அளவு' : 'QTY'}</Text>
                         <TextInput
                            keyboardType="numeric"
                            style={[styles.dashboardTrInput, { color: textColor, backgroundColor: isDark ? '#333' : '#F3F4F6' }]}
                            value={item.quantity.toString()}
                            selectTextOnFocus
                            onChangeText={(v) => updateCartItemInPreview(item.id, v, item.price.toString(), (item.itemDiscount || 0).toString())}
                          />
                       </View>
                       <View style={{ alignItems: 'center' }}>
                         <Text style={styles.dashboardValLabel}>{language === 'Tamil' ? 'விலை' : 'PRICE'}</Text>
                         <TextInput
                            keyboardType="numeric"
                            style={[styles.dashboardTrInput, { color: textColor, backgroundColor: isDark ? '#333' : '#F3F4F6' }]}
                            value={item.price.toString()}
                            selectTextOnFocus
                            onChangeText={(v) => updateCartItemInPreview(item.id, item.quantity.toString(), v, (item.itemDiscount || 0).toString())}
                          />
                       </View>
                    </View>

                    <View style={{ flex: 1, alignItems: 'flex-end' }}>
                      <Text style={[styles.trTotal, { color: primaryColor }]}>₹{item.total.toFixed(0)}</Text>
                      <View style={[styles.paidBadge, { backgroundColor: '#10B98115', marginTop: 4 }]}>
                         <Text style={styles.paidText}>{language === 'Tamil' ? 'சேர்க்கப்பட்டது' : 'Added'}</Text>
                      </View>
                    </View>
                  </Animated.View>
                ))}
              </Animated.View>
              {/* ── FINAL BREAKDOWN CARD ── */}
              <Animated.View entering={FadeInDown.delay(550)} style={{ marginTop: 20 }}>
                <View style={[styles.premiumCard, { backgroundColor: cardBg, padding: scale(20) }]}>
                  <View style={styles.cardHeader}>
                    <View style={styles.headerIndicator} />
                    <Text style={[styles.cardTitle, { color: textColor }]}>{language === 'Tamil' ? 'பண விவரம்' : 'Payment Summary'}</Text>
                  </View>
                  
                  <View style={styles.summaryLine}>
                    <Text style={[styles.summaryLabelText, { color: labelColor }]}>{language === 'Tamil' ? 'உருப்படிகளின் விலை' : 'Items Total'}</Text>
                    <Text style={[styles.summaryValueText, { color: textColor }]}>₹{cartTotal.toFixed(2)}</Text>
                  </View>
                  
                  <View style={[styles.summaryLine, { marginTop: 10 }]}>
                    <Text style={[styles.summaryLabelText, { color: '#EF4444' }]}>{language === 'Tamil' ? 'கூடுதல் தள்ளுபடி' : 'Extra Discount'}</Text>
                    <Text style={[styles.summaryValueText, { color: '#EF4444' }]}>- ₹{(parseFloat(discount.toString()) || 0).toFixed(2)}</Text>
                  </View>

                  <View style={[styles.divider, { backgroundColor: borderCol, marginVertical: 15 }]} />

                  <View style={styles.summaryLine}>
                    <Text style={[styles.summaryLabelText, { color: textColor, fontSize: 18, fontWeight: '900' }]}>{language === 'Tamil' ? 'மொத்த தொகை' : 'Grand Total'}</Text>
                    <Text style={[styles.summaryValueText, { color: primaryColor, fontSize: 22, fontWeight: '900' }]}>₹{(cartTotal - (parseFloat(discount.toString()) || 0)).toFixed(0)}</Text>
                  </View>
                </View>
              </Animated.View>

              {/* ── SHOP FOOTER BRANDING ── */}
              <View style={styles.invoiceFooterBranding}>
                <Image
                  source={require("../../src/assets/images/Logo_bill.png")}
                  style={styles.footerLogo}
                />
                <Text style={[styles.footerShopName, { color: textColor }]}>{user?.shopName || "SUJI VEGETABLES"}</Text>
                <Text style={[styles.footerShopLoc, { color: labelColor }]}>
                  {language === 'Tamil' ? 'பாண்டி - திண்டிவனம் மெயின் ரோடு, கிளியனூர்.' : 'Pondy - Tindivanam Road, Kiliyanur'}
                </Text>
                <Text style={[styles.footerShopContact, { color: labelColor }]}>Ph: +91 98765 43210</Text>
              </View>
            </View>

            <View style={{ height: 100 }} />
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: scale(20),
    paddingBottom: verticalScale(12),
    zIndex: 10,
  },
  shopTitle: {
    fontSize: moderateScale(22),
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  shopSubtitle: {
    fontSize: moderateScale(13),
    marginTop: verticalScale(2),
    fontWeight: "600",
    textTransform: "capitalize",
  },
  headerActions: {
    flexDirection: "row",
    gap: scale(10),
  },
  headerIconBtn: {
    width: scale(40),
    height: scale(40),
    borderRadius: scale(14),
    alignItems: "center",
    justifyContent: "center",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  // Settings Menu
  menuOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 20,
  },
  menuContainer: {
    position: "absolute",
    top: verticalScale(90),
    right: scale(20),
    width: scale(180),
    borderRadius: scale(16),
    padding: scale(8),
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    zIndex: 30,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: scale(12),
    gap: scale(10),
  },
  menuText: {
    fontSize: moderateScale(14),
    fontWeight: "600",
  },
  menuDivider: {
    height: 1,
    width: "100%",
    marginVertical: verticalScale(4),
  },
  searchSection: {
    paddingHorizontal: scale(20),
    marginBottom: verticalScale(15),
  },
  searchBar: {
    height: verticalScale(50),
    borderRadius: scale(16),
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: scale(15),
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 5,
  },
  searchInput: {
    flex: 1,
    marginLeft: scale(10),
    fontSize: moderateScale(15),
    fontWeight: "500",
  },
  // Card
  card: {
    flex: 1,
    borderRadius: scale(18),
    padding: scale(14),
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    marginBottom: scale(8),
  },
  cardInfoImage: {
    width: "100%",
    height: verticalScale(90),
    resizeMode: "contain",
    marginBottom: verticalScale(10),
  },
  checkBadge: {
    position: "absolute",
    top: verticalScale(10),
    right: scale(10),
    width: scale(22),
    height: scale(22),
    borderRadius: scale(11),
    backgroundColor: "#00A86B",
    zIndex: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFF",
  },
  cardDetails: {
    flex: 1,
  },
  cardTamilName: {
    fontSize: moderateScale(15),
    fontWeight: "800",
    marginBottom: verticalScale(2),
  },
  cardEngName: {
    fontSize: moderateScale(11),
    fontWeight: "600",
    marginBottom: verticalScale(8),
  },
  priceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: verticalScale(5),
  },
  priceText: {
    fontSize: moderateScale(16),
    fontWeight: "800",
  },
  unitText: {
    fontSize: moderateScale(11),
    fontWeight: "500",
    marginLeft: scale(2),
  },
  addBtn: {
    width: scale(34),
    height: scale(34),
    borderRadius: scale(12),
    alignItems: "center",
    justifyContent: "center",
  },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: scale(12),
    padding: scale(2),
    minHeight: scale(36),
  },
  stepBtn: {
    width: moderateScale(32),
    height: moderateScale(32),
    alignItems: "center",
    justifyContent: "center",
    borderRadius: scale(10),
    backgroundColor: "transparent",
  },
  stepVal: {
    fontSize: moderateScale(15),
    fontWeight: "800",
    marginHorizontal: scale(4),
    minWidth: moderateScale(38),
    textAlign: "center",
  },
  // Controls
  controlsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: scale(20),
    marginBottom: verticalScale(15),
  },
  segmentControl: {
    flexDirection: "row",
    borderRadius: scale(12),
    padding: scale(4),
    width: scale(180),
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: verticalScale(6),
    alignItems: "center",
    borderRadius: scale(10),
  },
  segmentBtnActive: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  segmentText: {
    fontSize: moderateScale(13),
    fontWeight: "600",
  },
  viewToggleGroup: {
    flexDirection: "row",
    backgroundColor: "transparent",
    gap: scale(8),
  },
  viewToggleBtn: {
    width: scale(36),
    height: scale(36),
    borderRadius: scale(10),
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  // List Item
  listItem: {
    flexDirection: "row",
    borderRadius: scale(16),
    padding: scale(14),
    marginBottom: scale(10),
    alignItems: "center",
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
  },
  listImage: {
    width: scale(60),
    height: scale(60),
    resizeMode: "contain",
    marginRight: scale(15),
  },
  listDetails: {
    flex: 1,
  },
  listTamilName: {
    fontSize: moderateScale(16),
    fontWeight: "800",
    marginBottom: verticalScale(4),
  },
  listPriceRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  listPriceText: {
    fontSize: moderateScale(16),
    fontWeight: "800",
  },
  listUnitText: {
    fontSize: moderateScale(11),
    fontWeight: "500",
    marginLeft: scale(2),
  },
  listActionCol: {
    alignItems: "flex-end",
    justifyContent: "center",
  },
  stepBtnSmall: {
    width: moderateScale(28),
    height: moderateScale(28),
    alignItems: "center",
    justifyContent: "center",
    borderRadius: scale(10),
    backgroundColor: "transparent",
  },
  // Categories
  catScroll: {
    paddingHorizontal: scale(20),
    gap: scale(10),
    alignItems: "center",
  },
  catPill: {
    paddingHorizontal: scale(16),
    paddingVertical: verticalScale(8),
    borderRadius: scale(20),
    borderWidth: scale(1),
    justifyContent: "center",
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  catPillActive: {
    borderWidth: 0,
    elevation: 3,
  },
  catText: {
    fontSize: moderateScale(13),
    fontWeight: "600",
  },
  gridContent: {
    padding: scale(20),
    paddingTop: 10,
  },
  // Bottom Bar
  floatBarContainer: {
    position: "absolute",
    bottom: verticalScale(30),
    left: scale(20),
    right: scale(20),
    zIndex: 100,
  },
  floatBar: {
    borderRadius: scale(20),
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: scale(16),
    paddingHorizontal: scale(20),
    elevation: 8,
    shadowColor: "#FF8C00",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  cartInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  basketIconBox: {
    position: "relative",
  },
  cartIconBg: {
    width: scale(40),
    height: scale(40),
    borderRadius: scale(14),
    alignItems: "center",
    justifyContent: "center",
  },
  cartBadge: {
    position: "absolute",
    top: -verticalScale(4),
    right: -scale(4),
    backgroundColor: "#EF4444",
    width: scale(18),
    height: scale(18),
    borderRadius: scale(9),
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#111827",
  },
  cartBadgeText: {
    color: "#FFF",
    fontSize: moderateScale(10),
    fontWeight: "bold",
  },
  barLabel: {
    color: "#9CA3AF",
    fontSize: moderateScale(10),
    fontWeight: "700",
    letterSpacing: 1,
    marginBottom: 2,
  },
  barTotal: {
    color: "#FFF",
    fontSize: moderateScale(18),
    fontWeight: "800",
  },
  nextBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: verticalScale(12),
    paddingHorizontal: scale(24),
    borderRadius: scale(16),
    gap: scale(8),
  },
  nextBtnText: {
    color: "#FFF",
    fontWeight: "700",
    fontSize: moderateScale(16),
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: scale(20),
    backdropFilter: "blur(10px)",
  },
  modalContent: {
    width: "100%",
    borderRadius: scale(28),
    padding: scale(24),
    elevation: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -5 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
  },
  modalTitle: {
    fontSize: moderateScale(18),
    fontWeight: "800",
    marginBottom: 2,
  },
  modalSubtitle: {
    fontSize: moderateScale(12),
    fontWeight: "500",
    opacity: 0.7,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: verticalScale(24),
  },
  modalHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  itemIconBox: {
    width: scale(44),
    height: scale(44),
    borderRadius: scale(12),
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: scale(12),
  },
  modalCloseBtn: {
    width: scale(36),
    height: scale(36),
    borderRadius: scale(18),
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputsContainer: {
    gap: verticalScale(20),
    marginBottom: verticalScale(24),
  },
  inputField: {
    gap: verticalScale(8),
  },
  inputHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(6),
  },
  inputLabel: {
    fontSize: moderateScale(14),
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  modalInput: {
    borderWidth: scale(1.5),
    borderRadius: scale(12),
    height: verticalScale(52),
    paddingHorizontal: scale(16),
    fontSize: moderateScale(16),
    fontWeight: "600",
  },
  inputUnit: {
    position: 'absolute',
    right: scale(16),
    fontSize: moderateScale(14),
    fontWeight: '600',
  },
  currencySymbol: {
    position: 'absolute',
    left: scale(16),
    fontSize: moderateScale(16),
    fontWeight: '600',
    zIndex: 1,
  },
  totalPreview: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: scale(16),
    backgroundColor: '#FF8C0008',
    borderRadius: scale(12),
    borderWidth: 1,
    borderColor: '#FF8C0020',
  },
  totalLabel: {
    fontSize: moderateScale(14),
    fontWeight: '600',
  },
  totalValue: {
    fontSize: moderateScale(18),
    fontWeight: '800',
  },
  confirmBtn: {
    flex: 1,
    height: verticalScale(56),
    borderRadius: scale(16),
    alignItems: "center",
    justifyContent: "center",
    elevation: 4,
    shadowColor: "#FF8C00",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  confirmBtnText: {
    color: "#FFF",
    fontWeight: "800",
    fontSize: moderateScale(16),
    letterSpacing: 0.5,
  },
  modalButtonsRow: {
    flexDirection: "row",
    gap: scale(12),
  },
  cancelBtn: {
    flex: 1,
    height: verticalScale(56),
    borderRadius: scale(16),
    borderWidth: scale(1),
    alignItems: "center",
    justifyContent: "center",
  },
  cancelBtnText: {
    fontWeight: "700",
    fontSize: moderateScale(16),
    letterSpacing: 0.5,
  },
  // Invoice Modal Styles
  invoiceContainer: {
    flex: 1,
  },
  invoiceHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: scale(20),
    paddingVertical: verticalScale(15),
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#EEE",
  },
  invoiceTitle: {
    fontSize: moderateScale(18),
    fontWeight: "800",
  },
  closeBtn: {
    padding: 5,
  },
  printBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: verticalScale(8),
    paddingHorizontal: scale(16),
    borderRadius: scale(10),
    gap: 6,
  },
  printBtnText: {
    color: "#FFF",
    fontWeight: "700",
    fontSize: moderateScale(14),
  },
  invoiceScroll: {
    padding: scale(20),
  },
  shopHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: scale(20),
  },
  shopLogo: {
    width: scale(60),
    height: scale(60),
    resizeMode: "contain",
    borderRadius: scale(12),
    marginRight: scale(15),
  },
  shopInfo: {
    flex: 1,
  },
  shopNameText: {
    fontSize: moderateScale(20),
    fontWeight: "900",
    marginBottom: 2,
  },
  shopDetails: {
    fontSize: moderateScale(12),
    fontWeight: "500",
    opacity: 0.8,
  },
  customerSection: {
    padding: scale(20),
  },
  customerInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  customerInput: {
    flex: 1,
    fontSize: moderateScale(16),
    fontWeight: "700",
    paddingVertical: 5,
  },
  dateTimeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#EEE",
    paddingTop: 10,
  },
  dateText: {
    fontSize: moderateScale(11),
    fontWeight: "600",
  },
  tableContainer: {
    padding: scale(20),
  },
  tableHead: {
    flexDirection: "row",
    paddingBottom: 10,
    borderBottomWidth: 1,
  },
  headLabel: {
    fontSize: moderateScale(11),
    fontWeight: "800",
    color: "#9CA3AF",
    letterSpacing: 1,
  },
  invoiceRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: verticalScale(15),
    borderBottomWidth: 1,
  },
  itemTamil: {
    fontSize: moderateScale(18),
    fontWeight: "900",
    marginBottom: 2,
  },
  itemEng: {
    fontSize: moderateScale(11),
    fontWeight: "600",
    textTransform: "uppercase",
  },
  editInput: {
    width: "100%",
    maxWidth: scale(75),
    height: verticalScale(35),
    borderRadius: scale(8),
    fontSize: moderateScale(14),
    fontWeight: "bold",
    textAlign: "center",
    padding: 0,
  },
  rowTotal: {
    fontSize: moderateScale(16),
    fontWeight: "900",
  },
  invoiceSummary: {
    marginTop: verticalScale(20),
    gap: 12,
  },
  summaryItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  summaryLabel: {
    fontSize: moderateScale(14),
    fontWeight: "600",
  },
  summaryVal: {
    fontSize: moderateScale(16),
    fontWeight: "700",
  },
  grandTotalActive: {
    backgroundColor: "#00A86B15",
    padding: scale(15),
    borderRadius: scale(16),
    borderWidth: 1,
    borderColor: "#00A86B50",
  },
  totalLabelFinal: {
    fontSize: moderateScale(16),
    fontWeight: "900",
    color: "#00A86B",
  },
  totalValFinal: {
    fontSize: moderateScale(22),
    fontWeight: "900",
    color: "#00A86B",
  },
  fixedHeader: {
    paddingHorizontal: scale(20),
    paddingBottom: verticalScale(12),
    zIndex: 10,
  },
  invoiceHeaderNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: verticalScale(50),
  },
  closeBtnCircle: {
    width: scale(36),
    height: scale(36),
    borderRadius: scale(18),
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  invoiceHeaderTitle: {
    fontSize: moderateScale(18),
    fontWeight: '900',
    color: '#FFF',
  },
  confirmHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    paddingHorizontal: scale(12),
    paddingVertical: verticalScale(6),
    borderRadius: scale(10),
    gap: scale(4),
  },
  confirmHeaderText: {
    fontSize: moderateScale(13),
    fontWeight: '800',
  },
  discountInput: {
    width: scale(70),
    height: verticalScale(35),
    borderRadius: scale(8),
    borderWidth: 1,
    textAlign: "center",
    fontSize: moderateScale(14),
    fontWeight: "bold",
  },
  // Dashboard Style Invoice
  hero: {
    paddingHorizontal: scale(20),
    paddingBottom: verticalScale(20),
    overflow: 'hidden',
    position: 'relative',
    borderBottomLeftRadius: scale(24),
    borderBottomRightRadius: scale(24),
  },
  decor1: {
    position: 'absolute',
    width: scale(250),
    height: scale(250),
    borderRadius: scale(125),
    backgroundColor: '#FFF',
    top: -scale(80),
    right: -scale(60),
  },
  decor2: {
    position: 'absolute',
    width: scale(150),
    height: scale(150),
    borderRadius: scale(75),
    backgroundColor: '#FFF',
    bottom: -scale(40),
    left: scale(20),
  },
  revenueBanner: {
    flexDirection: 'row',
    borderRadius: scale(20),
    padding: scale(18),
  },
  revenueItem: {
    flex: 1,
    alignItems: 'center',
  },
  revenueLabel: {
    fontSize: moderateScale(12),
    fontWeight: '600',
    marginBottom: 4,
  },
  revenueValue: {
    fontSize: moderateScale(26),
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  revenueDivider: {
    width: 1,
    marginHorizontal: scale(10),
  },
  discountInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dashboardDiscountInput: {
    color: '#FFF',
    fontSize: moderateScale(22),
    fontWeight: '900',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.5)',
    minWidth: scale(60),
    textAlign: 'center',
    padding: 0,
  },
  body: {
    paddingHorizontal: scale(16),
    paddingTop: verticalScale(20),
  },
  quickStatsRow: {
    flexDirection: 'row',
    gap: scale(10),
    marginBottom: verticalScale(24),
  },
  quickStatCard: {
    flex: 1,
    borderRadius: scale(18),
    padding: scale(14),
    alignItems: 'center',
    borderWidth: 1,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
  },
  quickStatIcon: {
    width: scale(40),
    height: scale(40),
    borderRadius: scale(12),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: verticalScale(8),
  },
  quickStatValue: {
    fontSize: moderateScale(18),
    fontWeight: '900',
    marginBottom: 2,
  },
  quickStatLabel: {
    fontSize: moderateScale(11),
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: moderateScale(18),
    fontWeight: '800',
    marginBottom: verticalScale(14),
    letterSpacing: -0.3,
  },
  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dashboardInvoiceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: scale(16),
    padding: scale(14),
    marginBottom: verticalScale(10),
    borderWidth: 1,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  dashboardIconBox: {
    width: scale(42),
    height: scale(42),
    borderRadius: scale(12),
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: scale(12),
  },
  dashboardCustomerInput: {
    fontSize: moderateScale(16),
    fontWeight: '800',
    paddingVertical: 4,
  },
  dashboardValLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  dashboardTrInput: {
    width: scale(55),
    height: verticalScale(30),
    borderRadius: scale(6),
    fontSize: moderateScale(13),
    fontWeight: '900',
    textAlign: 'center',
    padding: 0,
  },
  premiumCard: {
    borderRadius: scale(20),
    borderWidth: 1,
    borderColor: '#E5E7EB',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    marginBottom: verticalScale(16),
    overflow: 'hidden',
    padding: scale(18),
  },
  headerStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: scale(10),
    paddingVertical: verticalScale(4),
    borderRadius: scale(10),
    marginTop: 2,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#00FF00',
    marginRight: 6,
  },
  statusText: {
    fontSize: moderateScale(10),
    color: '#FFF',
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: verticalScale(15),
  },
  headerIndicator: {
    width: 4,
    height: 18,
    backgroundColor: '#FF8C00',
    borderRadius: 2,
    marginRight: 8,
  },
  cardTitle: {
    fontSize: moderateScale(14),
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoRowGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  infoItem: {
    flex: 1,
  },
  infoLabel: {
    fontSize: moderateScale(11),
    fontWeight: '600',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: moderateScale(15),
    fontWeight: '800',
  },
  divider: {
    height: 1,
    width: '100%',
    marginVertical: verticalScale(15),
  },
  customerInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F630',
    borderRadius: scale(12),
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: scale(15),
  },
  inputIconBox: {
    width: 30,
    alignItems: 'center',
  },
  customerInputPremium: {
    flex: 1,
    height: verticalScale(50),
    fontSize: moderateScale(16),
    fontWeight: '700',
    marginLeft: 8,
  },
  shopBrandingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  shopLogoMinimal: {
    width: scale(45),
    height: scale(45),
    resizeMode: 'contain',
    marginRight: scale(12),
  },
  shopNameMinimal: {
    fontSize: moderateScale(16),
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  shopLocMinimal: {
    fontSize: moderateScale(11),
    fontWeight: '500',
    opacity: 0.8,
  },
  tableHeaderHeader: {
    flexDirection: 'row',
    padding: scale(15),
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  thLabel: {
    fontSize: moderateScale(10),
    fontWeight: '900',
    color: '#6B7280',
    letterSpacing: 1,
  },
  trRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: scale(15),
    borderBottomWidth: 1,
  },
  trTamil: {
    fontSize: moderateScale(15),
    fontWeight: '800',
  },
  trEng: {
    fontSize: moderateScale(10),
    fontWeight: '600',
    textTransform: 'uppercase',
    marginTop: 2,
  },
  trInput: {
    width: '90%',
    height: verticalScale(34),
    borderRadius: scale(6),
    fontSize: moderateScale(13),
    fontWeight: 'bold',
    textAlign: 'center',
    padding: 0,
  },
  trTotal: {
    fontSize: moderateScale(14),
    fontWeight: '900',
  },
  summaryGrid: {
    gap: verticalScale(12),
  },
  summaryLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabelText: {
    fontSize: moderateScale(14),
    fontWeight: '600',
  },
  summaryValueText: {
    fontSize: moderateScale(16),
    fontWeight: '800',
  },
  finalDiscInput: {
    width: scale(80),
    height: verticalScale(36),
    borderRadius: scale(8),
    borderWidth: 1,
    textAlign: 'center',
    fontSize: moderateScale(14),
    fontWeight: '800',
  },
  totalBanner: {
    marginTop: verticalScale(10),
    padding: scale(20),
    borderRadius: scale(18),
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#00A86B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  totalBannerLabel: {
    color: '#FFF',
    fontSize: moderateScale(13),
    fontWeight: '800',
    opacity: 0.9,
    flex: 1,
  },
  totalBannerValue: {
    color: '#FFF',
    fontSize: moderateScale(22),
    fontWeight: '900',
  },
  paidBadge: {
    paddingHorizontal: scale(8),
    paddingVertical: 2,
    borderRadius: scale(6),
  },
  paidText: {
    fontSize: moderateScale(10),
    fontWeight: '800',
    color: '#10B981',
  },
  invoiceFooterBranding: {
    alignItems: 'center',
    marginTop: verticalScale(30),
    paddingBottom: verticalScale(20),
    opacity: 0.8,
  },
  footerLogo: {
    width: scale(40),
    height: scale(40),
    resizeMode: 'contain',
    marginBottom: 8,
  },
  footerShopName: {
    fontSize: moderateScale(16),
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  footerShopLoc: {
    fontSize: moderateScale(11),
    fontWeight: '500',
    textAlign: 'center',
    paddingHorizontal: 40,
    marginTop: 2,
  },
  footerShopContact: {
    fontSize: moderateScale(10),
    fontWeight: '700',
    marginTop: 4,
  },
});
