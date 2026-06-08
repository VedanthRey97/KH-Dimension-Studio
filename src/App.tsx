/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { Download, Loader2, Folder as FolderIcon, Image as ImageIcon, CheckCircle, AlertCircle, Trash2 } from 'lucide-react';
import { fetchSheetData } from './lib/sheetParser';
import { generateDimensionImage } from './lib/imageGenerator';
import { Dropzone } from './components/Dropzone';
import { ProductData, ProductGroup, ProcessedImage } from './types';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

export default function App() {
  const [products, setProducts] = useState<ProductData[]>([]);
  const [productGroups, setProductGroups] = useState<ProductGroup[]>([]);
  const [isFetching, setIsFetching] = useState(true);
  const [isProcessingAll, setIsProcessingAll] = useState(false);

  useEffect(() => {
    fetchSheetData()
      .then(data => setProducts(data))
      .catch(err => console.error("Failed to load sheet data", err))
      .finally(() => setIsFetching(false));
  }, []);

  const handleFilesAdded = (files: File[]) => {
    const uniqueProductNames = Array.from(new Set(products.map(p => p.productName)));
    const incomingMap = new Map<string, { canvas?: File, artwork?: File }>();

    for (const file of files) {
      let productName = "";
      let variant: 'canvas' | 'artwork' | null = null;
      const fNameLower = file.name.toLowerCase();

      if (fNameLower.includes('canvas')) variant = 'canvas';
      else if (fNameLower.includes('artwork')) variant = 'artwork';

      // Parse folder names to detect product
      if (file.webkitRelativePath) {
          const parts = file.webkitRelativePath.split('/');
          if (parts.length >= 2) {
              for (let i = parts.length - 2; i >= 0; i--) {
                  const folderName = parts[i];
                  const match = uniqueProductNames.find(p => p.toLowerCase() === folderName.toLowerCase());
                  if (match) {
                      productName = match;
                      break;
                  }
              }
              if (!productName) {
                  productName = parts[parts.length - 2]; 
              }
          }
      }

      if (!productName) {
          const match = uniqueProductNames.find(p => fNameLower.includes(p.toLowerCase()));
          if (match) productName = match;
          else productName = file.name.split('.')[0]; 
      }

      const exactMatch = uniqueProductNames.find(p => p.toLowerCase() === productName.toLowerCase());
      if (exactMatch) productName = exactMatch;

      if (!incomingMap.has(productName)) {
          incomingMap.set(productName, {});
      }
      
      if (variant) {
          const entry = incomingMap.get(productName)!;
          if (variant === 'canvas') entry.canvas = file;
          if (variant === 'artwork') entry.artwork = file;
      }
    }

    setProductGroups(prev => {
        const updated = [...prev];
        incomingMap.forEach((variantFiles, pName) => {
            const existingIdx = updated.findIndex(g => g.productName === pName && g.status === 'pending');
            if (existingIdx >= 0) {
                const ext = { ...updated[existingIdx] };
                ext.files = { ...ext.files };
                if (variantFiles.canvas) {
                    ext.files.canvas = { file: variantFiles.canvas, previewUrl: URL.createObjectURL(variantFiles.canvas) };
                }
                if (variantFiles.artwork) {
                    ext.files.artwork = { file: variantFiles.artwork, previewUrl: URL.createObjectURL(variantFiles.artwork) };
                }
                updated[existingIdx] = ext;
            } else {
                 const matched = products.filter(p => p.productName === pName);
                 updated.unshift({
                     id: Math.random().toString(36).substring(2, 9),
                     productName: pName,
                     files: {
                         ...(variantFiles.canvas ? { canvas: { file: variantFiles.canvas, previewUrl: URL.createObjectURL(variantFiles.canvas) } } : {}),
                         ...(variantFiles.artwork ? { artwork: { file: variantFiles.artwork, previewUrl: URL.createObjectURL(variantFiles.artwork) } } : {})
                     },
                     matchedProducts: matched,
                     generatedImages: [],
                     status: 'pending'
                 });
            }
        });
        return updated;
    });
  };

  const handleManualUpload = (groupId: string, variant: 'canvas' | 'artwork', e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setProductGroups(prev => prev.map(g => {
        if (g.id === groupId) {
           const newFiles = { ...g.files };
           newFiles[variant] = { file, previewUrl: URL.createObjectURL(file) };
           return { ...g, files: newFiles };
        }
        return g;
      }));
    }
    e.target.value = '';
  };

  const removeGroup = (id: string) => {
    setProductGroups(prev => prev.filter(g => g.id !== id));
  };

  const processGroup = async (group: ProductGroup) => {
    if (group.matchedProducts.length === 0) return;
    
    setProductGroups(prev => prev.map(g => g.id === group.id ? { ...g, status: 'processing' } : g));
    
    try {
      const generated: ProcessedImage[] = [];

      const uniqueTasks = new Map<string, ProductData>();
      for (const p of group.matchedProducts) {
          const key = p.itemSize + "||" + p.printType;
          if (!uniqueTasks.has(key)) uniqueTasks.set(key, p);
      }

      await Promise.all(
        Array.from(uniqueTasks.values()).map(async (task) => {
            const isCanvasParam = task.printType.toLowerCase().includes('canvas');
            const sourceInfo = isCanvasParam ? group.files.canvas : group.files.artwork;
            if (sourceInfo) {
                const dataUrl = await generateDimensionImage(sourceInfo.previewUrl, task.itemSize);
                generated.push({ sizeName: task.itemSize, printType: task.printType, dataUrl });
            }
        })
      );
      
      setProductGroups(prev => prev.map(g => g.id === group.id ? { ...g, generatedImages: generated, status: 'done' } : g));
    } catch (err) {
      console.error(err);
      setProductGroups(prev => prev.map(g => g.id === group.id ? { ...g, status: 'error' } : g));
    }
  };

  const processAll = async () => {
    setIsProcessingAll(true);
    const pending = productGroups.filter(g => g.status === 'pending');
    for (const g of pending) {
      await processGroup(g);
    }
    setIsProcessingAll(false);
  };

  const downloadAll = async () => {
    const zip = new JSZip();
    let hasFiles = false;
    
    productGroups.forEach(group => {
      group.generatedImages.forEach(gen => {
         const base64Data = gen.dataUrl.replace(/^data:image\/(png|jpeg);base64,/, "");
         const ext = gen.dataUrl.includes('jpeg') ? 'jpg' : 'png';
         const kind = gen.printType.replace(/\s/g, '_');
         const name = `${group.productName}_${kind}_${gen.sizeName.replace(/\s/g, '_')}.${ext}`;
         zip.file(name, base64Data, { base64: true });
         hasFiles = true;
      });
    });

    if (hasFiles) {
       const content = await zip.generateAsync({ type: "blob" });
       saveAs(content, "product_dimensions.zip");
    }
  };

  const pendingCount = productGroups.filter(i => i.status === 'pending').length;
  const doneCount = productGroups.filter(i => i.status === 'done').length;
  const totalGenImages = productGroups.reduce((acc, curr) => acc + curr.generatedImages.length, 0);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans pb-20">
      {/*... header ...*/}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="font-serif font-semibold text-2xl tracking-tight text-gray-900">KH Dimension Studio</h1>
          </div>
          <div className="flex items-center gap-4 text-sm">
            {isFetching ? (
               <span className="flex items-center gap-2 text-gray-500">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Syncing with Sheet...
               </span>
            ) : (
               <span className="flex items-center gap-2 text-green-700 bg-green-50 px-2.5 py-1.5 rounded-md font-medium border border-green-200">
                  <CheckCircle className="w-4 h-4" />
                  {products.length} Products synced
               </span>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        <section className="mb-12">
           <Dropzone onFilesAdded={handleFilesAdded} />
        </section>

        {productGroups.length > 0 && (
          <div className="flex items-center justify-between mb-6 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
             <div className="text-sm text-gray-600">
                <span className="font-medium text-gray-900">{productGroups.length}</span> products recognized • 
                <span className="font-medium text-gray-900 ml-1">{doneCount}</span> processed
             </div>
             <div className="flex gap-3">
                {pendingCount > 0 && (
                   <button 
                      onClick={processAll}
                      disabled={isProcessingAll}
                      className="flex items-center gap-2 px-5 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50 transition-colors"
                   >
                     {isProcessingAll && <Loader2 className="w-4 h-4 animate-spin" />}
                     {isProcessingAll ? 'Processing...' : `Process ${pendingCount} Products`}
                   </button>
                )}
                <button 
                   onClick={downloadAll}
                   disabled={totalGenImages === 0}
                   className="flex items-center gap-2 px-5 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50 transition-colors shadow-sm"
                >
                  <Download className="w-4 h-4" />
                  Download All Outputs
                </button>
             </div>
          </div>
        )}

        <div className="flex flex-col gap-6">
           {productGroups.map((group) => (
              <div key={group.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm flex flex-col">
                 <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                    <div className="flex items-center gap-3">
                       <FolderIcon className="w-5 h-5 text-gray-400" />
                       <span className="font-semibold text-gray-900 text-lg">{group.productName}</span>
                    </div>
                    <div className="flex items-center gap-4">
                       {group.status === 'processing' && <Loader2 className="w-5 h-5 animate-spin text-gray-400" />}
                       {group.status === 'done' && <CheckCircle className="w-5 h-5 text-green-500" />}
                       <button
                          onClick={() => removeGroup(group.id)}
                          className="text-gray-400 hover:text-red-500 transition-colors"
                          title="Remove Product"
                       >
                          <Trash2 className="w-5 h-5" />
                       </button>
                    </div>
                 </div>
                 
                 <div className="p-5 flex gap-8">
                    {/* Inputs panel */}
                    <div className="w-64 shrink-0 flex flex-col gap-4">
                       <h3 className="text-xs uppercase tracking-wider font-semibold text-gray-500">Source Images</h3>
                       
                       {(() => {
                           const requiresCanvas = group.matchedProducts.length === 0 || group.matchedProducts.some(p => p.printType.toLowerCase().includes('canvas'));
                           const requiresArtwork = group.matchedProducts.length === 0 || group.matchedProducts.some(p => !p.printType.toLowerCase().includes('canvas'));

                           return (
                              <>
                                 {requiresCanvas && (
                                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 relative group overflow-hidden">
                                       <p className="text-xs font-medium text-gray-700 mb-2">Canvas Variant</p>
                                       {group.files.canvas ? (
                                          <div className="flex items-center gap-3 relative z-10">
                                            <img src={group.files.canvas.previewUrl} className="w-10 h-10 rounded border border-gray-200 object-cover" alt="Canvas" />
                                            <span className="text-xs text-green-600 font-medium flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Uploaded</span>
                                          </div>
                                       ) : (
                                          <div className="flex items-center gap-2 text-amber-600 text-xs font-medium relative z-10 cursor-pointer group-hover:text-amber-700 transition-colors">
                                            <AlertCircle className="w-4 h-4" /> Click to upload Canvas
                                          </div>
                                       )}
                                       <input 
                                          type="file" 
                                          accept="image/*" 
                                          className="absolute inset-0 opacity-0 cursor-pointer z-20" 
                                          onChange={(e) => handleManualUpload(group.id, 'canvas', e)}
                                       />
                                    </div>
                                 )}

                                 {requiresArtwork && (
                                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 relative group overflow-hidden">
                                       <p className="text-xs font-medium text-gray-700 mb-2">Fine Art Print Variant</p>
                                       {group.files.artwork ? (
                                          <div className="flex items-center gap-3 relative z-10">
                                            <img src={group.files.artwork.previewUrl} className="w-10 h-10 rounded border border-gray-200 object-cover" alt="Artwork" />
                                            <span className="text-xs text-green-600 font-medium flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Uploaded</span>
                                          </div>
                                       ) : (
                                          <div className="flex items-center gap-2 text-amber-600 text-xs font-medium relative z-10 cursor-pointer group-hover:text-amber-700 transition-colors">
                                            <AlertCircle className="w-4 h-4" /> Click to upload Artwork
                                          </div>
                                       )}
                                       <input 
                                          type="file" 
                                          accept="image/*" 
                                          className="absolute inset-0 opacity-0 cursor-pointer z-20" 
                                          onChange={(e) => handleManualUpload(group.id, 'artwork', e)}
                                       />
                                    </div>
                                 )}
                              </>
                           );
                       })()}
                       
                       {group.matchedProducts.length === 0 && (
                          <div className="p-3 bg-red-50 text-red-700 text-xs rounded-lg border border-red-100 flex gap-2 mt-auto">
                             <AlertCircle className="w-4 h-4 shrink-0" />
                             No matching product found in sheet.
                          </div>
                       )}
                    </div>

                    {/* Outputs panel */}
                    <div className="flex-1">
                       <div className="flex items-center justify-between mb-4">
                          <h3 className="text-xs uppercase tracking-wider font-semibold text-gray-500">Required Sizes ({group.matchedProducts.length})</h3>
                          {group.status === 'pending' && group.matchedProducts.length > 0 && (
                             <button
                                onClick={() => processGroup(group)}
                                className="px-4 py-1.5 bg-gray-100 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-200 transition-colors"
                             >
                                Generate Sizes
                             </button>
                          )}
                       </div>

                       <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                          {group.status === 'done' ? (
                             group.generatedImages.map((gen, idx) => (
                                <div key={idx} className="space-y-2">
                                  <div className="aspect-square bg-gray-50 rounded-lg overflow-hidden border border-gray-200 relative group">
                                     <img src={gen.dataUrl} alt={gen.sizeName} className="w-full h-full object-contain" />
                                     <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <button 
                                           onClick={() => saveAs(gen.dataUrl, `${group.productName}_${gen.printType.replace(/\s/g, '_')}_${gen.sizeName.replace(/\s/g, '_')}.jpg`)}
                                           className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-gray-900 hover:scale-110 transition-transform shadow-lg"
                                           title="Download this image"
                                        >
                                           <Download className="w-5 h-5" />
                                        </button>
                                     </div>
                                  </div>
                                  <div className="text-center">
                                     <p className="text-xs font-semibold text-gray-900">{gen.sizeName}</p>
                                     <p className="text-[10px] text-gray-500">{gen.printType}</p>
                                  </div>
                                </div>
                             ))
                          ) : (
                             // Preview missing / pending elements based on sheet
                             group.matchedProducts.map((p, idx) => {
                                const isCanvas = p.printType.toLowerCase().includes('canvas');
                                const hasSource = isCanvas ? !!group.files.canvas : !!group.files.artwork;
                                return (
                                   <div key={idx} className="aspect-square bg-gray-50 border border-gray-200 border-dashed rounded-lg flex flex-col items-center justify-center text-center p-4">
                                      <p className="text-sm font-semibold text-gray-600">{p.itemSize}</p>
                                      <p className="text-xs text-gray-400 mt-1">{p.printType}</p>
                                      {!hasSource && (
                                         <span className="mt-2 text-[10px] text-amber-600 bg-amber-50 px-2 py-1 rounded border border-amber-100">Action Required</span>
                                      )}
                                   </div>
                                );
                             })
                          )}
                       </div>
                    </div>
                 </div>
              </div>
           ))}
        </div>
      </main>
    </div>
  );
}

