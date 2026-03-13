import { useAppTheme } from "@/context/ThemeContext";
import { billDbService } from "@/services/dbService";
import { LinearGradient } from "expo-linear-gradient";
import { moderateScale, scale, verticalScale } from "@/utils/responsive";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
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

export default function BillingHistoryScreen() {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBill, setSelectedBill] = useState<any>(null);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [startDate, setStartDate] = useState(new Date(new Date().setDate(new Date().getDate() - 7)).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const { t, isDark, language } = useAppTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    fetchHistory();
  }, [startDate, endDate]);

  const fetchHistory = async () => {
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
      }));
      setHistory(bills);
    } catch (error) {
      console.error("Fetch history error:", error);
      Alert.alert("Error", "Failed to fetch billing history.");
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPdf = async (billId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const billIdToUse = billId || selectedBill?.id;
      if (!billIdToUse) {
        Alert.alert("Error", "Bill ID not found.");
        return;
      }

      // Fetch bill details from local database
      const response = await billDbService.getPdf(billIdToUse);
      const billData = response.data;

      if (!billData || !billData.bill) {
        Alert.alert("Error", "Bill not found.");
        return;
      }

      Alert.alert(
        "Success",
        "Bill details retrieved successfully. PDF generation handled on the UI side.",
      );
    } catch (error) {
      console.error("PDF retrieval error", error);
      Alert.alert("Error", "Failed to retrieve bill details.");
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

  const primaryColor = "#FF8C00";
  const textColor = isDark ? "#F2F2F7" : "#1A1C1E";
  const labelColor = isDark ? "#8E8E93" : "#6B7280";
  const cardBg = isDark ? "#1C1C1E" : "#FFFFFF";
  const borderCol = isDark ? "#2C2C2E" : "#E5E7EB";
  const bg = isDark ? "#0F0F0F" : "#F0F2F5";
  const heroBg = isDark ? "#1C1C1E" : "#FF8C00";

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
      </View>
    </Animated.View>
  );
  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <StatusBar style="light" backgroundColor={heroBg} />

      {/* Branded Dashboard Header */}
      <LinearGradient
        colors={isDark ? ['#1A1A1A', '#1A1A1A'] : ['#FF8C00', '#FF8C00']}
        style={[
          styles.header,
          { paddingTop: insets.top + (Platform.OS === 'android' ? 15 : 10) }
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
               <View style={[styles.liveIndicator, { backgroundColor: '#10B981' }]} />
               <Text style={[styles.liveText, { color: '#FFF', opacity: 0.9 }]}>ADMIN DASHBOARD</Text>
            </View>
          </View>
        </View>

        {/* Date Filter Controls */}
        <View style={styles.filterRow}>
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
        </View>
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
                  {selectedBill?.customerName}
                </Text>
                <Text style={[styles.modalSubtitle, { color: labelColor }]}>
                  {selectedBill && new Date(selectedBill.date).toLocaleString()}
                </Text>
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
                    ₹{(selectedBill?.total_amount || 0).toFixed(2)}
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
                    ₹{((selectedBill?.total_amount || 0) - (selectedBill?.discount || 0)).toFixed(0)}
                  </Text>
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.downloadBtn, { backgroundColor: primaryColor }]}
                onPress={() => handleDownloadPdf("")}
              >
                <MaterialCommunityIcons
                  name="file-pdf-box"
                  size={20}
                  color="#FFF"
                />
                <Text style={styles.downloadBtnText}>Download PDF</Text>
              </TouchableOpacity>
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
    paddingBottom: verticalScale(24),
    borderBottomLeftRadius: scale(32),
    borderBottomRightRadius: scale(32),
  },
  filterRow: {
    flexDirection: 'row',
    marginTop: verticalScale(20),
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
    backgroundColor: '#10B981',
    marginRight: 6,
  },
  liveText: {
    fontSize: moderateScale(10),
    fontWeight: '800',
    color: '#10B981',
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
    shadowColor: '#00A86B',
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
});
