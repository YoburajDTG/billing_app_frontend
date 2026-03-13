import { openDatabaseAsync, type SQLiteDatabase, type SQLiteRunResult } from 'expo-sqlite';

export const DB_NAME = 'billing_app.db';

export type SQLQuery = string | { sql: string; args?: any[] };

/**
 * SQLite Database Service
 * Provides a unified interface for all database operations.
 * Uses expo-sqlite/next API (expo-sqlite v13+).
 *
 * Race-condition safe: all public methods call ensureInitialized() which awaits
 * any in-progress init promise rather than throwing immediately — so screens that
 * mount before the root layout's initApp() completes will simply wait for the DB.
 */
class SQLiteService {
  private db: SQLiteDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  /** Called once at app startup. Safe to call multiple times — deduplicates in-flight calls. */
  async initialize(): Promise<void> {
    if (this.db) return;
    if (this.initPromise) return this.initPromise;
    this.initPromise = this._doInitialize();
    return this.initPromise;
  }

  /** Performs the actual DB open + schema creation. */
  private async _doInitialize(): Promise<void> {
    try {
      this.db = await openDatabaseAsync(DB_NAME);
      console.log('SQLite database initialized');
      await this.createSchema();
    } catch (error) {
      this.initPromise = null; // Reset so callers can retry on next attempt
      console.error('Failed to initialize SQLite database:', error);
      throw error;
    }
  }

  /**
   * Ensures the DB is ready before any query.
   * - If already initialized: returns immediately.
   * - If init is in progress: awaits the existing promise (no double-open).
   * - If init hasn't started yet: starts it now (handles race where screen
   *   mounts before _layout useEffect fires).
   */
  private async ensureInitialized(): Promise<void> {
    if (this.db) return;
    await this.initialize();
    if (!this.db) throw new Error('Database initialization failed');
  }

  private async createSchema(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      // Users table
      await this.db.execAsync(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          username TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          role TEXT CHECK(role IN ('admin', 'shopkeeper')) DEFAULT 'shopkeeper',
          shop_name TEXT,
          phone TEXT,
          address TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Customers table
      await this.db.execAsync(`
        CREATE TABLE IF NOT EXISTS customers (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          phone TEXT,
          address TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Vegetables table
      await this.db.execAsync(`
        CREATE TABLE IF NOT EXISTS vegetables (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          tamil_name TEXT,
          image_url TEXT,
          category TEXT,
          wholesale_price REAL DEFAULT 0,
          retail_price REAL DEFAULT 0,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Manual migrations for existing tables that might be missing columns
      await this.ensureColumnExists('vegetables', 'wholesale_price', 'REAL DEFAULT 0');
      await this.ensureColumnExists('vegetables', 'retail_price', 'REAL DEFAULT 0');
      await this.ensureColumnExists('vegetables', 'price', 'REAL DEFAULT 0');
      await this.ensureColumnExists('users', 'shop_name', 'TEXT');
      await this.ensureColumnExists('users', 'phone', 'TEXT');
      await this.ensureColumnExists('users', 'address', 'TEXT');

      // Inventory table (daily pricing and stock)
      await this.db.execAsync(`
        CREATE TABLE IF NOT EXISTS inventory (
          id TEXT PRIMARY KEY,
          vegetable_id TEXT NOT NULL,
          price REAL NOT NULL,
          stock_quantity REAL NOT NULL,
          unit TEXT CHECK(unit IN ('kg', 'piece', 'bundle')) DEFAULT 'kg',
          date TEXT NOT NULL,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (vegetable_id) REFERENCES vegetables(id) ON DELETE CASCADE
        );
      `);

      // Bills table
      await this.db.execAsync(`
        CREATE TABLE IF NOT EXISTS bills (
          id TEXT PRIMARY KEY,
          total_amount REAL NOT NULL,
          discount REAL DEFAULT 0,
          tax REAL DEFAULT 0,
          customer_name TEXT,
          customer_id TEXT,
          payment_method TEXT DEFAULT 'cash',
          payment_status TEXT DEFAULT 'PAID',
          notes TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL
        );
      `);

      // Bill Items table
      await this.db.execAsync(`
        CREATE TABLE IF NOT EXISTS bill_items (
          id TEXT PRIMARY KEY,
          bill_id TEXT NOT NULL,
          vegetable_id TEXT NOT NULL,
          name TEXT,
          tamil_name TEXT,
          quantity REAL NOT NULL,
          unit_price REAL NOT NULL,
          total_price REAL NOT NULL,
          unit TEXT DEFAULT 'kg',
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (bill_id) REFERENCES bills(id) ON DELETE CASCADE
        );
      `);

      // Payments table
      await this.db.execAsync(`
        CREATE TABLE IF NOT EXISTS payments (
          id TEXT PRIMARY KEY,
          bill_id TEXT NOT NULL,
          amount REAL NOT NULL,
          payment_method TEXT DEFAULT 'cash',
          payment_date TEXT DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (bill_id) REFERENCES bills(id) ON DELETE CASCADE
        );
      `);

      // Manual migrations for existing tables that might be missing columns
      await this.ensureColumnExists('bills', 'customer_id', 'TEXT');
      await this.ensureColumnExists('bills', 'tax', 'REAL DEFAULT 0');
      await this.ensureColumnExists('bills', 'payment_status', "TEXT DEFAULT 'PAID'");
      await this.ensureColumnExists('bills', 'notes', 'TEXT');
      await this.ensureColumnExists('bills', 'mode', "TEXT DEFAULT 'Retail'");
      await this.ensureColumnExists('bills', 'updated_at', 'TEXT DEFAULT CURRENT_TIMESTAMP');

      await this.ensureColumnExists('bill_items', 'unit', "TEXT DEFAULT 'kg'");
      await this.ensureColumnExists('bill_items', 'name', "TEXT");
      await this.ensureColumnExists('bill_items', 'tamil_name', "TEXT");
      await this.ensureColumnExists('bill_items', 'created_at', 'TEXT DEFAULT CURRENT_TIMESTAMP');

      // Indexes (one per execAsync call for expo-sqlite/next compatibility)
      await this.db.execAsync(`CREATE INDEX IF NOT EXISTS idx_inventory_vegetable_id ON inventory(vegetable_id);`);
      await this.db.execAsync(`CREATE INDEX IF NOT EXISTS idx_inventory_date ON inventory(date);`);
      await this.db.execAsync(`CREATE INDEX IF NOT EXISTS idx_bill_items_bill_id ON bill_items(bill_id);`);
      await this.db.execAsync(`CREATE INDEX IF NOT EXISTS idx_bill_items_vegetable_id ON bill_items(vegetable_id);`);
      await this.db.execAsync(`CREATE INDEX IF NOT EXISTS idx_bills_customer_id ON bills(customer_id);`);
      await this.db.execAsync(`CREATE INDEX IF NOT EXISTS idx_bills_created_at ON bills(created_at);`);
      await this.db.execAsync(`CREATE INDEX IF NOT EXISTS idx_payments_bill_id ON payments(bill_id);`);

      console.log('Database schema created successfully');
    } catch (error) {
      console.error('Error creating schema:', error);
      throw error;
    }
  }

  /** Helper to add a column if it doesn't exist (basic migration) */
  private async ensureColumnExists(table: string, column: string, definition: string): Promise<void> {
    if (!this.db) return;
    try {
      const tableInfo = await this.db.getAllAsync<any>(`PRAGMA table_info(${table});`);
      const columnExists = tableInfo.some((col: any) => col.name === column);
      if (!columnExists) {
        console.log(`[Migration] Adding missing column ${column} to ${table}`);
        await this.db.execAsync(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition};`);
      }
    } catch (error) {
      console.error(`Failed to ensure column ${column} exists in ${table}:`, error);
    }
  }

  async execute(sql: string, args?: any[], options?: { silent?: boolean }): Promise<SQLiteRunResult> {
    await this.ensureInitialized();
    try {
      return await this.db!.runAsync(sql, args || []);
    } catch (error) {
      if (!options?.silent) {
        console.error('SQL Execute Error:', { sql, args, error });
      }
      throw error;
    }
  }

  async query<T = any>(sql: string, args?: any[]): Promise<T[]> {
    await this.ensureInitialized();
    try {
      return await this.db!.getAllAsync<T>(sql, args || []);
    } catch (error) {
      console.error('SQL Query Error:', { sql, args, error });
      throw error;
    }
  }

  async queryOne<T = any>(sql: string, args?: any[]): Promise<T | null> {
    await this.ensureInitialized();
    try {
      return await this.db!.getFirstAsync<T>(sql, args || []);
    } catch (error) {
      console.error('SQL QueryOne Error:', { sql, args, error });
      throw error;
    }
  }

  /**
   * Runs a callback inside an exclusive transaction.
   * withExclusiveTransactionAsync doesn't return a value, so we use a shared result variable.
   */
  async transaction<T>(callback: (txn: SQLiteDatabase) => Promise<T>): Promise<T> {
    await this.ensureInitialized();

    let result!: T;
    let callbackError: unknown;

    await this.db!.withExclusiveTransactionAsync(async (txn) => {
      try {
        result = await callback(txn);
      } catch (error) {
        callbackError = error;
        throw error; // re-throw so withExclusiveTransactionAsync rolls back
      }
    });

    if (callbackError) throw callbackError;
    return result;
  }

  async resetDatabase(): Promise<void> {
    await this.ensureInitialized();
    try {
      await this.db!.execAsync(`DROP TABLE IF EXISTS payments;`);
      await this.db!.execAsync(`DROP TABLE IF EXISTS bill_items;`);
      await this.db!.execAsync(`DROP TABLE IF EXISTS bills;`);
      await this.db!.execAsync(`DROP TABLE IF EXISTS inventory;`);
      await this.db!.execAsync(`DROP TABLE IF EXISTS vegetables;`);
      await this.db!.execAsync(`DROP TABLE IF EXISTS customers;`);
      await this.db!.execAsync(`DROP TABLE IF EXISTS users;`);
      console.log('Database reset successfully');
      await this.createSchema();
    } catch (error) {
      console.error('Error resetting database:', error);
      throw error;
    }
  }

  async getDatabase(): Promise<SQLiteDatabase> {
    await this.ensureInitialized();
    return this.db!;
  }
}

export const sqliteService = new SQLiteService();
