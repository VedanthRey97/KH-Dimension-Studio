export interface ProductData {
  productName: string;
  itemSize: string;
  printType: string;
}

export interface ProcessedImage {
  sizeName: string;
  printType: string;
  dataUrl: string;
}

export interface ProductGroup {
  id: string;
  productName: string;
  files: {
    canvas?: { file: File, previewUrl: string };
    artwork?: { file: File, previewUrl: string };
  };
  matchedProducts: ProductData[];
  generatedImages: ProcessedImage[];
  status: 'pending' | 'processing' | 'done' | 'error';
}

