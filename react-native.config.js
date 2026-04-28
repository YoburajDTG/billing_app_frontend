module.exports = {
  dependencies: {
    '@brooons/react-native-bluetooth-escpos-printer': {
      platforms: {
        android: {
          sourceDir: './node_modules/@brooons/react-native-bluetooth-escpos-printer/android',
          packageImportPath: 'import cn.jystudio.bluetooth.RNBluetoothEscposPrinterPackage;',
          packageInstance: 'new RNBluetoothEscposPrinterPackage()',
        },
      },
    },
  },
};
