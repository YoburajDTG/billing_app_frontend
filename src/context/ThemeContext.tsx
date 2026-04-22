import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TAMIL } from '@/constants/Tamil';
import { ENGLISH } from '@/constants/English';

export const THEME_COLORS = [
    { name: 'Orange', color: '#FF8C00' },
    { name: 'Blue', color: '#2563EB' },
    { name: 'Green', color: '#059669' },
    { name: 'Purple', color: '#7C3AED' },
    { name: 'Cyan', color: '#06B6D4' },
    { name: 'Red', color: '#E11D48' },
    { name: 'Pink', color: '#DB2777' },
    { name: 'Amber', color: '#D97706' },
    { name: 'Slate', color: '#475569' },
    { name: 'Lime', color: '#65A30D' },
];

type Language = 'English' | 'Tamil';
type Theme = 'light' | 'dark';

interface ThemeContextType {
    language: Language;
    theme: Theme;
    toggleLanguage: () => void;
    toggleTheme: () => void;
    t: any;
    isDark: boolean;
    primaryColor: string;
    setPrimaryColor: (color: string) => void;
}

const AppThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const AppThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const systemColorScheme = useColorScheme();
    const [language, setLanguage] = useState<Language>('Tamil');
    const [theme, setTheme] = useState<Theme>(systemColorScheme || 'light');
    const [primaryColor, setPrimaryColorState] = useState(THEME_COLORS[0].color);

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        try {
            const [savedLanguage, savedTheme, savedColor] = await Promise.all([
                AsyncStorage.getItem('language'),
                AsyncStorage.getItem('theme'),
                AsyncStorage.getItem('primary_color'),
            ]);
            
            if (savedLanguage) setLanguage(savedLanguage as Language);
            if (savedTheme) setTheme(savedTheme as Theme);
            if (savedColor) setPrimaryColorState(savedColor);
        } catch (error) {
            console.error('Error loading settings:', error);
        }
    };

    const toggleLanguage = async () => {
        const newLang = language === 'English' ? 'Tamil' : 'English';
        setLanguage(newLang);
        await AsyncStorage.setItem('language', newLang);
    };

    const toggleTheme = async () => {
        const newTheme = theme === 'light' ? 'dark' : 'light';
        setTheme(newTheme);
        await AsyncStorage.setItem('theme', newTheme);
    };

    const setPrimaryColor = async (color: string) => {
        setPrimaryColorState(color);
        await AsyncStorage.setItem('primary_color', color);
    };

    const t = language === 'Tamil' ? TAMIL : ENGLISH;
    const isDark = theme === 'dark';

    return (
        <AppThemeContext.Provider value={{ 
            language, 
            theme, 
            toggleLanguage, 
            toggleTheme, 
            t, 
            isDark, 
            primaryColor,
            setPrimaryColor 
        }}>
            {children}
        </AppThemeContext.Provider>
    );
};

export const useAppTheme = () => {
    const context = useContext(AppThemeContext);
    if (context === undefined) {
        throw new Error('useAppTheme must be used within an AppThemeProvider');
    }
    return context;
};
