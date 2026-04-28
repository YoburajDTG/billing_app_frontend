import { useAuth } from '@/context/AuthContext';
import { useAppTheme } from '@/context/ThemeContext';
import { billDbService, inventoryDbService } from '@/services/dbService';
import { KEYS, Storage } from '@/services/storage';
import { generateBillPDF } from '@/utils/pdfGenerator';
import { moderateScale, scale, verticalScale } from '@/utils/responsive';
import { SyncManager } from '@/utils/syncManager';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRouter, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
    Alert,
    FlatList,
    Linking,
    Modal,
    Platform,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThermalPrinter, isPrinterAvailable } from '@/utils/thermalPrinter';
import { NativeModules } from 'react-native';
import * as Contacts from 'expo-contacts';
import ViewShot, { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
const { BluetoothManager } = NativeModules;

// ─── Types ────────────────────────────────────────────────────────────────────
type Vegetable = {
    id: string;
    name: string;
    tamilName: string;
};

type CartItem = Vegetable & {
    quantity: string;
    price: string;
    total: number;
};

// ── VegItem Component (Highly Optimized) ──
const VegItem = React.memo(({ 
    item, 
    cartItem, 
    onToggle, 
    onUpdate, 
    isDark, 
    primary, 
    cardBg, 
    textCol, 
    subCol, 
    borderCol,
    qtyRef,
    priceRef
}: any) => {
    const selected = !!cartItem;
    const qVal = cartItem?.quantity || '';
    const pVal = cartItem?.price || '';
    const totalVal = (parseFloat(qVal) || 0) * (parseFloat(pVal) || 0);

    return (
        <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => onToggle(item)}
            style={[
                styles.listRow,
                {
                    backgroundColor: selected
                        ? (isDark ? '#2A1F4A' : '#F5F3FF')
                        : cardBg,
                    borderColor: selected ? primary : borderCol,
                    borderWidth: selected ? 1.5 : 1,
                },
            ]}
        >
            <View
                style={[
                    styles.selCircle,
                    {
                        backgroundColor: selected ? primary : 'transparent',
                        borderColor: selected ? primary : subCol,
                    },
                ]}
            >
                {selected && <Feather name="check" size={12} color="#FFF" />}
            </View>

            <View style={{ flex: 1, flexShrink: 1, marginLeft: scale(10) }}>
                <Text style={[styles.vegTamil, { color: textCol }]} numberOfLines={1} ellipsizeMode="tail">
                    {item.tamilName}
                </Text>
                <Text style={[styles.vegEng, { color: subCol, fontSize: moderateScale(10) }]} numberOfLines={1}>
                    {item.name}
                </Text>
            </View>

            {selected && (
                <View style={styles.inlineInputs}>
                    <View style={[styles.inlineBox, { borderColor: primary + '60', backgroundColor: isDark ? '#252525' : '#FFF' }]}>
                        <MaterialCommunityIcons name="scale" size={14} color={primary} />
                        <TextInput
                            ref={qtyRef}
                            style={[styles.inlineInput, { color: textCol }]}
                            keyboardType="decimal-pad"
                            placeholder="kg"
                            placeholderTextColor={subCol}
                            value={qVal}
                            onChangeText={v => onUpdate(item.id, 'quantity', v)}
                            returnKeyType="next"
                            onSubmitEditing={() => priceRef?.current?.focus()}
                            selectTextOnFocus
                        />
                    </View>
                    <Text style={{ color: subCol, marginHorizontal: 1, fontSize: 12, fontWeight: '700' }}>×</Text>
                    <View style={[styles.inlineBox, { borderColor: primary + '60', backgroundColor: isDark ? '#252525' : '#FFF' }]}>
                        <Text style={{ color: primary, fontSize: 13, fontWeight: '900', marginRight: 2 }}>₹</Text>
                        <TextInput
                            ref={priceRef}
                            style={[styles.inlineInput, { color: textCol }]}
                            keyboardType="decimal-pad"
                            placeholder="rate"
                            placeholderTextColor={subCol}
                            value={pVal}
                            onChangeText={v => onUpdate(item.id, 'price', v)}
                            selectTextOnFocus
                        />
                    </View>
                    <View style={{ minWidth: scale(30), alignItems: 'center' }}>
                        {totalVal > 0 && (
                            <Text style={[styles.inlineTotal, { color: primary }]}>
                                ={'\n'}₹{totalVal.toFixed(0)}
                            </Text>
                        )}
                    </View>
                </View>
            )}

            {!selected && (
                <View style={[styles.addCircle, { backgroundColor: primary + '15', borderColor: primary + '30' }]}>
                    <Feather name="plus" size={16} color={primary} />
                </View>
            )}
        </TouchableOpacity>
    );
}, (prev, next) => {
    // Custom equality check to minimize re-renders
    return (
        prev.item.id === next.item.id &&
        prev.isDark === next.isDark &&
        prev.cartItem?.quantity === next.cartItem?.quantity &&
        prev.cartItem?.price === next.cartItem?.price &&
        !!prev.cartItem === !!next.cartItem
    );
});
VegItem.displayName = 'VegItem';


// ── Preview Item Component ──
const PreviewItem = React.memo(({ item, onUpdate, onRemove, primary, textCol, borderCol, cardBg }: any) => {
    return (
        <View style={[styles.invoiceItemRow, { backgroundColor: cardBg, borderColor: borderCol }]}>
            <View style={styles.itemTopRow}>
                <View>
                    <Text style={[styles.trTamil, { color: textCol }]}>{item.tamilName}</Text>
                    <Text style={{ fontSize: 10, color: '#888' }}>{item.name}</Text>
                </View>
                <TouchableOpacity onPress={() => onRemove(item.id)} style={styles.removeBtn}>
                    <Feather name="trash-2" size={14} color="#EF4444" />
                </TouchableOpacity>
            </View>
            <View style={styles.itemBottomRow}>
                <View style={[styles.priceInputBox, { borderColor: primary + '30' }]}>
                    <Text style={{ fontSize: 12, color: primary }}>₹</Text>
                    <TextInput 
                        style={[styles.trInput, { color: primary, width: 60 }]} 
                        value={item.price} 
                        onChangeText={v => onUpdate(item.id, 'price', v)} 
                        keyboardType="decimal-pad" 
                        selectTextOnFocus 
                    />
                </View>
                <View style={styles.qtyStepperRow}>
                    <TouchableOpacity onPress={() => onUpdate(item.id, 'quantity', (Math.max(0, parseFloat(item.quantity || '0') - 0.25)).toString())} style={[styles.stepBtn, { borderColor: borderCol, borderWidth: 1 }]}><Feather name="minus" size={14} color={textCol} /></TouchableOpacity>
                    <TextInput style={[styles.trInput, { color: textCol, width: 45 }]} value={item.quantity} onChangeText={v => onUpdate(item.id, 'quantity', v)} keyboardType="decimal-pad" selectTextOnFocus />
                    <TouchableOpacity onPress={() => onUpdate(item.id, 'quantity', (parseFloat(item.quantity || '0') + 0.25).toString())} style={[styles.stepBtn, { backgroundColor: primary }]}><Feather name="plus" size={14} color="#FFF" /></TouchableOpacity>
                </View>
                <Text style={[styles.trTotal, { color: primary }]}>₹{item.total.toFixed(0)}</Text>
            </View>
        </View>
    );
});
PreviewItem.displayName = 'PreviewItem';


const PRIORITY_TAMIL = ['பச்சை மிளகாய்', 'தக்காளி', 'வெங்காயம்', 'உருளை', 'கேரட்', 'பீன்ஸ்'];

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function FunctionBillScreen() {
    const navigation = useNavigation();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { isDark, language, primaryColor } = useAppTheme();
    const { user } = useAuth();

    const { waitBillId } = useLocalSearchParams();
    const [editingBillId, setEditingBillId] = useState<string | null>(null);

    // ── State ──
    const [vegetables, setVegetables] = useState<Vegetable[]>([]);
    const [cart, setCart] = useState<CartItem[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const [customerName, setCustomerName] = useState('');
    const [customerMobile, setCustomerMobile] = useState('');
    const [mobileError, setMobileError] = useState(false);
    const [eventName, setEventName] = useState('');
    const [discount, setDiscount] = useState('0');
    const [nextBillId, setNextBillId] = useState('');
    const [billPreviewVisible, setBillPreviewVisible] = useState(false);
    const [printerPreference, setPrinterPreference] = useState<'2inch' | '3inch'>('3inch');
    const [isPrinterConnected, setIsPrinterConnected] = useState(false);
    const [showPrinterModal, setShowPrinterModal] = useState(false);
    const [pairedDevices, setPairedDevices] = useState<any[]>([]);
    const [isScanning, setIsScanning] = useState(false);

    useFocusEffect(
        useCallback(() => {
            loadVegetables();
            loadSettings();
            if (waitBillId && waitBillId !== editingBillId) {
                loadBillForEditing(waitBillId as string);
            }
        }, [waitBillId]) // Removed editingBillId to avoid cycle
    );

    const loadBillForEditing = async (billId: string) => {
        try {
            const response = await billDbService.getWithItems(billId);
            if (!response.data) return;
            const billData = response.data;

            setEditingBillId(billId);
            setNextBillId(billId);
            setCustomerName(billData.bill.customer_name || '');
            setCustomerMobile(billData.bill.customer_mobile || '');
            setDiscount(billData.bill.discount?.toString() || '0');
            
            // Extract event name from notes if present
            if (billData.bill.notes && billData.bill.notes.startsWith('Event: ')) {
                setEventName(billData.bill.notes.replace('Event: ', ''));
            }

            const restoredCart = billData.items.map(item => ({
                id: item.vegetable_id || item.id,
                name: item.name,
                tamilName: item.tamil_name,
                quantity: item.quantity.toString(),
                price: item.unit_price.toString(),
                total: item.total_price
            }));
            
            // Ensure uniqueness to prevent duplication
            const uniqueCart = Array.from(new Map(restoredCart.map(i => [i.id, i])).values());
            setCart(uniqueCart);
            // Clear param to avoid duplicate loads on re-focus
            router.setParams({ waitBillId: undefined });
        } catch (error) {
            console.error('Error loading bill for editing:', error);
            Alert.alert('Error', 'Failed to load bill data');
        }
    };

    const loadSettings = async () => {
        const pSize = await Storage.getItem(KEYS.PRINTER_SIZE);
        if (pSize) setPrinterPreference(pSize);
        
        const lastPrinter = await Storage.getItem('last_printer');
        if (lastPrinter) {
            handleConnectPrinter(lastPrinter.address);
        }
    };

    const handleConnectPrinter = async (address: string) => {
        try {
            const success = await ThermalPrinter.connect(address);
            if (success) {
                setIsPrinterConnected(true);
                setShowPrinterModal(false);
                // Save as last printer
                const devices = await ThermalPrinter.getPairedDevices();
                const device = devices.find((d: any) => d.address === address);
                if (device) await Storage.setItem('last_printer', device);
            } else {
                Alert.alert('Error', 'Failed to connect to printer');
            }
        } catch (error) {
            console.error(error);
            setIsSaving(false);
        }
    };

    const scanPrinters = async () => {
        setIsScanning(true);
        const devices = await ThermalPrinter.discoverDevices();
        setPairedDevices(devices);
        setIsScanning(false);
    };

    const handlePickContact = async () => {
        try {
            const { status } = await Contacts.requestPermissionsAsync();
            if (status === 'granted') {
                const contactResult = await Contacts.presentContactPickerAsync();
                if (contactResult) {
                    // Fetch full data by ID
                    const contact = await Contacts.getContactByIdAsync(contactResult.id);
                    if (contact) {
                        // Robust Name extraction
                        let displayName = contact.name;
                        if (!displayName || displayName === 'undefined') {
                            displayName = [contact.firstName, contact.middleName, contact.lastName].filter(Boolean).join(' ');
                        }
                        if (displayName && displayName !== 'undefined') setCustomerName(displayName);

                        if (contact.phoneNumbers && contact.phoneNumbers.length > 0) {
                            const mobileObj = contact.phoneNumbers.find(p => p.label === 'mobile' || p.label === 'Mobile') || contact.phoneNumbers[0];
                            const rawNumber = mobileObj.number || '';
                            const digits = rawNumber.replace(/\D/g, '').slice(-10);
                            if (digits) {
                                handleMobileChange(digits);
                            }
                        }
                    }
                }
            } else {
                Alert.alert('Permission Denied', 'Please allow contact access to pick a customer.');
            }
        } catch (error: any) {
            console.error('Contact picker error:', error);
            Alert.alert('Error', 'Could not open contacts: ' + (error?.message || 'Unknown error'));
        }
    };

    const thermalShotRef = useRef<any>(null);
    const viewShotRef = useRef<any>(null);

    const ThermalReceiptView = ({ name, mobile, billId, date, cart, total, shopName, shopPhone, grandTotal, width }: any) => {
        const is3Inch = width >= 576;
        const receiptWidth = is3Inch ? 576 : 384; 
        
        // Scale for crispness
        const scale = is3Inch ? 1.6 : 1.3;
        
        const PAD = 10 * scale; // Clean padding
        const COL_QTY = is3Inch ? 90 : 65;
        const COL_AMT = is3Inch ? 140 : 100;
        const COL_ITEM = receiptWidth - (PAD * 2) - COL_QTY - COL_AMT;

        const subtotalValue = cart.reduce((s: number, i: any) => s + (i.total || 0), 0);
        const discountValue = Math.max(0, subtotalValue - grandTotal);

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
                    பாண்டி - திண்டிவனம் மெயின் ரோடு, கிளியனூர்.
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
                    <Text style={{ width: COL_ITEM, color: '#000', fontSize: 16 * scale, fontWeight: 'bold' }}>
                      {item.tamilName || item.name}
                    </Text>
                    <Text style={{ width: COL_QTY, textAlign: 'center', color: '#000', fontSize: 16 * scale, fontWeight: '600' }}>
                      {item.quantity}
                    </Text>
                    <Text style={{ width: COL_AMT, textAlign: 'right', color: '#000', fontSize: 16 * scale, fontWeight: '900' }}>
                      {item.total.toFixed(0)}
                    </Text>
                  </View>
                ))}
        
                <View style={{ borderTopWidth: 1.5 * scale, borderTopColor: '#000', borderStyle: 'dashed', marginTop: 12 * scale, paddingTop: 12 * scale }}>
                  {/* --- TOTALS --- */}
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 * scale }}>
                    <Text style={{ fontSize: 15 * scale, color: '#000', fontWeight: '600' }}>Sub Total</Text>
                    <Text style={{ fontSize: 15 * scale, color: '#000', fontWeight: '800' }}>₹{subtotalValue.toFixed(0)}</Text>
                  </View>
                  
                  {discountValue > 0 && (
                     <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 * scale }}>
                        <Text style={{ fontSize: 15 * scale, color: '#444', fontWeight: '600' }}>Discount</Text>
                        <Text style={{ fontSize: 15 * scale, color: '#000', fontWeight: '800' }}>-₹{discountValue.toFixed(0)}</Text>
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
                    <Text style={{ fontWeight: '900', color: '#000', fontSize: 24 * scale }}>₹{grandTotal.toFixed(0)}</Text>
                  </View>
                </View>
        
                {/* --- FOOTER --- */}
                <View style={{ marginTop: 30 * scale, alignItems: 'center' }}>
                  <Text style={{ fontSize: 20 * scale, fontWeight: '900', color: '#000' }}>நன்றி! மீண்டும் வருக.</Text>
                  <Text style={{ fontSize: 13 * scale, color: '#555', fontWeight: '600', marginTop: 6 * scale }}>Thank you! Visit again.</Text>
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
            console.log('Capture success (Function Bill):', uri);

            const cleanPhone = (customerMobile || "").trim().replace(/\D/g, '');
            if (!cleanPhone) {
                 await Sharing.shareAsync(uri);
                 return;
            }

            try {
                const hasNativeShare = !!NativeModules.RNShare;
                if (hasNativeShare && cleanPhone.length >= 10) {
                    const Share = require('react-native-share').default;
                    const FileSystem = require('expo-file-system');
                    const targetPhone = `91${cleanPhone.slice(-10)}`;
                    
                    const base64Data = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
                    const shareUrl = `data:image/jpeg;base64,${base64Data}`;

                    const shareOptions = {
                        social: Share.Social.WHATSAPP,
                        whatsAppNumber: targetPhone,
                        url: shareUrl,
                        type: 'image/jpeg',
                        appId: "com.whatsapp",
                        forceFullApp: true,
                        failOnCancel: false,
                    };
                    await Share.shareSingle(shareOptions);
                } else {
                    await Sharing.shareAsync(uri);
                }
            } catch (err) {
                console.warn('Direct share failed in function bill, using system:', err);
                await Sharing.shareAsync(uri);
            }
        } catch (error) {
            console.error('Share image error:', error);
            Alert.alert('Error', 'Failed to share invoice as image');
        }
    };

    // inline input refs
    const qtyRefs = useRef<{ [id: string]: TextInput | null }>({});
    const priceRefs = useRef<{ [id: string]: TextInput | null }>({});

    // ── Validation ──
    const isValidMobile = (num: string) => /^[6-9]\d{9}$/.test(num.trim());
    const handleMobileChange = (value: string) => {
        const digits = value.replace(/\D/g, '').slice(0, 10);
        setCustomerMobile(digits);
        setMobileError(digits.length > 0 && !isValidMobile(digits));
    };

    // ── Colors ──
    const primary = primaryColor;
    const bg = isDark ? '#0F0F0F' : '#F5F3FF';
    const cardBg = isDark ? '#1C1C1E' : '#FFFFFF';
    const textCol = isDark ? '#F2F2F7' : '#1A1C1E';
    const subCol = isDark ? '#8E8E93' : '#6B7280';
    const borderCol = isDark ? '#2C2C2E' : '#E5E7EB';

    const loadVegetables = useCallback(async () => {
        try {
            const res = await inventoryDbService.getAll();
            if (res?.data?.length > 0) {
                const mapped: Vegetable[] = res.data.map((v: any) => ({
                    id: v.id,
                    name: v.name || 'Unknown',
                    tamilName: v.tamil_name || v.name || '',
                }));
                const sorted = [...mapped].sort((a, b) => {
                    const ai = PRIORITY_TAMIL.indexOf(a.tamilName);
                    const bi = PRIORITY_TAMIL.indexOf(b.tamilName);
                    if (ai !== -1 && bi !== -1) return ai - bi;
                    if (ai !== -1) return -1;
                    if (bi !== -1) return 1;
                    return a.name.localeCompare(b.name);
                });
                setVegetables(sorted);
            }
        } catch {
            // silent
        }
    }, []);

    useEffect(() => {
        navigation.setOptions({ headerShown: false });
        loadVegetables();
    }, [navigation, loadVegetables]);

    const filteredVegetables = useMemo(() => {
        if (!searchQuery.trim()) return vegetables;
        const q = searchQuery.toLowerCase();
        return vegetables.filter(v => v.name.toLowerCase().includes(q) || v.tamilName.includes(searchQuery));
    }, [vegetables, searchQuery]);

    const cartMap = useMemo(() => {
        const map: { [id: string]: CartItem } = {};
        cart.forEach(c => { map[c.id] = c; });
        return map;
    }, [cart]);

    const toggleSelect = useCallback((veg: Vegetable) => {
        setCart(prev => {
            const idx = prev.findIndex(c => c.id === veg.id);
            if (idx !== -1) {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                return prev.filter(c => c.id !== veg.id);
            } else {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                // Trigger focus AFTER state update cycle
                setTimeout(() => {
                    qtyRefs.current[veg.id]?.focus();
                }, 100);
                return [...prev, { ...veg, quantity: '', price: '', total: 0 }];
            }
        });
    }, []);

    const updateCartField = useCallback((id: string, field: 'quantity' | 'price', raw: string) => {
        const sanitized = raw.replace(/[^0-9.]/g, '');
        const parts = sanitized.split('.');
        const finalRaw = parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : sanitized;

        setCart(prev => prev.map(c => {
            if (c.id !== id) return c;
            const newQtyStr = field === 'quantity' ? finalRaw : c.quantity;
            const newPriceStr = field === 'price' ? finalRaw : c.price;
            const q = parseFloat(newQtyStr) || 0;
            const p = parseFloat(newPriceStr) || 0;
            return { ...c, [field]: finalRaw, total: Math.max(0, q * p) };
        }));
    }, []);

    const removeCartItem = useCallback((id: string) => {
        setCart(prev => prev.filter(c => c.id !== id));
    }, []);

    const renderVegRow = useCallback(({ item }: { item: Vegetable }) => {
        return (
            <VegItem
                item={item}
                cartItem={cartMap[item.id]}
                onToggle={toggleSelect}
                onUpdate={updateCartField}
                isDark={isDark}
                primary={primary}
                cardBg={cardBg}
                textCol={textCol}
                subCol={subCol}
                borderCol={borderCol}
                qtyRef={(r: any) => { qtyRefs.current[item.id] = r; }}
                priceRef={(r: any) => { priceRefs.current[item.id] = r; }}
            />
        );
    }, [isDark, primary, cardBg, textCol, subCol, borderCol, toggleSelect, updateCartField, cartMap]);

    const validCart = useMemo(() => cart.filter(c => (parseFloat(c.quantity) || 0) > 0 && (parseFloat(c.price) || 0) > 0), [cart]);
    const subtotal = useMemo(() => cart.reduce((s, i) => s + i.total, 0), [cart]);
    const discountAmt = Math.max(0, parseFloat(discount) || 0);
    const grandTotal = Math.max(0, subtotal - discountAmt);

    const handlePreview = async () => {
        if (customerName.trim() && customerName.trim().length < 2) {
            Alert.alert(language === 'Tamil' ? 'சரிபார்ப்பு' : 'Validation Error', language === 'Tamil' ? 'வாடிக்கையாளர் பெயர் குறைந்தது 2 எழுத்துக்கள் இருக்க வேண்டும்' : 'Customer Name must be at least 2 characters');
            return;
        }
        if (eventName.trim() && eventName.trim().length < 3) {
            Alert.alert(language === 'Tamil' ? 'சரிபார்ப்பு' : 'Validation Error', language === 'Tamil' ? 'நிகழ்வு பெயர் குறைந்தது 3 எழுத்துக்கள் இருக்க வேண்டும்' : 'Event Name must be at least 3 characters');
            return;
        }
        if (validCart.length === 0) {
            Alert.alert(language === 'Tamil' ? 'பிழை' : 'Error', 'Please select items with quantity and price');
            return;
        }
        if (customerMobile.length > 0 && !isValidMobile(customerMobile)) {
            Alert.alert(language === 'Tamil' ? 'பிழை' : 'Invalid Mobile', 'Enter valid 10-digit number');
            setMobileError(true);
            return;
        }
        
        // Only fetch next ID if we are NOT editing an existing bill
        if (!editingBillId) {
            try {
                const { data } = await billDbService.getNextId();
                setNextBillId(data);
            } catch {
                setNextBillId('FUNC-BILL');
            }
        }
        
        setBillPreviewVisible(true);
    };

    const handleFinalize = () => {
        // Direct print using visible preference
        processBill(true, printerPreference);
    };

    const handleWaitBill = async () => {
        if (!validCart.length || isSaving) {
            if (!validCart.length) Alert.alert(language === 'Tamil' ? 'பிழை' : 'Error', 'Cart is empty');
            return;
        }
        setIsSaving(true);
        try {
            const [mName, mNumber] = await Promise.all([
                Storage.getItem(KEYS.MERCHANT_NAME),
                Storage.getItem(KEYS.MERCHANT_NUMBER),
            ]);
            
            const billData = {
                shopName: mName || 'சுஜி காய்கறி கடை',
                phone: mNumber || '9095938085',
                customer_name: customerName || (language === 'Tamil' ? 'விழா வாடிக்கையாளர்' : 'Event Customer'),
                customer_mobile: (customerMobile || "").trim().replace(/\D/g, ''),
                billNumber: editingBillId || nextBillId,
                date: new Date().toLocaleString('en-IN'),
                mode: 'Function',
                language,
                payment_status: 'WAITING',
                notes: eventName ? `Event: ${eventName}` : undefined,
                items: validCart.map(i => ({
                    vegetable_id: i.id,
                    name: i.tamilName || i.name,
                    tamilName: i.tamilName,
                    quantity: parseFloat(i.quantity) || 0,
                    unit_price: parseFloat(i.price) || 0,
                    discount: 0,
                    total_price: parseFloat(i.total.toFixed(2)),
                })),
                discount: discountAmt,
                total_amount: parseFloat(grandTotal.toFixed(2)),
            };

            if (editingBillId) {
                await billDbService.update(editingBillId, billData, billData.items);
                Alert.alert(language === 'Tamil' ? 'வெற்றி' : 'Success', language === 'Tamil' ? 'பில் புதுப்பிக்கப்பட்டது' : 'Bill updated successfully');
            } else {
                await SyncManager.queueBill(billData);
                Alert.alert(language === 'Tamil' ? 'வெற்றி' : 'Success', language === 'Tamil' ? 'பில் காத்திருப்பில் வைக்கப்பட்டது' : 'Bill parked in Wait List');
            }
            
            setCart([]); setCustomerName(''); setCustomerMobile(''); setEventName(''); setDiscount('0'); 
            setBillPreviewVisible(false);
            setIsSaving(false);
            setEditingBillId(null);
            router.push('/shop/history');
        } catch (err) {
            console.error(err);
            Alert.alert('Error', 'Could not save wait bill');
        }
    };

    const handleWhatsAppShare = async () => {
        try {
            const [mName, mNumber] = await Promise.all([
                Storage.getItem(KEYS.MERCHANT_NAME),
                Storage.getItem(KEYS.MERCHANT_NUMBER),
            ]);

            const validCart = cart.filter(i => parseFloat(i.quantity) > 0 && parseFloat(i.price) > 0);
            const subtotal = validCart.reduce((s, i) => s + i.total, 0);
            const discountAmt = parseFloat(discount) || 0;
            const grandTotal = subtotal - discountAmt;

            const billData = {
                shopName: mName || 'சுஜி காய்கறி கடை',
                phone: mNumber || '9095938085',
                userName: customerName || (language === 'Tamil' ? 'விழா வாடிக்கையாளர்' : 'Event Customer'),
                billNumber: nextBillId || 'FUNC-BILL',
                date: new Date().toLocaleString('en-IN'),
                items: validCart,
                subTotal: subtotal,
                discount: discountAmt,
                grandTotal: grandTotal
            };

            let message = `🧾 *${billData.shopName.toUpperCase()}*\n`;
            message += `${language === 'Tamil' ? 'போன்' : 'Ph'}: ${billData.phone}\n`;
            message += `--------------------------\n`;
            message += `${language === 'Tamil' ? 'பில் எண்' : 'Bill No'}: *${billData.billNumber}*\n`;
            message += `${language === 'Tamil' ? 'தேதி' : 'Date'}: ${billData.date}\n`;
            message += `${language === 'Tamil' ? 'விழா' : 'Event'}: ${eventName || (language === 'Tamil' ? 'திருவிழா' : 'Festival')}\n`;
            message += `${language === 'Tamil' ? 'வாடிக்கையாளர்' : 'Customer'}: ${billData.userName}\n`;
            message += `--------------------------\n`;

            billData.items.forEach((item: any) => {
                const name = item.tamilName || item.name;
                message += `• ${name}\n`;
                message += `  ${item.quantity}kg x ₹${item.price} = *₹${item.total.toFixed(0)}*\n`;
            });

            if (billData.discount > 0) {
                message += `--------------------------\n`;
                message += `${language === 'Tamil' ? 'கூட்டுத் தொகை' : 'Subtotal'}: ₹${billData.subTotal.toFixed(0)}\n`;
                message += `${language === 'Tamil' ? 'தள்ளுபடி' : 'Discount'}: -₹${billData.discount.toFixed(0)}\n`;
            }

            message += `--------------------------\n`;
            message += `*${language === 'Tamil' ? 'மொத்த தொகை' : 'GRAND TOTAL'}: ₹${billData.grandTotal.toFixed(0)}*\n`;
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

    const processBill = async (printDirect: boolean, printerSize: '2inch' | '3inch' = '2inch') => {
        if (mobileError || isSaving) {
            if (mobileError) {
                Alert.alert(
                    language === 'Tamil' ? 'பிழை' : 'Invalid Contact',
                    language === 'Tamil' ? 'சரியான 10 இலக்க எணனை உள்ளிடவும்' : 'Please enter a valid 10-digit mobile number'
                );
            }
            return;
        }
        setIsSaving(true);
        try {
            const [mName, mNumber] = await Promise.all([
                Storage.getItem(KEYS.MERCHANT_NAME),
                Storage.getItem(KEYS.MERCHANT_NUMBER),
            ]);
            const billData = {
                shopName: mName || 'சுஜி காய்கறி கடை',
                phone: mNumber || '9095938085',
                customer_name: customerName || (language === 'Tamil' ? 'விழா வாடிக்கையாளர்' : 'Event Customer'),
                customer_mobile: (customerMobile || "").trim().replace(/\D/g, ''),
                billNumber: editingBillId || nextBillId,
                date: new Date().toLocaleString('en-IN'),
                mode: 'Function',
                language,
                payment_status: 'PAID',
                notes: eventName ? `Event: ${eventName}` : undefined,
                items: validCart.map(i => ({
                    vegetable_id: i.id,
                    name: i.tamilName || i.name,
                    tamilName: i.tamilName,
                    quantity: parseFloat(i.quantity) || 0,
                    unit_price: parseFloat(i.price) || 0,
                    discount: 0,
                    total_price: parseFloat(i.total.toFixed(2)),
                })),
                discount: discountAmt,
                total_amount: parseFloat(grandTotal.toFixed(2)),
            };

            let savedBill;
            if (editingBillId) {
                await billDbService.update(editingBillId, billData, billData.items);
                savedBill = { id: editingBillId };
            } else {
                savedBill = await SyncManager.queueBill(billData);
            }
            
            if (isPrinterConnected) {
                try {
                    // 1. Capture the beautiful receipt view as an image (required for Tamil support)
                    if (thermalShotRef.current) {
                        const captureWidth = printerPreference === '2inch' ? 384 : 576;
                        const uri = await thermalShotRef.current.capture({
                          format: 'jpg',
                          quality: 0.8,
                          width: captureWidth
                        });
                        
                        // 2. Print the captured image
                        await ThermalPrinter.printImage(uri, captureWidth);
                    } else {
                        // Fallback if ref is not ready
                        console.warn('Thermal shot ref not ready, falling back to text print');
                        await ThermalPrinter.printInvoice({
                            shopName: billData.shopName,
                            billId: savedBill?.id || nextBillId,
                            date: billData.date,
                            items: billData.items.map((i: any) => ({
                                name: i.name,
                                tamilName: i.tamilName,
                                quantity: i.quantity,
                                unitPrice: i.unit_price,
                                totalPrice: i.total_price
                            })),
                            totalAmount: billData.total_amount,
                            customerName: billData.customer_name,
                            customerMobile: billData.customer_mobile,
                            shopPhone: billData.phone,
                        });
                    }
                } catch (printErr) {
                    console.error('Image printing failed:', printErr);
                    Alert.alert('Print Error', 'Could not print Tamil bill. Please try sharing via WhatsApp instead.');
                }
            } else {
                await generateBillPDF({...billData, billNumber: savedBill?.id || nextBillId}, { printDirect, printerSize });
            }
            
            Alert.alert(language === 'Tamil' ? 'வெற்றி' : 'Success', language === 'Tamil' ? 'பில் சேமிக்கப்பட்டது' : 'Bill saved successfully!');
            setCart([]); setCustomerName(''); setCustomerMobile(''); setEventName(''); setDiscount('0'); setBillPreviewVisible(false);
            setEditingBillId(null);
            setIsSaving(false);
        } catch (err) {
            console.error(err);
            setIsSaving(false);
            Alert.alert('Error', 'Could not complete bill');
        }
    };

    return (
        <View style={[styles.root, { backgroundColor: bg }]}>
            <StatusBar style="light" backgroundColor={primaryColor} />
            
            <LinearGradient colors={isDark ? ['#1A1A1A', '#1A1A1A'] : [primaryColor, primaryColor]} style={[styles.header, { paddingTop: insets.top + (Platform.OS === 'android' ? verticalScale(14) : verticalScale(8)) }]}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}><Ionicons name="arrow-back" size={22} color={primaryColor} /></TouchableOpacity>
                <View style={{ flex: 1, marginLeft: scale(10) }}>
                    <Text style={styles.headerTitle}>{language === 'Tamil' ? 'விழா பில்' : 'Function Bill'}</Text>
                    <Text style={styles.headerSub}>{language === 'Tamil' ? 'திருமணம் & நிகழ்வு பில்லிங்' : 'Marriage & Event Billing'}</Text>
                </View>
                {validCart.length > 0 && (
                    <View style={styles.cartBadgeWrap}><Text style={styles.cartBadgeText}>{validCart.length}</Text></View>
                )}
            </LinearGradient>

            <View style={[styles.infoBar, { backgroundColor: cardBg, borderBottomColor: borderCol }]}>
                <View style={[styles.infoInput, { backgroundColor: isDark ? '#252525' : '#F9F9FF', borderColor: borderCol }]}>
                    <MaterialCommunityIcons name="party-popper" size={15} color={primary} />
                    <TextInput style={[styles.infoTextField, { color: textCol }]} placeholder="Event name (optional)" placeholderTextColor={subCol} value={eventName} onChangeText={setEventName} />
                </View>
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
                    <View style={[styles.infoInput, { flex: 1, backgroundColor: isDark ? '#252525' : '#F9F9FF', borderColor: borderCol, paddingRight: 4 }]}>
                        <Ionicons name="person" size={14} color={primary} />
                        <TextInput style={[styles.infoTextField, { color: textCol, flex: 1 }]} placeholder="Customer name" placeholderTextColor={subCol} value={customerName} onChangeText={setCustomerName} />
                        <TouchableOpacity onPress={handlePickContact} style={{ padding: 4 }}>
                            <Ionicons name="people" size={16} color={primary} />
                        </TouchableOpacity>
                    </View>
                    <View style={[styles.infoInput, { flex: 1, borderColor: mobileError ? '#EF4444' : borderCol, backgroundColor: isDark ? '#252525' : '#F9F9FF' }]}>
                        <Ionicons name="call" size={14} color={mobileError ? '#EF4444' : primary} />
                        <TextInput style={[styles.infoTextField, { color: textCol }]} placeholder="Mobile no." placeholderTextColor={subCol} value={customerMobile} onChangeText={handleMobileChange} keyboardType="phone-pad" maxLength={10} />
                    </View>
                </View>

                <TouchableOpacity 
                    onPress={() => {
                        scanPrinters();
                        setShowPrinterModal(true);
                    }}
                    style={[styles.printerStatus, { backgroundColor: isPrinterConnected ? primaryColor + '20' : '#EF444420', borderColor: isPrinterConnected ? primaryColor : '#EF4444' }]}
                >
                    <MaterialCommunityIcons name={isPrinterConnected ? 'printer-check' : 'printer-off'} size={14} color={isPrinterConnected ? primaryColor : '#EF4444'} />
                    <Text style={{ fontSize: 10, fontWeight: '700', color: isPrinterConnected ? primaryColor : '#EF4444', marginLeft: 4 }}>
                        {isPrinterConnected ? 'PRINTER CONNECTED' : 'CONNECT PRINTER'}
                    </Text>
                </TouchableOpacity>
            </View>

            <View style={[styles.searchBar, { backgroundColor: cardBg, borderBottomColor: borderCol }]}>
                <View style={[styles.searchInput, { backgroundColor: isDark ? '#252525' : '#F3F4F6', borderColor: borderCol }]}>
                    <Feather name="search" size={16} color={subCol} />
                    <TextInput style={[styles.searchField, { color: textCol }]} placeholder="Search items..." placeholderTextColor={subCol} value={searchQuery} onChangeText={setSearchQuery} />
                </View>
            </View>

            <FlatList
                data={filteredVegetables}
                keyExtractor={item => item.id}
                renderItem={renderVegRow}
                extraData={cart}
                contentContainerStyle={{ padding: 12, paddingBottom: 150 }}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                removeClippedSubviews={false}
                initialNumToRender={10}
                maxToRenderPerBatch={10}
                windowSize={5}
            />

            {validCart.length > 0 && (
                <View style={[styles.floatBar, { backgroundColor: cardBg, borderColor: borderCol, paddingBottom: Math.max(insets.bottom, 14) }]}>
                    <View style={styles.floatInfo}>
                        <View style={[styles.floatIconBox, { backgroundColor: primary }]}><Feather name="shopping-bag" size={18} color="#FFF" /></View>
                        <View style={{ marginLeft: 10 }}>
                            <Text style={[styles.floatLabel, { color: subCol }]}>{validCart.length} items</Text>
                            <Text style={[styles.floatTotal, { color: textCol }]}>₹{grandTotal.toFixed(0)}</Text>
                        </View>
                    </View>
                    <TouchableOpacity style={[styles.previewBtn, { backgroundColor: primary }]} onPress={handlePreview} activeOpacity={0.85}>
                        <Text style={styles.previewBtnText}>Preview Bill</Text>
                        <Feather name="arrow-right" size={18} color="#FFF" />
                    </TouchableOpacity>
                </View>
            )}

            <Modal visible={billPreviewVisible} animationType="slide">
                <SafeAreaView style={[styles.invoiceContainer, { backgroundColor: bg }]}>
                    <LinearGradient colors={isDark ? ['#1A1A1A', '#1A1A1A'] : [primaryColor, primaryColor]} style={[styles.invoiceFixedHeader, { paddingTop: insets.top + (Platform.OS === 'android' ? 14 : 8) }]}>
                        <View style={styles.invoiceHeaderNav}>
                            <TouchableOpacity onPress={() => setBillPreviewVisible(false)} style={styles.closeBtnCircle}><Ionicons name="arrow-back" size={20} color={primaryColor} /></TouchableOpacity>
                            <View style={{ flex: 1, marginLeft: 12 }}>
                                <Text style={styles.invoiceHeaderTitle}>{language === 'Tamil' ? 'பில் முன்னோட்டம்' : 'Bill Preview'}</Text>
                                <Text style={styles.invoiceHeaderSub}>{language === 'Tamil' ? 'திருமணம் & நிகழ்வு' : 'Marriage & Event'}</Text>
                            </View>
                            
                            <TouchableOpacity 
                                activeOpacity={0.7}
                                onPress={() => {
                                    scanPrinters();
                                    setShowPrinterModal(true);
                                }}
                                style={[
                                    { 
                                        flexDirection: 'row', 
                                        alignItems: 'center', 
                                        paddingHorizontal: scale(8), 
                                        paddingVertical: 4, 
                                        borderRadius: 20, 
                                        borderWidth: 1.5,
                                        marginRight: 10,
                                        gap: 4,
                                        backgroundColor: isPrinterConnected ? '#4ADE8030' : '#F8717130',
                                        borderColor: isPrinterConnected ? '#4ADE80' : '#F87171',
                                    }
                                ]}
                            >
                                <MaterialCommunityIcons 
                                    name={isPrinterConnected ? "printer-check" : "printer-off"} 
                                    size={12} 
                                    color={isPrinterConnected ? '#4ADE80' : '#F87171'} 
                                />
                                <Text style={{ fontSize: 10, fontWeight: '900', color: isPrinterConnected ? '#4ADE80' : '#F87171' }}>
                                    {isPrinterConnected ? 'ON' : 'OFF'}
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={handleWaitBill}
                                disabled={isSaving}
                                style={[
                                    styles.closeBtnCircle, 
                                    { 
                                        width: 'auto', 
                                        paddingHorizontal: scale(12), 
                                        backgroundColor: isSaving ? '#CCC' : '#FF9800', 
                                        borderRadius: scale(10),
                                        flexDirection: 'row',
                                        gap: 6,
                                        elevation: 4,
                                        opacity: isSaving ? 0.7 : 1,
                                    }
                                ]}
                            >
                                <MaterialCommunityIcons name="clock-outline" size={18} color="#FFF" />
                                <Text style={{ color: '#FFF', fontWeight: '900', fontSize: moderateScale(11) }}>
                                    {isSaving ? '...' : (language === 'Tamil' ? 'காத்திருப்பு' : 'Wait Bill')}
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
                            cart={validCart}
                            total={subtotal}
                            grandTotal={grandTotal}
                            shopName={user?.shopName}
                            shopPhone={user?.phone}
                            width={printerPreference === '2inch' ? 384 : 576}
                        />
                    </View>

                    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }} showsVerticalScrollIndicator={false}>
                        <ViewShot ref={viewShotRef} options={{ format: "jpg", quality: 0.9 }} style={{ backgroundColor: bg, padding: 8 }}>
                        <View style={styles.quickStatsRow}>
                            <View style={[styles.quickStatCard, { backgroundColor: cardBg, borderColor: borderCol }]}>
                                <Text style={[styles.quickStatValue, { color: textCol }]}>{nextBillId}</Text>
                                <Text style={[styles.quickStatLabel, { color: subCol }]}>ID</Text>
                            </View>
                            <View style={[styles.quickStatCard, { backgroundColor: cardBg, borderColor: borderCol }]}>
                                <Text style={[styles.quickStatValue, { color: textCol }]}>{new Date().toLocaleDateString()}</Text>
                                <Text style={[styles.quickStatLabel, { color: subCol }]}>Date</Text>
                            </View>
                        </View>

                        <View style={[styles.previewCustCard, { backgroundColor: cardBg, borderColor: borderCol }]}>
                            <TextInput style={[styles.custInput, { color: textCol }]} value={customerName} onChangeText={setCustomerName} placeholder="Customer Name" placeholderTextColor={subCol} />
                            <TextInput style={[styles.custInput, { color: textCol, marginTop: 12, borderTopWidth: 1, borderTopColor: borderCol, paddingTop: 12 }]} value={customerMobile} onChangeText={handleMobileChange} placeholder="Mobile" placeholderTextColor={subCol} keyboardType="phone-pad" maxLength={10} />
                        </View>

                        {validCart.map((item) => (
                            <PreviewItem 
                                key={item.id} 
                                item={item} 
                                onUpdate={updateCartField} 
                                onRemove={removeCartItem}
                                primary={primary}
                                textCol={textCol}
                                borderCol={borderCol}
                                cardBg={cardBg}
                            />
                        ))}

                        <View style={[styles.summaryCard, { backgroundColor: cardBg, borderColor: borderCol }]}>
                            <View style={styles.summaryLine}><Text style={{ color: subCol }}>Items Total</Text><Text style={{ fontWeight: '700', color: textCol }}>₹{subtotal.toFixed(2)}</Text></View>
                            <View style={[styles.discountBlock, { backgroundColor: isDark ? '#2A1A1A' : '#FFF5F5' }]}>
                                <Text style={{ color: '#EF4444', fontWeight: '700' }}>Extra Discount (₹)</Text>
                                <TextInput 
                                    style={[styles.discFullInput, { color: '#EF4444', borderColor: '#EF444430' }]} 
                                    value={discount} 
                                    onChangeText={(v) => {
                                        const sanitized = v.replace(/[^0-9.]/g, '');
                                        setDiscount(sanitized);
                                    }} 
                                    keyboardType="numeric" 
                                    selectTextOnFocus 
                                />
                            </View>
                            <View style={[styles.summaryLine, { marginTop: 15 }]}><Text style={{ fontWeight: '800', color: textCol, fontSize: 16 }}>Grand Total</Text><Text style={{ fontWeight: '900', fontSize: 22, color: primary }}>₹{grandTotal.toFixed(0)}</Text></View>
                        </View>
                        <View style={{ height: 120 }} />
                        </ViewShot>
                    </ScrollView>

                    <View style={[styles.stickyFooter, { backgroundColor: cardBg, borderTopColor: borderCol, flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingTop: 16, paddingBottom: Math.max(insets.bottom, 16) + (Platform.OS === 'android' ? 15 : 0) }]}>
                        <TouchableOpacity 
                            style={[
                                styles.generateBtn, 
                                { 
                                    backgroundColor: '#25D366', 
                                    flex: 0.25, 
                                    justifyContent: 'center',
                                    flexDirection: 'row',
                                    elevation: 4,
                                    shadowColor: '#25D366',
                                    shadowOpacity: 0.4,
                                    shadowRadius: 8,
                                    shadowOffset: { width: 0, height: 4 },
                                    borderRadius: 16
                                }
                            ]} 
                            onPress={handleShareImage}
                            activeOpacity={0.8}
                        >
                            <Ionicons name="logo-whatsapp" size={26} color="#FFF" />
                        </TouchableOpacity>

                        <TouchableOpacity 
                            style={[
                                styles.generateBtn, 
                                { 
                                    backgroundColor: isSaving ? '#CCC' : primary, 
                                    flex: 0.75, 
                                    flexDirection: 'row', 
                                    justifyContent: 'space-between', 
                                    paddingHorizontal: 20,
                                    elevation: 4,
                                    shadowColor: primary,
                                    shadowOpacity: 0.4,
                                    shadowRadius: 8,
                                    shadowOffset: { width: 0, height: 4 },
                                    borderRadius: 16
                                }
                            ]} 
                            onPress={handleFinalize} 
                            disabled={isSaving}
                            activeOpacity={0.8}
                        >
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                <MaterialCommunityIcons name="printer-pos" size={26} color="#FFF" />
                                <Text style={[styles.generateBtnText, { fontSize: moderateScale(15), letterSpacing: 0.5 }]}>
                                    {isSaving ? '...' : (language === 'Tamil' ? 'பில் அச்சிடு' : 'Print Bill')}
                                </Text>
                            </View>

                            <TouchableOpacity 
                                onPress={(e) => {
                                    e.stopPropagation();
                                    const nextSize = printerPreference === '2inch' ? '3inch' : '2inch';
                                    setPrinterPreference(nextSize);
                                    Storage.setItem(KEYS.PRINTER_SIZE, nextSize);
                                }}
                                style={{ 
                                    backgroundColor: 'rgba(255,255,255,0.25)', 
                                    paddingHorizontal: 10, 
                                    paddingVertical: 6, 
                                    borderRadius: 10,
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: 4
                                }}
                            >
                                <MaterialCommunityIcons name="format-size" size={14} color="#FFF" />
                                <Text style={{ color: '#FFF', fontSize: 13, fontWeight: 'bold' }}>
                                    {printerPreference === '2inch' ? '2"' : '3"'}
                                </Text>
                            </TouchableOpacity>
                        </TouchableOpacity>
                    </View>
                </SafeAreaView>
            </Modal>

            {/* Printer Selection Modal */}
            <Modal visible={showPrinterModal} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={[styles.printerModal, { backgroundColor: cardBg }]}>
                        <View style={styles.modalHeader}>
                            <Text style={[styles.modalTitle, { color: textCol }]}>Select Bluetooth Printer</Text>
                            <TouchableOpacity onPress={() => setShowPrinterModal(false)}>
                                <Ionicons name="close" size={24} color={textCol} />
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
                                        <Text style={[styles.deviceName, { color: textCol }]}>{item.name || 'Unknown'}</Text>
                                        <Text style={{ color: subCol, fontSize: 10 }}>{item.address}</Text>
                                    </View>
                                    <MaterialCommunityIcons name="bluetooth" size={20} color={primary} />
                                </TouchableOpacity>
                            )}
                                    ListEmptyComponent={
                                        <View style={{ padding: 25, alignItems: 'center', justifyContent: 'center' }}>
                                            <MaterialCommunityIcons 
                                                name={!isPrinterAvailable ? "alert-circle-outline" : "bluetooth-off"} 
                                                size={42} 
                                                color="#CCC" 
                                            />
                                            <Text style={{ 
                                                color: textCol, 
                                                fontWeight: '800', 
                                                fontSize: 14, 
                                                marginTop: 10,
                                                textAlign: 'center' 
                                            }}>
                                                {!isPrinterAvailable 
                                                    ? (language === 'Tamil' ? 'பிரிண்டர் மாட்யூல் கிடைக்கவில்லை' : 'Printer Module Not Found') 
                                                    : (language === 'Tamil' ? 'பிரிண்டர் எதுவும் கிடைக்கவில்லை' : 'No Printers Found')}
                                            </Text>
                                            <Text style={{ 
                                                color: subCol, 
                                                fontSize: 12, 
                                                marginTop: 6, 
                                                textAlign: 'center',
                                                lineHeight: 16 
                                            }}>
                                                {!isPrinterAvailable 
                                                    ? (language === 'Tamil' 
                                                       ? 'Expo Go-வில் பிரிண்டர் வேலை செய்யாது.' 
                                                       : 'Printer search doesn\'t work in Expo Go.')
                                                    : (language === 'Tamil'
                                                       ? 'Bluetooth மற்றும் Pairing செட்டிங்ஸை சரிபார்க்கவும்.'
                                                       : 'Check Bluetooth and System Pairing settings.')
                                                }
                                            </Text>
                                        </View>
                                    }
                        />
                        
                        <TouchableOpacity 
                            onPress={scanPrinters} 
                            style={[styles.modalActionBtn, { backgroundColor: primary }]}
                        >
                            <Text style={{ color: '#FFF', fontWeight: 'bold' }}>Refresh List</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1 },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12 },
    backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
    headerTitle: { fontSize: moderateScale(17), fontWeight: '800', color: '#FFF' },
    headerSub: { fontSize: moderateScale(10), color: 'rgba(255,255,255,0.7)', marginTop: 1 },
    cartBadgeWrap: { minWidth: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
    cartBadgeText: { color: '#FFF', fontSize: 12, fontWeight: '900' },
    infoBar: { padding: 12, borderBottomWidth: 1 },
    infoInput: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 },
    infoTextField: { flex: 1, fontSize: 13, fontWeight: '600', padding: 0 },
    searchBar: { padding: 12, borderBottomWidth: 1 },
    searchInput: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 10 },
    searchField: { flex: 1, fontSize: 13, marginLeft: 8 },
    thermalCaptureContainer: {
        width: 384,
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
    listRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, borderWidth: 1, padding: 12, marginBottom: 8 },
    selCircle: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
    vegTamil: { fontSize: moderateScale(15), fontWeight: '700' },
    vegEng: { fontSize: moderateScale(11) },
    inlineInputs: { flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 4 },
    inlineBox: { flexDirection: 'row', alignItems: 'center', gap: 2, borderWidth: 1.5, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 5, minWidth: 70 },
    inlineInput: { fontSize: 15, fontWeight: '800', padding: 0, minWidth: 45 },
    inlineTotal: { fontSize: 10, fontWeight: '800', textAlign: 'center', lineHeight: 12 },
    addCircle: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
    floatBar: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 14, borderTopWidth: 1 },
    floatInfo: { flexDirection: 'row', alignItems: 'center' },
    floatIconBox: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    floatLabel: { fontSize: 11, fontWeight: '600' },
    floatTotal: { fontSize: 20, fontWeight: '900' },
    previewBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 14 },
    previewBtnText: { color: '#FFF', fontWeight: '800', fontSize: 14 },
    invoiceContainer: { flex: 1 },
    invoiceFixedHeader: { paddingHorizontal: 16, paddingBottom: 10 },
    invoiceHeaderNav: { flexDirection: 'row', alignItems: 'center', paddingBottom: 10 },
    closeBtnCircle: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
    invoiceHeaderTitle: { fontSize: 17, fontWeight: '800', color: '#FFF' },
    invoiceHeaderSub: { fontSize: 10, color: 'rgba(255,255,255,0.7)' },
    quickStatsRow: { flexDirection: 'row', gap: 10, marginBottom: 15 },
    quickStatCard: { flex: 1, borderRadius: 12, borderWidth: 1, padding: 10, alignItems: 'center' },
    quickStatValue: { fontSize: 13, fontWeight: '800' },
    quickStatLabel: { fontSize: 9, fontWeight: '600', marginTop: 2 },
    previewCustCard: { borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 10 },
    custInput: { fontSize: 14, fontWeight: '700', padding: 0 },
    invoiceItemRow: { borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 10 },
    itemTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
    removeBtn: { width: 28, height: 28, borderRadius: 8, backgroundColor: '#EF444410', alignItems: 'center', justifyContent: 'center' },
    itemBottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
    priceInputBox: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1.5, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
    qtyStepperRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    stepBtn: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
    trInput: { fontSize: 14, fontWeight: '800', textAlign: 'center', padding: 0 },
    trTotal: { fontWeight: '900', fontSize: 18 },
    trTamil: { fontSize: 14, fontWeight: '800' },
    summaryCard: { borderRadius: 16, borderWidth: 1, padding: 16 },
    summaryLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    discountBlock: { marginTop: 15, padding: 12, borderRadius: 12, gap: 10 },
    discFullInput: { borderWidth: 1.5, borderRadius: 10, padding: 10, textAlign: 'right', fontSize: 18, fontWeight: '900' },
    stickyFooter: { padding: 16, borderTopWidth: 1 },
    generateBtn: { borderRadius: 14, paddingVertical: 16, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center' },
    generateBtnText: { color: '#FFF', fontWeight: '900', fontSize: 16 },
    printerStatus: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', borderLeftWidth: 3, paddingVertical: 4, paddingHorizontal: 8, marginTop: 10, borderRadius: 4 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
    printerModal: { borderRadius: 20, padding: 20, maxHeight: '80%' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    modalTitle: { fontSize: 18, fontWeight: 'bold' },
    deviceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1 },
    deviceName: { fontSize: 14, fontWeight: '600' },
    modalActionBtn: { marginTop: 20, padding: 15, borderRadius: 12, alignItems: 'center' },
});
