import { generateId } from '@/utils/idGenerator';
import { Vegetable } from '../schema/vegetables';
import { sqliteService } from '../sqlite';

export const vegetableRepository = {
    async getAll(): Promise<Vegetable[]> {
        try {
            const vegetables = await sqliteService.query<Vegetable>(
                `SELECT * FROM vegetables ORDER BY name ASC`
            );
            return vegetables;
        } catch (error) {
            console.error('Error fetching all vegetables:', error);
            throw error;
        }
    },

    async findByName(name: string, tamilName?: string): Promise<Vegetable | null> {
        try {
            const vegetable = await sqliteService.queryOne<Vegetable>(
                `SELECT * FROM vegetables WHERE name = ? OR (tamil_name = ? AND tamil_name IS NOT NULL)`,
                [name, tamilName || null]
            );
            return vegetable || null;
        } catch (error) {
            console.error('Error finding vegetable by name:', error);
            return null;
        }
    },

    async getById(id: string): Promise<Vegetable | null> {
        try {
            const vegetable = await sqliteService.queryOne<Vegetable>(
                `SELECT * FROM vegetables WHERE id = ?`,
                [id]
            );
            return vegetable || null;
        } catch (error) {
            console.error('Error fetching vegetable by id:', error);
            throw error;
        }
    },

    async create(vegetable: Omit<Vegetable, 'id' | 'created_at'>): Promise<Vegetable> {
        try {
            const id = generateId();
            const createdAt = new Date().toISOString();

            await sqliteService.execute(
                `INSERT INTO vegetables (id, name, tamil_name, image_url, category, created_at)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [id, vegetable.name, vegetable.tamil_name, vegetable.image_url, vegetable.category, createdAt],
                { silent: true }
            );

            return {
                id,
                name: vegetable.name,
                tamil_name: vegetable.tamil_name,
                image_url: vegetable.image_url,
                category: vegetable.category,
                created_at: createdAt
            };
        } catch (error) {
            console.error('Error creating vegetable:', error);
            throw error;
        }
    },

    async update(id: string, vegetable: Partial<Vegetable> | any): Promise<Vegetable | null> {
        try {
            // Helper to handle both snake_case and camelCase for database updates
            const dbData: any = { ...vegetable };
            
            if (dbData.wholesalePrice !== undefined && dbData.wholesale_price === undefined) {
                dbData.wholesale_price = dbData.wholesalePrice;
                delete dbData.wholesalePrice;
            }
            if (dbData.retailPrice !== undefined && dbData.retail_price === undefined) {
                dbData.retail_price = dbData.retailPrice;
                delete dbData.retailPrice;
            }

            const updateFields = Object.keys(dbData)
                .filter(key => dbData[key] !== undefined && key !== 'id' && key !== 'created_at')
                .map(key => `${key} = ?`)
                .join(', ');

            const updateValues = Object.keys(dbData)
                .filter(key => dbData[key] !== undefined && key !== 'id' && key !== 'created_at')
                .map(key => dbData[key]);

            if (updateFields.length === 0) {
                return this.getById(id);
            }

            await sqliteService.execute(
                `UPDATE vegetables SET ${updateFields} WHERE id = ?`,
                [...updateValues, id]
            );

            return this.getById(id);
        } catch (error) {
            console.error('Error updating vegetable:', error);
            throw error;
        }
    },

    async delete(id: string): Promise<boolean> {
        try {
            const result = await sqliteService.execute(
                `DELETE FROM vegetables WHERE id = ?`,
                [id]
            );
            return (result.changes || 0) > 0;
        } catch (error) {
            console.error('Error deleting vegetable:', error);
            throw error;
        }
    }
};
