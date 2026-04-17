import { Alert, Platform, NativeModules, PermissionsAndroid } from 'react-native';

const { BluetoothEscposPrinter, BluetoothManager } = NativeModules;
const isPrinterAvailable = !!(BluetoothManager && BluetoothEscposPrinter);

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
}

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
            console.warn(err);
            return false;
        }
    },

    /**
     * Scan for ALL available devices (paired and unpaired)
     */
    async discoverDevices() {
        if (!isPrinterAvailable || Platform.OS !== 'android') return [];
        
        const hasPermission = await this.requestPermissions();
        if (!hasPermission) return [];

        try {
            // scanDevices returns a JSON string with found devices
            const devices = await BluetoothManager.scanDevices();
            const parsed = JSON.parse(devices);
            // Combine found and paired for a better UX
            const paired = await this.getPairedDevices();
            
            // Filter unique devices by address
            const allDevices = [...paired];
            const found = parsed.found || [];
            
            found.forEach((d: any) => {
                if (!allDevices.find(a => a.address === d.address)) {
                    allDevices.push(d);
                }
            });
            
            return allDevices;
        } catch (error) {
            console.error('Error scanning devices:', error);
            return await this.getPairedDevices();
        }
    },

    /**
     * Connect to a specific device by address
     */
    async connect(address: string) {
        if (!isPrinterAvailable) return false;
        try {
            await BluetoothManager.connect(address);
            return true;
        } catch (error) {
            console.error('Connection failed:', error);
            return false;
        }
    },

    /**
     * Check if Bluetooth is enabled
     */
    async isBluetoothEnabled() {
        if (!isPrinterAvailable) return false;
        try {
            return await BluetoothManager.isBluetoothEnabled();
        } catch (error) {
            console.error('Error checking bluetooth:', error);
            return false;
        }
    },

    /**
     * Format and print receipt for 8mm (3 inch) paper
     */
    async printReceipt(data: ReceiptData) {
        if (!isPrinterAvailable) {
            console.warn('Printer native module not available. This is normal in Expo Go.');
            return;
        }
        try {
            const isEnabled = await this.isBluetoothEnabled();
            if (!isEnabled) {
                Alert.alert('Bluetooth Off', 'Please turn on Bluetooth to print.');
                return;
            }

            // If not connected, we might need to auto-connect to the last used printer
            // For now, assume connection is handled by a settings screen or auto-select first paired
            
            // ESC/POS Commands
            await BluetoothEscposPrinter.printerAlign(1); // CENTER
            await BluetoothEscposPrinter.setBlob(1); // Bold
            await BluetoothEscposPrinter.printText(`${data.shopName}\n`, {
                encoding: 'GBK',
                codepage: 0,
                widthtimes: 1,
                heigthtimes: 1,
                fonttype: 0
            });
            await BluetoothEscposPrinter.setBlob(0);
            await BluetoothEscposPrinter.printText('--------------------------------\n', {});

            await BluetoothEscposPrinter.printerAlign(0); // LEFT
            await BluetoothEscposPrinter.printText(`Date: ${data.date}\n`, {});
            await BluetoothEscposPrinter.printText(`Bill No: ${data.billId}\n`, {});
            if (data.customerName) {
                await BluetoothEscposPrinter.printText(`Cust: ${data.customerName}\n`, {});
            }
            await BluetoothEscposPrinter.printText('--------------------------------\n', {});

            // Header for items
            // 80mm printer usually has ~48 characters per line
            // Name (left) -> 30 chars, Total (right) -> 18 chars
            await BluetoothEscposPrinter.printText('Item                 Qty    Price\n', {});
            await BluetoothEscposPrinter.printText('--------------------------------\n', {});

            for (const item of data.items) {
                const name = item.name.substring(0, 20);
                const qty = item.quantity.toString().padEnd(6);
                const price = item.totalPrice.toFixed(2).padStart(8);
                
                await BluetoothEscposPrinter.printText(`${name.padEnd(20)}${qty}${price}\n`, {});
                
                // If there's a Tamil name, we might want to print it too
                // Note: Standard ESC/POS doesn't support Tamil fonts well. 
                // Advanced users print Tamil as an Image/Bitmap.
            }

            await BluetoothEscposPrinter.printText('--------------------------------\n', {});
            await BluetoothEscposPrinter.printerAlign(2); // RIGHT
            await BluetoothEscposPrinter.setBlob(1);
            await BluetoothEscposPrinter.printText(`TOTAL: Rs.${data.totalAmount.toFixed(2)}\n`, {
                widthtimes: 1,
                heigthtimes: 1,
            });
            await BluetoothEscposPrinter.setBlob(0);
            
            await BluetoothEscposPrinter.printerAlign(1); // CENTER
            await BluetoothEscposPrinter.printText('\nThank you! Visit Again\n\n\n', {});
            
            // Cut paper
            await BluetoothEscposPrinter.printText('\x1dV\x42\x00', {}); // Standard Cut command (GS V m n)

        } catch (error) {
            console.error('Printing error:', error);
            Alert.alert('Printer Error', 'Failed to print the bill. Please check printer connection.');
        }
    }
};
