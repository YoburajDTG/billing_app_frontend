import AsyncStorage from '@react-native-async-storage/async-storage';

export const Storage = {
    setItem: async (key: string, value: any) => {
        try {
            await AsyncStorage.setItem(key, JSON.stringify(value));
        } catch (e) {
            console.error('Error saving data', e);
        }
    },
    getItem: async (key: string) => {
        try {
            const value = await AsyncStorage.getItem(key);
            return value ? JSON.parse(value) : null;
        } catch (e) {
            console.error('Error reading data', e);
            return null;
        }
    },
    removeItem: async (key: string) => {
        try {
            await AsyncStorage.removeItem(key);
        } catch (e) {
            console.error('Error removing data', e);
        }
    },
    clear: async () => {
        try {
            await AsyncStorage.clear();
        } catch (e) {
            console.error('Error clearing storage', e);
        }
    },
};

export const KEYS = {
    AUTH_TOKEN: 'auth_token',
    USER_DATA: 'user_data',
    VEGETABLES: 'vegetables',
    TOP_VEGETABLES: 'top_vegetables',
    PENDING_BILLS: 'pending_bills',
    OFFLINE_PRICES: 'offline_prices',
    REMINDER_TIME: 'reminder_time',
    MERCHANT_NAME: 'merchant_name',
    MERCHANT_LOGO: 'merchant_logo',
    MERCHANT_NUMBER: 'merchant_number',
    PRINTER_SIZE: 'printer_size',
};
