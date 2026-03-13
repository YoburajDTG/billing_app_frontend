import { useAppTheme } from '@/context/ThemeContext';
import { useRouter } from 'expo-router';
import { Customer, customerRepository } from '@/database/repositories/customerRepository';
import { moderateScale, scale, verticalScale } from '@/utils/responsive';
import { Feather, Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Modal, StyleSheet, Text, TextInput, TouchableOpacity, View, Platform, KeyboardAvoidingView } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

export default function CustomersScreen() {
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [modalVisible, setModalVisible] = useState(false);
    const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [address, setAddress] = useState('');
    const { isDark, language } = useAppTheme();
    const insets = useSafeAreaInsets();
    const router = useRouter();

    useEffect(() => {
        fetchCustomers();
    }, []);

    const fetchCustomers = async () => {
        setIsLoading(true);
        try {
            const data = await customerRepository.getAll();
            setCustomers(data);
        } catch (e) {
            console.error(e);
            Alert.alert(language === 'Tamil' ? 'பிழை' : 'Error', language === 'Tamil' ? 'வாடிக்கையாளர்களை ஏற்றுவதில் தோல்வி' : 'Failed to load customers');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async () => {
        if (!name.trim()) {
            Alert.alert(language === 'Tamil' ? 'சரிபார்ப்பு பிழை' : 'Validation Error', language === 'Tamil' ? 'வாடிக்கையாளர் பெயர் அவசியம்' : 'Customer Name is required');
            return;
        }

        try {
            if (editingCustomer) {
                await customerRepository.update(editingCustomer.id, { name, phone, address });
            } else {
                await customerRepository.create({ name, phone, address });
            }
            setModalVisible(false);
            resetForm();
            fetchCustomers();
        } catch (e) {
            console.error(e);
            Alert.alert(language === 'Tamil' ? 'பிழை' : 'Error', language === 'Tamil' ? 'வாடிக்கையாளரைச் சேமிப்பதில் தோல்வி' : 'Failed to save customer');
        }
    };

    const handleDelete = async (id: string) => {
        Alert.alert(language === 'Tamil' ? 'நீக்க உறுதிப்படுத்தவும்' : 'Confirm Delete', language === 'Tamil' ? 'இந்த வாடிக்கையாளரை நீக்க விரும்புகிறீர்களா?' : 'Are you sure you want to delete this customer?', [
            { text: language === 'Tamil' ? 'ரத்து' : 'Cancel', style: 'cancel' },
            {
                text: language === 'Tamil' ? 'நீக்கு' : 'Delete', style: 'destructive', onPress: async () => {
                    try {
                        await customerRepository.delete(id);
                        fetchCustomers();
                    } catch (e) {
                        Alert.alert(language === 'Tamil' ? 'பிழை' : 'Error', language === 'Tamil' ? 'வாடிக்கையாளரை நீக்குவதில் தோல்வி' : 'Failed to delete customer');
                    }
                }
            }
        ]);
    };

    const resetForm = () => {
        setName('');
        setPhone('');
        setAddress('');
        setEditingCustomer(null);
    };

    const openAddModal = () => {
        resetForm();
        setModalVisible(true);
    };

    const openEditModal = (customer: Customer) => {
        setEditingCustomer(customer);
        setName(customer.name);
        setPhone(customer.phone || '');
        setAddress(customer.address || '');
        setModalVisible(true);
    };

    const background = isDark ? '#0F0F0F' : '#F8FAFC';
    const cardBg = isDark ? '#1E1E1E' : '#FFFFFF';
    const textColor = isDark ? '#FFF' : '#1E293B';
    const subTextColor = isDark ? '#94A3B8' : '#64748B';
    const primaryColor = '#FF8C00';

    const renderItem = ({ item, index }: { item: Customer, index: number }) => (
        <Animated.View 
            entering={FadeInUp.delay(50 * index).duration(400)} 
            style={[styles.card, { backgroundColor: cardBg }]}
        >
            <View style={styles.cardTop}>
                <View style={[styles.avatarContainer, { backgroundColor: primaryColor + '10' }]}>
                    <Text style={[styles.avatarText, { color: primaryColor }]}>{item.name.charAt(0).toUpperCase()}</Text>
                </View>
                <View style={styles.cardMain}>
                    <Text style={[styles.nameText, { color: textColor }]}>{item.name}</Text>
                    {item.phone ? (
                        <View style={styles.infoRow}>
                            <Feather name="phone" size={12} color={subTextColor} />
                            <Text style={[styles.infoText, { color: subTextColor }]}>{item.phone}</Text>
                        </View>
                    ) : null}
                </View>
                <View style={styles.actionGroup}>
                    <TouchableOpacity onPress={() => openEditModal(item)} style={styles.iconBtn}>
                        <Feather name="edit-2" size={18} color="#94A3B8" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDelete(item.id)} style={styles.iconBtn}>
                        <Feather name="trash-2" size={18} color="#EF4444" />
                    </TouchableOpacity>
                </View>
            </View>
            
            {item.address ? (
                <View style={[styles.addressBox, { borderTopColor: isDark ? '#2D2D2D' : '#F1F5F9' }]}>
                    <Feather name="map-pin" size={12} color={subTextColor} style={{ marginTop: 2 }} />
                    <Text style={[styles.addressText, { color: subTextColor }]}>{item.address}</Text>
                </View>
            ) : null}
        </Animated.View>
    );

    return (
        <View style={[styles.container, { backgroundColor: background }]}>
            <StatusBar style="light" backgroundColor="#FF8C00" />
            
            <LinearGradient
                colors={['#FF8C00', '#FFA500']}
                style={[styles.header, { paddingTop: insets.top + verticalScale(20) }]}
            >
                <View style={styles.headerDecor} />
                <View style={styles.headerTop}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                        <Ionicons name="arrow-back" size={24} color="#FF8C00" />
                    </TouchableOpacity>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.headerTitle}>{language === 'Tamil' ? 'வாடிக்கையாளர்கள்' : 'Customer base'}</Text>
                        <Text style={styles.headerSubtitle}>{customers.length} {language === 'Tamil' ? 'மொத்த வாடிக்கையாளர்கள்' : 'total customers'}</Text>
                    </View>
                    <TouchableOpacity style={styles.addTrigger} onPress={openAddModal}>
                        <Ionicons name="add" size={28} color="#FF8C00" />
                    </TouchableOpacity>
                </View>
            </LinearGradient>

            {isLoading ? (
                <View style={styles.loaderBox}><ActivityIndicator size="large" color={primaryColor} /></View>
            ) : customers.length === 0 ? (
                <View style={styles.emptyBox}>
                    <View style={styles.emptyIconCircle}>
                        <Feather name="users" size={40} color="#CBD5E1" />
                    </View>
                    <Text style={[styles.emptyTitle, { color: textColor }]}>{language === 'Tamil' ? 'வாடிக்கையாளர்கள் யாரும் இல்லை' : 'No customers yet'}</Text>
                    <Text style={[styles.emptyDesc, { color: subTextColor }]}>{language === 'Tamil' ? 'உங்கள் வழக்கமான வாடிக்கையாளர்களை அவர்களின் விவரங்கள் மற்றும் வரலாற்றைக் கண்காணிக்கச் சேர்க்கவும்.' : 'Add your regular customers to keep track of their details and history.'}</Text>
                    <TouchableOpacity style={[styles.emptyAddBtn, { backgroundColor: primaryColor }]} onPress={openAddModal}>
                        <Text style={styles.emptyAddBtnText}>{language === 'Tamil' ? 'முதல் வாடிக்கையாளரைச் சேர்க்கவும்' : 'Add First Customer'}</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <FlatList
                    data={customers}
                    keyExtractor={(item) => item.id}
                    renderItem={renderItem}
                    contentContainerStyle={[styles.listContainer, { paddingBottom: Math.max(insets.bottom, verticalScale(20)) + verticalScale(20) }]}
                    showsVerticalScrollIndicator={false}
                />
            )}

            <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={() => setModalVisible(false)}>
                <KeyboardAvoidingView 
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined} 
                    style={styles.modalShade}
                >
                    <TouchableOpacity 
                        style={styles.modalBlur} 
                        activeOpacity={1} 
                        onPress={() => setModalVisible(false)} 
                    />
                    <Animated.View 
                        entering={FadeInDown.duration(300)} 
                        style={[styles.sheet, { 
                            backgroundColor: cardBg,
                            paddingBottom: Math.max(insets.bottom, verticalScale(20)) + scale(10)
                        }]}
                    >
                        <View style={styles.sheetHandle} />
                        <Text style={[styles.sheetTitle, { color: textColor }]}>
                            {editingCustomer ? (language === 'Tamil' ? 'விவரங்களை மாற்று' : 'Edit details') : (language === 'Tamil' ? 'புதிய வாடிக்கையாளர்' : 'New customer')}
                        </Text>

                        <View style={styles.inputWrapper}>
                            <Text style={[styles.inputLabel, { color: subTextColor }]}>{language === 'Tamil' ? 'பெயர்' : 'Display Name'}</Text>
                            <TextInput 
                                style={[styles.input, { color: textColor, borderColor: isDark ? '#333' : '#E2E8F0', backgroundColor: isDark ? '#2C2C2C' : '#F8FAFC' }]} 
                                value={name} 
                                onChangeText={setName} 
                                placeholder={language === 'Tamil' ? 'எ.கா. ராகுல் சர்மா' : "e.g. Rahul Sharma"} 
                                placeholderTextColor="#94A3B8"
                            />
                        </View>

                        <View style={styles.inputWrapper}>
                            <Text style={[styles.inputLabel, { color: subTextColor }]}>{language === 'Tamil' ? 'தொலைபேசி எண்' : 'Phone Number'}</Text>
                            <TextInput 
                                style={[styles.input, { color: textColor, borderColor: isDark ? '#333' : '#E2E8F0', backgroundColor: isDark ? '#2C2C2C' : '#F8FAFC' }]} 
                                value={phone} 
                                onChangeText={setPhone} 
                                keyboardType="phone-pad" 
                                placeholder={language === 'Tamil' ? '10 இலக்க மொபைல் எண்' : "10-digit mobile number"}
                                placeholderTextColor="#94A3B8"
                            />
                        </View>

                        <View style={styles.inputWrapper}>
                            <Text style={[styles.inputLabel, { color: subTextColor }]}>{language === 'Tamil' ? 'முகவரி / இருப்பிடம்' : 'Address / Location'}</Text>
                            <TextInput 
                                style={[styles.input, styles.textArea, { color: textColor, borderColor: isDark ? '#333' : '#E2E8F0', backgroundColor: isDark ? '#2C2C2C' : '#F8FAFC' }]} 
                                value={address} 
                                onChangeText={setAddress} 
                                multiline 
                                placeholder={language === 'Tamil' ? 'முழு முகவரி...' : "Full address or landmark..."}
                                placeholderTextColor="#94A3B8"
                            />
                        </View>

                        <View style={styles.sheetActions}>
                            <TouchableOpacity style={[styles.sheetBtn, styles.closeSheetBtn]} onPress={() => setModalVisible(false)}>
                                <Text style={[styles.closeSheetText, { color: subTextColor }]}>{language === 'Tamil' ? 'ரத்து' : 'Cancel'}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.sheetBtn, styles.saveSheetBtn, { backgroundColor: primaryColor }]} onPress={handleSave}>
                                <Text style={styles.saveSheetText}>{editingCustomer ? (language === 'Tamil' ? 'புதுப்பிக்கவும்' : 'Update') : (language === 'Tamil' ? 'பதிவு செய்' : 'Register')}</Text>
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
        overflow: 'hidden',
    },
    headerDecor: {
        position: 'absolute',
        width: scale(240),
        height: scale(240),
        borderRadius: scale(120),
        backgroundColor: 'rgba(255,255,255,0.1)',
        top: -scale(100),
        right: -scale(60),
    },
    headerTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: moderateScale(28),
        fontWeight: '900',
        color: '#FFF',
        letterSpacing: -0.5,
    },
    headerSubtitle: {
        fontSize: moderateScale(14),
        color: 'rgba(255,255,255,0.8)',
        fontWeight: '600',
        marginTop: verticalScale(2),
    },
    addTrigger: {
        width: scale(52),
        height: scale(52),
        borderRadius: scale(26),
        backgroundColor: '#FFF',
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 5 },
        shadowOpacity: 0.2,
        shadowRadius: 10,
    },
    backBtn: {
        width: scale(46),
        height: scale(46),
        borderRadius: scale(16),
        backgroundColor: '#FFF',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: scale(18),
        elevation: 5,
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowRadius: 10,
    },
    loaderBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    listContainer: { padding: scale(20), paddingBottom: verticalScale(40) },
    card: {
        borderRadius: scale(20),
        padding: scale(16),
        marginBottom: verticalScale(16),
        elevation: 3,
        shadowColor: '#000',
        shadowOpacity: 0.06,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 }
    },
    cardTop: { flexDirection: 'row', alignItems: 'center' },
    avatarContainer: {
        width: scale(48),
        height: scale(48),
        borderRadius: scale(16),
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: scale(14),
    },
    avatarText: { fontSize: moderateScale(22), fontWeight: '900' },
    cardMain: { flex: 1 },
    nameText: { fontSize: moderateScale(17), fontWeight: '800', marginBottom: verticalScale(2) },
    infoRow: { flexDirection: 'row', alignItems: 'center', gap: scale(6) },
    infoText: { fontSize: moderateScale(13), fontWeight: '600' },
    actionGroup: { flexDirection: 'row', gap: scale(4) },
    iconBtn: { padding: scale(8) },
    addressBox: {
        flexDirection: 'row',
        marginTop: verticalScale(14),
        paddingTop: verticalScale(12),
        borderTopWidth: 1,
        gap: scale(8),
    },
    addressText: { fontSize: moderateScale(13), fontWeight: '500', lineHeight: moderateScale(18), flex: 1 },
    emptyBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: scale(40) },
    emptyIconCircle: {
        width: scale(100),
        height: scale(100),
        borderRadius: scale(50),
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: verticalScale(20),
    },
    emptyTitle: { fontSize: moderateScale(20), fontWeight: '800', marginBottom: verticalScale(8) },
    emptyDesc: { fontSize: moderateScale(14), textAlign: 'center', lineHeight: moderateScale(22), marginBottom: verticalScale(30) },
    emptyAddBtn: { paddingHorizontal: scale(30), paddingVertical: verticalScale(15), borderRadius: scale(16), elevation: 5 },
    emptyAddBtnText: { color: '#FFF', fontWeight: '800', fontSize: moderateScale(16) },
    modalShade: { flex: 1, justifyContent: 'flex-end' },
    modalBlur: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
    sheet: {
        borderTopLeftRadius: scale(32),
        borderTopRightRadius: scale(32),
        padding: scale(25),
        paddingBottom: verticalScale(Platform.OS === 'ios' ? 40 : 25),
    },
    sheetHandle: {
        width: scale(40),
        height: verticalScale(5),
        backgroundColor: '#E2E8F0',
        borderRadius: 3,
        alignSelf: 'center',
        marginBottom: verticalScale(20),
    },
    sheetTitle: { fontSize: moderateScale(22), fontWeight: '900', marginBottom: verticalScale(25) },
    inputWrapper: { marginBottom: verticalScale(18) },
    inputLabel: { fontSize: moderateScale(13), fontWeight: '700', marginBottom: verticalScale(8), letterSpacing: 0.3 },
    input: { height: verticalScale(52), borderRadius: scale(16), borderWidth: 1.5, paddingHorizontal: scale(18), fontSize: moderateScale(16), fontWeight: '600' },
    textArea: { height: verticalScale(90), paddingVertical: verticalScale(15), textAlignVertical: 'top' },
    sheetActions: { flexDirection: 'row', gap: scale(15), marginTop: verticalScale(10) },
    sheetBtn: { flex: 1, height: verticalScale(58), borderRadius: scale(20), alignItems: 'center', justifyContent: 'center' },
    closeSheetBtn: { backgroundColor: 'transparent' },
    saveSheetBtn: { 
        elevation: 8,
        shadowColor: '#FF8C00',
        shadowOpacity: 0.3,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 6 }
    },
    closeSheetText: { fontSize: moderateScale(16), fontWeight: '700' },
    saveSheetText: { color: '#FFF', fontSize: moderateScale(18), fontWeight: '800' }
});
