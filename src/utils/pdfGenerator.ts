import * as Print from 'expo-print';
import { shareAsync } from 'expo-sharing';

type BillData = {
  shopName: string;
  userName: string;
  billNumber: string;
  phone?: string;
  address?: string;
  date: string;
  items: Array<{
    name: string;
    quantity: number;
    price: number;
    discount?: number;
    total: number;
  }>;
  subTotal: number;
  discount?: number;
  grandTotal: number;
  logo?: string;
  language?: 'English' | 'Tamil';
};

export const generateBillPDF = async (data: BillData) => {
  const html = `
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          @page { margin: 0 !important; }
          * { box-sizing: border-box; }
          html, body {
            margin: 0;
            padding: 0;
            width: 100%;
            background-color: #fff;
          }
          body { 
            font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; 
            padding: 4px; 
            color: #000; 
            -webkit-print-color-adjust: exact;
          }
          .header { text-align: center; margin-bottom: 6px; border-bottom: 1px dashed #000; padding-bottom: 6px; }
          .shop-name { font-size: 14px; font-weight: 800; color: #000; margin-bottom: 2px; }
          .shop-address { font-size: 9px; font-weight: 500; margin-bottom: 2px; line-height: 1.2; }
          .shop-phone { font-size: 9px; font-weight: 700; }
          
          .bill-meta { margin-bottom: 6px; font-size: 9px; line-height: 1.3; }
          .bill-meta b { font-weight: 700; }
          
          table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
          th { text-align: left; padding: 3px 0; font-size: 9px; border-bottom: 1px solid #000; }
          td { padding: 4px 0; font-size: 9px; vertical-align: top; }
          .text-right { text-align: right; }
          .text-center { text-align: center; }

          .summary-table { width: 100%; margin-top: 4px; border-top: 1px dashed #000; padding-top: 4px; }
          .summary-row { display: flex; justify-content: space-between; padding: 1px 0; font-size: 10px; font-weight: 600; }
          .total-row { padding-top: 3px; border-top: 1px solid #000; margin-top: 3px; font-size: 13px; font-weight: 800; }
          
          .footer { margin-top: 12px; text-align: center; font-size: 10px; font-weight: 700; border-top: 1px dashed #000; padding-top: 6px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="shop-name">${data.shopName}</div>
          <div class="shop-address">${data.address || 'பாண்டி - திண்டிவனம் மெயின் ரோடு, கிளியனூர்.'}</div>
          <div class="shop-phone">${data.language === 'Tamil' ? 'தொலைபேசி' : 'Phone'}: ${data.phone || '9095938085'}</div>
        </div>
        
        <div class="bill-meta">
          <div><b>${data.language === 'Tamil' ? 'தேதி' : 'Date'}:</b> ${data.date}</div>
          <div><b>${data.language === 'Tamil' ? 'ரசீது எண்' : 'No'}:</b> ${data.billNumber.slice(-8)}</div>
          <div><b>${data.language === 'Tamil' ? 'வாடிக்கையாளர்' : 'Cust'}:</b> ${data.userName}</div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 45%;">${data.language === 'Tamil' ? 'பொருள்' : 'ITEM'}</th>
              <th class="text-center">${data.language === 'Tamil' ? 'அளவு' : 'QTY'}</th>
              <th class="text-right">${data.language === 'Tamil' ? 'மொத்தம்' : 'TOTAL'}</th>
            </tr>
          </thead>
          <tbody>
            ${data.items.map(item => `
              <tr>
                <td><b>${item.name}</b><br/><span style="font-size: 8px;">₹${item.price}/kg</span></td>
                <td class="text-center">${item.quantity}kg</td>
                <td class="text-right">₹${item.total.toFixed(0)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="summary-table">
          <div class="summary-row">
            <span>${data.language === 'Tamil' ? 'சிறுது தொகை' : 'Sub-Total'}:</span>
            <span>₹${data.subTotal.toFixed(0)}</span>
          </div>
          ${data.discount ? `
          <div class="summary-row">
            <span>${data.language === 'Tamil' ? 'தள்ளுபடி' : 'Discount'}:</span>
            <span>- ₹${data.discount.toFixed(0)}</span>
          </div>` : ''}
          <div class="summary-row total-row">
            <span>${data.language === 'Tamil' ? 'மொத்தம்' : 'GRAND TOTAL'}:</span>
            <span>₹${data.grandTotal.toFixed(0)}</span>
          </div>
        </div>

        <div class="footer">
          நன்றி! மீண்டும் வருக!
        </div>
      </body>
    </html>
  `;

  // Calculate approximate height for thermal roll (58mm width)
  // Tightened to reduce excessive bottom white space
  const estimatedHeight = 180 + (data.items.length * 30);

  try {
    const { uri } = await Print.printToFileAsync({ 
      html,
      width: 155, // Adjusted to remove right white space
      height: estimatedHeight,
    });
    console.log('File has been saved to:', uri);
    await shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
  } catch (error) {
    console.error('Error generating PDF:', error);
  }
};
