import { SOUTHERN_VEGETABLES } from '@/constants/Vegetables';
import { inventoryRepository } from './repositories/inventoryRepository';
import { userRepository } from './repositories/userRepository';
import { vegetableRepository } from './repositories/vegetableRepository';
import { sqliteService } from './sqlite';

/**
 * Seed Data for the Billing Application
 * Add default vegetables, users, and initial inventory
 */

const DEFAULT_USERS = [
    {
        username: 'admin',
        password_hash: 'admin123', // Note: Use bcrypt hashing in production
        role: 'admin' as const
    },
    {
        username: 'shopkeeper',
        password_hash: 'shop123',
        role: 'shopkeeper' as const
    }
];

export const seedVegetables = async () => {
    console.log('🌱 Starting database seeding...');
    try {
        // Cleanup: Remove any fish items previously added (categorized under 'Coastal Regions')
        console.log('Cleaning up removed categories...');
        await sqliteService.execute(
            `DELETE FROM vegetables WHERE category = ?`,
            ['Coastal Regions']
        );

        // Seed vegetables from constants
        console.log('Checking for missing vegetables from constants...');
        let addedCount = 0;
        let skippedCount = 0;

        for (const veg of SOUTHERN_VEGETABLES) {
            const existing = await vegetableRepository.findByName(veg.name, veg.tamilName);
            
            if (!existing) {
                await vegetableRepository.create({
                    name: veg.name,
                    tamil_name: veg.tamilName,
                    image_url: veg.image,
                    category: veg.origin
                });
                console.log(`✓ Added new: ${veg.name}`);
                addedCount++;
            } else {
                skippedCount++;
            }
        }
        
        console.log(`✓ Vegetables seeding complete! (Added: ${addedCount}, Skipped: ${skippedCount})`);
        return true;
    } catch (error) {
        console.error('✗ Vegetable seeding failed:', error);
        return false;
    }
};

export async function seedDatabase() {
    try {
        console.log('🌱 Starting full database seeding...');

        // Seed vegetables
        await seedVegetables();

        // Seed users
        console.log('Adding users...');
        for (const user of DEFAULT_USERS) {
            try {
                // Check if user already exists first to avoid unique constraint error noise
                const existingUser = await userRepository.getByUsername(user.username);
                if (existingUser) {
                    console.log(`User '${user.username}' already exists`);
                    continue;
                }

                await userRepository.create(user);
                console.log(`✓ Created user: ${user.username}`);
            } catch (error: any) {
                console.error(`✗ Error creating user ${user.username}:`, error);
            }
        }

        // Add initial inventory if not exists for today (Incremental)
        console.log('Syncing inventory for today...');
        const vegetables = await vegetableRepository.getAll();
        const today = new Date().toISOString().split('T')[0];
        const existingInventory = await inventoryRepository.getByDate(today);
        const existingVegIds = new Set(existingInventory.map(i => i.vegetable_id));

        let inventoryAddedCount = 0;
        for (const veg of vegetables) {
            if (!existingVegIds.has(veg.id)) {
                try {
                    await inventoryRepository.create({
                        vegetable_id: veg.id,
                        price: veg.retail_price || 30, // Use retail price if set, else fallback
                        stock_quantity: 100,
                        unit: 'kg',
                        date: today
                    });
                    inventoryAddedCount++;
                } catch (error) {
                    console.warn(`Could not add inventory for ${veg.name}:`, error);
                }
            }
        }
        console.log(`✓ Inventory sync complete (Added: ${inventoryAddedCount} missing items for today)`);

        console.log('✓ Database seeding completed successfully');
        return true;
    } catch (error) {
        console.error('✗ Error seeding database:', error);
        return false;
    }
}

export async function resetAndSeedDatabase() {
    try {
        console.log('🔄 Resetting database...');
        await sqliteService.resetDatabase();
        await seedDatabase();
        console.log('✓ Database reset and reseeded successfully');
        return true;
    } catch (error) {
        console.error('✗ Error resetting database:', error);
        return false;
    }
}
