import { generateId } from '@/utils/idGenerator';
import { Bill, BillItem } from '../schema/bills';
import { sqliteService } from '../sqlite';

export const billRepository = {
    async createBill(bill: Omit<Bill, 'id' | 'created_at'>, items: Omit<BillItem, 'id' | 'bill_id'>[]): Promise<Bill> {
        try {
            const newBill = await sqliteService.transaction(async (txn) => {
                // 1. Insert the bill
                const billId = generateId();
                const createdAt = new Date().toISOString();

                await txn.runAsync(
                    `INSERT INTO bills (id, total_amount, discount, tax, customer_name, payment_method, notes, mode, created_at, updated_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        billId,
                        bill.total_amount,
                        bill.discount || 0,
                        bill.tax || 0,
                        bill.customer_name || null,
                        'cash',
                        null,
                        bill.mode || 'Retail',
                        createdAt,
                        createdAt
                    ]
                );

                // 2. Insert all items
                for (const item of items) {
                    const itemId = generateId();
                    await txn.runAsync(
                        `INSERT INTO bill_items (id, bill_id, vegetable_id, name, tamil_name, quantity, unit_price, total_price, unit, created_at)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        [
                            itemId,
                            billId,
                            item.vegetable_id,
                            item.name || null,
                            item.tamil_name || null,
                            item.quantity,
                            item.unit_price,
                            item.total_price,
                            item.unit || 'kg',
                            createdAt
                        ]
                    );
                }

                return {
                    id: billId,
                    total_amount: bill.total_amount,
                    discount: bill.discount || 0,
                    customer_name: bill.customer_name,
                    created_at: createdAt
                } as Bill;
            });

            return newBill;
        } catch (error) {
            console.error('Error creating bill:', error);
            throw error;
        }
    },

    async getHistory(limit = 50): Promise<(Bill & { itemCount: number })[]> {
        try {
            const bills = await sqliteService.query<Bill & { itemCount: number }>(
                `SELECT b.id, b.total_amount, b.discount, b.customer_name, b.created_at,
                 (SELECT COUNT(*) FROM bill_items WHERE bill_id = b.id) as itemCount
                 FROM bills b
                 ORDER BY b.created_at DESC 
                 LIMIT ?`,
                [limit]
            );
            return bills;
        } catch (error) {
            console.error('Error fetching bill history:', error);
            throw error;
        }
    },

    async getBillWithItems(billId: string): Promise<{ bill: Bill; items: BillItem[] } | null> {
        try {
            const bill = await sqliteService.queryOne<Bill>(
                `SELECT id, total_amount, discount, customer_name, created_at 
                 FROM bills 
                 WHERE id = ?`,
                [billId]
            );

            if (!bill) {
                return null;
            }

            const items = await sqliteService.query<BillItem & { name: string, tamil_name: string }>(
                `SELECT bi.*, 
                 COALESCE(bi.name, v.name) as name, 
                 COALESCE(bi.tamil_name, v.tamil_name) as tamil_name 
                 FROM bill_items bi
                 LEFT JOIN vegetables v ON bi.vegetable_id = v.id
                 WHERE bi.bill_id = ?`,
                [billId]
            );

            return { bill, items };
        } catch (error) {
            console.error('Error fetching bill with items:', error);
            throw error;
        }
    },

    async getBillById(billId: string): Promise<Bill | null> {
        try {
            return await sqliteService.queryOne<Bill>(
                `SELECT id, total_amount, discount, customer_name, created_at 
                 FROM bills 
                 WHERE id = ?`,
                [billId]
            );
        } catch (error) {
            console.error('Error fetching bill:', error);
            throw error;
        }
    },

    async getTotalAmount(): Promise<number> {
        try {
            const result = await sqliteService.queryOne<{ total: number }>(
                `SELECT SUM(total_amount) as total FROM bills`
            );
            return result?.total || 0;
        } catch (error) {
            console.error('Error calculating total amount:', error);
            throw error;
        }
    },

    async getBillsForDateRange(startDate: string, endDate: string): Promise<(Bill & { itemCount: number })[]> {
        try {
            const bills = await sqliteService.query<Bill & { itemCount: number }>(
                `SELECT b.id, b.total_amount, b.discount, b.customer_name, b.created_at,
                 (SELECT COUNT(*) FROM bill_items WHERE bill_id = b.id) as itemCount
                 FROM bills b
                 WHERE DATE(b.created_at) BETWEEN DATE(?) AND DATE(?)
                 ORDER BY b.created_at DESC`,
                [startDate, endDate]
            );
            return bills;
        } catch (error) {
            console.error('Error fetching bills for date range:', error);
            throw error;
        }
    }
};
