export interface Bill {
    id: string;
    total_amount: number;
    discount: number;
    tax?: number;
    customer_name?: string;
    customer_id?: string;
    payment_method?: string;
    payment_status?: string;
    notes?: string;
    mode?: 'Retail' | 'Wholesale';
    created_at: string;
    updated_at?: string;
}

export interface BillItem {
    id: string;
    bill_id: string;
    vegetable_id: string;
    name?: string;
    tamil_name?: string;
    quantity: number;
    unit_price: number;
    total_price: number;
    unit?: string;
}
