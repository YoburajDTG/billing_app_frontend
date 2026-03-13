import { Feather, Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    Image,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
    ActivityIndicator
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useAppTheme } from '@/context/ThemeContext';
import { KEYS, Storage } from '@/services/storage';
import { moderateScale, scale, verticalScale } from '@/utils/responsive';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

export default function MerchantProfileScreen() {
    const { isDark, language } = useAppTheme();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    
    const [loading, setLoading] = useState(false);
    const [merchantName, setMerchantName] = useState('');
    const [merchantLogo, setMerchantLogo] = useState('');
    const [merchantNumber, setMerchantNumber] = useState('');

    useEffect(() => {
        loadProfile();
    }, []);

    const loadProfile = async () => {
        setLoading(true);
        try {
            const [mName, mLogo, mNumber] = await Promise.all([
                Storage.getItem(KEYS.MERCHANT_NAME),
                Storage.getItem(KEYS.MERCHANT_LOGO),
                Storage.getItem(KEYS.MERCHANT_NUMBER)
            ]);

            if (mName) setMerchantName(mName);
            if (mLogo) setMerchantLogo(mLogo);
            if (mNumber) setMerchantNumber(mNumber);
        } catch (error) {
            console.error('Error loading profile:', error);
        } finally {
            setLoading(false);
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
        if (!merchantName.trim()) {
            Alert.alert(language === 'Tamil' ? 'சரிபார்ப்பு' : "Validation", language === 'Tamil' ? 'கடை பெயர் தேவை' : "Shop name is required");
            return;
        }
        setLoading(true);
        try {
            await Promise.all([
                Storage.setItem(KEYS.MERCHANT_NAME, merchantName),
                Storage.setItem(KEYS.MERCHANT_LOGO, merchantLogo),
                Storage.setItem(KEYS.MERCHANT_NUMBER, merchantNumber)
            ]);

            Alert.alert(language === 'Tamil' ? 'வெற்றி' : "Success", language === 'Tamil' ? 'விவரங்கள் சேமிக்கப்பட்டன!' : "Profile updated successfully!");
            router.back();
        } catch (error) {
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
                colors={['#FF8C00', '#FFA500']}
                style={[styles.header, { paddingTop: insets.top + verticalScale(20) }]}
            >
                <View style={styles.headerDecor} />
                <View style={styles.headerTop}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                        <Ionicons name="arrow-back" size={24} color="#FF8C00" />
                    </TouchableOpacity>
                    <View>
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
                            placeholder={language === 'Tamil' ? 'எ.கா. சுஜி காய்கறிகள்' : "e.g. Suji Vegetables"}
                            placeholderTextColor="#94A3B8"
                        />
                    </View>

                    <View style={styles.inputWrapper}>
                        <Text style={[styles.inputLabel, { color: subTextColor }]}>{language === 'Tamil' ? 'தொடர்பு எண்' : 'Contact Number'}</Text>
                        <TextInput
                            style={[styles.input, { color: textColor, borderColor: isDark ? '#333' : '#E2E8F0', backgroundColor: isDark ? '#2C2C2C' : '#F8FAFC' }]}
                            value={merchantNumber}
                            onChangeText={setMerchantNumber}
                            placeholder={language === 'Tamil' ? '90959 38085' : "e.g. 90959 38085"}
                            placeholderTextColor="#94A3B8"
                            keyboardType="phone-pad"
                        />
                    </View>

                    <View style={styles.inputWrapper}>
                        <Text style={[styles.inputLabel, { color: subTextColor }]}>{language === 'Tamil' ? 'அதிகாரப்பூர்வ சின்னம் (Logo)' : 'Official Logo'}</Text>
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
                                        <Feather name="camera" size={28} color={primaryColor} />
                                    </View>
                                    <Text style={[styles.logoHint, { color: primaryColor }]}>{language === 'Tamil' ? 'படம் தேர்ந்தெடுக்கவும்' : 'Select Image'}</Text>
                                </View>
                            )}
                        </TouchableOpacity>
                        {merchantLogo ? (
                            <TouchableOpacity style={styles.changeLogoBtn} onPress={pickImage}>
                                <Text style={{ color: primaryColor, fontWeight: '700', fontSize: moderateScale(13) }}>{language === 'Tamil' ? 'லோகோவை மாற்றவும்' : 'Change Logo'}</Text>
                            </TouchableOpacity>
                        ) : null}
                    </View>
                </View>
                
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
                            {language === 'Tamil' ? 'வாடிக்கையாளர் விவரங்கள்' : 'Customer Details'}
                        </Text>
                        <Feather name="chevron-right" size={18} color={subTextColor} />
                    </TouchableOpacity>

                    <View style={[styles.menuDivider, { backgroundColor: isDark ? '#333' : '#F1F5F9' }]} />

                    <TouchableOpacity 
                        style={styles.menuListItem} 
                        onPress={() => router.push('/shop/prices')}
                        activeOpacity={0.7}
                    >
                        <View style={[styles.menuIconBox, { backgroundColor: primaryColor + '15' }]}>
                            <Ionicons name="pricetag" size={20} color={primaryColor} />
                        </View>
                        <Text style={[styles.menuListText, { color: textColor }]}>
                            {language === 'Tamil' ? 'விலை நிர்ணயம்' : 'Set Prices'}
                        </Text>
                        <Feather name="chevron-right" size={18} color={subTextColor} />
                    </TouchableOpacity>
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
        alignItems: 'center',
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
    headerTitle: {
        fontSize: moderateScale(26),
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
    scrollContent: { padding: scale(20) },
    card: {
        borderRadius: scale(24),
        padding: scale(22),
        marginBottom: verticalScale(25),
        elevation: 3,
        shadowColor: '#000',
        shadowOpacity: 0.05,
        shadowRadius: 15,
        shadowOffset: { width: 0, height: 8 },
    },
    inputWrapper: { marginBottom: verticalScale(20) },
    inputLabel: { fontSize: moderateScale(13), fontWeight: '700', marginBottom: verticalScale(8), letterSpacing: 0.3 },
    input: { height: verticalScale(56), borderRadius: scale(16), borderWidth: 1.5, paddingHorizontal: scale(18), fontSize: moderateScale(16), fontWeight: '600' },
    logoPicker: {
        height: scale(160),
        borderRadius: scale(24),
        borderWidth: 2,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        backgroundColor: '#F8FAFC',
    },
    logoPreview: { width: '100%', height: '100%', resizeMode: 'cover' },
    placeholderLogo: { alignItems: 'center' },
    logoIconCircle: { width: scale(60), height: scale(60), borderRadius: scale(30), alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
    logoHint: { fontSize: moderateScale(14), fontWeight: '800' },
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
    },
});
