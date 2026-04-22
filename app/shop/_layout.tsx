import { useAppTheme } from '@/context/ThemeContext';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ShopLayout() {
    const { isDark, language, primaryColor } = useAppTheme();
    const insets = useSafeAreaInsets();

    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                tabBarStyle: {
                    backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF',
                    borderTopWidth: 0,
                    height: Platform.OS === 'ios' ? (88 + insets.bottom) : (75 + (insets.bottom > 0 ? insets.bottom - 10 : 0)),
                    paddingTop: 12,
                    paddingBottom: insets.bottom > 0 ? insets.bottom : (Platform.OS === 'ios' ? 25 : 12),
                    elevation: 20,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: -10 },
                    shadowOpacity: 0.1,
                    shadowRadius: 20,
                },
                tabBarActiveTintColor: primaryColor,
                tabBarInactiveTintColor: isDark ? '#555' : '#94A3B8',
                tabBarLabelStyle: {
                    fontSize: 10,
                    fontWeight: '800',
                    marginTop: 5,
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                }
            }}
        >
            <Tabs.Screen
                name="dashboard"
                options={{
                    title: language === 'Tamil' ? 'முகப்பு' : 'Home',
                    tabBarIcon: ({ color, size }) => (
                        <MaterialCommunityIcons name="home-analytics" size={size} color={color} />
                    ),
                }}
            />

            <Tabs.Screen
                name="index"
                options={{
                    title: language === 'Tamil' ? 'விற்பனை' : 'PoS',
                    tabBarIcon: ({ color, size }) => (
                        <MaterialCommunityIcons name="point-of-sale" size={size} color={color} />
                    ),
                }}
            />

            <Tabs.Screen
                name="customers"
                options={{
                    href: null, // Hide from bottom bar
                }}
            />

            <Tabs.Screen
                name="products"
                options={{
                    title: language === 'Tamil' ? 'பொருட்கள்' : 'Products',
                    tabBarIcon: ({ color, size }) => (
                        <MaterialCommunityIcons name="food-apple" size={size} color={color} />
                    ),
                }}
            />

            <Tabs.Screen
                name="history"
                options={{
                    title: language === 'Tamil' ? 'ரசீதுகள்' : 'Invoices',
                    tabBarIcon: ({ color, size }) => (
                        <MaterialCommunityIcons name="receipt" size={size} color={color} />
                    ),
                }}
            />

            <Tabs.Screen
                name="profile"
                options={{
                    title: language === 'Tamil' ? 'சுயவிவரம்' : 'Profile',
                    tabBarIcon: ({ color, size }) => (
                        <MaterialCommunityIcons name="account-circle" size={size} color={color} />
                    ),
                }}
            />

            {/* Hide the mode-selection from tabs */}
            <Tabs.Screen
                name="mode-selection"
                options={{
                    href: null,
                }}
            />

            <Tabs.Screen
                name="prices"
                options={{
                    href: null,
                }}
            />

            <Tabs.Screen
                name="function-bill"
                options={{
                    href: null,
                }}
            />
        </Tabs>
    );
}
