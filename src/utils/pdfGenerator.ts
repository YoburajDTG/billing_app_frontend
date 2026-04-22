import * as Print from 'expo-print';
import { shareAsync } from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';

type BillData = {
  shopName: string;
  userName: string;
  billNumber: string;
  phone?: string;
  address?: string;
  date: string;
  items: {
    name: string;
    quantity: number;
    price: number;
    discount?: number;
    total: number;
  }[];
  subTotal: number;
  discount?: number;
  grandTotal: number;
  logo?: string;
  language?: 'English' | 'Tamil';
};

export const generateBillPDF = async (data: BillData, options: { printDirect?: boolean, printerSize?: '2inch' | '3inch' } = {}) => {
  const is3Inch = options.printerSize === '3inch';
  
  // 58mm (2-inch) is ~164pt, 80mm (3-inch) is ~226pt
  const pageWidth = is3Inch ? 226 : 164;
  
  const html = `
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          @page { 
            margin: 0; 
            size: ${is3Inch ? '80mm' : '58mm'} auto;
          }
          * { 
            box-sizing: border-box; 
            -webkit-print-color-adjust: exact; 
            margin: 0; 
            padding: 0;
          }
          body { 
            font-family: 'Inter', 'Helvetica', 'Arial', sans-serif; 
            width: ${is3Inch ? '80mm' : '58mm'};
            padding: ${is3Inch ? '12px 16px' : '8px 10px'}; 
            color: #000;
            background: #fff;
          }
          .header { text-align: center; margin-bottom: 12px; border-bottom: 2px solid #000; padding-bottom: 10px; }
          .shop-name { font-size: ${is3Inch ? '22px' : '18px'}; font-weight: 900; line-height: 1.2; margin-bottom: 4px; }
          .shop-info { font-size: ${is3Inch ? '13px' : '11px'}; font-weight: 600; line-height: 1.4; }
          
          .bill-info { margin-bottom: 12px; font-size: ${is3Inch ? '13px' : '11px'}; line-height: 1.6; border-bottom: 1px dashed #666; padding-bottom: 8px; }
          .bill-info table { width: 100%; }
          .bill-info td { border: none; padding: 1px 0; }
          
          .items-table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
          .items-table th { text-align: left; padding: 6px 0; font-size: ${is3Inch ? '13px' : '11px'}; border-bottom: 2px solid #000; font-weight: 900; }
          .items-table td { padding: 8px 0; font-size: ${is3Inch ? '13px' : '11px'}; vertical-align: top; border-bottom: 1px solid #eee; }
          
          .price-sub { font-size: ${is3Inch ? '11px' : '9px'}; color: #444; font-weight: normal; }
          
          .summary { width: 100%; margin-top: 5px; }
          .summary-row { display: flex; justify-content: space-between; padding: 3px 0; font-size: ${is3Inch ? '14px' : '12px'}; font-weight: 700; }
          .grand-total { 
            margin-top: 8px;
            padding-top: 10px;
            border-top: 2px solid #000;
            display: flex;
            justify-content: space-between;
            font-size: ${is3Inch ? '22px' : '18px'};
            font-weight: 900;
          }
          
          .footer { margin-top: 20px; text-align: center; border-top: 1px dashed #000; padding-top: 12px; }
          .thanks { font-size: ${is3Inch ? '16px' : '14px'}; font-weight: 900; margin-bottom: 5px; }
          .developer { font-size: 8px; color: #999; margin-top: 10px; }
          
          .text-right { text-align: right; }
          .text-center { text-align: center; }
          .bold { font-weight: 900; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="shop-name">${data.shopName || "சுஜி காய்கறி கடை"}</div>
          <div class="shop-info">
            ${data.address || "பாண்டி - திண்டிவனம் மெயின் ரோடு, கிளியனூர்."}<br/>
            Cell: ${data.phone || '9095938085'}
          </div>
        </div>
        
        <div class="bill-info">
          <table>
            <tr>
              <td><b>Bill No:</b> ${data.billNumber}</td>
              <td class="text-right"><b>Date:</b> ${data.date.split(',')[0]}</td>
            </tr>
            <tr>
              <td colspan="2"><b>Customer:</b> ${data.userName}</td>
            </tr>
          </table>
        </div>

        <table class="items-table">
          <thead>
            <tr>
              <th style="width: 55%;">ITEM</th>
              <th class="text-center">QTY</th>
              <th class="text-right">TOTAL</th>
            </tr>
          </thead>
          <tbody>
            ${data.items.map(item => `
              <tr>
                <td>
                  <span class="bold">${item.name}</span><br/>
                  <span class="price-sub">₹${item.price}/kg</span>
                </td>
                <td class="text-center">${item.quantity}kg</td>
                <td class="text-right bold">₹${item.total.toFixed(0)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="summary">
          <div class="summary-row">
            <span>Sub-Total:</span>
            <span>₹${data.subTotal.toFixed(0)}</span>
          </div>
          ${data.discount ? `
          <div class="summary-row">
            <span>Discount:</span>
            <span>- ₹${data.discount.toFixed(0)}</span>
          </div>` : ''}
          <div class="grand-total">
            <span>TOTAL:</span>
            <span>₹${data.grandTotal.toFixed(0)}</span>
          </div>
        </div>

        <div class="footer">
          <div class="thanks">நன்றி! மீண்டும் வருக!</div>
          <div style="font-size: 10px; font-weight: 700;">Visit Again!</div>
          <div class="developer">Automated Billing System</div>
        </div>
      </body>
    </html>
  `;

  // Tighter height calculation to eliminate bottom white space
  const estimatedHeight = (is3Inch ? 160 : 130) + (data.items.length * (is3Inch ? 28 : 24));

  try {
    if (options.printDirect) {
      await Print.printAsync({
        html,
        width: pageWidth,
        height: estimatedHeight,
      });
    } else {
      // Build a clean filename: "Suji_Bill_<billNumber>.pdf"
      const safeBillNumber = data.billNumber.replace(/[^a-zA-Z0-9_\-]/g, '_');
      const fileName = `Suji_Bill_${safeBillNumber}.pdf`;

      const { uri } = await Print.printToFileAsync({
        html,
        width: pageWidth,
        height: estimatedHeight,
      });

      // Rename the temp file to the desired filename
      const destUri = `${FileSystem.cacheDirectory}${fileName}`;
      await FileSystem.moveAsync({ from: uri, to: destUri });

      console.log('File has been saved to:', destUri);
      await shareAsync(destUri, { UTI: '.pdf', mimeType: 'application/pdf' });
    }
  } catch (error) {
    console.error('Error generating/printing bill:', error);
  }
};

