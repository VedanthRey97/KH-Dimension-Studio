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
           
           const imgAspect = img.width / img.height;
           const innerAspect = innerWidth / innerHeight;
           
           let drawW = innerWidth;
           let drawH = innerHeight;
           if (imgAspect > innerAspect) {
               drawH = innerWidth / imgAspect;
           } else {
               drawW = innerHeight * imgAspect;
           }
           
           const drawX = padding + (innerWidth - drawW) / 2;
           const drawY = padding + (innerHeight - drawH) / 2;
           
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
           const lineOvershoot = Math.round(20 * scaleRatio);
           
           // Bottom dimension
           const bLineY = drawY + drawH + lineOffset;
           ctx.beginPath();
           // main horizontal line
           ctx.moveTo(drawX - lineOvershoot, bLineY);
           ctx.lineTo(drawX + drawW + lineOvershoot, bLineY);
           
           // vertical ticks
           ctx.moveTo(drawX, bLineY - tickSize);
           ctx.lineTo(drawX, bLineY + tickSize);
           ctx.moveTo(drawX + drawW, bLineY - tickSize);
           ctx.lineTo(drawX + drawW, bLineY + tickSize);
           ctx.stroke();
           
           ctx.fillText(bottomText, drawX + drawW / 2, bLineY + Math.round(60 * scaleRatio));
           
           // Right dimension
           const rLineX = drawX + drawW + lineOffset;
           ctx.beginPath();
           // main vertical line
           ctx.moveTo(rLineX, drawY - lineOvershoot);
           ctx.lineTo(rLineX, drawY + drawH + lineOvershoot);
           
           // horizontal ticks
           ctx.moveTo(rLineX - tickSize, drawY);
           ctx.lineTo(rLineX + tickSize, drawY);
           ctx.moveTo(rLineX - tickSize, drawY + drawH);
           ctx.lineTo(rLineX + tickSize, drawY + drawH);
           ctx.stroke();
           
           ctx.save();
           ctx.translate(rLineX + Math.round(60 * scaleRatio), drawY + drawH / 2);
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
