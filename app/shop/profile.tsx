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
    Switch,
    FlatList
} from 'react-native';
import { ThermalPrinter, isPrinterAvailable } from '@/utils/thermalPrinter';
import * as ImagePicker from 'expo-image-picker';
import { useAppTheme, THEME_COLORS } from '@/context/ThemeContext';
import { KEYS, Storage } from '@/services/storage';
import { moderateScale, scale, verticalScale } from '@/utils/responsive';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { sqliteService } from '@/database/sqlite';

export default function MerchantProfileScreen() {
    const { isDark, language, toggleTheme, toggleLanguage, primaryColor, setPrimaryColor } = useAppTheme();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    
    // Merchant States
    const [merchantName, setMerchantName] = useState('');
    const [merchantLogo, setMerchantLogo] = useState('');
    const [merchantNumber, setMerchantNumber] = useState('');
    const [merchantAddress, setMerchantAddress] = useState('');
    const [mobileError, setMobileError] = useState(false);
    const [loading, setLoading] = useState(false);

    // Printer States
    const [printerStatus, setPrinterStatus] = useState(language === 'Tamil' ? 'இணைக்கப்படவில்லை' : 'Not Connected');
    const [isPrinterConnected, setIsPrinterConnected] = useState(false);
    const [printerSize, setPrinterSize] = useState<'2inch' | '3inch'>('3inch');
    const [isAutoPrint, setIsAutoPrint] = useState(false);
    const [pairedDevices, setPairedDevices] = useState<any[]>([]);
    const [isScanning, setIsScanning] = useState(false);
    const [showDeviceList, setShowDeviceList] = useState(false);

    useEffect(() => {
        loadProfile();
    }, []);

    const loadProfile = async () => {
        setLoading(true);
        try {
            const [mName, mLogo, mNumber, pSize, mAddr, lastPrinter, autoPrint] = await Promise.all([
                Storage.getItem(KEYS.MERCHANT_NAME),
                Storage.getItem(KEYS.MERCHANT_LOGO),
                Storage.getItem(KEYS.MERCHANT_NUMBER),
                Storage.getItem(KEYS.PRINTER_SIZE),
                Storage.getItem(KEYS.MERCHANT_ADDRESS),
                Storage.getItem(KEYS.LAST_PRINTER),
                Storage.getItem(KEYS.AUTO_PRINT)
            ]);

            if (mName) setMerchantName(mName);
            if (mLogo) setMerchantLogo(mLogo);
            if (mNumber) setMerchantNumber(mNumber);
            if (pSize) setPrinterSize(pSize);
            if (mAddr) setMerchantAddress(mAddr);
            if (autoPrint !== null) setIsAutoPrint(autoPrint);
            
            if (lastPrinter) {
                // Try connecting in the background
                setPrinterStatus(language === 'Tamil' ? 'மீண்டும் இணைக்கிறது...' : 'Reconnecting...');
                const conn = await ThermalPrinter.connectPrinter(lastPrinter);
                if (conn.success) {
                    setPrinterStatus(lastPrinter.name || lastPrinter.address);
                    setIsPrinterConnected(true);
                } else {
                    setPrinterStatus(language === 'Tamil' ? 'இணைப்பு தோல்வி' : 'Connection Failed');
                    setIsPrinterConnected(false);
                }
            }
        } catch (error) {
            console.error('Error loading profile:', error);
        } finally {
            setLoading(false);
        }
    };

    const scanDevices = async () => {
        if (!isPrinterAvailable) {
            Alert.alert('Info', 'Printer module only works on physical Android devices');
            return;
        }
        setIsScanning(true);
        try {
            const devices = await ThermalPrinter.discoverDevices();
            setPairedDevices(devices);
            setShowDeviceList(true);
        } catch (err) {
            console.error(err);
        } finally {
            setIsScanning(false);
        }
    };

    const connectToPrinter = async (device: any) => {
        setLoading(true);
        setShowDeviceList(false);
        setPrinterStatus(language === 'Tamil' ? 'இணைக்கிறது...' : 'Connecting...');
        
        try {
            const res = await ThermalPrinter.connectPrinter(device.address);
            if (res.success) {
                setPrinterStatus(device.name || device.address);
                setIsPrinterConnected(true);
                Alert.alert(language === 'Tamil' ? 'வெற்றி' : 'Success', language === 'Tamil' ? 'பிரிண்டர் இணைக்கப்பட்டது!' : 'Printer connected!');
            } else {
                setPrinterStatus(language === 'Tamil' ? 'தோல்வி' : 'Failed');
                setIsPrinterConnected(false);
                Alert.alert('Error', res.message);
            }
        } catch (err) {
            setPrinterStatus(language === 'Tamil' ? 'பிழை' : 'Error');
            setIsPrinterConnected(false);
        } finally {
            setLoading(false);
        }
    };

    const toggleAutoPrint = async (value: boolean) => {
        setIsAutoPrint(value);
        await Storage.setItem(KEYS.AUTO_PRINT, value);
    };

    const handleTestPrint = async () => {
        await ThermalPrinter.testPrint();
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
            Alert.alert(language === 'Tamil' ? 'பிழை' : "Invalid Mobile", language === 'Tamil' ? 'சரியான 10 இலக்க எண்ணை உள்ளிடவும்' : "Please enter a valid 10-digit mobile number");
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
                Storage.setItem(KEYS.MERCHANT_ADDRESS, merchantAddress)
            ]);

            Alert.alert(language === 'Tamil' ? 'வெற்றி' : "Success", language === 'Tamil' ? 'விவரங்கள் சேமிக்கப்பட்டன!' : "Profile updated successfully!");
            router.back();
        } catch {
            Alert.alert(language === 'Tamil' ? 'பிழை' : "Error", language === 'Tamil' ? 'சுயவிவர மாற்றங்களைச் சேமிப்பதில் தோல்வி.' : "Failed to save profile changes.");
        } finally {
            setLoading(false);
        }
    };

    const handleResetData = async (type: 'today' | 'month') => {
        const title = language === 'Tamil' ? 'தரவை மீட்டமை' : 'Reset Data';
        const message = type === 'today' 
            ? (language === 'Tamil' ? 'இன்றைய விற்பனை முழுவதையும் அழிக்க விரும்புகிறீர்களா?' : 'Are you sure you want to clear all of today\'s sales?')
            : (language === 'Tamil' ? 'இந்த மாத விற்பனை முழுவதையும் அழிக்க விரும்புகிறீர்களா?' : 'Are you sure you want to clear all sales for this month?');
        
        Alert.alert(
            title,
            message,
            [
                { text: language === 'Tamil' ? 'இல்லை' : 'Cancel', style: 'cancel' },
                { 
                    text: language === 'Tamil' ? 'ஆம்' : 'Yes, Reset', 
                    style: 'destructive',
                    onPress: async () => {
                        setLoading(true);
                        try {
                            const today = new Date().toISOString().split('T')[0];
                            const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
                            
                            if (type === 'today') {
                                await sqliteService.execute(`DELETE FROM bills WHERE created_at LIKE ?`, [`${today}%`]);
                            } else {
                                await sqliteService.execute(`DELETE FROM bills WHERE created_at >= ?`, [monthStart]);
                            }
                            
                            Alert.alert(language === 'Tamil' ? 'வெற்றி' : 'Success', language === 'Tamil' ? 'தரவு அழிக்கப்பட்டது!' : 'Data cleared successfully!');
                        } catch (error) {
                            console.error(error);
                            Alert.alert('Error', 'Failed to reset data');
                        } finally {
                            setLoading(false);
                        }
                    }
                }
            ]
        );
    };

    const background = isDark ? '#0F0F0F' : '#F8FAFC';
    const cardBg = isDark ? '#1E1E1E' : '#FFFFFF';
    const textColor = isDark ? '#FFF' : '#1E293B';
    const subTextColor = isDark ? '#94A3B8' : '#64748B';

    return (
        <View style={[styles.container, { backgroundColor: background }]}>
            <StatusBar style="light" backgroundColor={primaryColor} />
            
            <LinearGradient
                colors={[primaryColor, primaryColor]}
                style={[styles.header, { paddingTop: insets.top + (Platform.OS === 'android' ? verticalScale(10) : verticalScale(8)) }]}
            >
                <View style={styles.headerTop}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                        <Ionicons name="arrow-back" size={24} color={'#FFF'} />
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
                            style={[styles.input, { color: textColor, borderColor: isDark ? '#333' : '#E2E8F0', backgroundColor: isDark ? '#2C2C2E' : '#F8FAFC' }]}
                            value={merchantName}
                            onChangeText={setMerchantName}
                            placeholder={language === 'Tamil' ? 'எ.கா. சுஜி காய்கறி கடை' : "e.g. Suji Vegetables"}
                            placeholderTextColor="#94A3B8"
                        />
                    </View>

                    <View style={styles.inputWrapper}>
                        <Text style={[styles.inputLabel, { color: subTextColor }]}>{language === 'Tamil' ? 'தொடர்பு எண்' : 'Contact Number'}</Text>
                        <TextInput
                            style={[styles.input, { color: textColor, borderColor: mobileError ? '#EF4444' : (isDark ? '#333' : '#E2E8F0'), backgroundColor: isDark ? '#2C2C2E' : '#F8FAFC' }]}
                            value={merchantNumber}
                            onChangeText={handleMobileChange}
                            placeholder={language === 'Tamil' ? '90959 38085' : "e.g. 90959 38085"}
                            placeholderTextColor="#94A3B8"
                            keyboardType="phone-pad"
                            maxLength={10}
                        />
                    </View>

                    <View style={styles.inputWrapper}>
                        <Text style={[styles.inputLabel, { color: subTextColor }]}>{language === 'Tamil' ? 'கடை முகவரி' : 'Shop Address'}</Text>
                        <TextInput
                            style={[styles.input, { height: verticalScale(60), textAlignVertical: 'top', paddingTop: 10, color: textColor, borderColor: isDark ? '#333' : '#E2E8F0', backgroundColor: isDark ? '#2C2C2E' : '#F8FAFC' }]}
                            value={merchantAddress}
                            onChangeText={setMerchantAddress}
                            placeholder={language === 'Tamil' ? 'எ.கா. மெயின் ரோடு, சென்னை' : "e.g. Main Road, Chennai"}
                            placeholderTextColor="#94A3B8"
                            multiline
                            numberOfLines={2}
                        />
                    </View>
                </View>

                {/* Printer Settings Card */}
                <View style={[styles.card, { backgroundColor: cardBg }]}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
                        <Text style={[styles.sectionCardTitle, { color: textColor, marginBottom: 0 }]}>
                            {language === 'Tamil' ? 'பிரிண்டர் அமைப்புகள்' : 'Printer Settings'}
                        </Text>
                        {isPrinterConnected && (
                            <TouchableOpacity onPress={handleTestPrint} style={styles.testBtn}>
                                <Text style={styles.testBtnText}>{language === 'Tamil' ? 'பரிசோதனை' : 'Test Print'}</Text>
                            </TouchableOpacity>
                        )}
                    </View>

                    <View style={styles.settingRow}>
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.settingLabel, { color: textColor }]}>
                                {language === 'Tamil' ? 'தானியங்கி பிரிண்ட்' : 'Auto Print After Save'}
                            </Text>
                            <Text style={[styles.settingHint, { color: subTextColor }]}>
                                {language === 'Tamil' ? 'சேமித்தவுடன் தானாக பிரிண்ட் செய்ய' : 'Print instantly after saving invoice'}
                            </Text>
                        </View>
                        <Switch
                            value={isAutoPrint}
                            onValueChange={toggleAutoPrint}
                            trackColor={{ false: '#767577', true: primaryColor + '80' }}
                            thumbColor={isAutoPrint ? primaryColor : '#f4f3f4'}
                        />
                    </View>

                    <View style={styles.menuDivider} />

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
                            <Text style={[styles.settingHint, { color: isPrinterConnected ? primaryColor : '#FF4444' }]}>
                                {printerStatus}
                            </Text>
                        </View>
                        <TouchableOpacity 
                            onPress={scanDevices}
                            disabled={isScanning}
                            style={[styles.miniBtn, { backgroundColor: primaryColor + '15' }]}
                        >
                            {isScanning ? (
                                <ActivityIndicator size="small" color={primaryColor} />
                            ) : (
                                <Text style={{ color: primaryColor, fontWeight: '800', fontSize: 12 }}>
                                    {language === 'Tamil' ? 'தேடுக' : 'Scan'}
                                </Text>
                            )}
                        </TouchableOpacity>
                    </View>

                    {showDeviceList && (
                        <View style={styles.deviceListContainer}>
                            <Text style={styles.deviceListTitle}>{language === 'Tamil' ? 'கிடைக்கும் சாதனங்கள்' : 'Available Devices'}</Text>
                            {pairedDevices.length > 0 ? (
                                pairedDevices.map((item, index) => (
                                    <TouchableOpacity 
                                        key={index} 
                                        style={styles.deviceItem}
                                        onPress={() => connectToPrinter(item)}
                                    >
                                        <Ionicons name="print-outline" size={20} color={textColor} />
                                        <View style={{ flex: 1, marginLeft: 10 }}>
                                            <Text style={[styles.deviceName, { color: textColor, marginLeft: 0 }]}>{item.name || 'Unknown Device'}</Text>
                                            <Text style={styles.deviceAddress}>{item.address}</Text>
                                        </View>
                                        <View style={[styles.pairStatusBadge, { backgroundColor: item.name ? '#4ADE8020' : '#94A3B820' }]}>
                                            <Text style={[styles.pairStatusText, { color: item.name ? '#4ADE80' : '#94A3B8' }]}>
                                                {item.type === 'paired' || (item.name && item.name.length > 0) ? 'PAIRED' : 'NEW'}
                                            </Text>
                                        </View>
                                    </TouchableOpacity>
                                ))
                            ) : (
                                <Text style={styles.noDeviceText}>{language === 'Tamil' ? 'சாதனங்கள் எதுவும் இல்லை' : 'No devices found'}</Text>
                            )}
                            <TouchableOpacity onPress={() => setShowDeviceList(false)} style={styles.closeListBtn}>
                                <Text style={styles.closeListText}>{language === 'Tamil' ? 'மூடுக' : 'Close'}</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>

                {/* Business Management Card */}
                <View style={[styles.card, { backgroundColor: cardBg }]}>
                    <Text style={[styles.sectionCardTitle, { color: textColor }]}>
                        {language === 'Tamil' ? 'வணிக மேலாண்மை' : 'Business Management'}
                    </Text>

                    <TouchableOpacity style={styles.menuListItem} onPress={() => router.push('/shop/customers')}>
                        <View style={[styles.menuIconBox, { backgroundColor: '#3B82F615' }]}>
                            <Ionicons name="people" size={20} color="#3B82F6" />
                        </View>
                        <Text style={[styles.menuListText, { color: textColor }]}>
                            {language === 'Tamil' ? 'வாடிக்கையாளர் விவரங்கள்' : 'Manage Customers'}
                        </Text>
                        <Feather name="chevron-right" size={18} color={subTextColor} />
                    </TouchableOpacity>
                </View>

                {/* UI Theme Settings Card */}
                <View style={[styles.card, { backgroundColor: cardBg }]}>
                    <Text style={[styles.sectionCardTitle, { color: textColor }]}>
                        {language === 'Tamil' ? 'தோற்றம் மற்றும் மொழி' : 'Theme & Language'}
                    </Text>

                    <View style={styles.settingRow}>
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.settingLabel, { color: textColor }]}>{language === 'Tamil' ? 'இருண்ட பயன்முறை' : 'Dark Mode'}</Text>
                        </View>
                        <Switch value={isDark} onValueChange={toggleTheme} trackColor={{ false: '#767577', true: primaryColor + '80' }} thumbColor={isDark ? primaryColor : '#f4f3f4'} />
                    </View>

                    <View style={styles.menuDivider} />

                    <View style={styles.settingRow}>
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.settingLabel, { color: textColor }]}>{language === 'Tamil' ? 'மொழி' : 'Language'}</Text>
                        </View>
                        <View style={styles.langSelector}>
                           <TouchableOpacity onPress={() => language !== 'Tamil' && toggleLanguage()} style={[styles.langOption, language === 'Tamil' && { backgroundColor: primaryColor, borderColor: primaryColor }]}>
                               <Text style={[styles.langText, language === 'Tamil' && { color: '#FFF' }]}>தமிழ்</Text>
                           </TouchableOpacity>
                           <TouchableOpacity onPress={() => language !== 'English' && toggleLanguage()} style={[styles.langOption, language === 'English' && { backgroundColor: primaryColor, borderColor: primaryColor }]}>
                               <Text style={[styles.langText, language === 'English' && { color: '#FFF' }]}>ENG</Text>
                           </TouchableOpacity>
                        </View>
                    </View>
                </View>

                <TouchableOpacity style={[styles.saveBtn, { backgroundColor: primaryColor }]} onPress={saveProfile} disabled={loading}>
                    {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveBtnText}>{language === 'Tamil' ? 'சுயவிவரத்தைப் புதுப்பி' : 'Update Profile'}</Text>}
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
        elevation: 8,
    },
    headerTop: { flexDirection: 'row', alignItems: 'center' },
    backBtn: { width: scale(38), height: scale(38), borderRadius: scale(12), backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', marginRight: scale(15) },
    headerTitle: { fontSize: moderateScale(20), fontWeight: '900', color: '#FFF' },
    headerSubtitle: { fontSize: moderateScale(13), color: 'rgba(255,255,255,0.85)', fontWeight: '600', marginTop: verticalScale(2) },
    scrollContent: { padding: scale(16) },
    card: { borderRadius: scale(20), padding: scale(16), marginBottom: verticalScale(16), elevation: 3 },
    inputWrapper: { marginBottom: verticalScale(16) },
    inputLabel: { fontSize: moderateScale(13), fontWeight: '700', marginBottom: verticalScale(8) },
    input: { height: verticalScale(50), borderRadius: scale(14), borderWidth: 1.5, paddingHorizontal: scale(16), fontSize: moderateScale(15), fontWeight: '600' },
    saveBtn: { height: verticalScale(60), borderRadius: scale(20), alignItems: 'center', justifyContent: 'center', marginTop: 10 },
    saveBtnText: { color: '#FFF', fontSize: moderateScale(18), fontWeight: '900' },
    sectionCardTitle: { fontSize: moderateScale(17), fontWeight: '800', marginBottom: verticalScale(16) },
    menuListItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: verticalScale(12) },
    menuIconBox: { width: scale(38), height: scale(38), borderRadius: scale(10), alignItems: 'center', justifyContent: 'center', marginRight: scale(14) },
    menuListText: { flex: 1, fontSize: moderateScale(15), fontWeight: '700' },
    menuDivider: { height: 1, width: '100%', backgroundColor: '#F1F5F9', marginVertical: 12 },
    miniBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
    settingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    settingLabel: { fontSize: moderateScale(15), fontWeight: '700' },
    settingHint: { fontSize: moderateScale(11), marginTop: 2 },
    sizeSelector: { flexDirection: 'row', gap: 12, marginTop: 8 },
    sizeOption: { flex: 1, height: 44, borderRadius: 10, borderWidth: 1.5, borderColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center' },
    sizeOptionText: { fontSize: moderateScale(13), fontWeight: '700', color: '#64748B' },
    testBtn: { backgroundColor: '#10B98115', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 },
    testBtnText: { color: '#10B981', fontWeight: 'bold', fontSize: 12 },
    deviceListContainer: { marginTop: 15, padding: 10, backgroundColor: '#F1F5F9', borderRadius: 12 },
    deviceListTitle: { fontWeight: 'bold', marginBottom: 10, color: '#475569' },
    deviceItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
    deviceName: { flex: 1, fontWeight: '600', marginLeft: 10 },
    deviceAddress: { fontSize: 10, color: '#94A3B8' },
    noDeviceText: { textAlign: 'center', color: '#94A3B8', padding: 10 },
    closeListBtn: { marginTop: 10, alignItems: 'center' },
    closeListText: { color: '#3B82F6', fontWeight: 'bold' },
    langSelector: { flexDirection: 'row', gap: 8 },
    langOption: { paddingHorizontal: scale(12), paddingVertical: verticalScale(6), borderRadius: scale(8), borderWidth: 1.5, borderColor: '#E2E8F0' },
    langText: { fontSize: moderateScale(12), fontWeight: '800', color: '#64748B' },
    pairStatusBadge: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    pairStatusText: {
        fontSize: 9,
        fontWeight: 'bold',
    },
});
