import React, { useEffect } from 'react';
import { View, Image, StyleSheet, Animated, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { scale, verticalScale } from '@/utils/responsive';
import { useAppTheme } from '@/context/ThemeContext';

const { width, height } = Dimensions.get('window');

/**
 * SplashScreen Component
 * Displays the company logo centered with a professional fade-in and scale animation.
 * After 2.5 seconds, it navigates to the dashboard.
 */
const SplashScreen = () => {
    const router = useRouter();
    const { isDark } = useAppTheme();
    
    // Animation constants
    const fadeAnim = new Animated.Value(0);
    const scaleAnim = new Animated.Value(0.9);

    useEffect(() => {
        // Professional animation sequence
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 1200,
                useNativeDriver: true,
            }),
            Animated.spring(scaleAnim, {
                toValue: 1,
                friction: 6,
                tension: 40,
                useNativeDriver: true,
            })
        ]).start();

        // 2.5 second delay before navigation
        const timer = setTimeout(() => {
            router.replace('/shop/dashboard');
        }, 2500);

        return () => clearTimeout(timer);
    }, []);

    // Clean background matches the app's dark/light theme
    const backgroundColor = isDark ? '#121212' : '#FFFFFF';

    return (
        <View style={[styles.container, { backgroundColor }]}>
            <Animated.View 
                style={[
                    styles.logoWrapper,
                    { 
                        opacity: fadeAnim,
                        transform: [{ scale: scaleAnim }]
                    }
                ]}
            >
                <Image
                    source={require('@/assets/images/icon.png')}
                    style={styles.logo}
                    resizeMode="contain"
                />
            </Animated.View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    logoWrapper: {
        width: scale(280),
        height: scale(280),
        justifyContent: 'center',
        alignItems: 'center',
    },
    logo: {
        width: '100%',
        height: '100%',
    },
});

export default SplashScreen;
