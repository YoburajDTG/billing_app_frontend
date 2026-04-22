import { useAuth } from '@/context/AuthContext';
import { useAppTheme } from '@/context/ThemeContext';
import { sqliteService } from '@/database/sqlite';
import { moderateScale, scale, verticalScale } from '@/utils/responsive';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    Modal,
    Platform,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

export default function DashboardScreen() {
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [stats, setStats] = useState({
        todaySales: 0,
        todayCount: 0,
        monthSales: 0,
        totalCustomers: 0,
        totalProducts: 0,
        recentInvoices: [] as any[],
        topProducts: [] as any[],
    });
    const [shopName, setShopName] = useState('');
    const [showTypeModal, setShowTypeModal] = useState(false);

    const { isDark, language, toggleLanguage, primaryColor } = useAppTheme();
    const { user } = useAuth();
    const insets = useSafeAreaInsets();
    const router = useRouter();


    useFocusEffect(
        useCallback(() => {
            fetchStats();
            loadShopSettings();
        }, [])
    );

    const loadShopSettings = async () => {
        const { KEYS, Storage } = require('@/services/storage');
        const mName = await Storage.getItem(KEYS.MERCHANT_NAME);
        if (mName) setShopName(mName);
    };

    const fetchStats = async () => {
        setLoading(true);
        try {
            const today = new Date().toISOString().split('T')[0];
            const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

            const todayRes = await sqliteService.queryOne(
                `SELECT SUM(total_amount) as total, COUNT(*) as count FROM bills WHERE created_at LIKE ?`,
                [`${today}%`]
            );
            const monthRes = await sqliteService.queryOne(
                `SELECT SUM(total_amount) as total FROM bills WHERE created_at >= ?`,
                [monthStart]
            );
            const custRes = await sqliteService.queryOne(`SELECT COUNT(*) as count FROM customers`);
            const prodRes = await sqliteService.queryOne(`SELECT COUNT(*) as count FROM vegetables`);
            
            const recentRes = await sqliteService.query(
                `SELECT id, total_amount, customer_name, created_at FROM bills ORDER BY created_at DESC LIMIT 8`
            );

            // Fetch Top Selling Products
            const topProducts = await sqliteService.query(
                `SELECT v.name, v.tamil_name, SUM(bi.quantity) as total_qty 
                 FROM bill_items bi 
                 JOIN vegetables v ON bi.vegetable_id = v.id 
                 GROUP BY bi.vegetable_id 
                 ORDER BY total_qty DESC 
                 LIMIT 4`
            );

            setStats({
                todaySales: todayRes?.total || 0,
                todayCount: todayRes?.count || 0,
                monthSales: monthRes?.total || 0,
                totalCustomers: custRes?.count || 0,
                totalProducts: prodRes?.count || 0,
                recentInvoices: recentRes || [],
                topProducts: topProducts || [],
            } as any);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleNewBill = (mode: 'retail' | 'wholesale') => {
        setShowTypeModal(false);
        router.push({ pathname: '/shop', params: { mode, timestamp: Date.now() } });
    };

    const handleFunctionBill = () => {
        setShowTypeModal(false);
        router.push('/shop/function-bill');
    };

    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return 'காலை வணக்கம்! ☀️';
        if (hour < 17) return 'மதிய வணக்கம்! 🌤️';
        return 'மாலை வணக்கம்! 🌙';
    };

    // Theme colors
    const bg = isDark ? '#0F0F0F' : '#F0F2F5';
    const cardBg = isDark ? '#1C1C1E' : '#FFFFFF';
    const textCol = isDark ? '#FFFFFF' : '#1A1C1E';
    const subCol = isDark ? '#8E8E93' : '#6B7280';
    const borderCol = isDark ? '#2C2C2E' : '#E5E7EB';
    const primary = primaryColor;
    const heroBg = isDark ? '#1C1C1E' : primaryColor;

    return (
        <View style={{ flex: 1, backgroundColor: bg }}>
            <StatusBar style={isDark ? 'light' : 'light'} backgroundColor={heroBg} />

            {/* ── FIXED TOP BAR ── */}
            <LinearGradient
                colors={isDark ? ['#1A1A1A', '#1A1A1A'] : [primaryColor, primaryColor]}
                style={[
                    styles.fixedHeader,
                    { paddingTop: insets.top + (Platform.OS === 'android' ? 15 : 10) }
                ]}
            >
                <View style={styles.heroTop}>
                    <View style={{ flex: 1 }}>
                        <Text style={[styles.greeting, { color: isDark ? subCol : 'rgba(255,255,255,0.85)' }]}>
                            {getGreeting()}
                        </Text>
                        <Text style={[styles.shopNameHero, { color: isDark ? textCol : '#FFF' }]} numberOfLines={1}>
                            {shopName || user?.shopName || (language === 'Tamil' ? 'சுஜி காய்கறி கடை' : 'SUJI VEGETABLES')}
                        </Text>
                    </View>

                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: scale(6) }}>
                        <View style={[styles.langToggleContainer, { backgroundColor: isDark ? '#2C2C2E' : 'rgba(255,255,255,0.2)' }]}>
                            <TouchableOpacity 
                                onPress={() => language !== 'English' && toggleLanguage()} 
                                style={[styles.langPill, language === 'English' && styles.langPillActive]}
                            >
                                <Text style={[styles.langPillText, language === 'English' && styles.langPillTextActive]}>EN</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                                onPress={() => language !== 'Tamil' && toggleLanguage()} 
                                style={[styles.langPill, language === 'Tamil' && styles.langPillActive]}
                            >
                                <Text style={[styles.langPillText, language === 'Tamil' && styles.langPillTextActive]}>தமிழ்</Text>
                            </TouchableOpacity>
                        </View>

                    </View>
                </View>
            </LinearGradient>

            <ScrollView
                style={{ flex: 1 }}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ 
                    flexGrow: 1,
                    paddingBottom: Math.max(insets.bottom, verticalScale(20))
                }}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={() => { setRefreshing(true); fetchStats(); }}
                        tintColor={primary}
                        colors={[primary]}
                    />
                }
            >
                {/* ── HERO BANNER (Scrollable) ── */}
                <LinearGradient
                    colors={isDark ? ['#1A1A1A', '#121212'] : [primaryColor, primaryColor]}
                    style={[styles.hero, { shadowColor: primaryColor }]}
                >
                    {/* Decorative circles */}
                    <View style={[styles.decor1, { opacity: isDark ? 0.03 : 0.1 }]} />
                    <View style={[styles.decor2, { opacity: isDark ? 0.02 : 0.08 }]} />

                    {/* Revenue Banner */}
                    <Animated.View entering={FadeInDown.delay(100).duration(500)}>
                        <LinearGradient
                            colors={isDark ? ['#252525', '#1E1E1E'] : ['rgba(255,255,255,0.3)', 'rgba(255,255,255,0.15)']}
                            style={styles.revenueBanner}
                        >
                            <View style={styles.revenueItem}>
                                <Text 
                                    style={[styles.revenueLabel, { color: isDark ? subCol : 'rgba(255,255,255,0.85)' }]}
                                    numberOfLines={1}
                                    adjustsFontSizeToFit
                                >
                                    {language === 'Tamil' ? 'இன்றைய விற்பனை' : 'Today\'s Sales'}
                                </Text>
                                <Text style={[styles.revenueValue, { color: '#FFF' }]}>
                                    ₹{Number(stats.todaySales).toLocaleString('en-IN')}
                                </Text>
                            </View>
                            <View style={[styles.revenueDivider, { backgroundColor: isDark ? borderCol : 'rgba(255,255,255,0.3)' }]} />
                            <View style={styles.revenueItem}>
                                <Text 
                                    style={[styles.revenueLabel, { color: isDark ? subCol : 'rgba(255,255,255,0.85)' }]}
                                    numberOfLines={1}
                                    adjustsFontSizeToFit
                                >
                                    {language === 'Tamil' ? 'இந்த மாதம்' : 'Month Total'}
                                </Text>
                                <Text style={[styles.revenueValue, { color: '#FFF' }]}>
                                    ₹{Number(stats.monthSales).toLocaleString('en-IN')}
                                </Text>
                            </View>
                        </LinearGradient>
                    </Animated.View>
                </LinearGradient>

                <View style={styles.body}>
                    {/* ── QUICK STATS (Customers & Products) ── */}
                    <Animated.View entering={FadeInUp.delay(200).duration(400)} style={styles.quickStatsRow}>
                        <View style={[styles.quickStatCard, { backgroundColor: cardBg, borderColor: borderCol }]}>
                            <View style={[styles.quickStatIcon, { backgroundColor: '#3B82F615' }]}>
                                <Ionicons name="people" size={20} color="#3B82F6" />
                            </View>
                            <Text style={[styles.quickStatValue, { color: textCol }]} numberOfLines={1} adjustsFontSizeToFit>{stats.totalCustomers}</Text>
                            <Text style={[styles.quickStatLabel, { color: subCol }]} numberOfLines={1} adjustsFontSizeToFit>{language === 'Tamil' ? 'வாடிக்கையாளர்' : 'Customers'}</Text>
                        </View>
                        <View style={[styles.quickStatCard, { backgroundColor: cardBg, borderColor: borderCol }]}>
                            <View style={[styles.quickStatIcon, { backgroundColor: primaryColor + '15' }]}>
                                <MaterialCommunityIcons name="food-apple" size={20} color={primaryColor} />
                            </View>
                            <Text style={[styles.quickStatValue, { color: textCol }]} numberOfLines={1} adjustsFontSizeToFit>{stats.totalProducts}</Text>
                            <Text style={[styles.quickStatLabel, { color: subCol }]} numberOfLines={1} adjustsFontSizeToFit>{language === 'Tamil' ? 'பொருட்கள்' : 'Products'}</Text>
                        </View>
 
                        <View style={[styles.quickStatCard, { backgroundColor: cardBg, borderColor: borderCol }]}>
                            <View style={[styles.quickStatIcon, { backgroundColor: primary + '15' }]}>
                                <MaterialCommunityIcons name="receipt" size={20} color={primary} />
                            </View>
                            <Text style={[styles.quickStatValue, { color: textCol }]} numberOfLines={1} adjustsFontSizeToFit>{(stats as any).todayCount || 0}</Text>
                            <Text style={[styles.quickStatLabel, { color: subCol }]} numberOfLines={1} adjustsFontSizeToFit>{language === 'Tamil' ? 'இன்றைய பில்' : 'Bills Today'}</Text>
                        </View>
                    </Animated.View>

                    {/* ── QUICK ACTIONS ── */}
                    <Animated.View entering={FadeInUp.delay(250).duration(400)}>
                        <Text style={[styles.sectionTitle, { color: textCol }]}>{language === 'Tamil' ? 'விரைவு செயல்கள்' : 'Quick Actions'}</Text>
                        <View style={styles.actionsRow}>
                            {/* 1. Retail Bill */}
                            <TouchableOpacity
                                style={[styles.actionCard, { backgroundColor: primary }]}
                                onPress={() => handleNewBill('retail')}
                                activeOpacity={0.85}
                            >
                                <View style={styles.actionIconBox}>
                                    <Ionicons name="cart" size={26} color="#FFF" />
                                </View>
                                <Text style={styles.actionTitle} numberOfLines={1} adjustsFontSizeToFit>{language === 'Tamil' ? 'சில்லறை விற்பனை' : 'Retail Bill'}</Text>
                                <Text style={styles.actionDesc}>{language === 'Tamil' ? 'சாதாரண விலை' : 'Standard rates'}</Text>
                            </TouchableOpacity>

                            {/* 2. Wholesale */}
                            <TouchableOpacity
                                style={[styles.actionCard, { backgroundColor: '#3B82F6' }]}
                                onPress={() => handleNewBill('wholesale')}
                                activeOpacity={0.85}
                            >
                                <View style={styles.actionIconBox}>
                                    <Ionicons name="business" size={26} color="#FFF" />
                                </View>
                                <Text style={styles.actionTitle} numberOfLines={1} adjustsFontSizeToFit>{language === 'Tamil' ? 'மொத்த விற்பனை' : 'Wholesale'}</Text>
                                <Text style={styles.actionDesc}>{language === 'Tamil' ? 'மொத்த விலை' : 'Bulk rates'}</Text>
                            </TouchableOpacity>

                            {/* 3. Function Bill */}
                            <TouchableOpacity
                                style={[styles.actionCard, { backgroundColor: isDark ? '#252525' : '#F5F3FF', borderWidth: 1, borderColor: '#8B5CF650' }]}
                                onPress={handleFunctionBill}
                                activeOpacity={0.85}
                            >
                                <View style={[styles.actionIconBox, { backgroundColor: '#8B5CF620' }]}>
                                    <MaterialCommunityIcons name="party-popper" size={26} color="#8B5CF6" />
                                </View>
                                <Text style={[styles.actionTitle, { color: textCol }]} numberOfLines={1} adjustsFontSizeToFit>{language === 'Tamil' ? 'விழா பில்' : 'Function Bill'}</Text>
                                <Text style={[styles.actionDesc, { color: subCol }]}>{language === 'Tamil' ? 'திருமணம் & நிகழ்வு' : 'Marriage & Events'}</Text>
                            </TouchableOpacity>

                            {/* 4. Set Price */}
                            <TouchableOpacity
                                style={[styles.actionCard, { backgroundColor: isDark ? '#252525' : '#F3F4F6', borderWidth: 1, borderColor: borderCol }]}
                                onPress={() => router.push('/shop/prices')}
                                activeOpacity={0.85}
                            >
                                <View style={[styles.actionIconBox, { backgroundColor: primary + '20' }]}>
                                    <Ionicons name="pricetag" size={26} color={primary} />
                                </View>
                                <Text style={[styles.actionTitle, { color: textCol }]} numberOfLines={1} adjustsFontSizeToFit>{language === 'Tamil' ? 'விலை நிர்ணயம்' : 'Set Price'}</Text>
                                <Text style={[styles.actionDesc, { color: subCol }]}>{language === 'Tamil' ? 'தினசரி விலை' : 'Daily rates'}</Text>
                            </TouchableOpacity>

                            {/* 5. History */}
                            <TouchableOpacity
                                style={[styles.actionCard, { backgroundColor: isDark ? '#252525' : '#F3F4F6', borderWidth: 1, borderColor: borderCol }]}
                                onPress={() => router.push('/shop/history')}
                                activeOpacity={0.85}
                            >
                                <View style={[styles.actionIconBox, { backgroundColor: primaryColor + '15' }]}>
                                    <MaterialCommunityIcons name="history" size={26} color={primaryColor} />
                                </View>
                                <Text style={[styles.actionTitle, { color: textCol }]} numberOfLines={1} adjustsFontSizeToFit>{language === 'Tamil' ? 'ரசீது வரலாறு' : 'History'}</Text>
                                <Text style={[styles.actionDesc, { color: subCol }]}>{language === 'Tamil' ? 'அனைத்து ரசீதுகள்' : 'All invoices'}</Text>
                            </TouchableOpacity>
                        </View>
                    </Animated.View>

                    {/* ── TOP PRODUCTS ── */}
                    {(stats as any).topProducts?.length > 0 && (
                        <Animated.View entering={FadeInUp.delay(280).duration(400)} style={{ marginBottom: verticalScale(24) }}>
                            <Text style={[styles.sectionTitle, { color: textCol }]}>{language === 'Tamil' ? 'அதிகம் விற்பனையானவை' : 'Top Selling Products'}</Text>
                            <View style={styles.topProductsRow}>
                                {(stats as any).topProducts.map((p: any, i: number) => (
                                    <View key={i} style={[styles.topProductCard, { backgroundColor: cardBg, borderColor: borderCol }]}>
                                        <Text style={[styles.topProductTitle, { color: textCol }]}>{language === 'Tamil' ? p.tamil_name : p.name}</Text>
                                        <Text style={[styles.topProductQty, { color: primary }]}>{Number(p.total_qty).toFixed(1)} kg</Text>
                                    </View>
                                ))}
                            </View>
                        </Animated.View>
                    )}

                    {/* ── RECENT INVOICES ── */}
                    <Animated.View entering={FadeInUp.delay(300).duration(400)}>
                        <View style={styles.sectionRow}>
                            <Text style={[styles.sectionTitle, { color: textCol }]}>{language === 'Tamil' ? 'சமீபத்திய ரசீதுகள்' : 'Recent Invoices'}</Text>
                            <TouchableOpacity onPress={() => router.push('/shop/history')}>
                                <Text style={[styles.seeAll, { color: primary }]}>{language === 'Tamil' ? 'அனைத்தையும் பார்க்க' : 'See All'}</Text>
                            </TouchableOpacity>
                        </View>

                        {loading ? (
                            <View style={styles.center}>
                                <ActivityIndicator size="large" color={primary} />
                            </View>
                        ) : stats.recentInvoices.length > 0 ? (
                            stats.recentInvoices.map((inv, index) => (
                                <Animated.View
                                    key={inv.id}
                                    entering={FadeInUp.delay(350 + index * 60).duration(350)}
                                    style={[styles.invoiceCard, { backgroundColor: cardBg, borderColor: borderCol }]}
                                >
                                    <View style={[styles.invoiceIconBox, { backgroundColor: primary + '15' }]}>
                                        <MaterialCommunityIcons name="receipt" size={20} color={primary} />
                                    </View>
                                    <View style={styles.invoiceInfo}>
                                        <Text style={[styles.invoiceName, { color: textCol }]} numberOfLines={1}>
                                            {inv.customer_name || (language === 'Tamil' ? 'சில்லறை வாடிக்கையாளர்' : 'Walk-in Customer')}
                                        </Text>
                                        <View style={styles.invoiceMeta}>
                                            <Feather name="clock" size={11} color={subCol} />
                                            <Text style={[styles.invoiceDate, { color: subCol }]}>
                                                {'  '}{new Date(inv.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}
                                            </Text>
                                        </View>
                                    </View>
                                        <View style={[styles.invoiceRight, { justifyContent: 'center' }]}>
                                            <Text style={[styles.invoiceTotal, { color: primary }]}>
                                                ₹{Number(inv.total_amount).toFixed(0)}
                                            </Text>
                                            <View style={[styles.paidBadge, { backgroundColor: primaryColor + '15' }]}>
                                                <Text style={[styles.paidText, { color: primaryColor }]}>{language === 'Tamil' ? 'செலுத்தப்பட்டது' : 'Paid'}</Text>
                                            </View>
                                        </View>
                                </Animated.View>
                            ))
                        ) : (
                            <View style={[styles.emptyBox, { backgroundColor: cardBg, borderColor: borderCol }]}>
                                <MaterialCommunityIcons name="receipt-outline" size={48} color={subCol} />
                                <Text style={[styles.emptyTitle, { color: textCol }]}>{language === 'Tamil' ? 'ரசீதுகள் எதுவும் இல்லை' : 'No Invoices Yet'}</Text>
                                <Text style={[styles.emptyDesc, { color: subCol }]}>{language === 'Tamil' ? 'தொடங்க உங்கள் முதல் பில்லை உருவாக்கவும்' : 'Create your first bill to get started'}</Text>
                                <TouchableOpacity
                                    style={[styles.emptyBtn, { backgroundColor: primary }]}
                                    onPress={() => setShowTypeModal(true)}
                                >
                                    <Text style={styles.emptyBtnText}>{language === 'Tamil' ? 'பில் உருவாக்கு' : 'Create Bill'}</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </Animated.View>

                    {/* ── SHOP BRANDING FOOTER ── */}
                    <View style={styles.footerBranding}>
                        <Text style={[styles.footerShopName, { color: textCol }]}>
                            {shopName || user?.shopName || 'SUJI VEGETABLES'}
                        </Text>
                        <Text style={[styles.footerTagline, { color: subCol }]}>
                            {language === 'Tamil' ? 'தரமான பொருட்கள், நியாயமான விலை!' : 'Fresh Quality, Fair Prices!'}
                        </Text>
                        <View style={[styles.footerLine, { backgroundColor: primaryColor }]} />
                    </View>
                </View>
            </ScrollView>

            {/* ── BILL TYPE MODAL ── */}
            <Modal visible={showTypeModal} transparent animationType="fade" onRequestClose={() => setShowTypeModal(false)}>
                <View style={[styles.modalOverlay, { paddingBottom: Math.max(insets.bottom, verticalScale(20)) + scale(10) }]}>
                    <Animated.View entering={FadeInUp.duration(300)} style={[styles.modalContent, { backgroundColor: cardBg }]}>
                        <View style={styles.modalHeader}>
                            <Text style={[styles.modalTitle, { color: textCol }]}>{language === 'Tamil' ? 'புதிய பில்' : 'New Bill'}</Text>
                            <TouchableOpacity
                                style={[styles.modalCloseBtn, { backgroundColor: isDark ? '#333' : '#F3F4F6' }]}
                                onPress={() => setShowTypeModal(false)}
                            >
                                <Ionicons name="close" size={20} color={subCol} />
                            </TouchableOpacity>
                        </View>
                        <Text style={[styles.modalSubtitle, { color: subCol }]}>{language === 'Tamil' ? 'பில்லிங் முறையைத் தேர்வுசெய்க' : 'Choose the billing mode'}</Text>

                        <View style={styles.typeButtonsRow}>
                            <TouchableOpacity
                                style={[styles.typeBtn, { backgroundColor: isDark ? '#252525' : '#FFF7EB', borderColor: primary + '50' }]}
                                onPress={() => handleNewBill('retail')}
                                activeOpacity={0.85}
                            >
                                <View style={[styles.typeIconBox, { backgroundColor: primary }]}>
                                    <Ionicons name="cart" size={28} color="#FFF" />
                                </View>
                                <Text style={[styles.typeBtnTitle, { color: textCol }]}>{language === 'Tamil' ? 'சில்லறை விற்பனை' : 'Retail Bill'}</Text>
                                <Text style={styles.typeBtnDesc}>{language === 'Tamil' ? 'சாதாரண விலை' : 'Standard Rates'}</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.typeBtn, { backgroundColor: isDark ? '#252525' : '#EFF6FF', borderColor: '#3B82F650' }]}
                                onPress={() => handleNewBill('wholesale')}
                                activeOpacity={0.85}
                            >
                                <View style={[styles.typeIconBox, { backgroundColor: '#3B82F6' }]}>
                                    <Ionicons name="business" size={28} color="#FFF" />
                                </View>
                                <Text style={[styles.typeBtnTitle, { color: textCol }]}>{language === 'Tamil' ? 'மொத்த விற்பனை' : 'Wholesale'}</Text>
                                <Text style={styles.typeBtnDesc}>{language === 'Tamil' ? 'மொத்த விலை' : 'Bulk Rates'}</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.typeBtn, { backgroundColor: isDark ? '#252525' : '#F5F3FF', borderColor: '#8B5CF650' }]}
                                onPress={handleFunctionBill}
                                activeOpacity={0.85}
                            >
                                <View style={[styles.typeIconBox, { backgroundColor: '#8B5CF6' }]}>
                                    <MaterialCommunityIcons name="party-popper" size={28} color="#FFF" />
                                </View>
                                <Text style={[styles.typeBtnTitle, { color: textCol }]}>{language === 'Tamil' ? 'விழா பில்' : 'Function Bill'}</Text>
                                <Text style={styles.typeBtnDesc}>{language === 'Tamil' ? 'திருமணம் & நிகழ்வு' : 'Marriage & Events'}</Text>
                            </TouchableOpacity>
                        </View>
                    </Animated.View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    fixedHeader: {
        paddingHorizontal: scale(20),
        paddingBottom: verticalScale(12),
        zIndex: 10,
    },
    hero: {
        paddingHorizontal: scale(20),
        paddingBottom: verticalScale(20),
        overflow: 'hidden',
        position: 'relative',
        borderBottomLeftRadius: scale(32),
        borderBottomRightRadius: scale(32),
        elevation: 8,
        shadowOpacity: 0.15,
        shadowRadius: 15,
        shadowOffset: { width: 0, height: 10 },
    },
    decor1: {
        position: 'absolute',
        width: scale(250),
        height: scale(250),
        borderRadius: scale(125),
        backgroundColor: '#FFF',
        top: -scale(80),
        right: -scale(60),
    },
    decor2: {
        position: 'absolute',
        width: scale(150),
        height: scale(150),
        borderRadius: scale(75),
        backgroundColor: '#FFF',
        bottom: -scale(40),
        left: scale(20),
    },
    heroTop: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: verticalScale(20),
        gap: scale(12),
    },
    greeting: {
        fontSize: moderateScale(13),
        fontWeight: '600',
        marginBottom: 3,
    },
    shopNameHero: {
        fontSize: moderateScale(22),
        fontWeight: '900',
        letterSpacing: -0.5,
    },
    newBillBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: verticalScale(10),
        paddingHorizontal: scale(14),
        borderRadius: scale(12),
        borderWidth: 1,
        gap: scale(6),
    },
    newBillBtnText: {
        color: '#FFF',
        fontWeight: '800',
        fontSize: moderateScale(13),
    },
    langToggleContainer: {
        flexDirection: 'row',
        borderRadius: scale(10),
        padding: 3,
        alignItems: 'center',
    },
    langPill: {
        paddingHorizontal: scale(8),
        paddingVertical: verticalScale(5),
        borderRadius: scale(8),
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: scale(40),
    },
    langPillActive: {
        backgroundColor: '#FFF',
        elevation: 3,
    },
    langPillText: {
        fontSize: moderateScale(10),
        fontWeight: '700',
        color: '#FFF',
    },
    langPillTextActive: {
        color: '#000',
    },
    revenueBanner: {
        flexDirection: 'row',
        borderRadius: scale(20),
        padding: scale(18),
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: verticalScale(5),
    },
    revenueItem: {
        flex: 1,
    },
    revenueLabel: {
        fontSize: moderateScale(11),
        fontWeight: '700',
        marginBottom: verticalScale(4),
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    revenueValue: {
        fontSize: moderateScale(20),
        fontWeight: '900',
    },
    revenueDivider: {
        width: 1.5,
        height: '70%',
        marginHorizontal: scale(15),
    },
    body: {
        paddingHorizontal: scale(20),
        paddingTop: verticalScale(20),
    },
    quickStatsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: verticalScale(24),
        gap: scale(10),
    },
    quickStatCard: {
        flex: 1,
        borderRadius: scale(18),
        padding: scale(12),
        borderWidth: 1,
        alignItems: 'center',
    },
    quickStatIcon: {
        width: scale(36),
        height: scale(36),
        borderRadius: scale(12),
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: verticalScale(8),
    },
    quickStatValue: {
        fontSize: moderateScale(18),
        fontWeight: '800',
        marginBottom: 2,
    },
    quickStatLabel: {
        fontSize: moderateScale(9),
        fontWeight: '700',
        opacity: 0.8,
        textAlign: 'center',
    },
    sectionTitle: {
        fontSize: moderateScale(17),
        fontWeight: '800',
        marginBottom: verticalScale(16),
        letterSpacing: -0.3,
    },
    actionsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: scale(10),
        marginBottom: verticalScale(24),
    },
    actionCard: {
        width: '48.5%', 
        borderRadius: scale(20),
        padding: scale(16),
        elevation: 3,
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 3 },
    },
    actionIconBox: {
        width: scale(42),
        height: scale(42),
        borderRadius: scale(14),
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: verticalScale(12),
        backgroundColor: 'rgba(255,255,255,0.2)',
    },
    actionTitle: {
        color: '#FFF',
        fontSize: moderateScale(14),
        fontWeight: '800',
        marginBottom: 2,
    },
    actionDesc: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: moderateScale(10),
        fontWeight: '600',
    },
    sectionRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: verticalScale(16),
    },
    seeAll: {
        fontSize: moderateScale(12),
        fontWeight: '700',
    },
    invoiceCard: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: scale(16),
        padding: scale(12),
        marginBottom: verticalScale(10),
        borderWidth: 1,
    },
    invoiceIconBox: {
        width: scale(38),
        height: scale(38),
        borderRadius: scale(10),
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: scale(12),
    },
    invoiceInfo: {
        flex: 1,
    },
    invoiceName: {
        fontSize: moderateScale(14),
        fontWeight: '700',
        marginBottom: 2,
    },
    invoiceMeta: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    invoiceDate: {
        fontSize: moderateScale(11),
        fontWeight: '600',
    },
    invoiceRight: {
        alignItems: 'flex-end',
    },
    invoiceTotal: {
        fontSize: moderateScale(16),
        fontWeight: '800',
        marginBottom: 2,
    },
    paidBadge: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 8,
    },
    paidText: {
        fontSize: moderateScale(9),
        fontWeight: '800',
    },
    topProductsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: scale(8),
    },
    topProductCard: {
        flex: 1,
        minWidth: '45%',
        padding: scale(12),
        borderRadius: scale(14),
        borderWidth: 1,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    topProductTitle: {
        fontSize: moderateScale(12),
        fontWeight: '700',
        flex: 1,
    },
    topProductQty: {
        fontSize: moderateScale(12),
        fontWeight: '800',
    },
    emptyBox: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: scale(30),
        borderRadius: scale(24),
        borderWidth: 1,
        borderStyle: 'dashed',
    },
    emptyTitle: {
        fontSize: moderateScale(16),
        fontWeight: '800',
        marginTop: verticalScale(12),
    },
    emptyDesc: {
        fontSize: moderateScale(12),
        fontWeight: '600',
        textAlign: 'center',
        marginTop: verticalScale(4),
        marginBottom: verticalScale(16),
    },
    emptyBtn: {
        paddingHorizontal: scale(20),
        paddingVertical: verticalScale(10),
        borderRadius: scale(12),
    },
    emptyBtnText: {
        color: '#FFF',
        fontWeight: '800',
        fontSize: moderateScale(13),
    },
    footerBranding: {
        alignItems: 'center',
        marginTop: verticalScale(20),
        marginBottom: verticalScale(10),
        opacity: 0.6,
    },
    footerShopName: {
        fontSize: moderateScale(12),
        fontWeight: '800',
        letterSpacing: 1,
    },
    footerTagline: {
        fontSize: moderateScale(10),
        fontWeight: '600',
        marginTop: 2,
    },
    footerLine: {
        width: scale(30),
        height: 2,
        borderRadius: 1,
        marginTop: verticalScale(10),
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: scale(20),
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        borderTopLeftRadius: scale(30),
        borderTopRightRadius: scale(30),
        padding: scale(24),
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: verticalScale(8),
    },
    modalTitle: {
        fontSize: moderateScale(18),
        fontWeight: '900',
    },
    modalCloseBtn: {
        width: scale(32),
        height: scale(32),
        borderRadius: scale(16),
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalSubtitle: {
        fontSize: moderateScale(13),
        fontWeight: '600',
        marginBottom: verticalScale(20),
    },
    typeButtonsRow: {
        gap: verticalScale(12),
    },
    typeBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: scale(16),
        borderRadius: scale(20),
        borderWidth: 1,
    },
    typeIconBox: {
        width: scale(48),
        height: scale(48),
        borderRadius: scale(16),
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: scale(16),
    },
    typeBtnTitle: {
        fontSize: moderateScale(16),
        fontWeight: '800',
        flex: 1,
    },
    typeBtnDesc: {
        fontSize: moderateScale(10),
        fontWeight: '700',
        color: '#666',
        backgroundColor: 'rgba(0,0,0,0.05)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
});
