import { Alert, Platform, PermissionsAndroid } from 'react-native';
import { Storage, KEYS } from '../services/storage';

let BluetoothEscposPrinter: any;
let BluetoothManager: any;

const loadPrinterModules = () => {
    try {
        const BluetoothModule = require('@brooons/react-native-bluetooth-escpos-printer');
        BluetoothEscposPrinter = BluetoothModule.BluetoothEscposPrinter;
        BluetoothManager = BluetoothModule.BluetoothManager;
        return true;
    } catch (e) {
        console.warn('Bluetooth printer modules not found', e);
        return false;
    }
};

export const isPrinterAvailable = true;

/**
 * Utility for thermal printer operations
 * This utility EXCLUSIVELY uses image-based printing (printPic)
 * to ensure perfect alignment and Tamil language support.
 */
export const ThermalPrinter = {
    /**
     * Request necessary permissions for Bluetooth on Android
     */
    async requestPermissions() {
        if (Platform.OS !== 'android') return true;
        
        try {
            if (Platform.Version >= 31) {
                const permissions = [
                    'android.permission.BLUETOOTH_SCAN' as any,
                    'android.permission.BLUETOOTH_CONNECT' as any,
                ];
                
                if (Platform.Version < 33) {
                    permissions.push(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
                }

                const granted = await PermissionsAndroid.requestMultiple(permissions);
                
                const scanGranted = granted['android.permission.BLUETOOTH_SCAN' as any] === PermissionsAndroid.RESULTS.GRANTED;
                const connectGranted = granted['android.permission.BLUETOOTH_CONNECT' as any] === PermissionsAndroid.RESULTS.GRANTED;
                
                return scanGranted && connectGranted;
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
     * Connect to a printer. 
     */
    async connectPrinter(address?: string) {
        if (!loadPrinterModules()) return { success: false, message: 'Printer module not available.' };
        
        const targetAddress = address || await Storage.getItem(KEYS.LAST_PRINTER);
        if (!targetAddress) return { success: false, message: 'No printer selected' };

        console.log(`Attempting connection to: ${targetAddress}`);

        try {
            if (typeof BluetoothManager?.checkBluetoothEnabled !== 'function') {
                return { success: false, message: 'Bluetooth Manager not initialized.' };
            }

            const hasPermission = await this.requestPermissions();
            if (!hasPermission) {
                return { success: false, message: 'Bluetooth permissions required.' };
            }

            const isEnabled = await BluetoothManager.checkBluetoothEnabled();
            if (!isEnabled) {
                try {
                    await BluetoothManager.enableBluetooth();
                    await new Promise(resolve => setTimeout(resolve, 2000));
                } catch (e) {
                    return { success: false, message: 'Please turn on Bluetooth.' };
                }
            }

            // PRIMARY CONNECTION ATTEMPT
            try {
                await BluetoothManager.connect(targetAddress);
                console.log('Printer connected successfully (Primary)');
                return { success: true };
            } catch (firstErr) {
                console.warn('Primary connection failed, attempting Discovery-Connect retry...', firstErr);
                
                // DISCOVERY-CONNECT RETRY: Briefly scan to "wake up" the OS Bluetooth handle
                try {
                    await BluetoothManager.scanDevices();
                    await new Promise(resolve => setTimeout(resolve, 1500)); // Short scan window
                } catch (scanErr) {
                    console.warn('Retry scan failed:', scanErr);
                }

                // SECONDARY CONNECTION ATTEMPT
                await BluetoothManager.connect(targetAddress);
                console.log('Printer connected successfully (Retry)');
                return { success: true };
            }
        } catch (error: any) {
            console.error('Connection failed definitively for:', targetAddress, error);
            return { success: false, message: error.message || 'Connection failed' };
        }
    },

    /**
     * Print a Base64 image or a file URI
     * @param uriOrBase64 - The image source
     * @param width - The target print width (384 for 2-inch, 576 for 3-inch)
     */
    async printImage(uriOrBase64: string, width: number = 384) {
        if (!loadPrinterModules()) return false;
        try {
            const connection = await this.connectPrinter();
            if (!connection.success) return false;

            // WARM-UP DELAY: Give the printer a moment to stabilize the socket after connection
            await new Promise(resolve => setTimeout(resolve, 1500));

            let base64Data = '';

            if (uriOrBase64.startsWith('file://') || uriOrBase64.startsWith('/') || uriOrBase64.startsWith('content://')) {
                try {
                    const FileSystem = require('expo-file-system/legacy');
                    base64Data = await FileSystem.readAsStringAsync(uriOrBase64, {
                        encoding: 'base64',
                    });
                } catch (readErr) {
                    console.error('Failed to read image file:', readErr);
                    return false;
                }
            } else {
                base64Data = uriOrBase64.includes(',') ? uriOrBase64.split(',')[1] : uriOrBase64;
            }
            
            if (!base64Data) return false;

            const printWidth = width || 384;
            
            // 1. Initialize & Reset
            await BluetoothEscposPrinter.printText('\x1b\x40', {}); 
            await new Promise(resolve => setTimeout(resolve, 500));

            // 2. Center Alignment
            await BluetoothEscposPrinter.printerAlign(1); 
            
            // 3. Print Image - Centered
            await BluetoothEscposPrinter.printPic(base64Data, {
                width: printWidth
            });
            
            // 4. Feed paper
            await BluetoothEscposPrinter.printAndFeed(6); 
            return true;
        } catch (error) {
            console.error('Image print failed:', error);
            return false;
        }
    },

    /**
     * Discover Bluetooth devices
     */
    async discoverDevices() {
        if (!loadPrinterModules() || Platform.OS !== 'android') return [];
        try {
            const hasPermission = await this.requestPermissions();
            if (!hasPermission) return [];

            const paired = await this.getPairedDevices();
            let allDevices = [...paired];
            
            try {
                const scanResult = await BluetoothManager.scanDevices();
                let found = [];
                if (scanResult) {
                    const parsed = typeof scanResult === 'string' ? JSON.parse(scanResult) : scanResult;
                    found = parsed.found || parsed || [];
                }

                if (Array.isArray(found)) {
                    found.forEach((dev: any) => {
                        let device = dev;
                        try { if (typeof dev === 'string') device = JSON.parse(dev); } catch (e) {}
                        if (device && device.address && !allDevices.some(d => d.address === device.address)) {
                            allDevices.push({
                                name: device.name || 'Unknown Device',
                                address: device.address,
                                type: 'found'
                            });
                        }
                    });
                }
            } catch (e) {}

            return allDevices;
        } catch (error) {
            return await this.getPairedDevices();
        }
    },

    /**
     * Get paired devices
     */
    async getPairedDevices() {
        if (!loadPrinterModules() || Platform.OS !== 'android') return [];
        try {
            const response = await BluetoothManager.getPairedDevices();
            const devices = typeof response === 'string' ? JSON.parse(response) : response;
            return (devices || []).map((d: any) => ({
                name: d.name || 'Unknown Device',
                address: d.address,
                type: 'paired'
            }));
        } catch (error) {
            return [];
        }
    },

    /**
     * Diagnostic test print
     */
    async testPrint() {
        if (!loadPrinterModules()) return;
        try {
            const connection = await this.connectPrinter();
            if (!connection.success) return;

            await BluetoothEscposPrinter.printerAlign(1);
            await BluetoothEscposPrinter.printText('--- PRINTER TEST ---\n', {});
            await BluetoothEscposPrinter.printText('Image Mode Ready\n', {});
            await BluetoothEscposPrinter.printText('--------------------\n', {});
            await BluetoothEscposPrinter.printAndFeed(4);
        } catch (e) {}
    }
};
