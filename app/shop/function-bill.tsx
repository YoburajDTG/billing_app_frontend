import { useAppTheme } from '@/context/ThemeContext';
import { billDbService, inventoryDbService } from '@/services/dbService';
import { KEYS, Storage } from '@/services/storage';
import { generateBillPDF } from '@/utils/pdfGenerator';
import { moderateScale, scale } from '@/utils/responsive';
import { SyncManager } from '@/utils/syncManager';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Alert,
    FlatList,
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
    const { isDark, language } = useAppTheme();

    // ── State ──
    const [vegetables, setVegetables] = useState<Vegetable[]>([]);
    const [cart, setCart] = useState<CartItem[]>([]);
    const [searchQuery, setSearchQuery] = useState('');

    const [customerName, setCustomerName] = useState('');
    const [customerMobile, setCustomerMobile] = useState('');
    const [mobileError, setMobileError] = useState(false);
    const [eventName, setEventName] = useState('');
    const [discount, setDiscount] = useState('0');
    const [nextBillId, setNextBillId] = useState('');
    const [billPreviewVisible, setBillPreviewVisible] = useState(false);

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
    const primary = '#8B5CF6';
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
        try {
            const { data } = await billDbService.getNextId();
            setNextBillId(data);
        } catch {
            setNextBillId('FUNC-BILL');
        }
        setBillPreviewVisible(true);
    };

    const handleFinalize = () => {
        Alert.alert(
            language === 'Tamil' ? 'பில் உருவாக்கவும்' : 'Generate Bill',
            'Choose option',
            [
                { text: language === 'Tamil' ? 'அச்சிடு & சேமி' : 'Print & Save', onPress: () => processBill(true) },
                { text: language === 'Tamil' ? 'பகிர் & சேமி' : 'Share & Save', onPress: () => processBill(false) },
                { text: 'Cancel', style: 'cancel' },
            ]
        );
    };

    const processBill = async (printDirect: boolean) => {
        if (mobileError) {
            Alert.alert(
                language === 'Tamil' ? 'பிழை' : 'Invalid Contact',
                language === 'Tamil' ? 'சரியான 10 இலக்க எணனை உள்ளிடவும்' : 'Please enter a valid 10-digit mobile number'
            );
            return;
        }
        try {
            const [mName, mNumber] = await Promise.all([
                Storage.getItem(KEYS.MERCHANT_NAME),
                Storage.getItem(KEYS.MERCHANT_NUMBER),
            ]);
            const billData = {
                shopName: mName || 'சுஜி காய்கறி கடை',
                phone: mNumber || '9095938085',
                userName: customerName || (language === 'Tamil' ? 'விழா வாடிக்கையாளர்' : 'Event Customer'),
                customerPhone: customerMobile || undefined,
                billNumber: nextBillId,
                date: new Date().toLocaleString('en-IN'),
                mode: 'Function',
                language,
                notes: eventName ? `Event: ${eventName}` : undefined,
                items: validCart.map(i => ({
                    id: i.id,
                    name: i.tamilName || i.name,
                    tamilName: i.tamilName,
                    quantity: parseFloat(i.quantity) || 0,
                    price: parseFloat(i.price) || 0,
                    discount: 0,
                    total: parseFloat(i.total.toFixed(2)),
                })),
                subTotal: parseFloat(subtotal.toFixed(2)),
                discount: discountAmt,
                grandTotal: parseFloat(grandTotal.toFixed(2)),
            };
            const savedBill = await SyncManager.queueBill(billData);
            await generateBillPDF({...billData, billNumber: savedBill?.id || nextBillId}, { printDirect });
            Alert.alert('Success', 'Bill saved successfully!');
            setCart([]); setCustomerName(''); setCustomerMobile(''); setEventName(''); setDiscount('0'); setBillPreviewVisible(false);
        } catch (err) {
            console.error(err);
            Alert.alert('Error', 'Could not complete bill');
        }
    };

    return (
        <View style={[styles.root, { backgroundColor: bg }]}>
            <StatusBar style="light" backgroundColor="#7C3AED" />
            
            <LinearGradient colors={isDark ? ['#1A1A1A', '#1A1A1A'] : ['#7C3AED', '#8B5CF6']} style={[styles.header, { paddingTop: insets.top + (Platform.OS === 'android' ? 14 : 8) }]}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}><Ionicons name="arrow-back" size={22} color="#FFF" /></TouchableOpacity>
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
                    <View style={[styles.infoInput, { flex: 1, backgroundColor: isDark ? '#252525' : '#F9F9FF', borderColor: borderCol }]}>
                        <Ionicons name="person" size={14} color={primary} />
                        <TextInput style={[styles.infoTextField, { color: textCol }]} placeholder="Customer name" placeholderTextColor={subCol} value={customerName} onChangeText={setCustomerName} />
                    </View>
                    <View style={[styles.infoInput, { flex: 1, borderColor: mobileError ? '#EF4444' : borderCol, backgroundColor: isDark ? '#252525' : '#F9F9FF' }]}>
                        <Ionicons name="call" size={14} color={mobileError ? '#EF4444' : primary} />
                        <TextInput style={[styles.infoTextField, { color: textCol }]} placeholder="Mobile no." placeholderTextColor={subCol} value={customerMobile} onChangeText={handleMobileChange} keyboardType="phone-pad" maxLength={10} />
                    </View>
                </View>
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
                    <LinearGradient colors={isDark ? ['#1A1A1A', '#1A1A1A'] : ['#7C3AED', '#8B5CF6']} style={[styles.invoiceFixedHeader, { paddingTop: insets.top + (Platform.OS === 'android' ? 14 : 8) }]}>
                        <View style={styles.invoiceHeaderNav}>
                            <TouchableOpacity onPress={() => setBillPreviewVisible(false)} style={styles.closeBtnCircle}><Ionicons name="arrow-back" size={20} color="#FFF" /></TouchableOpacity>
                            <View style={{ flex: 1, marginLeft: 12 }}>
                                <Text style={styles.invoiceHeaderTitle}>Bill Preview</Text>
                                <Text style={styles.invoiceHeaderSub}>Marriage & Event</Text>
                            </View>
                        </View>
                    </LinearGradient>

                    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }} showsVerticalScrollIndicator={false}>
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
                    </ScrollView>

                    <View style={[styles.stickyFooter, { backgroundColor: cardBg, borderTopColor: borderCol }]}>
                        <TouchableOpacity style={[styles.generateBtn, { backgroundColor: primary }]} onPress={handleFinalize} activeOpacity={0.8}>
                            <Text style={styles.generateBtnText}>Print & Save Bill</Text>
                        </TouchableOpacity>
                    </View>
                </SafeAreaView>
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
    searchField: { flex: 1, fontSize: 13, padding: 0 },
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
});
