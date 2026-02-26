/**
 * Client-side image quality check
 * Validates image quality before upload to ensure better OCR results
 */

export interface ImageQualityIssue {
  type: 'blur' | 'orientation' | 'brightness' | 'size' | 'aspect';
  severity: 'error' | 'warning';
  message: string;
  suggestion: string;
}

export interface ImageQualityResult {
  isValid: boolean;
  score: number; // 0-100
  issues: ImageQualityIssue[];
}

/**
 * Create Image object from File
 */
function createImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };
    
    img.src = url;
  });
}

/**
 * Calculate blur score using Laplacian variance
 * Higher score = less blur
 */
function calculateBlurScore(canvas: HTMLCanvasElement): number {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return 0;
  
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  
  // Calculate Laplacian variance (edge detection)
  let variance = 0;
  let mean = 0;
  const laplacian: number[] = [];
  
  // Convert to grayscale and calculate Laplacian
  for (let y = 1; y < canvas.height - 1; y++) {
    for (let x = 1; x < canvas.width - 1; x++) {
      const idx = (y * canvas.width + x) * 4;
      const gray = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
      
      // Laplacian kernel
      const laplacianValue = Math.abs(
        gray * 4 -
        (data[((y - 1) * canvas.width + x) * 4] + data[((y + 1) * canvas.width + x) * 4] + 
         data[(y * canvas.width + (x - 1)) * 4] + data[(y * canvas.width + (x + 1)) * 4]) / 3
      );
      
      laplacian.push(laplacianValue);
      mean += laplacianValue;
    }
  }
  
  mean /= laplacian.length;
  
  // Calculate variance
  for (const val of laplacian) {
    variance += Math.pow(val - mean, 2);
  }
  variance /= laplacian.length;
  
  // Normalize to 0-100 scale (variance > 100 = sharp, < 50 = blurry)
  return Math.min(100, Math.max(0, (variance / 100) * 100));
}

/**
 * Calculate average brightness (0-1)
 */
function calculateBrightness(canvas: HTMLCanvasElement): number {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return 0.5;
  
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  
  let sum = 0;
  for (let i = 0; i < data.length; i += 4) {
    // RGB to grayscale
    const gray = (data[i] + data[i + 1] + data[i + 2]) / 3;
    sum += gray;
  }
  
  return sum / (data.length / 4) / 255;
}

/**
 * Check image quality before upload
 * Returns validation result with issues and suggestions
 */
export async function checkImageQuality(
  file: File,
  locale: string = 'tr',
  isAdmin: boolean = false
): Promise<ImageQualityResult> {
  const issues: ImageQualityIssue[] = [];
  let score = 100;

  // Only check images, not PDFs
  if (!file.type.startsWith('image/')) {
    return { isValid: true, score: 100, issues: [] };
  }

  try {
    const img = await createImageFromFile(file);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      return { isValid: false, score: 0, issues: [{
        type: 'size',
        severity: 'error',
        message: locale === 'tr' ? 'Görüntü yüklenemedi' : 'Failed to load image',
        suggestion: locale === 'tr' ? 'Lütfen farklı bir görüntü deneyiniz. Ekran görüntüsü (screenshot) kabul edilmemektedir.' : 'Please try a different image. Screenshots are not accepted.'
      }]};
    }

    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0);

    // 1. Check image size (minimum resolution) – küçük çözünürlük çoğunlukla fişin kadrajı doldurması / kenarların kesilmesi ile ilişkilidir
    if (img.width < 800 || img.height < 600) {
      issues.push({
        type: 'size',
        severity: isAdmin ? 'warning' : 'error', // Admin için sadece uyarı
        message: locale === 'tr' ? 'Fişin tamamı fotoğrafta görünmüyor' : 'The entire receipt is not visible in the photo',
        suggestion: locale === 'tr' 
          ? 'Lütfen kameranızı fişten uzaklaştırınız ki fişin tamamı ve etrafında biraz boşluk görünsün. Ekran görüntüsü (screenshot) kabul edilmemektedir.'
          : 'Please move your camera away from the receipt so the entire receipt and some space around it are visible. Screenshots are not accepted.'
      });
      score -= isAdmin ? 10 : 30; // Admin için daha az penalty
    }

    // 2. Check aspect ratio (receipt should be portrait or landscape, not square)
    const aspectRatio = img.width / img.height;
    if (aspectRatio < 0.3 || aspectRatio > 3.0) {
      issues.push({
        type: 'aspect',
        severity: 'error',
        message: locale === 'tr' ? 'Fiş dik olarak durmak zorundadır' : 'Receipt must be upright',
        suggestion: locale === 'tr'
          ? 'Lütfen fişi düz bir yüzeye koyunuz ve kameranızı fişe dik açıyla tutunuz. Ekran görüntüsü (screenshot) kabul edilmemektedir.'
          : 'Please place the receipt on a flat surface and hold your camera perpendicular to the receipt. Screenshots are not accepted.'
      });
      score -= 20;
    }

    // 3. Check blur
    const blurScore = calculateBlurScore(canvas);
    if (blurScore < 50) {
      issues.push({
        type: 'blur',
        severity: 'error',
        message: locale === 'tr' ? 'Fotoğraf bulanık' : 'Photo is blurry',
        suggestion: locale === 'tr'
          ? 'Lütfen kameranızı sabit tutunuz ve fişe odaklanınız. Işığın yeterli olduğundan emin olunuz. Ekran görüntüsü (screenshot) kabul edilmemektedir.'
          : 'Please hold your camera steady and focus on the receipt. Ensure there is sufficient lighting. Screenshots are not accepted.'
      });
      score -= 25;
    } else if (blurScore < 70) {
      issues.push({
        type: 'blur',
        severity: 'warning',
        message: locale === 'tr' ? 'Fotoğraf biraz bulanık olabilir' : 'Photo may be slightly blurry',
        suggestion: locale === 'tr'
          ? 'Daha net bir fotoğraf için kameranızı sabit tutunuz. Ekran görüntüsü (screenshot) kabul edilmemektedir.'
          : 'Hold your camera steady for a sharper photo. Screenshots are not accepted.'
      });
      score -= 10;
    }

    // 4. Check brightness (tolerant: only very dark < 0.2 = error, 0.2-0.3 = warning)
    const brightness = calculateBrightness(canvas);
    if (brightness < 0.2) {
      issues.push({
        type: 'brightness',
        severity: 'error',
        message: locale === 'tr' ? 'Fotoğraf çok karanlık' : 'Photo too dark',
        suggestion: locale === 'tr'
          ? 'Lütfen ışığın yeterli olduğuna emin olunuz. Daha iyi aydınlatılmış bir yerde çekiniz. Ekran görüntüsü (screenshot) kabul edilmemektedir; lütfen fişin fotoğrafını çekiniz.'
          : 'Please ensure there is sufficient lighting. Take the photo in a well-lit area. Screenshots are not accepted; please take a photo of the receipt.'
      });
      score -= 20;
    } else if (brightness < 0.3) {
      issues.push({
        type: 'brightness',
        severity: 'warning',
        message: locale === 'tr' ? 'Fotoğraf biraz karanlık olabilir' : 'Photo may be a bit dark',
        suggestion: locale === 'tr'
          ? 'Daha iyi okuma için daha aydınlık bir yerde çekmeyi deneyebilirsiniz. Ekran görüntüsü (screenshot) kabul edilmemektedir.'
          : 'Try taking the photo in a brighter area for better reading. Screenshots are not accepted.'
      });
      score -= 5;
    } else if (brightness > 0.9) {
      issues.push({
        type: 'brightness',
        severity: 'warning',
        message: locale === 'tr' ? 'Fotoğraf çok parlak' : 'Photo too bright',
        suggestion: locale === 'tr'
          ? 'Lütfen doğrudan ışık kaynağından kaçınınız. Ekran görüntüsü (screenshot) kabul edilmemektedir.'
          : 'Please avoid direct light sources. Screenshots are not accepted.'
      });
      score -= 10;
    }

    // Background/contrast check REMOVED — caused false positives for e-faturas and low-contrast images
    // (receipt on similar background triggered edge noise as "background objects")

    return {
      isValid: score >= 70 && issues.filter(i => i.severity === 'error').length === 0,
      score: Math.max(0, score),
      issues
    };
  } catch (error: any) {
    console.error('[image-quality-check] Error:', error);
    return {
      isValid: false,
      score: 0,
      issues: [{
        type: 'size',
        severity: 'error',
        message: locale === 'tr' ? 'Görüntü analiz edilemedi' : 'Failed to analyze image',
        suggestion: locale === 'tr' ? 'Lütfen farklı bir görüntü deneyiniz. Ekran görüntüsü (screenshot) kabul edilmemektedir.' : 'Please try a different image. Screenshots are not accepted.'
      }]
    };
  }
}
