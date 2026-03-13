import { billRepository } from '@/database/repositories/billRepository';
import { inventoryRepository } from '@/database/repositories/inventoryRepository';
import { userRepository } from '@/database/repositories/userRepository';
import { vegetableRepository } from '@/database/repositories/vegetableRepository';
import { KEYS, Storage } from './storage';

/**
 * DB Service - Replaces the API layer to interact directly with Neon DB.
 * Use this service to bypass the backend.
 */

export const authDbService = {
    login: async (credentials: any) => {
        const user = await userRepository.getByUsername(credentials.username);
        if (user && user.password_hash === credentials.password) { // Simple check, use bcrypt in reality
            await Storage.setItem(KEYS.AUTH_TOKEN, 'dummy-neon-token-' + user.id);
            await Storage.setItem(KEYS.USER_DATA, user);
            return { data: { access_token: 'dummy-neon-token', user } };
        }
        throw new Error('Invalid credentials');
    },
    signup: async (userData: any) => {
        const newUser = await userRepository.create({
            username: userData.username,
            password_hash: userData.password, // Use hashing in real app
            role: userData.role || 'shopkeeper'
        });
        return { data: { access_token: 'dummy-neon-token', user: newUser } };
    }
};

export const adminDbService = {
    createUser: (userData: any) => authDbService.signup(userData)
};

export const inventoryDbService = {
    setup: async (data: any[]) => {
        // Bulk setup vegetables
        const results = [];
        for (const item of data) {
            const v = await vegetableRepository.create({
                name: item.name,
                tamil_name: item.tamilName || item.tamil_name,
                image_url: item.image,
                category: item.origin
            });
            results.push(v);
        }
        return { data: results };
    },
    getAll: async () => {
        const inventory = await inventoryRepository.getLatestPrices();
        return { data: inventory };
    },
    update: async (vegId: string, data: any) => {
        const updated = await vegetableRepository.update(vegId, data);
        return { data: updated };
    },
    dailyPricing: async (priceData: any) => {
        // priceData expected to be { vegetable_id, price, stock_quantity, unit, date }
        const result = await inventoryRepository.updatePriceAndStock(priceData);
        return { data: result };
    }
};

export const vegetableDbService = {
    getAll: async () => {
        const vegs = await vegetableRepository.getAll();
        return { data: vegs };
    },
    getTop15: async () => {
        const vegs = await vegetableRepository.getAll();
        return { data: vegs.slice(0, 15) };
    }
};

export const billDbService = {
    create: async (billData: any) => {
        // billData: { total_amount, discount, customer_name, items: [{vegetable_id, quantity, unit_price, total_price}] }
        const { items, ...billInfo } = billData;
        const newBill = await billRepository.createBill(billInfo, items);
        return { data: newBill };
    },
    getHistory: async () => {
        const bills = await billRepository.getHistory();
        return { data: bills };
    },
    getHistoryByDateRange: async (startDate: string, endDate: string) => {
        const bills = await billRepository.getBillsForDateRange(startDate, endDate);
        return { data: bills };
    },
    // getPdf would normally be handled by a backend, here we might return metadata
    // or trigger a client-side PDF generation in the UI components
    getPdf: async (billId: string) => {
        const bill = await billRepository.getBillWithItems(billId);
        return { data: bill };
    }
};
