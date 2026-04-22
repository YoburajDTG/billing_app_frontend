import { Alert, Platform, NativeModules, PermissionsAndroid } from 'react-native';
import { Storage, KEYS } from '../services/storage';

import { BluetoothEscposPrinter, BluetoothManager } from '@brooons/react-native-bluetooth-escpos-printer';

export const isPrinterAvailable = !!(BluetoothManager && BluetoothEscposPrinter);

export interface ReceiptItem {
    name: string;
    tamilName?: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    unit?: string;
}

export interface ReceiptData {
    shopName: string;
    billId: string;
    date: string;
    items: ReceiptItem[];
    totalAmount: number;
    discount?: number;
    customerName?: string;
    customerMobile?: string;
    shopPhone?: string;
    shopAddress?: string;
    gstNumber?: string;
    receivedAmount?: number;
    balanceAmount?: number;
}

// 80mm (3 inch) printer usually has 48 characters width
const COLUMN_WIDTH_80MM = 48;

export const ThermalPrinter = {
    /**
     * Request necessary permissions for Bluetooth on Android
     */
    async requestPermissions() {
        if (Platform.OS !== 'android') return true;
        
        try {
            if (Platform.Version >= 31) {
                const granted = await PermissionsAndroid.requestMultiple([
                    PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
                    PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
                    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
                ]);

                return (
                    granted['android.permission.BLUETOOTH_SCAN'] === PermissionsAndroid.RESULTS.GRANTED &&
                    granted['android.permission.BLUETOOTH_CONNECT'] === PermissionsAndroid.RESULTS.GRANTED &&
                    granted['android.permission.ACCESS_FINE_LOCATION'] === PermissionsAndroid.RESULTS.GRANTED
                );
            } else {
                const granted = await PermissionsAndroid.request(
                    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
                );
                return granted === PermissionsAndroid.RESULTS.GRANTED;
            }
        } catch (err) {
            console.warn('Permission request error:', err);
            return false;
        }
    },

    /**
     * Connect to a printer. If address is provided, connect to it.
     * If no address, try connecting to the last used printer.
     */
    async connectPrinter(address?: string) {
        if (!isPrinterAvailable) return { success: false, message: 'Printer module not available' };
        
        const targetAddress = address || await Storage.getItem(KEYS.LAST_PRINTER);
        if (!targetAddress) return { success: false, message: 'No printer selected' };

        try {
            const isEnabled = await BluetoothManager.isBluetoothEnabled();
            if (!isEnabled) {
                return { success: false, message: 'Bluetooth is turned off' };
            }

            // Attempt connection with a small retry logic for stability
            let result = null;
            try {
                result = await BluetoothManager.connect(targetAddress);
            } catch (e) {
                // Wait 1 second and retry once
                await new Promise(resolve => setTimeout(resolve, 1000));
                result = await BluetoothManager.connect(targetAddress);
            }
            
            // Save as last printer if successful
            if (address) {
                await Storage.setItem(KEYS.LAST_PRINTER, address);
            }
            
            return { success: true, message: 'Connected successfully' };
        } catch (error) {
            console.error('Connection failed:', error);
            return { 
                success: false, 
                message: 'Failed to connect. Please try pairing the printer in your Phone Settings first then try again.' 
            };
        }
    },

    /**
     * Print a formatted invoice
     */
    async printInvoice(data: ReceiptData) {
        if (!isPrinterAvailable) {
            console.warn('Printer native module not available.');
            return false;
        }

        try {
            // 1. Ensure connected
            const connection = await this.connectPrinter();
            if (!connection.success) {
                Alert.alert('Printer Error', connection.message);
                return false;
            }

            // 2. Start Printing
            // 80mm layout
            const width = COLUMN_WIDTH_80MM;
            const divider = '-'.repeat(width) + '\n';

            await BluetoothEscposPrinter.printerAlign(1); // CENTER
            await BluetoothEscposPrinter.setBlob(1); // Bold
            await BluetoothEscposPrinter.printText(`${data.shopName}\n`, {
                widthtimes: 1, // Double width for shop name
                heigthtimes: 1,
            });
            await BluetoothEscposPrinter.setBlob(0);
            
            if (data.shopAddress) {
                await BluetoothEscposPrinter.printText(`${data.shopAddress}\n`, {});
            }
            if (data.shopPhone) {
                await BluetoothEscposPrinter.printText(`Phone: ${data.shopPhone}\n`, {});
            }
            if (data.gstNumber) {
                await BluetoothEscposPrinter.printText(`GST: ${data.gstNumber}\n`, {});
            }
            
            await BluetoothEscposPrinter.printText(divider, {});

            await BluetoothEscposPrinter.printerAlign(0); // LEFT
            // Bill Info Line
            const dateStr = `Date: ${data.date}`;
            const billStr = `Bill: ${data.billId}`;
            const infoLine = dateStr + ' '.repeat(width - dateStr.length - billStr.length) + billStr + '\n';
            await BluetoothEscposPrinter.printText(infoLine, {});

            if (data.customerName) {
                await BluetoothEscposPrinter.printText(`Customer: ${data.customerName}\n`, {});
            }
            if (data.customerMobile) {
                await BluetoothEscposPrinter.printText(`Mobile  : ${data.customerMobile}\n`, {});
            }
            
            await BluetoothEscposPrinter.printText(divider, {});

            // Table Header: Item (24), Qty (8), Rate (8), Total (8) -> 48 chars
            const header = 'Item'.padEnd(24) + 'Qty'.padStart(8) + 'Rate'.padStart(8) + 'Total'.padStart(8) + '\n';
            await BluetoothEscposPrinter.printText(header, {});
            await BluetoothEscposPrinter.printText(divider, {});

            for (const item of data.items) {
                // Handle long item names by wrapping or truncating
                const name = item.name.length > 23 ? item.name.substring(0, 23) : item.name;
                const qtyLine = name.padEnd(24) + 
                               item.quantity.toString().padStart(8) + 
                               item.unitPrice.toFixed(2).padStart(8) + 
                               item.totalPrice.toFixed(2).padStart(8) + '\n';
                
                await BluetoothEscposPrinter.printText(qtyLine, {});
            }

            await BluetoothEscposPrinter.printText(divider, {});

            // Summary
            await BluetoothEscposPrinter.printerAlign(2); // RIGHT
            const totalText = `GRAND TOTAL: Rs. ${data.totalAmount.toFixed(2)}`;
            await BluetoothEscposPrinter.setBlob(1);
            await BluetoothEscposPrinter.printText(`${totalText}\n`, {
                widthtimes: 0,
                heigthtimes: 0,
            });
            await BluetoothEscposPrinter.setBlob(0);

            if (data.receivedAmount !== undefined) {
                await BluetoothEscposPrinter.printText(`Received: Rs. ${data.receivedAmount.toFixed(2)}\n`, {});
                await BluetoothEscposPrinter.printText(`Balance : Rs. ${data.balanceAmount?.toFixed(2) || '0.00'}\n`, {});
            }

            await BluetoothEscposPrinter.printText('\n', {});
            await BluetoothEscposPrinter.printerAlign(1); // CENTER
            await BluetoothEscposPrinter.printText('Thank you! Visit Again\n', {});
            await BluetoothEscposPrinter.printText('Powered by VegBilling App\n', {});
            
            // Feed and Cut
            await BluetoothEscposPrinter.printText('\n\n\n', {});
            await BluetoothEscposPrinter.printText('\x1dV\x42\x00', {}); // Cut command

            return true;
        } catch (error) {
            console.error('Print failed:', error);
            Alert.alert('Print Error', 'Printing failed. Please check connection and try again.');
            return false;
        }
    },

    /**
     * Logic to be called after invoice save
     */
    async autoPrintAfterSave(data: ReceiptData) {
        const isAutoPrintEnabled = await Storage.getItem(KEYS.AUTO_PRINT);
        if (isAutoPrintEnabled) {
            return await this.printInvoice(data);
        }
        return false;
    },

    /**
     * Discover Bluetooth devices
     */
    async discoverDevices() {
        if (!isPrinterAvailable || Platform.OS !== 'android') return [];
        
        try {
            const hasPermission = await this.requestPermissions();
            if (!hasPermission) return [];

            // Get paired devices FIRST (instantly)
            const paired = await this.getPairedDevices();
            
            // Start scanning for NEW devices
            const scanResult = await BluetoothManager.scanDevices();
            let found = [];
            
            try {
                // The scanResult is usually a JSON string
                const parsed = typeof scanResult === 'string' ? JSON.parse(scanResult) : scanResult;
                found = parsed.found || [];
            } catch (e) {
                console.warn('Error parsing scan result:', e);
            }

            // Combine and format
            const allDevices = [...paired];
            
            found.forEach((dev: any) => {
                const device = typeof dev === 'string' ? JSON.parse(dev) : dev;
                if (!allDevices.some(d => d.address === device.address)) {
                    allDevices.push({
                        name: device.name || 'Unknown Device',
                        address: device.address,
                        type: 'found'
                    });
                }
            });

            return allDevices;
        } catch (error) {
            console.error('Discovery failed:', error);
            // Fallback to just paired devices if scan fails
            return await this.getPairedDevices();
        }
    },

    /**
     * Get paired devices
     */
    async getPairedDevices() {
        if (!isPrinterAvailable || Platform.OS !== 'android') return [];
        try {
            const response = await BluetoothManager.getPairedDevices();
            const devices = typeof response === 'string' ? JSON.parse(response) : response;
            
            return (devices || []).map((d: any) => ({
                name: d.name || 'Unknown Device',
                address: d.address,
                type: 'paired'
            }));
        } catch (error) {
            console.error('Error getting paired devices:', error);
            return [];
        }
    },

    /**
     * Print a test page
     */
    async testPrint() {
        if (!isPrinterAvailable) return;
        try {
            const connection = await this.connectPrinter();
            if (!connection.success) {
                Alert.alert('Error', connection.message);
                return;
            }

            await BluetoothEscposPrinter.printerAlign(1);
            await BluetoothEscposPrinter.printText('--- TEST PRINT ---\n', {});
            await BluetoothEscposPrinter.printText('Printer is working correctly!\n', {});
            await BluetoothEscposPrinter.printText('80mm / 3 inch Support\n', {});
            await BluetoothEscposPrinter.printText('------------------\n', {});
            await BluetoothEscposPrinter.printText('\n\n\n', {});
            await BluetoothEscposPrinter.printText('\x1dV\x42\x00', {});
        } catch (e) {
            console.error(e);
        }
    }
};
