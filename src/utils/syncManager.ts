import { Storage, KEYS } from '@/services/storage';
import { billDbService } from '@/services/dbService';

/**
 * Sync Manager - Now handles local database operations
 * For offline-first architecture, bills are saved directly to SQLite
 */
export const SyncManager = {
    queueBill: async (billData: any) => {
        try {
            // Convert UI bill data to database format
            const billPayload = {
                total_amount: billData.grandTotal || 0,
                discount: billData.discount || 0,
                customer_name: billData.userName || 'Guest',
                mode: billData.mode || 'Retail',
                items: billData.items.map((item: any) => ({
                    vegetable_id: item.id,
                    name: item.name,
                    tamil_name: item.tamilName,
                    quantity: item.quantity,
                    unit_price: item.price,
                    total_price: item.total,
                    unit: 'kg'
                }))
            };

            // Save directly to local database
            await billDbService.create(billPayload);
            console.log('✓ Bill saved successfully to local database');
        } catch (error) {
            console.error('✗ Error saving bill:', error);
            // Keep bill in queue for retry
            const pendingBills = (await Storage.getItem(KEYS.PENDING_BILLS)) || [];
            pendingBills.push(billData);
            await Storage.setItem(KEYS.PENDING_BILLS, pendingBills);
            throw error;
        }
    },

    syncPending: async () => {
        try {
            const pendingBills = await Storage.getItem(KEYS.PENDING_BILLS);
            if (!pendingBills || pendingBills.length === 0) {
                console.log('No pending bills to sync');
                return;
            }

            console.log(`Syncing ${pendingBills.length} pending bills...`);
            const remainingBills = [];

            for (const bill of pendingBills) {
                try {
                    await SyncManager.queueBill(bill);
                } catch (error) {
                    console.warn('Failed to sync bill, keeping in queue:', error);
                    remainingBills.push(bill);
                }
            }

            await Storage.setItem(KEYS.PENDING_BILLS, remainingBills);
            console.log(`✓ Sync complete. ${remainingBills.length} bills remaining in queue`);
        } catch (error) {
            console.error('Sync error:', error);
        }
    },

    // Force clear all pending bills (use with caution)
    clearPending: async () => {
        try {
            await Storage.removeItem(KEYS.PENDING_BILLS);
            console.log('✓ Pending bills cleared');
        } catch (error) {
            console.error('Error clearing pending bills:', error);
        }
    }
};
