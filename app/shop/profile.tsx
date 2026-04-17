import { Feather, Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
    ActivityIndicator,
    Platform,
    NativeModules
} from 'react-native';
import { ThermalPrinter } from '@/utils/thermalPrinter';
import * as ImagePicker from 'expo-image-picker';
import { useAppTheme } from '@/context/ThemeContext';
import { KEYS, Storage } from '@/services/storage';
import { moderateScale, scale, verticalScale } from '@/utils/responsive';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

export default function MerchantProfileScreen() {
    const { isDark, language, toggleTheme, toggleLanguage } = useAppTheme();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    
    const [merchantAddress, setMerchantAddress] = useState('');
    const [printerStatus, setPrinterStatus] = useState(language === 'Tamil' ? 'இணைக்கப்படவில்லை' : 'Not Connected');
    const [isPrinterConnected, setIsPrinterConnected] = useState(false);
    const [loading, setLoading] = useState(false);
    const [merchantName, setMerchantName] = useState('');
    const [merchantLogo, setMerchantLogo] = useState('');
    const [merchantNumber, setMerchantNumber] = useState('');
    const [mobileError, setMobileError] = useState(false);
    const [printerSize, setPrinterSize] = useState<'2inch' | '3inch'>('2inch');

    useEffect(() => {
        loadProfile();
    }, []);

    const loadProfile = async () => {
        setLoading(true);
        try {
            const [mName, mLogo, mNumber, pSize, mAddr, lastPrinter] = await Promise.all([
                Storage.getItem(KEYS.MERCHANT_NAME),
                Storage.getItem(KEYS.MERCHANT_LOGO),
                Storage.getItem(KEYS.MERCHANT_NUMBER),
                Storage.getItem(KEYS.PRINTER_SIZE),
                Storage.getItem('merchant_address'),
                Storage.getItem('last_printer')
            ]);

            if (mName) setMerchantName(mName);
            if (mLogo) setMerchantLogo(mLogo);
            if (mNumber) setMerchantNumber(mNumber);
            if (pSize) setPrinterSize(pSize);
            if (mAddr) setMerchantAddress(mAddr);
            
            if (lastPrinter) {
                setPrinterStatus(lastPrinter.name || lastPrinter.address);
                setIsPrinterConnected(true);
            }
        } catch (error) {
            console.error('Error loading profile:', error);
        } finally {
            setLoading(false);
        }
    };

    const scanAndConnectPrinter = async () => {
        try {
            setPrinterStatus(language === 'Tamil' ? 'தேடுகிறது...' : 'Scanning...');
            const devices = await ThermalPrinter.discoverDevices();
            if (devices && devices.length > 0) {
                const printer = devices[0];
                const success = await ThermalPrinter.connect(printer.address);
                if (success) {
                    await Storage.setItem('last_printer', printer);
                    setPrinterStatus(printer.name || printer.address);
                    setIsPrinterConnected(true);
                    Alert.alert(language === 'Tamil' ? 'வெற்றி' : 'Success', language === 'Tamil' ? 'பிரிண்டர் இணைக்கப்பட்டது!' : 'Printer connected!');
                }
            } else {
                setPrinterStatus(language === 'Tamil' ? 'பிரிண்டர் கிடைக்கவில்லை' : 'No printer found');
                setIsPrinterConnected(false);
            }
        } catch (err) {
            setPrinterStatus(language === 'Tamil' ? 'பிழை' : 'Error');
            setIsPrinterConnected(false);
        }
    };

    const isValidMobile = (num: string) => /^[6-9]\d{9}$/.test(num.trim());

    const handleMobileChange = (value: string) => {
        const digits = value.replace(/\D/g, '').slice(0, 10);
        setMerchantNumber(digits);
        if (digits.length > 0) {
            setMobileError(!isValidMobile(digits));
        } else {
            setMobileError(false);
        }
    };

    const pickImage = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert(language === 'Tamil' ? 'அனுமதி மறுக்கப்பட்டது' : 'Permission Denied', language === 'Tamil' ? 'மன்னிக்கவும், இதைச் செய்ய எங்களுக்கு கேலரி அனுமதி தேவை!' : 'Sorry, we need camera roll permissions to make this work!');
            return;
        }

        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.7,
        });

        if (!result.canceled) {
            setMerchantLogo(result.assets[0].uri);
        }
    };

    const saveProfile = async () => {
        if (merchantName.trim().length < 3) {
            Alert.alert(
                language === 'Tamil' ? 'சரிபார்ப்பு' : "Validation", 
                language === 'Tamil' ? 'கடை பெயர் குறைந்தது 3 எழுத்துக்கள் இருக்க வேண்டும்' : "Shop name must be at least 3 characters"
            );
            return;
        }

        if (merchantNumber.trim() && !isValidMobile(merchantNumber)) {
            Alert.alert(
                language === 'Tamil' ? 'பிழை' : "Invalid Mobile", 
                language === 'Tamil' ? 'சரியான 10 இலக்க எண்ணை உள்ளிடவும்' : "Please enter a valid 10-digit mobile number"
            );
            setMobileError(true);
            return;
        }

        setLoading(true);
        try {
            await Promise.all([
                Storage.setItem(KEYS.MERCHANT_NAME, merchantName),
                Storage.setItem(KEYS.MERCHANT_LOGO, merchantLogo),
                Storage.setItem(KEYS.MERCHANT_NUMBER, merchantNumber),
                Storage.setItem(KEYS.PRINTER_SIZE, printerSize),
                Storage.setItem('merchant_address', merchantAddress)
            ]);

            Alert.alert(language === 'Tamil' ? 'வெற்றி' : "Success", language === 'Tamil' ? 'விவரங்கள் சேமிக்கப்பட்டன!' : "Profile updated successfully!");
            router.back();
        } catch {
            Alert.alert(language === 'Tamil' ? 'பிழை' : "Error", language === 'Tamil' ? 'சுயவிவர மாற்றங்களைச் சேமிப்பதில் தோல்வி.' : "Failed to save profile changes.");
        } finally {
            setLoading(false);
        }
    };

    const primaryColor = '#FF8C00';
    const background = isDark ? '#0F0F0F' : '#F8FAFC';
    const cardBg = isDark ? '#1E1E1E' : '#FFFFFF';
    const textColor = isDark ? '#FFF' : '#1E293B';
    const subTextColor = isDark ? '#94A3B8' : '#64748B';

    return (
        <View style={[styles.container, { backgroundColor: background }]}>
            <StatusBar style="light" backgroundColor="#FF8C00" />
            
            <LinearGradient
                colors={['#FF8C00', '#FF8C00']}
                style={[styles.header, { paddingTop: insets.top + (Platform.OS === 'android' ? verticalScale(10) : verticalScale(8)) }]}
            >
                <View style={styles.headerDecor} />
                <View style={styles.headerTop}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                        <Ionicons name="arrow-back" size={24} color="#FF8C00" />
                    </TouchableOpacity>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.headerTitle}>{language === 'Tamil' ? 'கடை விவரம்' : 'Shop Profile'}</Text>
                        <Text style={styles.headerSubtitle}>{language === 'Tamil' ? 'உங்கள் வணிக அடையாளத்தை நிர்வகிக்கவும்' : 'Manage your business identity'}</Text>
                    </View>
                </View>
            </LinearGradient>

            <ScrollView 
                contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insets.bottom, verticalScale(20)) + verticalScale(20) }]} 
                showsVerticalScrollIndicator={false}
            >
                <View style={[styles.card, { backgroundColor: cardBg }]}>
                    <View style={styles.inputWrapper}>
                        <Text style={[styles.inputLabel, { color: subTextColor }]}>{language === 'Tamil' ? 'கடை பெயர்' : 'Shop Name'}</Text>
                        <TextInput
                            style={[styles.input, { color: textColor, borderColor: isDark ? '#333' : '#E2E8F0', backgroundColor: isDark ? '#2C2C2C' : '#F8FAFC' }]}
                            value={merchantName}
                            onChangeText={setMerchantName}
                            placeholder={language === 'Tamil' ? 'எ.கா. சுஜி காய்கறி கடை' : "e.g. Suji Vegetables"}
                            placeholderTextColor="#94A3B8"
                        />
                    </View>

                    <View style={styles.inputWrapper}>
                        <Text style={[styles.inputLabel, { color: subTextColor }]}>{language === 'Tamil' ? 'தொடர்பு எண்' : 'Contact Number'}</Text>
                        <TextInput
                            style={[
                                styles.input, 
                                { 
                                    color: textColor, 
                                    borderColor: mobileError ? '#EF4444' : (isDark ? '#333' : '#E2E8F0'), 
                                    backgroundColor: isDark ? '#2C2C2C' : '#F8FAFC' 
                                }
                            ]}
                            value={merchantNumber}
                            onChangeText={handleMobileChange}
                            placeholder={language === 'Tamil' ? '90959 38085' : "e.g. 90959 38085"}
                            placeholderTextColor="#94A3B8"
                            keyboardType="phone-pad"
                            maxLength={10}
                        />
                        {mobileError && (
                            <Text style={styles.errorText}>
                                {language === 'Tamil' ? 'சரியான 10 இலக்க எண்ணை உள்ளிடவும்' : 'Enter valid 10-digit number'}
                            </Text>
                        )}
                    </View>

                    <View style={styles.inputWrapper}>
                        <Text style={[styles.inputLabel, { color: subTextColor }]}>{language === 'Tamil' ? 'கடை முகவரி' : 'Shop Address'}</Text>
                        <TextInput
                            style={[styles.input, { height: verticalScale(60), textAlignVertical: 'top', paddingTop: 10, color: textColor, borderColor: isDark ? '#333' : '#E2E8F0', backgroundColor: isDark ? '#2C2C2C' : '#F8FAFC' }]}
                            value={merchantAddress}
                            onChangeText={setMerchantAddress}
                            placeholder={language === 'Tamil' ? 'எ.கா. மெயின் ரோடு, சென்னை' : "e.g. Main Road, Chennai"}
                            placeholderTextColor="#94A3B8"
                            multiline
                            numberOfLines={2}
                        />
                    </View>
                </View>

                {/* Business Management Card */}
                <View style={[styles.card, { backgroundColor: cardBg }]}>
                    <Text style={[styles.sectionCardTitle, { color: textColor }]}>
                        {language === 'Tamil' ? 'வணிக மேலாண்மை' : 'Business Management'}
                    </Text>

                    <TouchableOpacity 
                        style={styles.menuListItem}
                        onPress={() => router.push('/shop/customers')}
                        activeOpacity={0.7}
                    >
                        <View style={[styles.menuIconBox, { backgroundColor: '#3B82F615' }]}>
                            <Ionicons name="people" size={20} color="#3B82F6" />
                        </View>
                        <Text style={[styles.menuListText, { color: textColor }]}>
                            {language === 'Tamil' ? 'வாடிக்கையாளர் விவரங்கள்' : 'Manage Customers'}
                        </Text>
                        <Feather name="chevron-right" size={18} color={subTextColor} />
                    </TouchableOpacity>

                    <View style={styles.menuDivider} />

                    <TouchableOpacity 
                        style={styles.menuListItem}
                        onPress={() => router.push('/shop/prices')}
                        activeOpacity={0.7}
                    >
                        <View style={[styles.menuIconBox, { backgroundColor: '#FF8C0015' }]}>
                            <Ionicons name="pricetag" size={20} color="#FF8C00" />
                        </View>
                        <Text style={[styles.menuListText, { color: textColor }]}>
                            {language === 'Tamil' ? 'விலை நிர்ணயம்' : 'Set Daily Prices'}
                        </Text>
                        <Feather name="chevron-right" size={18} color={subTextColor} />
                    </TouchableOpacity>
                </View>

                {/* Hardware Settings Card */}
                <View style={[styles.card, { backgroundColor: cardBg }]}>
                    <Text style={[styles.sectionCardTitle, { color: textColor }]}>
                        {language === 'Tamil' ? 'பிரிண்டர் மற்றும் ஹார்டுவேர்' : 'Printer & Hardware'}
                    </Text>

                    <View style={styles.inputWrapper}>
                        <Text style={[styles.inputLabel, { color: subTextColor }]}>{language === 'Tamil' ? 'பிரிண்டர் அளவு' : 'Default Printer Size'}</Text>
                        <View style={styles.sizeSelector}>
                            <TouchableOpacity 
                                style={[styles.sizeOption, printerSize === '2inch' && { backgroundColor: primaryColor, borderColor: primaryColor }]}
                                onPress={() => setPrinterSize('2inch')}
                            >
                                <Text style={[styles.sizeOptionText, printerSize === '2inch' && { color: '#FFF' }]}>2-inch (58mm)</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                                style={[styles.sizeOption, printerSize === '3inch' && { backgroundColor: primaryColor, borderColor: primaryColor }]}
                                onPress={() => setPrinterSize('3inch')}
                            >
                                <Text style={[styles.sizeOptionText, printerSize === '3inch' && { color: '#FFF' }]}>3-inch (80mm)</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    <View style={styles.menuDivider} />

                    <View style={[styles.settingRow, { marginTop: 10 }]}>
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.settingLabel, { color: textColor }]}>
                                {language === 'Tamil' ? 'ப்ளூடூத் பிரிண்டர்' : 'Bluetooth Printer'}
                            </Text>
                            <Text style={[styles.settingHint, { color: isPrinterConnected ? '#FF8C00' : subTextColor }]}>
                                {printerStatus}
                            </Text>
                        </View>
                        <TouchableOpacity 
                            onPress={scanAndConnectPrinter}
                            style={[styles.miniBtn, { backgroundColor: primaryColor + '15' }]}
                        >
                            <Text style={{ color: primaryColor, fontWeight: '800', fontSize: 12 }}>
                                {language === 'Tamil' ? 'இணைக்கவும்' : 'Connect'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* App Settings Card */}
                <View style={[styles.card, { backgroundColor: cardBg }]}>
                    <Text style={[styles.sectionCardTitle, { color: textColor }]}>
                        {language === 'Tamil' ? 'பயன்பாட்டு அமைப்புகள்' : 'App Settings'}
                    </Text>

                    <View style={styles.settingRow}>
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.settingLabel, { color: textColor }]}>
                                {language === 'Tamil' ? 'இருண்ட பயன்முறை' : 'Dark Mode'}
                            </Text>
                            <Text style={[styles.settingHint, { color: subTextColor }]}>
                                {isDark 
                                    ? (language === 'Tamil' ? 'இரவு நேரத்திற்கு சிறந்தது' : 'Optimized for night use')
                                    : (language === 'Tamil' ? 'பகல் நேரத்திற்கு சிறந்தது' : 'Classic bright interface')}
                            </Text>
                        </View>
                        <TouchableOpacity 
                            onPress={toggleTheme}
                            activeOpacity={0.8}
                            style={[
                                styles.themeToggle, 
                                { backgroundColor: isDark ? primaryColor : '#E2E8F0' }
                            ]}
                        >
                            <View style={[
                                styles.themeToggleBall, 
                                isDark ? { transform: [{ translateX: scale(22) }], backgroundColor: '#FFF' } : { transform: [{ translateX: 0 }], backgroundColor: '#FFF' }
                            ]}>
                                <Ionicons name={isDark ? "moon" : "sunny"} size={14} color={isDark ? primaryColor : '#64748B'} />
                            </View>
                        </TouchableOpacity>
                    </View>

                    <View style={[styles.menuDivider, { backgroundColor: isDark ? '#333' : '#F1F5F9', marginVertical: verticalScale(15) }]} />

                    <View style={styles.settingRow}>
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.settingLabel, { color: textColor }]}>
                                {language === 'Tamil' ? 'மொழி தேர்வு' : 'Language'}
                            </Text>
                            <Text style={[styles.settingHint, { color: subTextColor }]}>
                                {language === 'Tamil' ? 'தமிழ் அல்லது ஆங்கிலம்' : 'Choose Tamil or English'}
                            </Text>
                        </View>
                        <View style={styles.langSelector}>
                           <TouchableOpacity 
                            onPress={() => language !== 'Tamil' && toggleLanguage()}
                            style={[styles.langOption, language === 'Tamil' && { backgroundColor: primaryColor, borderColor: primaryColor }]}
                           >
                               <Text style={[styles.langText, language === 'Tamil' && { color: '#FFF' }]}>தமிழ்</Text>
                           </TouchableOpacity>
                           <TouchableOpacity 
                            onPress={() => language !== 'English' && toggleLanguage()}
                            style={[styles.langOption, language === 'English' && { backgroundColor: primaryColor, borderColor: primaryColor }]}
                           >
                               <Text style={[styles.langText, language === 'English' && { color: '#FFF' }]}>ENG</Text>
                           </TouchableOpacity>
                        </View>
                    </View>
                </View>

                {/* Branding Card */}
                <View style={[styles.card, { backgroundColor: cardBg }]}>
                     <Text style={[styles.sectionCardTitle, { color: textColor }]}>
                        {language === 'Tamil' ? 'பிராண்டிங்' : 'Branding'}
                    </Text>
                    <View style={[styles.inputWrapper, { alignItems: 'center' }]}>
                        <Text style={[styles.inputLabel, { color: subTextColor, alignSelf: 'flex-start' }]}>{language === 'Tamil' ? 'அதிகாரப்பூர்வ சின்னம் (Logo)' : 'Official Logo'}</Text>
                        <TouchableOpacity 
                            style={[styles.logoPicker, { borderColor: isDark ? '#333' : '#E2E8F0', borderStyle: merchantLogo ? 'solid' : 'dashed' }]} 
                            onPress={pickImage}
                            activeOpacity={0.7}
                        >
                            {merchantLogo ? (
                                <Image source={{ uri: merchantLogo }} style={styles.logoPreview} />
                            ) : (
                                <View style={styles.placeholderLogo}>
                                    <View style={[styles.logoIconCircle, { backgroundColor: primaryColor + '15' }]}>
                                        <Feather name="camera" size={20} color={primaryColor} />
                                    </View>
                                </View>
                            )}
                        </TouchableOpacity>
                        {!merchantLogo && (
                            <Text style={[styles.logoHint, { color: primaryColor, marginTop: 8 }]}>{language === 'Tamil' ? 'படம் தேர்ந்தெடுக்கவும்' : 'Select Image'}</Text>
                        )}
                    </View>
                </View>

                <TouchableOpacity 
                    style={[styles.saveBtn, { backgroundColor: primaryColor }]} 
                    onPress={saveProfile}
                    disabled={loading}
                    activeOpacity={0.8}
                >
                    {loading ? (
                        <ActivityIndicator color="#FFF" />
                    ) : (
                        <Text style={styles.saveBtnText}>{language === 'Tamil' ? 'சுயவிவரத்தைப் புதுப்பி' : 'Update Profile'}</Text>
                    )}
                </TouchableOpacity>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        paddingHorizontal: scale(25),
        paddingBottom: verticalScale(20),
        borderBottomLeftRadius: scale(32),
        borderBottomRightRadius: scale(32),
        overflow: 'hidden',
        elevation: 8,
        shadowColor: '#FF8C00',
        shadowOpacity: 0.2,
        shadowOffset: { width: 0, height: 10 },
        shadowRadius: 15,
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
        alignItems: 'center',
    },
    backBtn: {
        width: scale(38),
        height: scale(38),
        borderRadius: scale(12),
        backgroundColor: '#FFF',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: scale(15),
        elevation: 5,
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowRadius: 10,
    },
    headerTitle: {
        fontSize: moderateScale(20),
        fontWeight: '900',
        color: '#FFF',
        letterSpacing: -0.5,
    },
    headerSubtitle: {
        fontSize: moderateScale(13),
        color: 'rgba(255,255,255,0.85)',
        fontWeight: '600',
        marginTop: verticalScale(2),
    },
    scrollContent: { padding: scale(16) },
    card: {
        borderRadius: scale(20),
        padding: scale(16),
        marginBottom: verticalScale(16),
        elevation: 3,
        shadowColor: '#000',
        shadowOpacity: 0.05,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
    },
    inputWrapper: { marginBottom: verticalScale(16) },
    inputLabel: { fontSize: moderateScale(13), fontWeight: '700', marginBottom: verticalScale(8), letterSpacing: 0.3 },
    input: { height: verticalScale(50), borderRadius: scale(14), borderWidth: 1.5, paddingHorizontal: scale(16), fontSize: moderateScale(15), fontWeight: '600' },
    logoPicker: {
        width: scale(90),
        height: scale(90),
        borderRadius: scale(45),
        borderWidth: 1.5,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        backgroundColor: '#F8FAFC',
        marginTop: verticalScale(5),
    },
    logoPreview: { width: '100%', height: '100%', resizeMode: 'cover' },
    placeholderLogo: { alignItems: 'center', justifyContent: 'center' },
    logoIconCircle: { width: scale(40), height: scale(40), borderRadius: scale(20), alignItems: 'center', justifyContent: 'center' },
    logoHint: { fontSize: moderateScale(12), fontWeight: '700' },
    changeLogoBtn: { alignSelf: 'center', marginTop: verticalScale(10), paddingVertical: 5, paddingHorizontal: 15 },
    saveBtn: {
        height: verticalScale(62),
        borderRadius: scale(20),
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 10,
        shadowColor: '#FF8C00',
        shadowOpacity: 0.35,
        shadowRadius: 15,
        shadowOffset: { width: 0, height: 10 },
    },
    saveBtnText: { color: '#FFF', fontSize: moderateScale(18), fontWeight: '900', letterSpacing: 0.5 },
    sectionCardTitle: {
        fontSize: moderateScale(17),
        fontWeight: '800',
        marginBottom: verticalScale(16),
        letterSpacing: -0.3,
    },
    menuListItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: verticalScale(12),
    },
    menuIconBox: {
        width: scale(38),
        height: scale(38),
        borderRadius: scale(10),
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: scale(14),
    },
    menuListText: {
        flex: 1,
        fontSize: moderateScale(15),
        fontWeight: '700',
    },
    menuDivider: {
        height: 1,
        width: '100%',
        backgroundColor: '#F1F5F9',
        marginVertical: 12,
    },
    miniBtn: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
    },
    errorText: {
        color: '#EF4444',
        fontSize: moderateScale(11),
        fontWeight: '700',
        marginTop: verticalScale(4),
        marginLeft: scale(4),
    },
    sizeSelector: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 8,
    },
    sizeOption: {
        flex: 1,
        height: 44,
        borderRadius: 10,
        borderWidth: 1.5,
        borderColor: '#E2E8F0',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'transparent',
    },
    sizeOptionText: {
        fontSize: moderateScale(13),
        fontWeight: '700',
        color: '#64748B',
    },
    sizeHint: {
        fontSize: moderateScale(10),
        marginTop: 6,
        fontStyle: 'italic',
    },
    settingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    settingLabel: {
        fontSize: moderateScale(15),
        fontWeight: '700',
    },
    settingHint: {
        fontSize: moderateScale(11),
        marginTop: 2,
    },
    themeToggle: {
        width: scale(52),
        height: scale(28),
        borderRadius: scale(14),
        padding: scale(3),
        justifyContent: 'center',
    },
    themeToggleBall: {
        width: scale(22),
        height: scale(22),
        borderRadius: scale(11),
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 2,
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowRadius: 2,
    },
    langSelector: {
        flexDirection: 'row',
        gap: 8,
    },
    langOption: {
        paddingHorizontal: scale(12),
        paddingVertical: verticalScale(6),
        borderRadius: scale(8),
        borderWidth: 1.5,
        borderColor: '#E2E8F0',
        alignItems: 'center',
        justifyContent: 'center',
    },
    langText: {
        fontSize: moderateScale(12),
        fontWeight: '800',
        color: '#64748B',
    },
});
