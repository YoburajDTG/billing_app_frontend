import React, { useEffect, useRef } from 'react';
import { View, Image, StyleSheet, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { scale } from '@/utils/responsive';
import { useAppTheme } from '@/context/ThemeContext';

/**
 * SplashScreen Component
 * Displays the company logo centered with a professional fade-in and scale animation.
 * After 2.5 seconds, it navigates to the dashboard.
 */
const SplashScreen = () => {
    const router = useRouter();
    const { isDark } = useAppTheme();

    // Animation constants using useRef for stability
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const scaleAnim = useRef(new Animated.Value(0.9)).current;

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
    }, [fadeAnim, router, scaleAnim]);

    // Clean background matches the white native splash screen
    const backgroundColor = '#FFFFFF';

    return (
        <View style={[styles.container, { backgroundColor }]}>
            <Animated.View
                style={[
                    styles.fullScreenWrapper,
                    {
                        opacity: fadeAnim,
                    }
                ]}
            >
                <Image
                    source={require('@/assets/images/splash.png')}
                    style={styles.fullScreenImage}
                    resizeMode="cover"
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
    fullScreenWrapper: {
        width: '100%',
        height: '100%',
    },
    fullScreenImage: {
        width: '100%',
        height: '100%',
    },
});

export default SplashScreen;
