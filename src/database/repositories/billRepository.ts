import { generateId } from '@/utils/idGenerator';
import { Bill, BillItem } from '../schema/bills';
import { sqliteService } from '../sqlite';

export const billRepository = {
    async createBill(bill: Omit<Bill, 'id' | 'created_at'>, items: Omit<BillItem, 'id' | 'bill_id'>[]): Promise<Bill> {
        try {
            const newBill = await sqliteService.transaction(async (txn) => {
                // 1. Generate sequence-based Bill ID (Format: BILL001Y26)
                const now = new Date();
                const yearSuffix = now.getFullYear().toString().slice(-2);
                
                const lastBill = await txn.getFirstAsync<{ id: string }>(
                    `SELECT id FROM bills WHERE id LIKE 'BILL%Y${yearSuffix}' ORDER BY id DESC LIMIT 1`
                );

                let nextSeq = 1;
                if (lastBill) {
                    const match = lastBill.id.match(/BILL(\d+)Y/);
                    if (match) {
                        nextSeq = parseInt(match[1], 10) + 1;
                    }
                }

                const paddedSeq = nextSeq.toString().padStart(3, '0');
                const billId = `BILL${paddedSeq}Y${yearSuffix}`;
                const createdAt = now.toISOString();

                await txn.runAsync(
                    `INSERT INTO bills (id, total_amount, discount, tax, customer_name, customer_mobile, payment_method, payment_status, notes, mode, created_at, updated_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        billId,
                        bill.total_amount,
                        bill.discount || 0,
                        bill.tax || 0,
                        bill.customer_name || null,
                        bill.customer_mobile || null,
                        'cash',
                        bill.payment_status || 'PAID',
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
                    customer_mobile: bill.customer_mobile,
                    payment_status: bill.payment_status || 'PAID',
                    created_at: createdAt
                } as Bill;
            });

            return newBill;
        } catch (error) {
            console.error('Error creating bill:', error);
            throw error;
        }
    },

    async updateBill(billId: string, updates: Partial<Bill>, items?: Omit<BillItem, 'id' | 'bill_id'>[]): Promise<boolean> {
        try {
            await sqliteService.transaction(async (txn) => {
                const now = new Date().toISOString();
                
                // 1. Update bill header
                const updateFields: string[] = [];
                const values: any[] = [];
                
                if (updates.total_amount !== undefined) { updateFields.push('total_amount = ?'); values.push(updates.total_amount); }
                if (updates.discount !== undefined) { updateFields.push('discount = ?'); values.push(updates.discount); }
                if (updates.customer_name !== undefined) { updateFields.push('customer_name = ?'); values.push(updates.customer_name); }
                if (updates.customer_mobile !== undefined) { updateFields.push('customer_mobile = ?'); values.push(updates.customer_mobile); }
                if (updates.payment_status !== undefined) { updateFields.push('payment_status = ?'); values.push(updates.payment_status); }
                
                updateFields.push('updated_at = ?');
                values.push(now);
                values.push(billId);

                await txn.runAsync(
                    `UPDATE bills SET ${updateFields.join(', ')} WHERE id = ?`,
                    values
                );

                // 2. If items provided, replace existing items
                if (items) {
                    await txn.runAsync(`DELETE FROM bill_items WHERE bill_id = ?`, [billId]);
                    
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
                                now
                            ]
                        );
                    }
                }
            });
            return true;
        } catch (error) {
            console.error('Error updating bill:', error);
            throw error;
        }
    },

    async getHistory(limit = 50): Promise<(Bill & { itemCount: number })[]> {
        try {
            const bills = await sqliteService.query<Bill & { itemCount: number }>(
                `SELECT b.id, b.total_amount, b.discount, b.customer_name, b.customer_mobile, b.payment_status, b.created_at, b.mode,
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
                `SELECT * FROM bills WHERE id = ?`,
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
                `SELECT id, total_amount, discount, customer_name, customer_mobile, payment_status, created_at 
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

    async getNextBillId(): Promise<string> {
        try {
            const now = new Date();
            const yearSuffix = now.getFullYear().toString().slice(-2);
            const lastBill = await sqliteService.queryOne<{ id: string }>(
                `SELECT id FROM bills WHERE id LIKE 'BILL%Y${yearSuffix}' ORDER BY id DESC LIMIT 1`
            );

            let nextSeq = 1;
            if (lastBill) {
                const match = lastBill.id.match(/BILL(\d+)Y/);
                if (match) {
                    nextSeq = parseInt(match[1], 10) + 1;
                }
            }

            const paddedSeq = nextSeq.toString().padStart(3, '0');
            return `BILL${paddedSeq}Y${yearSuffix}`;
        } catch (error) {
            console.error('Error getting next bill ID:', error);
            return `BILL-ERROR`;
        }
    },

    async getBillsForDateRange(startDate: string, endDate: string): Promise<(Bill & { itemCount: number })[]> {
        try {
            const bills = await sqliteService.query<Bill & { itemCount: number }>(
                `SELECT b.id, b.total_amount, b.discount, b.customer_name, b.customer_mobile, b.payment_status, b.created_at, b.mode,
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
