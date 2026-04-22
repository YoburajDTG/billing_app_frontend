import { useAppTheme } from "@/context/ThemeContext";
import { billDbService } from "@/services/dbService";
import { LinearGradient } from "expo-linear-gradient";
import { moderateScale, scale, verticalScale } from "@/utils/responsive";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useState } from "react";
import { KEYS, Storage } from "@/services/storage";
import { generateBillPDF } from "@/utils/pdfGenerator";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Linking,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";

export default function BillingHistoryScreen() {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBill, setSelectedBill] = useState<any>(null);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedFilter, setSelectedFilter] = useState('Today');
  const [printerPreference, setPrinterPreference] = useState<'2inch' | '3inch'>('2inch');
  const { isDark, language, primaryColor } = useAppTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const pSize = await Storage.getItem(KEYS.PRINTER_SIZE);
    if (pSize) setPrinterPreference(pSize);
  };

  const fetchHistory = useCallback(async () => {
    // Basic validation for date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
      if (selectedFilter === 'Custom' && (startDate.length < 10 || endDate.length < 10)) {
        // Still typing
        return;
      }
      return;
    }

    if (new Date(startDate) > new Date(endDate)) {
        // Only alert if both are full length to avoid annoying user while typing
        if (startDate.length === 10 && endDate.length === 10) {
            Alert.alert(
                language === 'Tamil' ? 'பிழை' : 'Invalid Range',
                language === 'Tamil' ? 'தொடக்க தேதி முடிவு தேதிக்கு முன் இருக்க வேண்டும்' : 'Start date must be before end date'
            );
        }
        return;
    }

    setLoading(true);
    try {
      const response = await billDbService.getHistoryByDateRange(startDate, endDate);
      const bills = response.data.map((bill: any) => ({
        id: bill.id,
        billNumber: bill.id.substring(0, 8),
        customerName: bill.customer_name || (language === 'Tamil' ? 'வாடிக்கையாளர்' : 'Guest'),
        date: bill.created_at,
        grandTotal: bill.total_amount,
        itemCount: bill.itemCount || 0,
        paymentStatus: bill.payment_status || 'PAID',
        mode: bill.mode || 'Shop',
      }));
      setHistory(bills);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, language, selectedFilter]);

  useFocusEffect(
    useCallback(() => {
      fetchHistory();
    }, [fetchHistory])
  );

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const applyFilter = (filter: string) => {
    Haptics.selectionAsync();
    setSelectedFilter(filter);
    const today = new Date();
    let start = new Date();
    const end = new Date();

    if (filter === 'Today') {
      start = today;
    } else if (filter === 'Last Week') {
      start.setDate(today.getDate() - 7);
    } else if (filter === 'Last Month') {
      start.setMonth(today.getMonth() - 1);
    } else if (filter === 'Last Year') {
      start.setFullYear(today.getFullYear() - 1);
    } else {
      return; // Custom range, don't auto-update
    }

    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(end.toISOString().split('T')[0]);
  };

  const handleDownloadPdf = async (billId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const billIdToUse = billId || selectedBill?.id;
      if (!billIdToUse) {
        Alert.alert("Error", "Bill ID not found.");
        return;
      }

      const response = await billDbService.getPdf(billIdToUse);
      if (!response?.data?.bill) {
        Alert.alert("Error", "Bill not found.");
        return;
      }

      const [mName, mNumber] = await Promise.all([
        Storage.getItem(KEYS.MERCHANT_NAME),
        Storage.getItem(KEYS.MERCHANT_NUMBER),
      ]);

      const bill = response.data.bill;
      const items = response.data.items;

      const billData = {
        shopName: mName || 'SUJI VEGETABLES',
        phone: mNumber || '9095938085',
        userName: bill.customer_name || 'Customer',
        billNumber: bill.id,
        date: new Date(bill.created_at).toLocaleString('en-IN'),
        mode: 'History',
        language,
        items: items.map((i: any) => ({
          id: i.id,
          name: i.name,
          tamilName: i.tamil_name || i.name,
          quantity: i.quantity,
          price: i.unit_price,
          total: i.total_price
        })),
        subTotal: (bill.total_amount + (bill.discount || 0)),
        discount: bill.discount || 0,
        grandTotal: bill.total_amount
      };

      await generateBillPDF(billData, { printDirect: true, printerSize: printerPreference });
    } catch (error) {
      console.error("PDF generation error", error);
      Alert.alert("Error", "Failed to generate PDF.");
    }
  };

  const handleWhatsAppShare = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      if (!selectedBill?.id) return;

      const response = await billDbService.getPdf(selectedBill.id);
      if (!response?.data?.bill) {
        Alert.alert("Error", "Bill not found.");
        return;
      }

      const [mName, mNumber] = await Promise.all([
        Storage.getItem(KEYS.MERCHANT_NAME),
        Storage.getItem(KEYS.MERCHANT_NUMBER),
      ]);

      const bill = response.data.bill;
      const items = response.data.items;

      let message = `🧾 *${(mName || "SUJI VEGETABLES").toUpperCase()}*\n`;
      message += `${language === 'Tamil' ? 'போன்' : 'Ph'}: ${mNumber || "9095938085"}\n`;
      message += `--------------------------\n`;
      message += `${language === 'Tamil' ? 'பில் எண்' : 'Bill No'}: *${bill.id}*\n`;
      message += `${language === 'Tamil' ? 'தேதி' : 'Date'}: ${new Date(bill.created_at).toLocaleString('en-IN')}\n`;
      message += `${language === 'Tamil' ? 'வாடிக்கையாளர்' : 'Customer'}: ${bill.customer_name || (language === 'Tamil' ? 'வாடிக்கையாளர்' : 'Guest')}\n`;
      message += `--------------------------\n`;

      items.forEach((item: any) => {
        const name = item.tamil_name || item.name;
        message += `• ${name}\n`;
        message += `  ${item.quantity}kg x ₹${item.unit_price} = *₹${item.total_price.toFixed(0)}*\n`;
      });

      if (bill.discount > 0) {
        message += `--------------------------\n`;
        message += `${language === 'Tamil' ? 'கூட்டுத் தொகை' : 'Subtotal'}: ₹${(bill.total_amount + bill.discount).toFixed(0)}\n`;
        message += `${language === 'Tamil' ? 'தள்ளுபடி' : 'Discount'}: -₹${bill.discount.toFixed(0)}\n`;
      }

      message += `--------------------------\n`;
      message += `*${language === 'Tamil' ? 'மொத்த தொகை' : 'GRAND TOTAL'}: ₹${bill.total_amount.toFixed(0)}*\n`;
      message += `--------------------------\n`;
      message += language === 'Tamil' ? `நன்றி! மீண்டும் வருக.` : `Thank you! Visit again.`;

      let whatsappUrl = `whatsapp://send?text=${encodeURIComponent(message)}`;
      
      if (bill.customer_mobile && bill.customer_mobile.length >= 10) {
        // Simple sanitization: remove non-numeric
        const cleanPhone = bill.customer_mobile.replace(/\D/g, '');
        const phone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
        whatsappUrl = `whatsapp://send?phone=${phone}&text=${encodeURIComponent(message)}`;
      }

      const supported = await Linking.canOpenURL(whatsappUrl);
      
      if (supported) {
        await Linking.openURL(whatsappUrl);
      } else {
        const phone = bill.customer_mobile && bill.customer_mobile.length >= 10 
          ? (bill.customer_mobile.replace(/\D/g, '').length === 10 ? `91${bill.customer_mobile.replace(/\D/g, '')}` : bill.customer_mobile.replace(/\D/g, ''))
          : '';
        const fallbackUrl = phone 
          ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
          : `https://wa.me/?text=${encodeURIComponent(message)}`;
        await Linking.openURL(fallbackUrl);
      }
    } catch (error) {
      console.error("WhatsApp share error", error);
      Alert.alert("Error", "Failed to share on WhatsApp.");
    }
  };

  const handleViewBill = async (bill: any) => {
    Haptics.selectionAsync();
    setLoading(true);
    try {
        const response = await billDbService.getPdf(bill.id);
        if (response && response.data) {
            setSelectedBill({
                ...bill,
                items: response.data.items,
                discount: response.data.bill.discount || 0,
                total_amount: response.data.bill.total_amount
            });
            setPreviewVisible(true);
        }
    } catch (error) {
        console.error("Error fetching bill details:", error);
        Alert.alert("Error", "Could not load bill details");
    } finally {
        setLoading(false);
    }
  };

  const handleEditBill = (bill: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPreviewVisible(false);
    
    const targetPath = bill.mode === 'Function' ? "/shop/function-bill" : "/shop";
    
    router.replace({
        pathname: targetPath,
        params: { waitBillId: bill.id }
    });
  };

  const primaryColorLocal = primaryColor;
  const textColor = isDark ? "#F2F2F7" : "#1A1C1E";
  const labelColor = isDark ? "#8E8E93" : "#6B7280";
  const cardBg = isDark ? "#1C1C1E" : "#FFFFFF";
  const borderCol = isDark ? "#2C2C2E" : "#E5E7EB";
  const bg = isDark ? "#0F0F0F" : "#F0F2F5";
  const heroBg = isDark ? "#1C1C1E" : primaryColor;

  const renderItem = ({ item, index }: { item: any; index: number }) => (
    <Animated.View
      entering={FadeInDown.delay(index * 50).springify()}
      style={[styles.historyCard, { backgroundColor: cardBg, borderColor: borderCol, borderWidth: 1 }]}
    >
      <View style={styles.cardHeader}>
        <View
          style={[
            styles.iconBox,
            { backgroundColor: isDark ? 'rgba(255,140,0,0.1)' : "#FFF4E5" },
          ]}
        >
          <MaterialCommunityIcons
            name="file-document-outline"
            size={22}
            color={primaryColor}
          />
        </View>
        <View style={styles.headerText}>
          <Text style={[styles.billNumber, { color: textColor }]}>
            #{item.billNumber}
          </Text>
          <Text style={[styles.customerNameText, { color: labelColor }]}>
            {item.customerName}
          </Text>
          {item.paymentStatus === 'WAITING' && (
            <View style={[styles.waitingBadge, { backgroundColor: '#FF9800' }]}>
              <MaterialCommunityIcons name="clock-outline" size={10} color="#FFF" />
              <Text style={[styles.waitingBadgeText, { color: '#FFF' }]}>
                {language === 'Tamil' ? 'காத்திருப்பு' : 'WAITING'}
              </Text>
            </View>
          )}
        </View>
        <View style={styles.amountBadge}>
          <Text style={[styles.billAmount, { color: primaryColor }]}>
            ₹{item.grandTotal.toFixed(0)}
          </Text>
        </View>
      </View>

      <View style={styles.cardFooter}>
        <View style={styles.dateInfo}>
           <Text style={[styles.billDate, { color: labelColor }]}>
            {new Date(item.date).toLocaleDateString()}
          </Text>
          <Text style={[styles.dotSep, { color: borderCol }]}>•</Text>
          <Text style={[styles.itemCount, { color: labelColor }]}>
            {item.itemCount} {language === "Tamil" ? "பொருட்கள்" : "items"}
          </Text>
        </View>

        <TouchableOpacity
          style={[
            styles.viewBtn,
            { backgroundColor: isDark ? "#2C2C2E" : "#F5F5F7" },
          ]}
          onPress={() => handleViewBill(item)}
        >
          <Text style={[styles.viewBtnText, { color: textColor }]}>
            {language === 'Tamil' ? 'விவரம்' : 'View'}
          </Text>
          <Ionicons name="chevron-forward" size={14} color={labelColor} />
        </TouchableOpacity>

        {item.paymentStatus === 'WAITING' && (
           <TouchableOpacity
            style={[
              styles.editBtnSmall,
              { backgroundColor: primaryColor },
            ]}
            onPress={() => handleEditBill(item)}
           >
            <MaterialCommunityIcons name="pencil" size={14} color="#FFF" />
            <Text style={styles.editBtnTextSmall}>
                {language === 'Tamil' ? 'திருத்து' : 'Edit'}
            </Text>
           </TouchableOpacity>
        )}
      </View>
    </Animated.View>
  );
  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <StatusBar style="light" backgroundColor={heroBg} />

      {/* Branded Dashboard Header */}
      <LinearGradient
        colors={isDark ? ['#1A1A1A', '#1A1A1A'] : [primaryColor, primaryColor]}
        style={[
          styles.header,
          { paddingTop: insets.top + (Platform.OS === 'android' ? verticalScale(15) : verticalScale(10)) }
        ]}
      >
        <View style={styles.headerTopRow}>
          <TouchableOpacity 
            onPress={() => router.back()}
            style={[styles.backIcon, { backgroundColor: isDark ? '#2C2C2E' : 'rgba(255,255,255,0.2)' }]}
          >
            <Ionicons name="chevron-back" size={24} color="#FFF" />
          </TouchableOpacity>
          <View style={styles.headerTitleBox}>
            <Text style={[styles.navTitle, { color: '#FFF' }]}>
              {language === 'Tamil' ? 'விற்பனை வரலாறு' : 'Billing History'}
            </Text>
            <View style={styles.statusRow}>
               <View style={[styles.liveIndicator, { backgroundColor: isDark ? primaryColor : '#FFF' }]} />
               <Text style={[styles.liveText, { color: '#FFF', opacity: 0.9 }]}>{language === 'Tamil' ? 'நிர்வாக டாஷ்போர்டு' : 'ADMIN DASHBOARD'}</Text>
            </View>
          </View>
        </View>

        {/* Quick Filter Chips */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          style={styles.filterScroll}
          contentContainerStyle={styles.filterScrollContent}
        >
          {['Today', 'Last Week', 'Last Month', 'Last Year', 'Custom'].map((filter) => (
            <TouchableOpacity
              key={filter}
              onPress={() => applyFilter(filter)}
              style={[
                styles.filterChip,
                { 
                  backgroundColor: selectedFilter === filter ? '#FFF' : 'rgba(255,255,255,0.15)',
                  borderColor: selectedFilter === filter ? '#FFF' : 'transparent'
                }
              ]}
            >
              <Text 
                style={[
                  styles.filterChipText, 
                  { color: selectedFilter === filter ? primaryColor : '#FFF' }
                ]}
              >
                {language === 'Tamil' ? (
                  filter === 'Today' ? 'இன்று' :
                  filter === 'Last Week' ? 'கடந்த வாரம்' :
                  filter === 'Last Month' ? 'கடந்த மாதம்' :
                  filter === 'Last Year' ? 'கடந்த ஆண்டு' : 'சொந்த தேதி'
                ) : filter}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Date Filter Controls - Only show inputs if Custom is selected or for clarity */}
        {selectedFilter === 'Custom' && (
          <Animated.View entering={FadeInDown} style={styles.filterRow}>
            <View style={styles.dateInputContainer}>
                <Text style={styles.dateLabel}>{language === 'Tamil' ? 'தொடக்கம்' : 'From'}</Text>
                <TextInput
                  style={[styles.dateInput, { backgroundColor: isDark ? '#2C2C2E' : 'rgba(255,255,255,0.2)', color: '#FFF' }]}
                  value={startDate}
                  onChangeText={setStartDate}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="rgba(255,255,255,0.5)"
                />
            </View>
            <View style={styles.dateInputContainer}>
                <Text style={styles.dateLabel}>{language === 'Tamil' ? 'முடிவு' : 'To'}</Text>
                <TextInput
                  style={[styles.dateInput, { backgroundColor: isDark ? '#2C2C2E' : 'rgba(255,255,255,0.2)', color: '#FFF' }]}
                  value={endDate}
                  onChangeText={setEndDate}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="rgba(255,255,255,0.5)"
                />
            </View>
          </Animated.View>
        )}
      </LinearGradient>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={primaryColor} />
          <Text style={[styles.loadingText, { color: labelColor }]}>
            {language === "Tamil" ? "ஏற்றுகிறது..." : "Loading..."}
          </Text>
        </View>
      ) : (
        <FlatList
          data={history}
          renderItem={renderItem}
          keyExtractor={(item, index) => item.id || index.toString()}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View
                style={[
                  styles.emptyIconBg,
                  { backgroundColor: isDark ? "#1E1E1E" : "#FFF" },
                ]}
              >
                <MaterialCommunityIcons
                  name="history"
                  size={60}
                  color={isDark ? "#333" : "#E0E0E0"}
                />
              </View>
              <Text style={[styles.emptyText, { color: labelColor }]}>
                No billing history yet.
              </Text>
            </View>
          }
          onRefresh={fetchHistory}
          refreshing={loading}
        />
      )}

      {/* Bill Preview Modal */}
      <Modal
        visible={previewVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setPreviewVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalContent,
              { backgroundColor: isDark ? "#1E1E1E" : "#FFF" },
            ]}
          >
            <View style={styles.modalDragHandle} />
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderTitleBox}>
                <View style={[styles.idBadge, { backgroundColor: isDark ? 'rgba(0,168,107,0.1)' : '#ECFDF5' }]}>
                  <Text style={[styles.idBadgeText, { color: primaryColor }]}>
                    BILL #{selectedBill?.billNumber}
                  </Text>
                </View>
                <Text style={[styles.modalTitle, { color: textColor }]}>
                  {selectedBill?.customerName || (language === 'Tamil' ? 'வாடிக்கையாளர்' : 'Guest')}
                </Text>
                {selectedBill?.customer_mobile && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                    <FontAwesome name="whatsapp" size={14} color="#25D366" style={{ marginRight: 4 }} />
                    <Text style={{ color: labelColor, fontSize: 14, marginLeft: 4 }}>
                      {selectedBill.customer_mobile}
                    </Text>
                  </View>
                )}
                <Text style={[styles.modalSubtitle, { color: labelColor }]}>
                  {selectedBill && new Date(selectedBill.date).toLocaleString()}
                </Text>
                {selectedBill?.paymentStatus === 'WAITING' && (
                  <View style={[styles.waitingBadge, { backgroundColor: '#FF9800', marginTop: 10, paddingHorizontal: 10, paddingVertical: 4 }]}>
                    <MaterialCommunityIcons name="clock-outline" size={14} color="#FFF" />
                    <Text style={[styles.waitingBadgeText, { color: '#FFF' }]}>
                      {language === 'Tamil' ? 'காத்திருப்பு' : 'WAITING'}
                    </Text>
                  </View>
                )}
              </View>
              <TouchableOpacity
                style={[
                  styles.closeIcon,
                  { backgroundColor: isDark ? "#2C2C2E" : "#F1F5F9" },
                ]}
                onPress={() => setPreviewVisible(false)}
              >
                <Ionicons name="close" size={24} color={textColor} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.modalBody}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.tableHeader}>
                <Text
                  style={[
                    styles.tableHeaderText,
                    { flex: 2, color: labelColor },
                  ]}
                >
                  Item
                </Text>
                <Text
                  style={[
                    styles.tableHeaderText,
                    { flex: 1, textAlign: "center", color: labelColor },
                  ]}
                >
                  Qty
                </Text>
                <Text
                  style={[
                    styles.tableHeaderText,
                    { flex: 1, textAlign: "right", color: labelColor },
                  ]}
                >
                  Price
                </Text>
                <Text
                  style={[
                    styles.tableHeaderText,
                    { flex: 1, textAlign: "right", color: labelColor },
                  ]}
                >
                  Total
                </Text>
              </View>

              {selectedBill?.items.map((item: any, idx: number) => (
                <View
                  key={idx}
                  style={[
                    styles.tableRow,
                    { borderBottomColor: isDark ? "#2C2C2E" : "#F1F5F9" },
                  ]}
                >
                  <View style={{ flex: 2.5 }}>
                    <Text style={[styles.itemName, { color: textColor }]}>
                      {language === "Tamil" ? (item.tamil_name || item.tamilName) : item.name}
                    </Text>
                    <Text style={[styles.itemSubName, { color: labelColor }]}>
                      {item.name.toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1.5, alignItems: 'center' }}>
                    <Text style={[styles.tableCell, { color: textColor }]}>
                      {item.quantity} kg
                    </Text>
                    <Text style={[styles.cellLabel, { color: labelColor }]}>QTY</Text>
                  </View>
                  <View style={{ flex: 1.5, alignItems: 'flex-end' }}>
                    <Text style={[styles.tableCell, { color: textColor }]}>
                      ₹{item.unit_price || item.price}
                    </Text>
                    <Text style={[styles.cellLabel, { color: labelColor }]}>PRICE</Text>
                  </View>
                  <View style={{ flex: 1.5, alignItems: 'flex-end' }}>
                    <Text style={[styles.tableCell, { color: primaryColor, fontWeight: '900' }]}>
                      ₹{(item.total_price || item.total).toFixed(0)}
                    </Text>
                    <Text style={[styles.cellLabel, { color: labelColor }]}>TOTAL</Text>
                  </View>
                </View>
              ))}

              <View style={styles.totalSection}>
                <View style={styles.totalRow}>
                  <Text style={[styles.totalLabel, { color: labelColor }]}>
                    {language === 'Tamil' ? 'கூட்டுத் தொகை' : 'Subtotal'}
                  </Text>
                  <Text style={[styles.totalValue, { color: textColor }]}>
                    ₹{((selectedBill?.total_amount || 0) + (selectedBill?.discount || 0)).toFixed(2)}
                  </Text>
                </View>
                {selectedBill?.discount > 0 && (
                  <View style={styles.totalRow}>
                    <Text style={[styles.totalLabel, { color: '#EF4444' }]}>
                      {language === 'Tamil' ? 'தள்ளுபடி' : 'Discount'}
                    </Text>
                    <Text style={[styles.totalValue, { color: '#EF4444' }]}>
                      - ₹{(selectedBill?.discount || 0).toFixed(2)}
                    </Text>
                  </View>
                )}
                <View
                  style={[
                    styles.grandTotalRow,
                    { backgroundColor: isDark ? "#2C2C2E" : "#F8FAFC" },
                  ]}
                >
                  <Text style={[styles.grandTotalLabel, { color: textColor }]}>
                    {language === 'Tamil' ? 'மொத்தம்' : 'GRAND TOTAL'}
                  </Text>
                  <Text
                    style={[styles.grandTotalValue, { color: primaryColor }]}
                  >
                    ₹{(selectedBill?.total_amount || 0).toFixed(0)}
                  </Text>
                </View>
              </View>

              <View style={[styles.inlinePrefRow, { borderColor: borderCol }]}>
                  <Text style={[styles.prefLabel, { color: labelColor }]}>
                     {language === 'Tamil' ? 'பிரிண்டர் அளவு' : 'Printer Size'}
                  </Text>
                  <View style={styles.inlineToggleBox}>
                      <TouchableOpacity 
                        onPress={() => {
                          setPrinterPreference('2inch');
                          Storage.setItem(KEYS.PRINTER_SIZE, '2inch');
                        }}
                        style={[styles.miniToggle, printerPreference === '2inch' && { backgroundColor: primaryColor }]}
                      >
                         <Text style={[styles.miniToggleText, printerPreference === '2inch' && { color: '#FFF' }]}>2"</Text>
                      </TouchableOpacity>
                      <TouchableOpacity 
                        onPress={() => {
                          setPrinterPreference('3inch');
                          Storage.setItem(KEYS.PRINTER_SIZE, '3inch');
                        }}
                        style={[styles.miniToggle, printerPreference === '3inch' && { backgroundColor: primaryColor }]}
                      >
                         <Text style={[styles.miniToggleText, printerPreference === '3inch' && { color: '#FFF' }]}>3"</Text>
                      </TouchableOpacity>
                  </View>
              </View>
            </ScrollView>

            <View style={[styles.modalFooter, { flexDirection: 'row', gap: 10 }]}>
              <TouchableOpacity
                style={[styles.downloadBtn, { backgroundColor: '#25D366', flex: 0.4 }]}
                onPress={handleWhatsAppShare}
              >
                <MaterialCommunityIcons name="whatsapp" size={20} color="#FFF" />
                <Text style={styles.downloadBtnText}>Share</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.downloadBtn, { backgroundColor: primaryColor, flex: 1, shadowColor: primaryColor }]}
                onPress={() => handleDownloadPdf("")}
              >
                <MaterialCommunityIcons
                  name="file-pdf-box"
                  size={20}
                  color="#FFF"
                />
                <Text style={styles.downloadBtnText}>PDF</Text>
              </TouchableOpacity>

              {selectedBill?.paymentStatus === 'WAITING' && (
                <TouchableOpacity
                    style={[styles.downloadBtn, { backgroundColor: '#FF8C00', flex: 0.8 }]}
                    onPress={() => handleEditBill(selectedBill)}
                >
                    <MaterialCommunityIcons name="pencil" size={20} color="#FFF" />
                    <Text style={styles.downloadBtnText}>{language === 'Tamil' ? 'திருத்து' : 'Edit'}</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  header: {
    paddingHorizontal: scale(20),
    paddingBottom: verticalScale(25),
    borderBottomLeftRadius: scale(30),
    borderBottomRightRadius: scale(30),
    elevation: 8,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
  },
  filterScroll: {
    marginTop: verticalScale(15),
  },
  filterScrollContent: {
    gap: scale(10),
    paddingRight: scale(20),
  },
  filterChip: {
    paddingHorizontal: scale(16),
    paddingVertical: verticalScale(8),
    borderRadius: scale(20),
    borderWidth: 1,
  },
  filterChipText: {
    fontSize: moderateScale(12),
    fontWeight: '800',
  },
  filterRow: {
    flexDirection: 'row',
    marginTop: verticalScale(15),
    gap: scale(12),
  },
  dateInputContainer: {
    flex: 1,
  },
  dateLabel: {
    fontSize: moderateScale(10),
    fontWeight: '800',
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  dateInput: {
    height: verticalScale(42),
    borderRadius: scale(12),
    paddingHorizontal: scale(12),
    fontSize: moderateScale(13),
    fontWeight: '700',
  },
  backIcon: {
    width: scale(42),
    height: scale(42),
    borderRadius: scale(14),
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitleBox: {
    flex: 1,
    paddingLeft: scale(15),
  },
  navTitle: {
    fontSize: moderateScale(22),
    fontWeight: "900",
    letterSpacing: -0.5,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  liveIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  liveText: {
    fontSize: moderateScale(10),
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: verticalScale(15),
    fontSize: moderateScale(14),
    fontWeight: "600",
  },
  listContent: {
    padding: scale(16),
    paddingBottom: verticalScale(100),
  },
  historyCard: {
    borderRadius: scale(20),
    padding: scale(16),
    marginBottom: verticalScale(12),
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: verticalScale(16),
  },
  iconBox: {
    width: scale(44),
    height: scale(44),
    borderRadius: scale(14),
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: {
    flex: 1,
    marginLeft: scale(12),
  },
  billNumber: {
    fontSize: moderateScale(15),
    fontWeight: "900",
    marginBottom: 2,
  },
  customerNameText: {
    fontSize: moderateScale(13),
    fontWeight: "600",
  },
  amountBadge: {
    alignItems: "flex-end",
  },
  billAmount: {
    fontSize: moderateScale(18),
    fontWeight: "900",
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: verticalScale(12),
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.03)',
  },
  dateInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  billDate: {
    fontSize: moderateScale(12),
    fontWeight: "700",
  },
  dotSep: {
    marginHorizontal: scale(8),
    fontSize: moderateScale(14),
  },
  itemCount: {
    fontSize: moderateScale(12),
    fontWeight: "700",
  },
  viewBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: verticalScale(6),
    paddingHorizontal: scale(12),
    borderRadius: scale(10),
    gap: 4,
  },
  viewBtnText: {
    fontSize: moderateScale(12),
    fontWeight: "800",
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    marginTop: verticalScale(100),
  },
  emptyIconBg: {
    width: scale(100),
    height: scale(100),
    borderRadius: scale(30),
    alignItems: "center",
    justifyContent: "center",
    marginBottom: verticalScale(20),
  },
  emptyText: {
    fontSize: moderateScale(16),
    fontWeight: "700",
    opacity: 0.5,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  modalContent: {
    borderTopLeftRadius: scale(32),
    borderTopRightRadius: scale(32),
    maxHeight: "90%",
    padding: scale(20),
  },
  modalDragHandle: {
    width: scale(36),
    height: scale(4),
    backgroundColor: 'rgba(156, 163, 175, 0.3)',
    borderRadius: scale(2),
    alignSelf: "center",
    marginBottom: verticalScale(20),
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: verticalScale(24),
  },
  modalHeaderTitleBox: {
    flex: 1,
  },
  idBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: scale(8),
    paddingVertical: verticalScale(4),
    borderRadius: scale(6),
    marginBottom: 8,
  },
  idBadgeText: {
    fontSize: moderateScale(10),
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  modalTitle: {
    fontSize: moderateScale(24),
    fontWeight: "900",
    letterSpacing: -0.5,
  },
  modalSubtitle: {
    fontSize: moderateScale(13),
    fontWeight: "600",
    marginTop: 4,
  },
  closeIcon: {
    width: scale(42),
    height: scale(42),
    borderRadius: scale(21),
    alignItems: "center",
    justifyContent: "center",
  },
  modalBody: {
    flexGrow: 0,
  },
  tableHeader: {
    flexDirection: "row",
    paddingBottom: verticalScale(12),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
    marginBottom: verticalScale(10),
  },
  tableHeaderText: {
    fontSize: moderateScale(11),
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: verticalScale(16),
    borderBottomWidth: 1,
  },
  itemName: {
    fontSize: moderateScale(15),
    fontWeight: "800",
  },
  itemSubName: {
    fontSize: moderateScale(9),
    fontWeight: "700",
    color: '#94A3B8',
    marginTop: 2,
    letterSpacing: 0.5,
  },
  tableCell: {
    fontSize: moderateScale(14),
    fontWeight: "700",
  },
  cellLabel: {
    fontSize: moderateScale(8),
    fontWeight: "800",
    marginTop: 2,
  },
  totalSection: {
    marginTop: verticalScale(20),
    gap: verticalScale(12),
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: scale(4),
  },
  totalLabel: {
    fontSize: moderateScale(14),
    fontWeight: "700",
  },
  totalValue: {
    fontSize: moderateScale(14),
    fontWeight: "800",
  },
  grandTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: scale(20),
    borderRadius: scale(20),
    marginTop: verticalScale(8),
  },
  grandTotalLabel: {
    fontSize: moderateScale(14),
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  grandTotalValue: {
    fontSize: moderateScale(24),
    fontWeight: "900",
  },
  modalFooter: {
    paddingTop: verticalScale(24),
    paddingBottom: verticalScale(20),
  },
  downloadBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: verticalScale(58),
    borderRadius: scale(20),
    gap: scale(10),
    elevation: 4,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
  },
  downloadBtnText: {
    color: "#FFF",
    fontSize: moderateScale(16),
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  inlinePrefRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: scale(16),
    marginTop: 10,
    borderTopWidth: 1,
    borderStyle: 'dashed',
  },
  prefLabel: {
    fontSize: moderateScale(13),
    fontWeight: '700',
  },
  inlineToggleBox: {
    flexDirection: 'row',
    gap: 8,
  },
  miniToggle: {
    paddingHorizontal: scale(12),
    paddingVertical: verticalScale(6),
    borderRadius: scale(8),
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  miniToggleText: {
    fontSize: moderateScale(11),
    fontWeight: '800',
    color: '#6B7280',
  },
  waitingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: scale(8),
    paddingVertical: verticalScale(2),
    borderRadius: scale(6),
    marginTop: 4,
    gap: 4,
  },
  waitingBadgeText: {
    fontSize: moderateScale(10),
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  editBtnSmall: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: verticalScale(6),
    paddingHorizontal: scale(12),
    borderRadius: scale(10),
    gap: 4,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  editBtnTextSmall: {
    fontSize: moderateScale(12),
    fontWeight: "800",
    color: "#FFF",
  },
});
