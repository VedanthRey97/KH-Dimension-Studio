export async function generateDimensionImage(imageUrl: string, sizeString: string): Promise<string> {
   return new Promise((resolve, reject) => {
       const img = new Image();
       img.crossOrigin = "anonymous";
       img.onload = () => {
           const canvas = document.createElement("canvas");
           // Fixed size for great resolution but keeping file sizes manageable (approx < 100kb at 0.8 quality)
           const SIZE = 1200;
           
           canvas.width = SIZE;
           canvas.height = SIZE;
           const ctx = canvas.getContext("2d");
           if (!ctx) return reject("No canvas context");

           ctx.fillStyle = "#ffffff";
           ctx.fillRect(0, 0, SIZE, SIZE);

           const padding = Math.round(SIZE * 0.15); 
           
           const innerWidth = SIZE - padding * 2;
           const innerHeight = SIZE - padding * 2;
           
           // Extract bounds ignoring white/transparent background
           const getTrimmedBounds = (imgElem: HTMLImageElement) => {
               const c = document.createElement("canvas");
               let w = imgElem.width;
               let h = imgElem.height;
               const processSize = 400;
               let scaleToProcess = 1;
               if (Math.max(w, h) > processSize) {
                  scaleToProcess = processSize / Math.max(w, h);
                  w = Math.round(w * scaleToProcess);
                  h = Math.round(h * scaleToProcess);
               }
               c.width = w;
               c.height = h;
               const cctx = c.getContext("2d", { willReadFrequently: true });
               if (!cctx) return null;
               cctx.drawImage(imgElem, 0, 0, w, h);
               const data = cctx.getImageData(0, 0, w, h).data;
               let minX = w, minY = h, maxX = 0, maxY = 0;
               let found = false;
               for (let y = 0; y < h; y++) {
                   for (let x = 0; x < w; x++) {
                       const idx = (y * w + x) * 4;
                       const r = data[idx];
                       const g = data[idx + 1];
                       const b = data[idx + 2];
                       const a = data[idx + 3];
                       const isWhite = r > 240 && g > 240 && b > 240;
                       const isTransparent = a < 15;
                       if (!isWhite && !isTransparent) {
                           if (x < minX) minX = x;
                           if (x > maxX) maxX = x;
                           if (y < minY) minY = y;
                           if (y > maxY) maxY = y;
                           found = true;
                       }
                   }
               }
               if (!found || minX >= maxX || minY >= maxY) return null;
               // Add a tiny bit of breathing room to the bounds, to ensure anti-aliased edges aren't clipped aggressively
               const margin = Math.round(w * 0.01);
               minX = Math.max(0, minX - margin);
               minY = Math.max(0, minY - margin);
               maxX = Math.min(w, maxX + margin);
               maxY = Math.min(h, maxY + margin);
               
               return {
                  x: minX / scaleToProcess,
                  y: minY / scaleToProcess,
                  w: (maxX - minX) / scaleToProcess,
                  h: (maxY - minY) / scaleToProcess
               };
           };

           const bounds = getTrimmedBounds(img) || { x: 0, y: 0, w: img.width, h: img.height };
           const subjectAspect = bounds.w / bounds.h;
           const innerAspect = innerWidth / innerHeight;
           
           let scaleToFit = 1;
           if (subjectAspect > innerAspect) {
               scaleToFit = innerWidth / bounds.w;
           } else {
               scaleToFit = innerHeight / bounds.h;
           }
           
           const scaledSubW = bounds.w * scaleToFit;
           const scaledSubH = bounds.h * scaleToFit;
           const subX = padding + (innerWidth - scaledSubW) / 2;
           const subY = padding + (innerHeight - scaledSubH) / 2;
           
           const drawX = subX - bounds.x * scaleToFit;
           const drawY = subY - bounds.y * scaleToFit;
           const drawW = img.width * scaleToFit;
           const drawH = img.height * scaleToFit;
           
           ctx.drawImage(img, drawX, drawY, drawW, drawH);

           let bottomText = sizeString;
           let rightText = sizeString;
           
           const parts = sizeString.toLowerCase().replace('cm', '').split('x').map(s => s.trim());
           if (parts.length >= 2) {
               bottomText = `${parts[0]} cm.`;
               rightText = `${parts[1]} cm.`;
           }
           
           ctx.fillStyle = "#6b7280";
           ctx.strokeStyle = "#9ca3af";
           
           // Scale text and lines according to the high res size
           const scaleRatio = SIZE / 1200; 
           
           ctx.lineWidth = Math.max(2, Math.round(3 * scaleRatio));
           const fontSize = Math.round(48 * scaleRatio);
           ctx.font = `300 ${fontSize}px Inter, sans-serif`;
           ctx.textAlign = "center";
           ctx.textBaseline = "middle";

           const lineOffset = Math.round(60 * scaleRatio); 
           const tickSize = Math.round(15 * scaleRatio);
           const lineOvershoot = 0; // Prevent extending into whitespace
           
           // Bottom dimension
           const bLineY = subY + scaledSubH + lineOffset;
           ctx.beginPath();
           // main horizontal line
           ctx.moveTo(subX - lineOvershoot, bLineY);
           ctx.lineTo(subX + scaledSubW + lineOvershoot, bLineY);
           
           // vertical ticks
           ctx.moveTo(subX, bLineY - tickSize);
           ctx.lineTo(subX, bLineY + tickSize);
           ctx.moveTo(subX + scaledSubW, bLineY - tickSize);
           ctx.lineTo(subX + scaledSubW, bLineY + tickSize);
           ctx.stroke();
           
           ctx.fillText(bottomText, subX + scaledSubW / 2, bLineY + Math.round(60 * scaleRatio));
           
           // Right dimension
           const rLineX = subX + scaledSubW + lineOffset;
           ctx.beginPath();
           // main vertical line
           ctx.moveTo(rLineX, subY - lineOvershoot);
           ctx.lineTo(rLineX, subY + scaledSubH + lineOvershoot);
           
           // horizontal ticks
           ctx.moveTo(rLineX - tickSize, subY);
           ctx.lineTo(rLineX + tickSize, subY);
           ctx.moveTo(rLineX - tickSize, subY + scaledSubH);
           ctx.lineTo(rLineX + tickSize, subY + scaledSubH);
           ctx.stroke();
           
           ctx.save();
           ctx.translate(rLineX + Math.round(60 * scaleRatio), subY + scaledSubH / 2);
           ctx.rotate(-Math.PI / 2);
           ctx.fillText(rightText, 0, 0);
           ctx.restore();

           // Using 0.8 quality on a 1200 canvas retains great readability while optimizing payload close to 100kb
           resolve(canvas.toDataURL("image/jpeg", 0.8)); // Very high quality jpeg
       };
       img.onerror = reject;
       img.src = imageUrl;
   });
}
