import React, { createContext, useContext, useEffect, useState } from 'react';
import { KEYS, Storage } from '@/services/storage';

type User = {
    username: string;
    role: 'admin' | 'shopkeeper';
    shopName?: string;
    phone?: string;
    address?: string;
    top_selling_vegetables?: string[];
};

type AuthContextType = {
    user: User | null;
    login: (userData: User, token: string) => Promise<void>;
    logout: () => Promise<void>;
    isLoading: boolean;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Default offline user configuration
const DEFAULT_OFFLINE_USER: User = {
    username: 'Owner',
    role: 'admin',
    shopName: 'சுஜி காய்கறிகள்',
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(DEFAULT_OFFLINE_USER);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        loadStorageData();
    }, []);

    const loadStorageData = async () => {
        try {
            const storedUser = await Storage.getItem(KEYS.USER_DATA);
            if (storedUser) {
                setUser(storedUser);
            } else {
                // Keep the default offline user
                setUser(DEFAULT_OFFLINE_USER);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    const login = async (userData: User, token: string) => {
        setUser(userData);
        await Storage.setItem(KEYS.USER_DATA, userData);
        await Storage.setItem(KEYS.AUTH_TOKEN, token);
    };

    const logout = async () => {
        // For offline mode, we reset to default instead of null
        setUser(DEFAULT_OFFLINE_USER);
        try {
            await Storage.removeItem(KEYS.USER_DATA);
            await Storage.removeItem(KEYS.AUTH_TOKEN);
        } catch (error) {
            console.error('Error clearing storage:', error);
        }
    };

    return (
        <AuthContext.Provider value={{ user, login, logout, isLoading }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
