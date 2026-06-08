import Papa from 'papaparse';
import { ProductData } from '../types';

const CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQsmbHRSxd7Ved68jbVTOInX0eAIFWGhmX-jHDv2aJcZXaHkOHjdIb4zeq8YVKvc9eFvGlYBcjCl-Lf/pub?output=csv";

export async function fetchSheetData(): Promise<ProductData[]> {
    return new Promise((resolve, reject) => {
        Papa.parse(CSV_URL, {
            download: true,
            header: true,
            complete: (results) => {
                const data = results.data.map((row: any) => ({
                    productName: row['Product Name']?.trim() || '',
                    itemSize: row['Item Size (Length*width*height)']?.trim() || '',
                    printType: row['Fine art surface Print / Canvas Print']?.trim() || '',
                })).filter((p: ProductData) => p.productName);
                resolve(data);
            },
            error: (error: any) => {
                reject(error);
            }
        });
    });
}
