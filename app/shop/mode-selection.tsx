import React from 'react';
import {
    StyleSheet,
    View,
    Text,
    TouchableOpacity,
    Platform,
    ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { useAppTheme } from '@/context/ThemeContext';
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeInUp, ZoomIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { moderateScale, scale, verticalScale } from '@/utils/responsive';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';

export default function ModeSelectionScreen() {
    const router = useRouter();
    const { user } = useAuth();
    const { isDark, toggleTheme, language } = useAppTheme();
    const insets = useSafeAreaInsets();

    const handleModeSelect = (mode: 'wholesale' | 'retail') => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        router.push({ pathname: '/shop', params: { mode } });
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
                style={[styles.hero, { paddingTop: insets.top + verticalScale(40) }]}
            >
                <View style={styles.headerDecor} />
                <Animated.View entering={ZoomIn.duration(600)} style={styles.avatarCircle}>
                    <Text style={styles.avatarText}>{user?.username?.charAt(0).toUpperCase() || 'S'}</Text>
                </Animated.View>
                <Animated.Text entering={FadeInDown.delay(200)} style={styles.greeting}>{language === 'Tamil' ? 'மீண்டும் வருக,' : 'Welcome back,'}</Animated.Text>
                <Animated.Text entering={FadeInDown.delay(300)} style={styles.userName}>{user?.username || (language === 'Tamil' ? 'உரிமையாளர்' : 'Owner')}</Animated.Text>
                <Animated.Text entering={FadeInDown.delay(400)} style={styles.shopName}>{user?.shopName || 'SUJI VEGETABLES'}</Animated.Text>
                
                <View style={styles.heroActions}>
                    <TouchableOpacity onPress={toggleTheme} style={styles.roundActionBtn}>
                        <Ionicons name={isDark ? "sunny" : "moon"} size={22} color="#FF8C00" />
                    </TouchableOpacity>
                </View>
            </LinearGradient>

            <ScrollView 
                contentContainerStyle={[
                    styles.scrollContent, 
                    { 
                        flexGrow: 1,
                        paddingBottom: Math.max(insets.bottom, verticalScale(24)) 
                    }
                ]} 
                showsVerticalScrollIndicator={false}
            >
                <Animated.Text entering={FadeInUp.delay(500)} style={[styles.sectionTitle, { color: subTextColor }]}>{language === 'Tamil' ? 'பில்லிங் முறையைத் தேர்ந்தெடுக்கவும்' : 'CHOOSE BILLING MODE'}</Animated.Text>
                
                <View style={styles.cardsGrid}>
                    <Animated.View entering={FadeInUp.delay(600).springify()}>
                        <TouchableOpacity 
                            style={[styles.modeCard, { backgroundColor: cardBg }]} 
                            onPress={() => handleModeSelect('retail')}
                            activeOpacity={0.85}
                        >
                            <View style={[styles.modeIconCircle, { backgroundColor: primaryColor + '10' }]}>
                                <MaterialCommunityIcons name="shopping" size={36} color={primaryColor} />
                            </View>
                            <View style={styles.modeTextCol}>
                                <Text style={[styles.modeName, { color: textColor }]}>{language === 'Tamil' ? 'சில்லறை விற்பனை முறை' : 'Retail Mode'}</Text>
                                <Text style={[styles.modeTamil, { color: primaryColor }]}>சில்லறை விற்பனை</Text>
                                <Text style={[styles.modeDesc, { color: subTextColor }]}>{language === 'Tamil' ? 'தனிநபர் விற்பனைக்கான விரைவான பில்லிங்' : 'Quick individual billing with auto-suggest'}</Text>
                            </View>
                            <Feather name="chevron-right" size={24} color={subTextColor} />
                        </TouchableOpacity>
                    </Animated.View>

                    <Animated.View entering={FadeInUp.delay(700).springify()}>
                        <TouchableOpacity 
                            style={[styles.modeCard, { backgroundColor: cardBg }]} 
                            onPress={() => handleModeSelect('wholesale')}
                            activeOpacity={0.85}
                        >
                            <View style={[styles.modeIconCircle, { backgroundColor: '#3B82F610' }]}>
                                <MaterialCommunityIcons name="package-variant-closed" size={36} color="#3B82F6" />
                            </View>
                            <View style={styles.modeTextCol}>
                                <Text style={[styles.modeName, { color: textColor }]}>{language === 'Tamil' ? 'மொத்த விற்பனை முறை' : 'Wholesale Mode'}</Text>
                                <Text style={[styles.modeTamil, { color: '#3B82F6' }]}>மொத்த விற்பனை</Text>
                                <Text style={[styles.modeDesc, { color: subTextColor }]}>{language === 'Tamil' ? 'மொத்த ஆர்டர்கள் மற்றும் தள்ளுபடிகள்' : 'Bulk orders with crate tracking and discounts'}</Text>
                            </View>
                            <Feather name="chevron-right" size={24} color={subTextColor} />
                        </TouchableOpacity>
                    </Animated.View>

                    <Animated.View entering={FadeInUp.delay(800).springify()}>
                        <TouchableOpacity 
                            style={[styles.modeCard, { backgroundColor: cardBg }]} 
                            onPress={() => router.push('/shop/dashboard')}
                            activeOpacity={0.85}
                        >
                            <View style={[styles.modeIconCircle, { backgroundColor: '#10B98110' }]}>
                                <MaterialCommunityIcons name="view-dashboard" size={36} color="#10B981" />
                            </View>
                            <View style={styles.modeTextCol}>
                                <Text style={[styles.modeName, { color: textColor }]}>{language === 'Tamil' ? 'முகப்புத் திரை' : 'Dashboard'}</Text>
                                <Text style={[styles.modeTamil, { color: '#10B981' }]}>முகப்பு தகவல்கள்</Text>
                                <Text style={[styles.modeDesc, { color: subTextColor }]}>{language === 'Tamil' ? 'விற்பனை அறிக்கைகள் மற்றும் இருப்பைக் காண்க' : 'View sales reports, inventory and history'}</Text>
                            </View>
                            <Feather name="chevron-right" size={24} color={subTextColor} />
                        </TouchableOpacity>
                    </Animated.View>
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    hero: {
        paddingHorizontal: scale(30),
        paddingBottom: verticalScale(40),
        borderBottomLeftRadius: scale(40),
        borderBottomRightRadius: scale(40),
        alignItems: 'center',
        overflow: 'hidden',
    },
    headerDecor: {
        position: 'absolute',
        width: scale(300),
        height: scale(300),
        borderRadius: scale(150),
        backgroundColor: 'rgba(255,255,255,0.12)',
        top: -scale(100),
        right: -scale(80),
    },
    avatarCircle: {
        width: scale(80),
        height: scale(80),
        borderRadius: scale(30),
        backgroundColor: '#FFF',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: verticalScale(20),
        elevation: 10,
        shadowColor: '#000',
        shadowOpacity: 0.15,
        shadowRadius: 15,
        shadowOffset: { width: 0, height: 10 },
    },
    avatarText: { fontSize: moderateScale(36), fontWeight: '900', color: '#FF8C00' },
    greeting: { fontSize: moderateScale(16), fontWeight: '600', color: 'rgba(255,255,255,0.85)', marginBottom: 4 },
    userName: { fontSize: moderateScale(32), fontWeight: '900', color: '#FFF', marginBottom: 4, letterSpacing: -0.5 },
    shopName: { fontSize: moderateScale(14), fontWeight: '700', color: '#FFF', opacity: 0.9, letterSpacing: 1, textTransform: 'uppercase' },
    heroActions: {
        flexDirection: 'row',
        gap: scale(15),
        marginTop: verticalScale(25),
    },
    roundActionBtn: {
        width: scale(50),
        height: scale(50),
        borderRadius: scale(25),
        backgroundColor: '#FFF',
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 5,
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowRadius: 10,
    },
    scrollContent: { padding: scale(25), paddingTop: verticalScale(30) },
    sectionTitle: { fontSize: moderateScale(12), fontWeight: '800', letterSpacing: 2, marginBottom: verticalScale(20) },
    cardsGrid: { gap: verticalScale(16) },
    modeCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: scale(20),
        borderRadius: scale(24),
        elevation: 3,
        shadowColor: '#000',
        shadowOpacity: 0.05,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 },
    },
    modeIconCircle: {
        width: scale(64),
        height: scale(64),
        borderRadius: scale(20),
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: scale(18),
    },
    modeTextCol: { flex: 1 },
    modeName: { fontSize: moderateScale(20), fontWeight: '900', marginBottom: 2 },
    modeTamil: { fontSize: moderateScale(14), fontWeight: '800', marginBottom: 8 },
    modeDesc: { fontSize: moderateScale(12), fontWeight: '600', lineHeight: moderateScale(18) },
});
