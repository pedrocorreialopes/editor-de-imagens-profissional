/**
 * PIXELCRAFT — FILTERS ENGINE
 * Motor de processamento de imagens via Canvas API
 * Autor: Pedro Correia | Contato: 85 98900-2536
 *
 * Implementa algoritmos de:
 * - Brilho, Contraste, Saturação, Exposição
 * - Matiz (Hue Rotation), Nitidez (Sharpening)
 * - Ruído aleatório, Desfoque (Gaussian Blur)
 * - Escala de cinza, P&B, Sépia, Inversão
 * - Temperatura de cor, Vinheta (Vignette)
 * - Filtros preset (Instagram-like)
 */

'use strict';

/* =============================================================
   UTILITIES
   ============================================================= */

/**
 * Clamp um valor entre min e max
 */
const clamp = (v, min = 0, max = 255) => Math.max(min, Math.min(max, v));

/**
 * Converte RGB → HSL
 */
function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;
  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      default: h = ((r - g) / d + 4) / 6;
    }
  }
  return [h * 360, s * 100, l * 100];
}

/**
 * Converte HSL → RGB
 */
function hslToRgb(h, s, l) {
  h /= 360; s /= 100; l /= 100;
  let r, g, b;
  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

/* =============================================================
   FILTROS INDIVIDUAIS — Pixel-level operations
   ============================================================= */

/**
 * Ajuste de BRILHO
 * @param {Uint8ClampedArray} data
 * @param {number} amount  -100 a +100
 */
function applyBrightness(data, amount) {
  if (amount === 0) return;
  const adj = (amount / 100) * 255;
  for (let i = 0; i < data.length; i += 4) {
    data[i]     = clamp(data[i]     + adj);
    data[i + 1] = clamp(data[i + 1] + adj);
    data[i + 2] = clamp(data[i + 2] + adj);
  }
}

/**
 * Ajuste de CONTRASTE
 * @param {Uint8ClampedArray} data
 * @param {number} amount  -100 a +100
 */
function applyContrast(data, amount) {
  if (amount === 0) return;
  const factor = (259 * (amount + 255)) / (255 * (259 - amount));
  for (let i = 0; i < data.length; i += 4) {
    data[i]     = clamp(factor * (data[i]     - 128) + 128);
    data[i + 1] = clamp(factor * (data[i + 1] - 128) + 128);
    data[i + 2] = clamp(factor * (data[i + 2] - 128) + 128);
  }
}

/**
 * Ajuste de SATURAÇÃO
 * @param {Uint8ClampedArray} data
 * @param {number} amount  -100 a +100
 */
function applySaturation(data, amount) {
  if (amount === 0) return;
  const sat = 1 + amount / 100;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const gray = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    data[i]     = clamp(gray + sat * (r - gray));
    data[i + 1] = clamp(gray + sat * (g - gray));
    data[i + 2] = clamp(gray + sat * (b - gray));
  }
}

/**
 * Ajuste de EXPOSIÇÃO (gamma-based)
 * @param {Uint8ClampedArray} data
 * @param {number} amount  -100 a +100
 */
function applyExposure(data, amount) {
  if (amount === 0) return;
  const factor = Math.pow(2, amount / 50);
  for (let i = 0; i < data.length; i += 4) {
    data[i]     = clamp(data[i]     * factor);
    data[i + 1] = clamp(data[i + 1] * factor);
    data[i + 2] = clamp(data[i + 2] * factor);
  }
}

/**
 * ROTAÇÃO DE MATIZ (Hue Rotation)
 * @param {Uint8ClampedArray} data
 * @param {number} degrees  -180 a +180
 */
function applyHueRotation(data, degrees) {
  if (degrees === 0) return;
  for (let i = 0; i < data.length; i += 4) {
    const [h, s, l] = rgbToHsl(data[i], data[i + 1], data[i + 2]);
    const newH = (h + degrees + 360) % 360;
    const [r, g, b] = hslToRgb(newH, s, l);
    data[i]     = r;
    data[i + 1] = g;
    data[i + 2] = b;
  }
}

/**
 * ESCALA DE CINZA
 */
function applyGrayscale(data) {
  for (let i = 0; i < data.length; i += 4) {
    const luma = Math.round(0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]);
    data[i] = data[i + 1] = data[i + 2] = luma;
  }
}

/**
 * PRETO E BRANCO (limiar adaptativo)
 * @param {Uint8ClampedArray} data
 * @param {number} threshold  0-255 (default 128)
 */
function applyBlackWhite(data, threshold = 128) {
  for (let i = 0; i < data.length; i += 4) {
    const luma = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
    const bw = luma >= threshold ? 255 : 0;
    data[i] = data[i + 1] = data[i + 2] = bw;
  }
}

/**
 * SÉPIA
 */
function applySepia(data) {
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    data[i]     = clamp(r * 0.393 + g * 0.769 + b * 0.189);
    data[i + 1] = clamp(r * 0.349 + g * 0.686 + b * 0.168);
    data[i + 2] = clamp(r * 0.272 + g * 0.534 + b * 0.131);
  }
}

/**
 * INVERSÃO de cores
 */
function applyInvert(data) {
  for (let i = 0; i < data.length; i += 4) {
    data[i]     = 255 - data[i];
    data[i + 1] = 255 - data[i + 1];
    data[i + 2] = 255 - data[i + 2];
  }
}

/**
 * RUÍDO aleatório
 * @param {Uint8ClampedArray} data
 * @param {number} amount  0-100
 */
function applyNoise(data, amount) {
  if (amount === 0) return;
  const noise = (amount / 100) * 80;
  for (let i = 0; i < data.length; i += 4) {
    const n = (Math.random() - 0.5) * noise;
    data[i]     = clamp(data[i]     + n);
    data[i + 1] = clamp(data[i + 1] + n);
    data[i + 2] = clamp(data[i + 2] + n);
  }
}

/**
 * TEMPERATURA de cor
 * @param {Uint8ClampedArray} data
 * @param {number} amount  -100 (frio) a +100 (quente)
 */
function applyTemperature(data, amount) {
  if (amount === 0) return;
  const factor = amount / 100;
  for (let i = 0; i < data.length; i += 4) {
    if (factor > 0) {
      // Quente: mais vermelho, menos azul
      data[i]     = clamp(data[i]     + factor * 30);
      data[i + 1] = clamp(data[i + 1] + factor * 10);
      data[i + 2] = clamp(data[i + 2] - factor * 30);
    } else {
      // Frio: mais azul, menos vermelho
      data[i]     = clamp(data[i]     + factor * 30);
      data[i + 1] = clamp(data[i + 1] + factor * 5);
      data[i + 2] = clamp(data[i + 2] - factor * 30);
    }
  }
}

/**
 * DESFOQUE (Box Blur — aproximação de Gaussiano)
 * @param {Uint8ClampedArray} data
 * @param {number} width   largura da imagem
 * @param {number} height  altura da imagem
 * @param {number} radius  raio do blur
 */
function applyBlur(data, width, height, radius) {
  if (radius <= 0) return;
  const r = Math.round(radius);
  const tempData = new Uint8ClampedArray(data);

  // Horizontal pass
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let rSum = 0, gSum = 0, bSum = 0, count = 0;
      for (let dx = -r; dx <= r; dx++) {
        const nx = clamp(x + dx, 0, width - 1);
        const idx = (y * width + nx) * 4;
        rSum += tempData[idx];
        gSum += tempData[idx + 1];
        bSum += tempData[idx + 2];
        count++;
      }
      const idx = (y * width + x) * 4;
      data[idx]     = rSum / count;
      data[idx + 1] = gSum / count;
      data[idx + 2] = bSum / count;
    }
  }

  // Vertical pass
  const tempData2 = new Uint8ClampedArray(data);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let rSum = 0, gSum = 0, bSum = 0, count = 0;
      for (let dy = -r; dy <= r; dy++) {
        const ny = clamp(y + dy, 0, height - 1);
        const idx = (ny * width + x) * 4;
        rSum += tempData2[idx];
        gSum += tempData2[idx + 1];
        bSum += tempData2[idx + 2];
        count++;
      }
      const idx = (y * width + x) * 4;
      data[idx]     = rSum / count;
      data[idx + 1] = gSum / count;
      data[idx + 2] = bSum / count;
    }
  }
}

/**
 * NITIDEZ (Unsharp Mask)
 * @param {Uint8ClampedArray} data
 * @param {number} width
 * @param {number} height
 * @param {number} strength  0-10
 */
function applySharpness(data, width, height, strength) {
  if (strength <= 0) return;
  const amount = strength * 0.3;

  // Kernel de Laplaciano para realçar bordas
  const kernel = [
    0, -1, 0,
    -1, 5, -1,
    0, -1, 0
  ];

  const original = new Uint8ClampedArray(data);

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let rSum = 0, gSum = 0, bSum = 0;
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const kIdx = (ky + 1) * 3 + (kx + 1);
          const idx = ((y + ky) * width + (x + kx)) * 4;
          rSum += original[idx]     * kernel[kIdx];
          gSum += original[idx + 1] * kernel[kIdx];
          bSum += original[idx + 2] * kernel[kIdx];
        }
      }
      const idx = (y * width + x) * 4;
      const srcIdx = idx;
      data[idx]     = clamp(original[srcIdx]     + (rSum - original[srcIdx])     * amount);
      data[idx + 1] = clamp(original[srcIdx + 1] + (gSum - original[srcIdx + 1]) * amount);
      data[idx + 2] = clamp(original[srcIdx + 2] + (bSum - original[srcIdx + 2]) * amount);
    }
  }
}

/**
 * VINHETA (Vignette)
 * @param {Uint8ClampedArray} data
 * @param {number} width
 * @param {number} height
 * @param {number} amount  0-100
 */
function applyVignette(data, width, height, amount) {
  if (amount <= 0) return;
  const cx = width / 2;
  const cy = height / 2;
  const maxDist = Math.sqrt(cx * cx + cy * cy);
  const strength = amount / 100;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy) / maxDist;
      const darkening = 1 - (strength * Math.pow(dist, 1.5));
      const factor = clamp(darkening, 0, 1);
      const idx = (y * width + x) * 4;
      data[idx]     = clamp(data[idx]     * factor);
      data[idx + 1] = clamp(data[idx + 1] * factor);
      data[idx + 2] = clamp(data[idx + 2] * factor);
    }
  }
}

/* =============================================================
   FILTROS PRESET (Instagram-like)
   ============================================================= */

const PRESETS = {
  none: {
    name: 'Original',
    icon: '🎨',
    settings: {}
  },
  vivid: {
    name: 'Vívido',
    icon: '🌈',
    settings: { saturation: 50, contrast: 20, brightness: 10 }
  },
  cool: {
    name: 'Frio',
    icon: '❄️',
    settings: { temperature: -60, saturation: 10, brightness: 5 }
  },
  warm: {
    name: 'Quente',
    icon: '🌅',
    settings: { temperature: 60, saturation: 20, brightness: 5 }
  },
  vintage: {
    name: 'Vintage',
    icon: '📷',
    settings: { sepia: true, contrast: -10, brightness: 5, saturation: -20 }
  },
  dramatic: {
    name: 'Dramático',
    icon: '🎭',
    settings: { contrast: 60, saturation: -20, brightness: -10, vignette: 40 }
  },
  noir: {
    name: 'Noir',
    icon: '🎬',
    settings: { grayscale: true, contrast: 50, brightness: -10, vignette: 50 }
  },
  fade: {
    name: 'Desbotado',
    icon: '🌫️',
    settings: { contrast: -30, saturation: -30, brightness: 20 }
  },
  bloom: {
    name: 'Bloom',
    icon: '🌸',
    settings: { brightness: 25, saturation: 20, contrast: -15, temperature: 20 }
  },
  sunset: {
    name: 'Pôr do Sol',
    icon: '🌇',
    settings: { temperature: 80, saturation: 40, contrast: 20, hue: 10 }
  },
  forest: {
    name: 'Floresta',
    icon: '🌿',
    settings: { hue: -20, saturation: 40, contrast: 10, brightness: -5 }
  },
  neon: {
    name: 'Neon',
    icon: '💜',
    settings: { saturation: 80, contrast: 30, brightness: 5, hue: 20 }
  }
};

/* =============================================================
   PROCESSADOR PRINCIPAL
   ============================================================= */

/**
 * Aplica todos os ajustes em um ImageData e retorna novo ImageData
 * @param {ImageData} imageData  — ImageData original
 * @param {object} settings     — parâmetros de edição
 * @param {number} width
 * @param {number} height
 * @returns {ImageData}
 */
function processImage(imageData, settings, width, height) {
  // Copiar pixels originais
  const result = new ImageData(
    new Uint8ClampedArray(imageData.data),
    width,
    height
  );
  const d = result.data;

  const s = Object.assign({
    brightness: 0,
    contrast: 0,
    saturation: 0,
    exposure: 0,
    hue: 0,
    sharpness: 0,
    noise: 0,
    blur: 0,
    grayscale: false,
    blackwhite: false,
    sepia: false,
    invert: false,
    vignette: 0,
    temperature: 0
  }, settings);

  // Ordem de aplicação importa!

  // 1. Blur (opera sobre vizinhos, melhor antes de pixel ops)
  if (s.blur > 0) applyBlur(d, width, height, s.blur);

  // 2. Exposição (antes do brilho)
  if (s.exposure !== 0) applyExposure(d, s.exposure);

  // 3. Brilho
  if (s.brightness !== 0) applyBrightness(d, s.brightness);

  // 4. Contraste
  if (s.contrast !== 0) applyContrast(d, s.contrast);

  // 5. Temperatura
  if (s.temperature !== 0) applyTemperature(d, s.temperature);

  // 6. Saturação
  if (s.saturation !== 0) applySaturation(d, s.saturation);

  // 7. Matiz
  if (s.hue !== 0) applyHueRotation(d, s.hue);

  // 8. Nitidez
  if (s.sharpness > 0) applySharpness(d, width, height, s.sharpness);

  // 9. Modos de cor (mutuamente exclusivos, a ordem determina precedência)
  if (s.blackwhite) {
    applyBlackWhite(d);
  } else if (s.grayscale) {
    applyGrayscale(d);
  } else if (s.sepia) {
    applySepia(d);
  }

  // 10. Inversão (após modo de cor)
  if (s.invert) applyInvert(d);

  // 11. Ruído (após todos os outros)
  if (s.noise > 0) applyNoise(d, s.noise);

  // 12. Vinheta (por último — opera sobre posição)
  if (s.vignette > 0) applyVignette(d, width, height, s.vignette);

  return result;
}

/* =============================================================
   REDIMENSIONAMENTO (via Canvas 2D)
   ============================================================= */

/**
 * Redimensiona uma imagem mantendo qualidade
 * @param {HTMLImageElement|HTMLCanvasElement} source
 * @param {number} targetW
 * @param {number} targetH
 * @param {number} [steps=2]  Passos de downscaling para melhor qualidade
 * @returns {HTMLCanvasElement}
 */
function resizeImage(source, targetW, targetH, steps = 2) {
  const srcW = source.width || source.naturalWidth;
  const srcH = source.height || source.naturalHeight;

  // Downscale em múltiplas etapas para melhor qualidade
  if (steps > 1 && targetW < srcW * 0.5 && targetH < srcH * 0.5) {
    const midW = Math.round(srcW * 0.5);
    const midH = Math.round(srcH * 0.5);
    const mid = resizeImage(source, midW, midH, steps - 1);
    return resizeImage(mid, targetW, targetH, 1);
  }

  const canvas = document.createElement('canvas');
  canvas.width  = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, 0, 0, targetW, targetH);
  return canvas;
}

/**
 * Calcula dimensões mantendo aspect ratio
 * @param {number} origW
 * @param {number} origH
 * @param {number|null} newW
 * @param {number|null} newH
 * @returns {{ w: number, h: number }}
 */
function calcAspectRatio(origW, origH, newW, newH) {
  if (newW && newH) return { w: newW, h: newH };
  if (newW)  return { w: newW,  h: Math.round(origH * (newW / origW)) };
  if (newH)  return { w: Math.round(origW * (newH / origH)), h: newH };
  return { w: origW, h: origH };
}

/* =============================================================
   RECORTE (Crop)
   ============================================================= */

/**
 * Aplica recorte percentual
 * @param {HTMLCanvasElement} canvas
 * @param {{ top, bottom, left, right }} crop  % de cada lado
 * @returns {HTMLCanvasElement}
 */
function cropImage(canvas, crop) {
  const { top = 0, bottom = 0, left = 0, right = 0 } = crop;
  const cw = canvas.width;
  const ch = canvas.height;
  const sx = Math.round(cw * left   / 100);
  const sy = Math.round(ch * top    / 100);
  const sw = Math.round(cw * (1 - left / 100 - right  / 100));
  const sh = Math.round(ch * (1 - top  / 100 - bottom / 100));

  if (sw <= 0 || sh <= 0) return canvas;

  const result = document.createElement('canvas');
  result.width  = sw;
  result.height = sh;
  const ctx = result.getContext('2d');
  ctx.drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh);
  return result;
}

/* =============================================================
   ROTAÇÃO E FLIP
   ============================================================= */

/**
 * Rotaciona um canvas em múltiplos de 90°
 * @param {HTMLCanvasElement} canvas
 * @param {number} degrees  90 | -90 | 180
 * @returns {HTMLCanvasElement}
 */
function rotateCanvas(canvas, degrees) {
  const rad = (degrees * Math.PI) / 180;
  const isOrthogonal = degrees % 180 !== 0;
  const w = isOrthogonal ? canvas.height : canvas.width;
  const h = isOrthogonal ? canvas.width  : canvas.height;
  const result = document.createElement('canvas');
  result.width  = w;
  result.height = h;
  const ctx = result.getContext('2d');
  ctx.translate(w / 2, h / 2);
  ctx.rotate(rad);
  ctx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);
  return result;
}

/**
 * Flip horizontal ou vertical
 * @param {HTMLCanvasElement} canvas
 * @param {'h'|'v'} direction
 * @returns {HTMLCanvasElement}
 */
function flipCanvas(canvas, direction) {
  const result = document.createElement('canvas');
  result.width  = canvas.width;
  result.height = canvas.height;
  const ctx = result.getContext('2d');
  if (direction === 'h') {
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
  } else {
    ctx.translate(0, canvas.height);
    ctx.scale(1, -1);
  }
  ctx.drawImage(canvas, 0, 0);
  return result;
}

/* =============================================================
   ESTIMATIVA DE TAMANHO
   ============================================================= */

/**
 * Estima tamanho do arquivo em bytes
 * @param {HTMLCanvasElement} canvas
 * @param {string} format  'image/jpeg' | 'image/png' | ...
 * @param {number} quality  0-1
 * @returns {Promise<number>}
 */
async function estimateFileSize(canvas, format, quality) {
  return new Promise(resolve => {
    canvas.toBlob(blob => {
      resolve(blob ? blob.size : 0);
    }, format, quality);
  });
}

/**
 * Formata bytes para exibição
 */
function formatBytes(bytes) {
  if (bytes < 1024)       return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

/* =============================================================
   EXPORT para uso no editor
   ============================================================= */
window.PixelFilters = {
  processImage,
  resizeImage,
  calcAspectRatio,
  cropImage,
  rotateCanvas,
  flipCanvas,
  estimateFileSize,
  formatBytes,
  PRESETS,
  // Filtros individuais expostos
  applyBrightness,
  applyContrast,
  applySaturation,
  applyGrayscale,
  applySepia,
  applyInvert,
  applyNoise,
  applyBlur,
  applyVignette
};
