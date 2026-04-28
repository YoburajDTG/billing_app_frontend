import { SOUTHERN_VEGETABLES } from "@/constants/Vegetables";
import { useAuth } from "@/context/AuthContext";
import { useAppTheme, THEME_COLORS } from "@/context/ThemeContext";
import { inventoryDbService, vegetableDbService, billDbService } from "@/services/dbService";
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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ThermalPrinter, isPrinterAvailable } from "@/utils/thermalPrinter";
import { useFocusEffect } from "@react-navigation/native";
import { NativeModules } from 'react-native';
import * as Contacts from 'expo-contacts';
import ViewShot, { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
// Removed direct NativeModules access to avoid crashes in Expo Go

import {
  Alert,
  FlatList,
  Image,
  Linking,
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
];

export default function ShopScreen() {
  const { user, updateUser } = useAuth();
  const navigation = useNavigation();
  const router = useRouter();
  const { mode, timestamp, waitBillId } = useLocalSearchParams<{ mode: string; timestamp?: string; waitBillId?: string }>();
  const [isWholesale, setIsWholesale] = useState(mode === "wholesale");
  const [editingBillId, setEditingBillId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "card">("list");
  const insets = useSafeAreaInsets();

  const { t, theme, isDark, toggleTheme, language, primaryColor } = useAppTheme();

  // States
  const [allVegetables, setAllVegetables] = useState<Vegetable[]>([]);
  const [cart, setCart] = useState<BillItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
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
  const [customerMobile, setCustomerMobile] = useState("");
  const [discount, setDiscount] = useState(0);
  const [nextBillId, setNextBillId] = useState("");
  const [printerPreference, setPrinterPreference] = useState<'2inch' | '3inch'>('2inch');
  const [shopName, setShopName] = useState("");
  const [shopPhone, setShopPhone] = useState("");
  const [shopAddress, setShopAddress] = useState("");
  const [isPrinterConnected, setIsPrinterConnected] = useState(false);
  const [showPrinterModal, setShowPrinterModal] = useState(false);
  const [pairedDevices, setPairedDevices] = useState<any[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (billPreviewVisible) {
      // Ensure we start at the top of the invoice
      setTimeout(() => {
        scrollRef.current?.scrollTo({ y: 0, animated: false });
      }, 100);
    }
  }, [billPreviewVisible]);

  useEffect(() => {
    // Hide default header
    navigation.setOptions({ headerShown: false });
    loadSettings();
    
    if (waitBillId) {
      loadBillForEditing(waitBillId);
    }
  }, [waitBillId]);

  const loadBillForEditing = async (billId: string) => {
    if (!billId) return;
    try {
      const { data } = await billDbService.getWithItems(billId);
      if (data) {
        const { bill, items } = data;
        setEditingBillId(bill.id);
        setCustomerName(bill.customer_name || "");
        setCustomerMobile(bill.customer_mobile || "");
        setDiscount(bill.discount || 0);
        setIsWholesale(bill.mode === "Wholesale");
        setNextBillId(bill.id);
        
        const cartItems: BillItem[] = items.map(item => ({
          id: item.vegetable_id,
          name: item.name || "",
          tamilName: item.tamil_name || "",
          price: item.unit_price,
          quantity: item.quantity,
          total: item.total_price,
          image: "" 
        }));
        
        const uniqueCart = Array.from(new Map(cartItems.map(i => [i.id, i])).values());
        setCart(uniqueCart);
        // Clear param to avoid duplicate loads on re-focus
        router.setParams({ waitBillId: undefined });
      }
    } catch (error) {
      console.error("Failed to load bill for editing:", error);
    }
  };

  const loadSettings = async () => {
    const [pSize, mName, mPhone, mAddr] = await Promise.all([
      Storage.getItem(KEYS.PRINTER_SIZE),
      Storage.getItem(KEYS.MERCHANT_NAME),
      Storage.getItem(KEYS.MERCHANT_NUMBER),
      Storage.getItem(KEYS.MERCHANT_ADDRESS)
    ]);
    if (pSize) setPrinterPreference(pSize);
    if (mName) setShopName(mName);
    if (mPhone) setShopPhone(mPhone);
    if (mAddr) setShopAddress(mAddr);

    const lastPrinter = await Storage.getItem('last_printer');
    if (lastPrinter) {
      handleConnectPrinter(lastPrinter.address);
    }
  };

  const handleConnectPrinter = async (address: string) => {
    try {
      const res = await ThermalPrinter.connectPrinter(address);
      if (res.success) {
        setIsPrinterConnected(true);
        setShowPrinterModal(false);
        const devices = await ThermalPrinter.getPairedDevices();
        const device = devices.find((d: any) => d.address === address);
        if (device) await Storage.setItem('last_printer', device);
      } else {
        Alert.alert('Error', 'Failed to connect to printer');
      }
    } catch (error) {
      console.error(error);
    }
  };

  const scanPrinters = async () => {
    if (!isPrinterAvailable) {
      Alert.alert('Module Error', 'Thermal printer module is not available in this build. Please ensure you are using the installed APK and not Expo Go.');
      return;
    }

    setIsScanning(true);
    try {
      const devices = await ThermalPrinter.discoverDevices();
      if (devices.length === 0) {
        Alert.alert('No Devices', 'No Bluetooth printers found. Please:\n1. Turn ON Bluetooth & Location (GPS)\n2. Pair the printer in Phone Settings first.');
      }
      setPairedDevices(devices);
    } catch (error) {
      console.error(error);
      Alert.alert('Scan Error', 'Failed to scan for Bluetooth devices.');
    } finally {
      setIsScanning(false);
    }
  };

  useEffect(() => {
    if (mode) {
      setIsWholesale(mode === "wholesale");
      // New bill requested from dashboard (new timestamp)
      setCart([]);
      setCustomerName("");
      setDiscount(0);
    }
  }, [mode, timestamp]);

  // Sync cart item prices when switching between Retail/Wholesale mode
  useEffect(() => {
    if (cart.length > 0) {
      setCart(prev => prev.map(item => {
        const veg = allVegetables.find(v => v.id === item.id);
        if (veg) {
          const retailPrice = veg.retailPrice || veg.price || 0;
          const newPrice = isWholesale 
            ? veg.wholesalePrice || Math.floor(retailPrice * 0.75)
            : retailPrice;
          return {
            ...item,
            price: newPrice,
            total: item.quantity * newPrice - (item.itemDiscount || 0)
          };
        }
        return item;
      }));
    }
  }, [isWholesale]);

  useFocusEffect(
    useCallback(() => {
      loadVegetables();
      if (waitBillId && waitBillId !== editingBillId) {
        loadBillForEditing(waitBillId as string);
      }
    }, [timestamp, waitBillId, editingBillId])
  );

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
      // Fetch all vegetables with their latest pricing from local SQLite database
      const res = await inventoryDbService.getAll();

      if (res && res.data && res.data.length > 0) {
        const validated = res.data.map((v: any) => {
          const name = v.name || "Unknown Item";
          // Priority: 
          // 1. Manually set retail_price from vegetables table
          // 2. Base price from vegetables table
          // 3. Last logged price from inventory table
          // 4. Fallback 30
          const retailPrice = v.retail_price || v.base_price || v.last_logged_price || 30;
          const wholesalePrice = v.wholesale_price || Math.floor(retailPrice * 0.75);
          
          return {
            id: v.id,
            name: name,
            tamilName: v.tamil_name || "",
            image: getRealImage(
              name,
              "https://cdn-icons-png.flaticon.com/512/135/135687.png",
            ),
            category: v.category || assignCategory(v),
            price: retailPrice, 
            retailPrice: retailPrice,
            wholesalePrice: wholesalePrice,
          };
        });

        // Priority Sorting based on user request
        const priorityTamilNames = ["பச்சை மிளகாய்", "தக்காளி", "வெங்காயம்", "உருளை", "கேரட்", "பீன்ஸ்"];
        
        const sortedData = [...validated].sort((a, b) => {
          const aIndex = priorityTamilNames.indexOf(a.tamilName);
          const bIndex = priorityTamilNames.indexOf(b.tamilName);
          
          if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
          if (aIndex !== -1) return -1;
          if (bIndex !== -1) return 1;
          
          return (a.name || "").localeCompare(b.name || "");
        });

        setAllVegetables(sortedData);
        Storage.setItem(KEYS.VEGETABLES, sortedData);
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
    return allVegetables.map((v) => {
      const retailPrice = v.retailPrice || v.price || 0;
      return {
        ...v,
        price: isWholesale
          ? v.wholesalePrice || Math.floor(retailPrice * 0.75)
          : retailPrice,
      };
    });
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
    }

    // Apply Priority Sorting based on Tamil Name
    const priorityTamilNames = ["பச்சை மிளகாய்", "தக்காளி", "வெங்காயம்", "உருளை", "கேரட்", "பீன்ஸ்"];
    
    return [...data].sort((a, b) => {
      const aIndex = priorityTamilNames.indexOf(a.tamilName);
      const bIndex = priorityTamilNames.indexOf(b.tamilName);
      
      if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
      if (aIndex !== -1) return -1;
      if (bIndex !== -1) return 1;
      
      return (a.name || "").localeCompare(b.name || "");
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

  const toggleFavourite = async (vegId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const currentFavourites = user?.top_selling_vegetables || [];
    let newFavourites: string[];
    
    if (currentFavourites.includes(vegId)) {
        newFavourites = currentFavourites.filter(id => id !== vegId);
    } else {
        newFavourites = [...currentFavourites, vegId];
    }
    
    await updateUser({ top_selling_vegetables: newFavourites });
  };

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    
    // Only fetch next ID if we are NOT editing a waiting bill
    if (!editingBillId) {
      try {
        const { data } = await billDbService.getNextId();
        setNextBillId(data);
      } catch (error) {
        console.error("Failed to fetch next bill ID:", error);
      }
    }
    
    setBillPreviewVisible(true);
  };

  const handleWaitBill = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    try {
      const billData = {
        total_amount: cartTotal - (parseFloat(discount.toString()) || 0),
        discount: parseFloat(discount.toString()) || 0,
        customer_name: customerName,
        customer_mobile: (customerMobile || "").trim().replace(/\D/g, ''),
        payment_status: 'WAITING',
        mode: isWholesale ? "Wholesale" : "Retail",
        items: cart.map(item => ({
          vegetable_id: item.id,
          name: item.name,
          tamil_name: item.tamilName,
          quantity: item.quantity,
          unit_price: item.price,
          total_price: item.total
        }))
      };

      if (editingBillId) {
        await billDbService.update(editingBillId, billData);
        Alert.alert(language === 'Tamil' ? 'வெற்றி' : "Success", language === 'Tamil' ? 'காத்திருப்பு பட்டியல் புதுப்பிக்கப்பட்டது' : "Wait bill updated");
      } else {
        await billDbService.create(billData);
        Alert.alert(language === 'Tamil' ? 'வெற்றி' : "Success", language === 'Tamil' ? 'காத்திருப்பு பட்டியலில் சேர்க்கப்பட்டது' : "Moved to waiting list");
      }
      
      setBillPreviewVisible(false);
      setCart([]);
      setCustomerName("");
      setCustomerMobile("");
      setDiscount(0);
      setEditingBillId(null);
      setIsProcessing(false);
    } catch (error) {
      console.error(error);
      setIsProcessing(false);
      Alert.alert("Error", "Failed to save wait bill");
    }
  };

  const finalizeBill = async () => {
    // Proceed to print/save
    try {
      const billId = nextBillId || `B${Date.now()}`;
      const billData = {
        shopName: shopName || "சுஜி காய்கறி கடை",
        logo: "Logo_bill.png",
        phone: shopPhone || "9095938085",
        address: shopAddress || "பாண்டி - திண்டிவனம் மெயின் ரோடு, கிளியனூர்.",
        userName: customerName || (language === 'Tamil' ? 'வாடிக்கையாளர்' : 'Walk-in Customer'),
        billId: billId, // For DB
        billNumber: billId, // For Print
        date: new Date().toLocaleString("en-IN"),
        mode: isWholesale ? "Wholesale" : "Retail",
        payment_status: 'PAID',
        language: language,
        items: cart.map((item) => ({
          id: item.id,
          name: item.tamilName || item.name,
          tamilName: item.tamilName,
          quantity: item.quantity,
          unitPrice: item.price,
          price: item.price,
          discount: item.itemDiscount || 0,
          totalPrice: parseFloat(item.total.toFixed(2)),
          total: parseFloat(item.total.toFixed(2)),
        })),
        totalAmount: parseFloat((cartTotal - (parseFloat(discount.toString()) || 0)).toFixed(2)),
        subTotal: parseFloat(cartTotal.toFixed(2)),
        discount: parseFloat(discount.toString()) || 0,
        grandTotal: parseFloat((cartTotal - (parseFloat(discount.toString()) || 0)).toFixed(2)),
      } as any;

      if (editingBillId) {
          const updatePayload = {
              total_amount: billData.grandTotal,
              discount: billData.discount,
              customer_name: billData.userName,
              customer_mobile: (customerMobile || "").trim().replace(/\D/g, ''),
              payment_status: 'PAID',
              items: cart.map(item => ({
                vegetable_id: item.id,
                name: item.name,
                tamil_name: item.tamilName,
                quantity: item.quantity,
                unit_price: item.price,
                total_price: item.total
              }))
          };
          await billDbService.update(editingBillId, updatePayload);
          setEditingBillId(null);
      } else {
          await SyncManager.queueBill(billData);
      }

      // 📸 CAPTURE IMAGE FOR PRINTING (Ensures Tamil support)
      let printImageUri = null;
      if (isPrinterConnected && thermalShotRef.current) {
        try {
          const captureWidth = printerPreference === '2inch' ? 384 : 576;
          printImageUri = await thermalShotRef.current.capture({
            format: 'png', // User requested png for transparency/quality
            quality: 1,
            width: captureWidth
          });
        } catch (captureErr) {
          console.warn('Failed to capture receipt image:', captureErr);
        }
      }

      // 🔄 AUTO PRINT LOGIC
      setCart([]);
      setBillPreviewVisible(false);
      setCustomerName("");
      setDiscount("");
      setNextBillId("");
      
      // Attempt auto print if enabled (Image mode only)
      if (printImageUri) {
          const receiptWidth = printerPreference === '2inch' ? 384 : 576;
          await ThermalPrinter.printImage(printImageUri, receiptWidth);
      }

      Alert.alert(
        language === 'Tamil' ? 'வெற்றி' : "Success", 
        language === 'Tamil' ? 'பில் வெற்றிகரமாக சேமிக்கப்பட்டது' : "Bill Saved Successfully"
      );

    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Could not complete bill process");
    }
  };

  const handleWhatsAppShare = async () => {
    try {
      const billData = {
        shopName: shopName || "சுஜி காய்கறி கடை",
        phone: shopPhone || "9095938085",
        address: shopAddress || "பாண்டி - திண்டிவனம் மெயின் ரோடு, கிளியனூர்.",
        userName: customerName || (language === 'Tamil' ? 'வாடிக்கையாளர்' : 'Walk-in Customer'),
        billNumber: nextBillId,
        date: new Date().toLocaleString("en-IN"),
        items: cart.map(item => ({
          name: item.name,
          tamilName: item.tamilName,
          quantity: item.quantity,
          price: item.price,
          total: item.total
        })),
        grandTotal: (cartTotal - (parseFloat(discount.toString()) || 0)).toFixed(0)
      };

      let message = `🧾 *${billData.shopName.toUpperCase()}*\n`;
      if (billData.address) message += `${billData.address}\n`;
      message += `${language === 'Tamil' ? 'போன்' : 'Ph'}: ${billData.phone}\n`;
      message += `--------------------------\n`;
      message += `${language === 'Tamil' ? 'பில் எண்' : 'Bill No'}: *${billData.billNumber}*\n`;
      message += `${language === 'Tamil' ? 'தேதி' : 'Date'}: ${billData.date}\n`;
      message += `${language === 'Tamil' ? 'வாடிக்கையாளர்' : 'Customer'}: ${billData.userName}\n`;
      message += `--------------------------\n`;

      billData.items.forEach((item: any) => {
        const name = item.tamilName || item.name;
        message += `• ${name}\n`;
        message += `  ${item.quantity}kg x ₹${item.price} = *₹${item.total.toFixed(0)}*\n`;
      });

      if (parseFloat(discount.toString()) > 0) {
        message += `--------------------------\n`;
        message += `${language === 'Tamil' ? 'கூட்டுத் தொகை' : 'Subtotal'}: ₹${cartTotal.toFixed(0)}\n`;
        message += `${language === 'Tamil' ? 'தள்ளுபடி' : 'Discount'}: -₹${parseFloat(discount.toString()).toFixed(0)}\n`;
      }

      message += `--------------------------\n`;
      message += `*${language === 'Tamil' ? 'மொத்த தொகை' : 'GRAND TOTAL'}: ₹${billData.grandTotal}*\n`;
      message += `--------------------------\n`;
      message += language === 'Tamil' ? `நன்றி! மீண்டும் வருக.` : `Thank you! Visit again.`;

      const cleanPhone = customerMobile.trim().replace(/\D/g, '');
      const url = cleanPhone.length >= 10 
        ? `whatsapp://send?phone=91${cleanPhone}&text=${encodeURIComponent(message)}`
        : `whatsapp://send?text=${encodeURIComponent(message)}`;
      
      const supported = await Linking.canOpenURL(url);
      
      if (supported) {
        await Linking.openURL(url);
      } else {
        const webUrl = cleanPhone.length >= 10
            ? `https://wa.me/91${cleanPhone}?text=${encodeURIComponent(message)}`
            : `https://wa.me/?text=${encodeURIComponent(message)}`;
        await Linking.openURL(webUrl);
      }
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Could not share to WhatsApp");
    }
  };

  const processBill = async (billData: any) => {
    try {
      await ThermalPrinter.printInvoice({
        shopName: billData.shopName,
        billId: billData.billNumber,
        date: billData.date,
        items: billData.items.map((i: any) => ({
          name: i.name,
          tamilName: i.tamilName,
          quantity: i.quantity,
          unitPrice: i.price,
          totalPrice: i.total
        })),
        totalAmount: billData.grandTotal,
        customerName: billData.userName,
        shopPhone: billData.phone,
        shopAddress: billData.address
      });
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Could not print bill");
    }
  };

  const handlePickContact = async () => {
    try {
        const { status } = await Contacts.requestPermissionsAsync();
        if (status === 'granted') {
            const contactResult = await Contacts.presentContactPickerAsync();
            if (contactResult) {
                const contact = await Contacts.getContactByIdAsync(contactResult.id);
                if (contact) {
                    let displayName = contact.name;
                    if (!displayName || displayName === 'undefined') {
                        displayName = [contact.firstName, contact.middleName, contact.lastName].filter(Boolean).join(' ');
                    }
                    if (displayName && displayName !== 'undefined') setCustomerName(displayName);
                    if (contact.phoneNumbers && contact.phoneNumbers.length > 0) {
                      setCustomerMobile(contact.phoneNumbers[0].number || '');
                    }
                }
            }
        }
    } catch (error: any) {
        console.error('Contact picker error:', error);
        Alert.alert('Error', 'Could not open contacts: ' + (error?.message || 'Unknown error'));
    }
  };

  const thermalShotRef = useRef<any>(null);
  const viewShotRef = useRef<any>(null);

  const ThermalReceiptView = ({ name, mobile, billId, date, cart, total, disc, shopName, shopPhone, width }: any) => {
    const is3Inch = width >= 576;
    const receiptWidth = is3Inch ? 576 : 384; 
    
    // Scale for crispness
    const scale = is3Inch ? 1.6 : 1.3;
    
    const PAD = 10 * scale; // Clean padding
    const COL_QTY = is3Inch ? 90 : 65;
    const COL_AMT = is3Inch ? 140 : 100;
    const COL_ITEM = receiptWidth - (PAD * 2) - COL_QTY - COL_AMT;

    return (
      <ViewShot 
        ref={thermalShotRef} 
        options={{ format: 'png', quality: 1, width: receiptWidth }} 
        style={{ width: receiptWidth, backgroundColor: '#FFFFFF' }}
      >
        <View style={{ 
          width: receiptWidth,
          backgroundColor: '#FFFFFF',
          paddingHorizontal: PAD,
          paddingVertical: 20 * scale,
          alignSelf: 'flex-start'
        }}>
          {/* --- HEADER --- */}
          <Text style={{ textAlign: 'center', fontSize: 26 * scale, fontWeight: '900', color: '#000', letterSpacing: 1 }}>
              {shopName || "சுஜி காய்கறி கடை"}
          </Text>
          <Text style={{ textAlign: 'center', color: '#222', fontSize: 13 * scale, fontWeight: '500', marginTop: 6 * scale }}>
              {shopAddress || "பாண்டி - திண்டிவனம் மெயின் ரோடு, கிளியனூர்."}
          </Text>
          <Text style={{ textAlign: 'center', color: '#000', fontSize: 14 * scale, fontWeight: '700', marginTop: 4 * scale, marginBottom: 10 * scale }}>
              Phone: {shopPhone || "9095938085"}
          </Text>

          {/* --- META INFO --- */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 * scale, marginBottom: 4 * scale }}>
            <Text style={{ color: '#000', fontSize: 14 * scale, fontWeight: '700' }}>No: {billId}</Text>
            <Text style={{ color: '#000', fontSize: 14 * scale, fontWeight: '700' }}>Date: {date.split(',')[0]}</Text>
          </View>
          <Text style={{ color: '#000', fontSize: 14 * scale, fontWeight: '700', marginBottom: 14 * scale }}>
            Customer: {name || (language === 'Tamil' ? 'வாடிக்கையாளர்' : 'Walk-in')}
          </Text>
  
          {/* --- TABLE HEADER --- */}
          <View style={{ 
            flexDirection: 'row', 
            paddingVertical: 8 * scale, 
            borderTopWidth: 2 * scale, 
            borderBottomWidth: 2 * scale,
            borderColor: '#000',
            marginBottom: 8 * scale
          }}>
            <Text style={{ width: COL_ITEM, fontWeight: 'bold', color: '#000', fontSize: 14 * scale }}>ITEM</Text>
            <Text style={{ width: COL_QTY, textAlign: 'center', fontWeight: 'bold', color: '#000', fontSize: 14 * scale }}>QTY</Text>
            <Text style={{ width: COL_AMT, textAlign: 'right', fontWeight: 'bold', color: '#000', fontSize: 14 * scale }}>AMOUNT</Text>
          </View>
  
          {/* --- ITEMS --- */}
          {cart.map((item: any, i: number) => (
            <View key={i} style={{ 
              flexDirection: 'row', 
              paddingVertical: 8 * scale,
            }}>
              <Text style={{
                width: COL_ITEM,
                color: '#000',
                fontSize: 16 * scale,
                fontWeight: 'bold',
              }}>
                {item.tamilName || item.name}
              </Text>

              <Text style={{ 
                width: COL_QTY, 
                textAlign: 'center', 
                color: '#000', 
                fontSize: 16 * scale,
                fontWeight: '600'
              }}>
                {item.quantity}
              </Text>

              <Text style={{ 
                width: COL_AMT, 
                textAlign: 'right', 
                color: '#000', 
                fontSize: 16 * scale,
                fontWeight: '900'
              }}>
                {item.total.toFixed(0)}
              </Text>
            </View>
          ))}
  
          <View style={{ borderTopWidth: 1.5 * scale, borderTopColor: '#000', borderStyle: 'dashed', marginTop: 12 * scale, paddingTop: 12 * scale }}>
            {/* --- TOTALS --- */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 * scale }}>
              <Text style={{ fontSize: 15 * scale, color: '#000', fontWeight: '600' }}>Sub Total</Text>
              <Text style={{ fontSize: 15 * scale, color: '#000', fontWeight: '800' }}>₹{total.toFixed(0)}</Text>
            </View>
            
            {parseFloat(disc) > 0 && (
               <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 * scale }}>
                  <Text style={{ fontSize: 15 * scale, color: '#444', fontWeight: '600' }}>Discount</Text>
                  <Text style={{ fontSize: 15 * scale, color: '#000', fontWeight: '800' }}>-₹{parseFloat(disc).toFixed(0)}</Text>
               </View>
            )}

            <View style={{ 
              flexDirection: 'row', 
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: 6 * scale,
              paddingVertical: 10 * scale,
              borderTopWidth: 2 * scale,
              borderBottomWidth: 2 * scale,
              borderColor: '#000',
            }}>
              <Text style={{ fontWeight: '900', color: '#000', fontSize: 20 * scale }}>TOTAL</Text>
              <Text style={{ fontWeight: '900', color: '#000', fontSize: 24 * scale }}>₹{(total - (parseFloat(disc) || 0)).toFixed(0)}</Text>
            </View>
          </View>
  
          {/* --- FOOTER --- */}
          <View style={{ marginTop: 30 * scale, alignItems: 'center' }}>
            <Text style={{
                fontSize: 20 * scale,
                fontWeight: '900',
                color: '#000',
            }}>
                நன்றி! மீண்டும் வருக.
            </Text>
            <Text style={{ fontSize: 13 * scale, color: '#555', fontWeight: '600', marginTop: 6 * scale }}>
                Thank you! Visit again.
            </Text>
          </View>
        </View>
      </ViewShot>
    );
  };
  const handleShareImage = async () => {
    try {
      if (!thermalShotRef.current) {
        Alert.alert('Error', 'Receipt view not ready');
        return;
      }

      // Capture using the ViewShot component's internal capture method
      const uri = await thermalShotRef.current.capture();
      console.log('Capture success:', uri);

      const cleanPhone = (customerMobile || "").trim().replace(/\D/g, '');
      const whatsAppNumber = cleanPhone.length >= 10 ? `+91${cleanPhone.slice(-10)}` : '';

      try {
        const hasNativeShare = !!NativeModules.RNShare;
        
        // PURE IMAGE DIRECT SHARING - HIGH COMPATIBILITY MODE
        if (hasNativeShare && cleanPhone.length >= 10) {
          try {
            const Share = require('react-native-share').default;
            const FileSystem = require('expo-file-system/legacy');
            
            const targetPhone = `+91${cleanPhone.slice(-10)}`;
            console.log('Direct Target Injection:', targetPhone);
            
            // Step 1: Ensure image is in a stable cache location with .jpg extension
            const sharePath = FileSystem.cacheDirectory + `bill_${Date.now()}.jpg`;
            await FileSystem.copyAsync({ from: uri, to: sharePath });
            const shareUri = `file://${sharePath.replace('file://', '')}`;

            const shareOptions = {
              social: Share.Social.WHATSAPP,
              whatsAppNumber: targetPhone,
              url: shareUri,
              type: 'image/jpeg',
              forceFullApp: true,
            };
            
            // Step 2: Attempt standard WhatsApp
            try {
              // On modern Android, WhatsApp often ignores the number when sharing files. 
              // We try to use the most direct intent parameters available.
              await Share.shareSingle(shareOptions);
            } catch (waErr) {
              console.warn('Standard WhatsApp failed, trying Business version...');
              // Try WhatsApp Business as fallback
              await Share.shareSingle({
                ...shareOptions,
                appId: "com.whatsapp.w4b"
              });
            }
            return;
          } catch (singleErr) {
            console.error('All direct injection attempts failed:', singleErr);
            // OS level security forces the share picker - we'll use the most direct one available
            await Sharing.shareAsync(uri);
            return;
          }
        } else {
          // If no phone or no native module, ALWAYS use system share for the IMAGE
          await Sharing.shareAsync(uri);
        }
      } catch (err) {
        console.error('Final image-only share block failed:', err);
        await Sharing.shareAsync(uri);
      }
    } catch (error) {
      console.error('Share image error:', error);
      Alert.alert('Error', 'Failed to generate invoice image');
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

  const adjustQtyInPreview = (id: string, delta: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCart((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const newQty = parseFloat(Math.max(0.25, item.quantity + delta).toFixed(2));
          return {
            ...item,
            quantity: newQty,
            total: newQty * item.price - (item.itemDiscount || 0),
          };
        }
        return item;
      }),
    );
  };

  const removeItemFromPreview = (id: string) => {
    Alert.alert(
      language === "Tamil" ? "நீக்கு" : "Remove Item",
      language === "Tamil" ? "பொருளை நீக்க வேண்டுமா?" : "Are you sure you want to remove this item?",
      [
        { text: language === "Tamil" ? "இல்லை" : "No", style: "cancel" },
        { 
          text: language === "Tamil" ? "ஆம்" : "Yes", 
          style: "destructive", 
          onPress: () => setCart(prev => prev.filter(item => item.id !== id))
        }
      ]
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

  // const primaryColor = "#FF8C00"; // Removed local override to use context color
  const accentColor = "#E67E00";
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
        <TouchableOpacity 
          style={[styles.favouriteBtn, { backgroundColor: isDark ? '#333' : '#F8FAFC' }]}
          onPress={(e) => {
            e.stopPropagation();
            toggleFavourite(item.id);
          }}
        >
          <Ionicons 
            name={user?.top_selling_vegetables?.includes(item.id) ? "star" : "star-outline"} 
            size={16} 
            color={user?.top_selling_vegetables?.includes(item.id) ? "#FFD700" : labelColor} 
          />
        </TouchableOpacity>

        {isSelected && (
          <View style={[styles.checkBadge, { backgroundColor: primaryColor }]}>
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
        <TouchableOpacity 
          style={[styles.favouriteBtnList, { backgroundColor: isDark ? '#333' : '#F8FAFC' }]}
          onPress={(e) => {
            e.stopPropagation();
            toggleFavourite(item.id);
          }}
        >
          <Ionicons 
            name={user?.top_selling_vegetables?.includes(item.id) ? "star" : "star-outline"} 
            size={14} 
            color={user?.top_selling_vegetables?.includes(item.id) ? "#FFD700" : labelColor} 
          />
        </TouchableOpacity>

        {isSelected && (
          <View
            style={[styles.checkBadge, { top: -scale(6), right: -scale(6), backgroundColor: primaryColor }]}
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
        backgroundColor={isDark ? "#1A1A1A" : primaryColor}
      />

      {/* Header */}
      <LinearGradient
        colors={isDark ? ["#1A1A1A", "#1A1A1A"] : [primaryColor, primaryColor]}
        style={[
          styles.header,
          { paddingTop: insets.top + (Platform.OS === "android" ? 10 : 0) },
        ]}
      >
        <View style={styles.headerTitleRow}>
          <View style={{ flex: 1 }}>
            <Text
              style={[styles.shopTitle, { color: isDark ? textColor : "#FFF" }]}
            >
              {shopName || user?.shopName || "Vegetable Shop"}
            </Text>
            <View style={styles.headerSubtitleRow}>
              <TouchableOpacity 
                activeOpacity={0.7}
                onPress={() => {
                  scanPrinters();
                  setShowPrinterModal(true);
                }}
                style={[
                    styles.printerBadgeHeader, 
                    { 
                        backgroundColor: isPrinterConnected ? '#4ADE8030' : '#F8717130',
                        borderColor: isPrinterConnected ? '#4ADE80' : '#F87171',
                    }
                ]}
              >
                <MaterialCommunityIcons 
                    name={isPrinterConnected ? "printer-check" : "printer-off"} 
                    size={10} 
                    color={isPrinterConnected ? '#4ADE80' : '#F87171'} 
                />
                <Text style={[styles.printerBadgeText, { color: isPrinterConnected ? '#4ADE80' : '#F87171' }]}>
                    {isPrinterConnected ? (language === 'Tamil' ? 'ஆன்' : 'ON') : (language === 'Tamil' ? 'இணைப்பு' : 'CONNECT')}
                </Text>
              </TouchableOpacity>
              <Text
                style={[
                  styles.shopSubtitle,
                  { color: isDark ? labelColor : "rgba(255,255,255,0.9)" },
                ]}
              >
                {language === 'Tamil' ? 'பாயிண்ட் ஆஃப் சேல்' : 'Point of Sale'} • {isWholesale ? (language === 'Tamil' ? 'மொத்த விற்பனை' : 'Wholesale') : (language === 'Tamil' ? 'சில்லறை' : 'Retail')}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            onPress={() => setSettingsMenuVisible(true)}
            style={[styles.headerActionBtn, { backgroundColor: isDark ? '#2C2C2E' : 'rgba(255,255,255,0.2)' }]}
          >
            <Ionicons name="settings-outline" size={22} color="#FFF" />
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

                <View
                  style={[
                    styles.menuDivider,
                    { backgroundColor: isDark ? "#333" : "#F0F0F0" },
                  ]}
                />

                <View style={styles.menuColorSection}>
                  <Text style={[styles.menuSectionLabel, { color: labelColor }]}>
                    {language === 'Tamil' ? 'தீம் நிறம்' : 'Theme Color'}
                  </Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.menuColorList}>
                    {THEME_COLORS.map((item: any) => (
                      <TouchableOpacity
                        key={item.color}
                        onPress={() => setPrimaryColor(item.color)}
                        style={[
                          styles.menuColorCircle,
                          { backgroundColor: item.color },
                          primaryColor === item.color && styles.menuColorActive
                        ]}
                      />
                    ))}
                  </ScrollView>
                </View>
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
              {language === "Tamil" ? "சில்லறை" : "Retail"}
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
              {language === "Tamil" ? "மொத்த விற்பனை" : "Wholesale"}
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
        <View style={styles.floatBarContainer}>
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
        </View>
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
                      <MaterialCommunityIcons name="currency-inr" size={16} color={primaryColor} />
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
                    <View style={[styles.totalPreview, { backgroundColor: primaryColor + '08', borderColor: primaryColor + '20' }]}>
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
                    style={[styles.confirmBtn, { backgroundColor: primaryColor, shadowColor: primaryColor }]}
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

      {/* Printer Selection Modal */}
      <Modal visible={showPrinterModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
            <View style={[styles.printerModal, { backgroundColor: cardBg }]}>
                <View style={styles.modalHeader}>
                    <Text style={[styles.modalTitle, { color: textColor }]}>Select Bluetooth Printer</Text>
                    <TouchableOpacity onPress={() => setShowPrinterModal(false)}>
                        <Ionicons name="close" size={24} color={textColor} />
                    </TouchableOpacity>
                </View>
                
                <FlatList
                    data={pairedDevices}
                    keyExtractor={item => item.address}
                    renderItem={({ item }) => (
                        <TouchableOpacity 
                            onPress={() => handleConnectPrinter(item.address)}
                            style={[styles.deviceRow, { borderBottomColor: borderCol }]}
                        >
                            <View>
                                <Text style={[styles.deviceName, { color: textColor }]}>{item.name || 'Unknown'}</Text>
                                <Text style={{ color: labelColor, fontSize: 10 }}>{item.address}</Text>
                            </View>
                            <MaterialCommunityIcons name="bluetooth" size={20} color={primaryColor} />
                        </TouchableOpacity>
                    )}
                    ListEmptyComponent={
                      <View style={{ padding: 25, alignItems: 'center', justifyContent: 'center' }}>
                        <MaterialCommunityIcons 
                          name={!isPrinterAvailable ? "alert-circle-outline" : "bluetooth-off"} 
                          size={48} 
                          color={isDark ? "#444" : "#CCC"} 
                        />
                        <Text style={{ 
                          color: textColor, 
                          fontWeight: '800', 
                          fontSize: 16, 
                          marginTop: 15,
                          textAlign: 'center' 
                        }}>
                          {!isPrinterAvailable 
                            ? (language === 'Tamil' ? 'பிரிண்டர் மாட்யூல் கிடைக்கவில்லை' : 'Printer Module Not Found') 
                            : (language === 'Tamil' ? 'பிரிண்டர் எதுவும் கிடைக்கவில்லை' : 'No Printers Found')}
                        </Text>
                        <Text style={{ 
                          color: labelColor, 
                          fontSize: 13, 
                          marginTop: 8, 
                          textAlign: 'center',
                          lineHeight: 18 
                        }}>
                          {!isPrinterAvailable 
                            ? (language === 'Tamil' 
                               ? 'தயவு செய்து APK-வை இன்ஸ்டால் செய்யவும். Expo Go-வில் பிரிண்டர் வேலை செய்யாது.' 
                               : 'Bluetooth printer features only work in an installed APK / Dev Build, not in Expo Go.')
                            : (language === 'Tamil'
                               ? '1. புளூடூத் ஆன் செய்யப்பட்டுள்ளதா என சரிபார்க்கவும்.\n2. போன் செட்டிங்ஸில் பிரிண்டரை Pair செய்யவும்.'
                               : '1. Ensure Bluetooth is ON.\n2. Pair the printer in Android Bluetooth Settings first.')
                          }
                        </Text>
                      </View>
                    }
                />
                
                <TouchableOpacity 
                    onPress={scanPrinters} 
                    style={[styles.modalActionBtn, { backgroundColor: primaryColor }]}
                >
                    <Text style={{ color: '#FFF', fontWeight: 'bold' }}>Refresh List</Text>
                </TouchableOpacity>
            </View>
        </View>
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
            colors={isDark ? ["#1A1A1A", "#1A1A1A"] : [primaryColor, primaryColor]}
            style={[
              styles.fixedHeader,
              { paddingTop: insets.top + (Platform.OS === 'android' ? 5 : 2) }
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
              </View>
              <TouchableOpacity
                onPress={handleWaitBill}
                disabled={isProcessing}
                style={[
                    styles.closeBtnCircle, 
                    { 
                        width: 'auto', 
                        paddingHorizontal: scale(12), 
                        backgroundColor: isProcessing ? '#CCC' : '#FF9800', 
                        borderRadius: scale(10),
                        flexDirection: 'row',
                        gap: 6,
                        elevation: 4,
                        opacity: isProcessing ? 0.7 : 1,
                    }
                ]}
              >
                <MaterialCommunityIcons name="clock-outline" size={18} color="#FFF" />
                <Text style={{ color: '#FFF', fontWeight: '900', fontSize: moderateScale(12) }}>
                  {isProcessing ? '...' : (language === 'Tamil' ? 'காத்திருப்பு' : 'Wait Bill')}
                </Text>
              </TouchableOpacity>
            </View>
          </LinearGradient>

            {/* Dynamic capture component based on printer size */}
            <View 
              pointerEvents="none"
              style={{ 
                position: 'absolute', 
                top: 0, 
                left: -5000, 
                zIndex: -999, 
                width: printerPreference === '2inch' ? 384 : 576,
              }} 
            >
              <ThermalReceiptView 
                 name={customerName}
                 mobile={customerMobile}
                 billId={nextBillId}
                 date={new Date().toLocaleString('en-IN')}
                 cart={cart}
                 total={cartTotal}
                 disc={discount}
                 shopName={shopName}
                 shopPhone={shopPhone}
                 shopAddress={shopAddress}
                 width={printerPreference === '2inch' ? 384 : 576}
              />
            </View>

            <ScrollView
              ref={scrollRef}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ flexGrow: 1 }}
            >
            
            <ViewShot ref={viewShotRef} options={{ format: "jpg", quality: 0.9 }} style={{ backgroundColor: bg }}>
            {/* ── HERO BANNER (Dashboard Style) ── */}
            <LinearGradient
              colors={isDark ? ['#1A1A1A', '#1A1A1A'] : [primaryColor, primaryColor]}
              style={styles.hero}
            >
              <View style={styles.heroContent}>
                <View style={styles.heroMain}>
                   <Text style={styles.heroTitle}>{language === 'Tamil' ? 'பில் விவரம்' : 'Invoice Details'}</Text>
                   <Text style={[styles.heroSubtitle, { color: 'rgba(255,255,255,0.9)' }]}>#{nextBillId} • {new Date().toLocaleDateString('en-IN')}</Text>
                </View>
                 <View style={{ width: 0 }} />
              </View>
            </LinearGradient>

            <View style={styles.body}>
              {/* ── QUICK STATS ── */}
              <Animated.View entering={FadeInDown.delay(200)} style={styles.quickStatsRow}>
                <View style={[styles.quickStatCard, { backgroundColor: cardBg, borderColor: borderCol }]}>
                  <View style={[styles.quickStatIcon, { backgroundColor: '#3B82F615' }]}>
                    <MaterialCommunityIcons name="pound" size={20} color="#3B82F6" />
                  </View>
                  <Text style={[styles.quickStatValue, { color: textColor }]}>{nextBillId}</Text>
                  <Text style={[styles.quickStatLabel, { color: labelColor }]}>{language === 'Tamil' ? 'பில் எண்' : 'Bill No'}</Text>
                </View>

                <View style={[styles.quickStatCard, { backgroundColor: cardBg, borderColor: borderCol }]}>
                  <View style={[styles.quickStatIcon, { backgroundColor: primaryColor + '15' }]}>
                    <MaterialCommunityIcons name="calendar" size={20} color={primaryColor} />
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
                <View style={[styles.dashboardInvoiceCard, { backgroundColor: cardBg, borderColor: borderCol, padding: scale(10), marginBottom: 5 }]}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <MaterialCommunityIcons name="account-outline" size={18} color={primaryColor} style={{ marginRight: 8 }} />
                        <TextInput
                        style={[styles.dashboardCustomerInput, { color: textColor, flex: 1, fontSize: moderateScale(14) }]}
                        placeholder={language === 'Tamil' ? "வாடிக்கையாளர் பெயரை உள்ளிடவும்" : "Enter Customer Name"}
                        placeholderTextColor={labelColor}
                        value={customerName}
                        onChangeText={setCustomerName}
                        />
                        <TouchableOpacity 
                            onPress={handlePickContact}
                            style={[styles.contactPickerBtn, { backgroundColor: primaryColor + '10', padding: 4, borderRadius: 6 }]}
                        >
                            <Feather name="users" size={16} color={primaryColor} />
                        </TouchableOpacity>
                    </View>
                    <View style={{ height: 1, backgroundColor: borderCol, marginVertical: moderateScale(8), opacity: 0.3 }} />
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <MaterialCommunityIcons name="whatsapp" size={16} color="#25D366" style={{ marginRight: 8 }} />
                      <TextInput
                        style={[styles.dashboardCustomerInput, { color: textColor, paddingVertical: 2, fontSize: moderateScale(14), flex: 1 }]}
                        placeholder={language === 'Tamil' ? "வாடிக்கையாளர் மொபைல் எண்" : "Customer Mobile Number"}
                        placeholderTextColor={labelColor}
                        keyboardType="phone-pad"
                        value={customerMobile}
                        onChangeText={setCustomerMobile}
                        maxLength={10}
                      />
                    </View>
                  </View>
                </View>
              </Animated.View>

              {/* ── ITEMS LIST ── */}
              <Animated.View entering={FadeInDown.delay(400)} style={{ marginTop: 10 }}>
                <View style={[styles.sectionRow, { marginBottom: 8 }]}>
                    <Text style={[styles.sectionTitle, { color: textColor, marginBottom: 0, fontSize: moderateScale(16) }]}>{language === 'Tamil' ? 'பொருட்கள் விவரம்' : 'Bill Items'}</Text>
                    <Text style={{ color: labelColor, fontWeight: '700', fontSize: 10 }}>{language === 'Tamil' ? 'விலை திருத்தலாம்' : 'Editable'}</Text>
                </View>

                {/* Column Headers */}
                <View style={{ flexDirection: 'row', paddingHorizontal: scale(14), marginBottom: 5 }}>
                    <Text style={{ flex: 2.2, color: labelColor, fontSize: 10, fontWeight: '800' }}>{language === 'Tamil' ? 'பொருள்/விலை' : 'ITEM / PRICE'}</Text>
                    <Text style={{ flex: 2, color: labelColor, fontSize: 10, fontWeight: '800', textAlign: 'center' }}>{language === 'Tamil' ? 'அளவு' : 'QUANTITY'}</Text>
                    <Text style={{ flex: 1.5, color: labelColor, fontSize: 10, fontWeight: '800', textAlign: 'right' }}>{language === 'Tamil' ? 'மொத்தம்' : 'TOTAL'}</Text>
                </View>

                {cart.map((item, index) => (
                  <Animated.View
                    key={item.id}
                    entering={FadeInDown.delay(450 + index * 50)}
                    style={[styles.dashboardInvoiceCard, { backgroundColor: cardBg, borderColor: borderCol, paddingVertical: verticalScale(8), marginBottom: 6, borderRadius: 12 }]}
                  >
                    <View style={{ flex: 2.2 }}>
                      <Text style={[styles.trTamil, { color: textColor, fontSize: moderateScale(15) }]} numberOfLines={1}>{item.tamilName}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                        <Text style={{ fontSize: 10, color: labelColor, fontWeight: '800' }}>₹</Text>
                        <TextInput
                          keyboardType="numeric"
                          style={[
                            styles.dashboardTrInput, 
                            { 
                              color: primaryColor, 
                              backgroundColor: isDark ? '#333' : '#F3F4F6',
                              width: scale(45),
                              height: verticalScale(22),
                              fontSize: moderateScale(11),
                              marginHorizontal: 3,
                              borderRadius: 4
                            }
                          ]}
                          value={item.price.toString()}
                          selectTextOnFocus
                          onChangeText={(v) => updateCartItemInPreview(item.id, item.quantity.toString(), v, (item.itemDiscount || 0).toString())}
                        />
                        <Text style={{ fontSize: 10, color: labelColor, fontWeight: '800' }}>/kg</Text>
                      </View>
                    </View>
                    
                    <View style={{ flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                       <TouchableOpacity 
                         onPress={() => adjustQtyInPreview(item.id, -0.25)}
                         style={[styles.previewStepBtn, { backgroundColor: isDark ? '#333' : '#F8FAFC', width: scale(24), height: scale(24) }]}
                       >
                         <Feather name="minus" size={12} color={textColor} />
                       </TouchableOpacity>
                       
                       <View style={{ alignItems: 'center', minWidth: scale(45) }}>
                         <TextInput
                            keyboardType="numeric"
                            style={[
                              styles.dashboardTrInput, 
                              { 
                                color: textColor, 
                                backgroundColor: isDark ? '#333' : '#F3F4F6',
                                width: scale(42),
                                height: verticalScale(26),
                                fontSize: moderateScale(12)
                              }
                            ]}
                            value={item.quantity.toString()}
                            selectTextOnFocus
                            onChangeText={(v) => updateCartItemInPreview(item.id, v, item.price.toString(), (item.itemDiscount || 0).toString())}
                          />
                       </View>

                       <TouchableOpacity 
                         onPress={() => adjustQtyInPreview(item.id, 0.25)}
                         style={[styles.previewStepBtn, { backgroundColor: primaryColor, width: scale(24), height: scale(24) }]}
                       >
                         <Feather name="plus" size={12} color="#FFF" />
                       </TouchableOpacity>
                    </View>

                    <View style={{ flex: 1.5, alignItems: 'flex-end', justifyContent: 'center' }}>
                      <Text style={[styles.trTotal, { color: primaryColor, fontSize: moderateScale(16) }]}>₹{item.total.toFixed(0)}</Text>
                      <TouchableOpacity 
                        onPress={() => removeItemFromPreview(item.id)}
                        style={{ marginTop: verticalScale(4), padding: 2 }}
                      >
                         <Feather name="trash-2" size={14} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  </Animated.View>
                ))}
                
                {/* ── ADD ITEM QUICK BUTTON ── */}
                <Animated.View entering={FadeInDown.delay(500)}>
                  <TouchableOpacity 
                    style={[styles.addItemQuickBtn, { borderColor: primaryColor, backgroundColor: primaryColor + '08' }]}
                    onPress={() => setBillPreviewVisible(false)}
                  >
                    <Feather name="plus-circle" size={20} color={primaryColor} />
                    <Text style={[styles.addItemQuickText, { color: primaryColor }]}>{t.ADD_ITEM || 'Add Item'}</Text>
                  </TouchableOpacity>
                </Animated.View>
              </Animated.View>

              {/* ── FINAL BREAKDOWN CARD ── */}
              <Animated.View entering={FadeInDown.delay(550)} style={{ marginTop: 10 }}>
                <View style={[styles.premiumCard, { backgroundColor: cardBg, padding: scale(15) }]}>
                  <View style={[styles.summaryLine, { marginBottom: 6 }]}>
                    <Text style={[styles.summaryLabelText, { color: labelColor, fontSize: 13 }]}>{language === 'Tamil' ? 'உருப்படிகளின் விலை' : 'Items Total'}</Text>
                    <Text style={[styles.summaryValueText, { color: textColor, fontSize: 13 }]}>₹{cartTotal.toFixed(2)}</Text>
                  </View>
                  
                  <View style={[styles.summaryLine]}>
                    <Text style={[styles.summaryLabelText, { color: '#EF4444', fontSize: 13 }]}>{language === 'Tamil' ? 'கூடுதல் தள்ளுபடி' : 'Extra Discount'}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                       <Text style={{ color: '#EF4444', fontWeight: 'bold', fontSize: 13 }}>- ₹</Text>
                       <TextInput
                         style={[styles.summaryValueText, { color: '#EF4444', minWidth: 50, textAlign: 'right', borderBottomWidth: 1, borderBottomColor: '#EF4444', padding: 0, fontSize: 13 }]}
                         keyboardType="numeric"
                         value={discount.toString()}
                         onChangeText={(v) => {
                           const val = parseFloat(v) || 0;
                           setDiscount(val);
                         }}
                         selectTextOnFocus
                       />
                    </View>
                  </View>

                  <View style={[styles.divider, { backgroundColor: borderCol, marginVertical: 10 }]} />

                  <View style={styles.summaryLine}>
                    <Text style={[styles.summaryLabelText, { color: textColor, fontSize: 16, fontWeight: '900' }]}>{language === 'Tamil' ? 'மொத்த தொகை' : 'Grand Total'}</Text>
                    <Text style={[styles.summaryValueText, { color: primaryColor, fontSize: 20, fontWeight: '900' }]}>₹{(cartTotal - (parseFloat(discount.toString()) || 0)).toFixed(0)}</Text>
                  </View>
                </View>
              </Animated.View>

              </View>
            </ViewShot>

            {/* Sticky Professional Footer Actions - Moved inside ScrollView but outside ViewShot */}
            <Animated.View 
              entering={FadeInDown.delay(600)}
              style={[
                styles.stickyInvoiceFooter, 
                { 
                  backgroundColor: cardBg, 
                  borderTopColor: borderCol,
                  paddingBottom: Math.max(verticalScale(20), insets.bottom + verticalScale(10)),
                  flexDirection: 'row',
                  gap: 12,
                  paddingHorizontal: 16,
                  marginTop: 20
                }
              ]}
            >
                <TouchableOpacity 
                  style={[
                    styles.mainGenerateBtn, 
                    { 
                      backgroundColor: '#25D366', 
                      flex: 1, 
                      elevation: 4,
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.2,
                      shadowRadius: 4,
                      paddingHorizontal: scale(10),
                      justifyContent: 'center',
                      alignItems: 'center',
                    }
                  ]} 
                  onPress={handleShareImage}
                  activeOpacity={0.8}
                >
                    <View style={[styles.generateBtnContent, { gap: scale(8) }]}>
                      <Ionicons name="logo-whatsapp" size={22} color="#FFF" />
                      <Text style={[styles.mainGenerateText, { fontWeight: '800', fontSize: moderateScale(13) }]}>Share Bill</Text>
                    </View>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[
                    styles.mainGenerateBtn, 
                    { 
                      backgroundColor: primaryColor, 
                      flex: 1.4, 
                      elevation: 4,
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.2,
                      shadowRadius: 4,
                      paddingHorizontal: scale(10),
                      justifyContent: 'center',
                      alignItems: 'center',
                    }
                  ]} 
                  onPress={finalizeBill}
                  activeOpacity={0.8}
                >
                  <View style={[styles.generateBtnContent, { gap: scale(8) }]}>
                    <MaterialCommunityIcons name="printer-check" size={24} color="#FFF" />
                    <Text style={[styles.mainGenerateText, { fontSize: moderateScale(14) }]}>
                      {language === 'Tamil' ? `அச்சிடு (${printerPreference === '2inch' ? '2"' : '3"'})` : `Print (${printerPreference === '2inch' ? '2"' : '3"'})`}
                    </Text>
                  </View>
                  <View style={[styles.printerSwitchInline, { backgroundColor: 'rgba(255,255,255,0.2)', marginHorizontal: 5 }]}>
                     <TouchableOpacity 
                       onPress={(e) => {
                         e.stopPropagation();
                         const newSize = printerPreference === '2inch' ? '3inch' : '2inch';
                         setPrinterPreference(newSize);
                         Storage.setItem(KEYS.PRINTER_SIZE, newSize);
                       }}
                       style={styles.switchIcon}
                     >
                       <MaterialCommunityIcons name="swap-horizontal" size={18} color="#FFF" />
                     </TouchableOpacity>
                  </View>
                  <View style={styles.generateBtnArrow}>
                    <Feather name="arrow-right" size={20} color="#FFF" />
                  </View>
                </TouchableOpacity>
            </Animated.View>
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
    paddingHorizontal: scale(25),
    paddingBottom: verticalScale(25),
    borderBottomLeftRadius: scale(30),
    borderBottomRightRadius: scale(30),
    overflow: 'hidden',
    elevation: 8,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    zIndex: 10,
  },
  headerTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  shopTitle: {
    fontSize: moderateScale(24),
    fontWeight: "900",
    letterSpacing: -0.5,
  },
  headerSubtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: verticalScale(4),
  },
  printerBadgeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: scale(6),
    paddingVertical: verticalScale(2),
    borderRadius: scale(12),
    borderWidth: 1,
    marginRight: scale(6),
    gap: 3
  },
  printerBadgeText: {
    fontSize: moderateScale(9),
    fontWeight: '900',
  },
  shopSubtitle: {
    fontSize: moderateScale(12),
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  headerActions: {
    flexDirection: "row",
    gap: scale(10),
  },
  headerIconBtn: {
    width: scale(42),
    height: scale(42),
    borderRadius: scale(15),
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: 'rgba(255,255,255,0.2)',
    backdropFilter: 'blur(10px)',
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
    height: verticalScale(40),
    borderRadius: scale(12),
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: scale(12),
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
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
    borderRadius: scale(12),
    padding: scale(10),
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    marginBottom: scale(6),
  },
  cardInfoImage: {
    width: "100%",
    height: verticalScale(70),
    resizeMode: "contain",
    marginBottom: verticalScale(6),
  },
  checkBadge: {
    position: "absolute",
    top: verticalScale(10),
    right: scale(10),
    width: scale(22),
    height: scale(22),
    borderRadius: scale(11),
    zIndex: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFF",
  },
  favouriteBtn: {
    position: "absolute",
    top: scale(8),
    left: scale(8),
    width: scale(26),
    height: scale(26),
    borderRadius: scale(13),
    zIndex: 15,
    alignItems: "center",
    justifyContent: "center",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  favouriteBtnList: {
    position: "absolute",
    top: scale(4),
    left: scale(4),
    width: scale(22),
    height: scale(22),
    borderRadius: scale(11),
    zIndex: 15,
    alignItems: "center",
    justifyContent: "center",
    elevation: 1,
  },
  cardDetails: {
    flex: 1,
  },
  cardTamilName: {
    fontSize: moderateScale(13),
    fontWeight: "800",
    marginBottom: verticalScale(1),
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
    fontSize: moderateScale(14),
    fontWeight: "800",
  },
  unitText: {
    fontSize: moderateScale(11),
    fontWeight: "500",
    marginLeft: scale(2),
  },
  addBtn: {
    width: scale(30),
    height: scale(30),
    borderRadius: scale(10),
    alignItems: "center",
    justifyContent: "center",
  },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: scale(10),
    padding: scale(2),
    minHeight: scale(32),
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
    fontSize: moderateScale(13),
    fontWeight: "800",
    marginHorizontal: scale(2),
    minWidth: moderateScale(30),
    textAlign: "center",
  },
  // Controls
  controlsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: scale(20),
    marginTop: verticalScale(10),
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
    borderRadius: scale(12),
    padding: scale(10),
    marginBottom: scale(8),
    alignItems: "center",
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
  },
  listImage: {
    width: scale(45),
    height: scale(45),
    resizeMode: "contain",
    marginRight: scale(10),
  },
  listDetails: {
    flex: 1,
  },
  listTamilName: {
    fontSize: moderateScale(14),
    fontWeight: "800",
    marginBottom: verticalScale(2),
  },
  listPriceRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  listPriceText: {
    fontSize: moderateScale(14),
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
    paddingHorizontal: scale(12),
    paddingVertical: verticalScale(6),
    borderRadius: scale(15),
    borderWidth: scale(1),
    justifyContent: "center",
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
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
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 100,
  },
  floatBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: scale(16),
    paddingHorizontal: scale(20),
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    borderTopLeftRadius: scale(24),
    borderTopRightRadius: scale(24),
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
    borderRadius: scale(12),
    borderWidth: 1,
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
    paddingVertical: verticalScale(10),
    borderBottomLeftRadius: scale(15),
    borderBottomRightRadius: scale(15),
    overflow: 'hidden',
    marginBottom: verticalScale(4),
  },
  heroContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10,
  },
  heroMain: {
    flex: 1,
  },
  heroTitle: {
    fontSize: moderateScale(18),
    fontWeight: '900',
    color: '#FFF',
    letterSpacing: -0.5,
  },
  heroSubtitle: {
    fontSize: moderateScale(11),
    fontWeight: '600',
    marginTop: 1,
  },
  heroStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: scale(10),
    paddingVertical: verticalScale(5),
    borderRadius: scale(10),
  },
  heroStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#4ADE80',
    marginRight: 6,
  },
  heroStatusText: {
    fontSize: moderateScale(10),
    color: '#FFF',
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  body: {
    paddingHorizontal: scale(16),
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
    paddingTop: verticalScale(6),
  },
  quickStatsRow: {
    flexDirection: 'row',
    gap: scale(10),
    marginBottom: verticalScale(15),
  },
  quickStatCard: {
    flex: 1,
    borderRadius: scale(12),
    padding: scale(8),
    alignItems: 'center',
    borderWidth: 1,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
  },
  quickStatIcon: {
    width: scale(30),
    height: scale(30),
    borderRadius: scale(8),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: verticalScale(4),
  },
  quickStatValue: {
    fontSize: moderateScale(14),
    fontWeight: '900',
    marginBottom: 1,
  },
  quickStatLabel: {
    fontSize: moderateScale(9),
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: moderateScale(15),
    fontWeight: '800',
    marginBottom: verticalScale(8),
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
  stickyInvoiceFooter: {
    padding: scale(20),
    borderTopWidth: 1,
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.1,
    shadowRadius: 15,
  },
  mainGenerateBtn: {
    height: verticalScale(60),
    borderRadius: scale(18),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: scale(20),
    elevation: 4,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  generateBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(12),
  },
  mainGenerateText: {
    color: '#FFF',
    fontSize: moderateScale(17),
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  generateBtnArrow: {
    width: scale(32),
    height: scale(32),
    borderRadius: scale(10),
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  printerSwitchInline: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: scale(10),
    paddingVertical: verticalScale(4),
    borderRadius: scale(12),
    marginHorizontal: scale(10),
  },
  switchIcon: {
    padding: 6,
  },
  addItemQuickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: scale(14),
    borderRadius: scale(16),
    borderWidth: 1,
    borderStyle: 'dashed',
    marginTop: verticalScale(10),
    gap: scale(8),
  },
  addItemQuickText: {
    fontSize: moderateScale(15),
    fontWeight: '800',
  },
  previewStepBtn: {
    width: scale(28),
    height: scale(28),
    borderRadius: scale(8),
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: verticalScale(15),
  },
  headerIndicator: {
    width: 4,
    height: 18,
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
  printerStatusHeader: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  printerModal: {
    borderRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  deviceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
  },
  deviceName: {
    fontSize: 14,
    fontWeight: '600',
  },
  modalActionBtn: {
    marginTop: 20,
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
  },
  contactPickerBtn: {
    width: scale(36),
    height: scale(36),
    borderRadius: scale(10),
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: scale(10),
  },
  thermalCaptureContainer: {
    width: 384, // Standard 58mm width
    backgroundColor: '#FFF',
    padding: 10,
  },
  thermalContent: {
    backgroundColor: '#FFF',
  },
  thermalShopName: {
    fontSize: 28,
    fontWeight: '900',
    textAlign: 'center',
    color: '#000',
    marginBottom: 5,
  },
  thermalShopLoc: {
    fontSize: 14,
    color: '#000',
    textAlign: 'center',
    fontWeight: '600',
    lineHeight: 18,
  },
  thermalShopContact: {
    fontSize: 16,
    color: '#000',
    textAlign: 'center',
    fontWeight: '700',
    marginTop: 5,
  },
  thermalDivider: {
    fontSize: 14,
    color: '#000',
    textAlign: 'center',
    fontWeight: 'bold',
    marginVertical: 10,
  },
  thermalRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  thermalText: {
    fontSize: 16,
    color: '#000',
    fontWeight: '600',
  },
  thermalHeader: {
    fontSize: 18,
    fontWeight: '900',
    color: '#000',
  },
  thermalItemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  thermalItemName: {
    fontSize: 20,
    fontWeight: '900',
    color: '#000',
  },
  thermalItemSub: {
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
  },
  thermalItemData: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
  },
  thermalSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  thermalSummaryLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
  },
  thermalSummaryValue: {
    fontSize: 18,
    fontWeight: '900',
    color: '#000',
  },
  thermalLineDivider: {
    height: 1,
    backgroundColor: '#000',
    width: '100%',
  },
  headerActionBtn: {
    width: scale(40),
    height: scale(40),
    borderRadius: scale(12),
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: scale(10),
  },
  menuColorSection: {
    padding: scale(15),
  },
  menuSectionLabel: {
    fontSize: moderateScale(12),
    fontWeight: '800',
    marginBottom: verticalScale(10),
    textTransform: 'uppercase',
  },
  menuColorList: {
    gap: scale(10),
    paddingRight: 20,
  },
  menuColorCircle: {
    width: scale(30),
    height: scale(30),
    borderRadius: scale(15),
    borderWidth: 2,
    borderColor: 'transparent',
  },
  menuColorActive: {
    borderColor: '#FFF',
    borderWidth: 2,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
  },
});
