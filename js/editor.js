/**
 * PIXELCRAFT — EDITOR ENGINE
 * Gerencia a instância do editor para uma imagem específica
 * Autor: Pedro Correia | Contato: 85 98900-2536
 */

'use strict';

class ImageEditor {
  /**
   * @param {object} imageRecord  — registro da imagem na galeria
   * @param {HTMLCanvasElement} canvas  — canvas do modal
   */
  constructor(imageRecord, canvas) {
    this.record   = imageRecord;
    this.canvas   = canvas;
    this.ctx      = canvas.getContext('2d', { willReadFrequently: true });

    // Imagem original (não modificada)
    this.originalImage = imageRecord.element; // HTMLImageElement

    // Dimensões originais
    this.origW = this.originalImage.naturalWidth;
    this.origH = this.originalImage.naturalHeight;

    // Canvas de trabalho (transformações geométricas)
    this.workCanvas = document.createElement('canvas');
    this.workCtx    = this.workCanvas.getContext('2d', { willReadFrequently: true });

    // Estado de rotação/flip
    this.rotation   = 0;
    this.flipH      = false;
    this.flipV      = false;

    // Configurações atuais de filtros
    this.settings = {
      brightness:  0,
      contrast:    0,
      saturation:  0,
      exposure:    0,
      hue:         0,
      sharpness:   0,
      noise:       0,
      blur:        0,
      grayscale:   false,
      blackwhite:  false,
      sepia:       false,
      invert:      false,
      vignette:    0,
      temperature: 0,
      preset:      'none'
    };

    // Configurações de exportação
    this.exportSettings = {
      format:   'image/jpeg',
      quality:  0.92,
      filename: '',
      width:    null,
      height:   null,
      cropTop:    0,
      cropBottom: 0,
      cropLeft:   0,
      cropRight:  0
    };

    // Zoom
    this.zoom = 1.0;

    // Debounce timer
    this._renderTimer = null;

    // Flag de processamento
    this.processing = false;

    // ImageData original cacheado
    this._origImageData = null;
    this._cacheReady    = false;

    // Inicializar
    this._init();
  }

  /* -------------------------------------------------------
     INICIALIZAÇÃO
  ------------------------------------------------------- */
  _init() {
    // Desenhar a imagem original no workCanvas com dimensões originais
    this.workCanvas.width  = this.origW;
    this.workCanvas.height = this.origH;
    this.workCtx.drawImage(this.originalImage, 0, 0);

    // Cachear ImageData original
    this._origImageData = this.workCtx.getImageData(0, 0, this.origW, this.origH);
    this._cacheReady    = true;

    // Render inicial
    this.render();
  }

  /* -------------------------------------------------------
     RENDER PRINCIPAL
  ------------------------------------------------------- */

  /**
   * Agenda o render com debounce para evitar travamentos
   * @param {number} delay  ms
   */
  scheduleRender(delay = 40) {
    clearTimeout(this._renderTimer);
    this._renderTimer = setTimeout(() => this.render(), delay);
  }

  /**
   * Pipeline completo de renderização
   */
  async render() {
    if (!this._cacheReady || this.processing) return;
    this.processing = true;
    this._showLoading(true);

    try {
      // 1. Reconstruir workCanvas com imagem original + transformações geométricas
      let srcCanvas = this._buildGeometryCanvas();

      // 2. Calcular dimensões de destino
      const dims = window.PixelFilters.calcAspectRatio(
        srcCanvas.width,
        srcCanvas.height,
        this.exportSettings.width  || null,
        this.exportSettings.height || null
      );

      // 3. Redimensionar se necessário
      let processCanvas = srcCanvas;
      if (dims.w !== srcCanvas.width || dims.h !== srcCanvas.height) {
        processCanvas = window.PixelFilters.resizeImage(srcCanvas, dims.w, dims.h);
      }

      // 4. Recorte
      const crop = {
        top:    this.exportSettings.cropTop,
        bottom: this.exportSettings.cropBottom,
        left:   this.exportSettings.cropLeft,
        right:  this.exportSettings.cropRight
      };
      const hasCrop = Object.values(crop).some(v => v > 0);
      if (hasCrop) {
        processCanvas = window.PixelFilters.cropImage(processCanvas, crop);
      }

      // 5. Processar filtros de pixel
      const pCtx    = processCanvas.getContext('2d', { willReadFrequently: true });
      const imgData = pCtx.getImageData(0, 0, processCanvas.width, processCanvas.height);
      const processed = window.PixelFilters.processImage(
        imgData,
        this.settings,
        processCanvas.width,
        processCanvas.height
      );
      pCtx.putImageData(processed, 0, 0);

      // 6. Renderizar no canvas visível com zoom
      this._drawToDisplay(processCanvas);

      // 7. Atualizar informações
      this._updateInfoBar(processCanvas);

    } catch (err) {
      console.error('[PixelCraft] Erro no render:', err);
    } finally {
      this.processing = false;
      this._showLoading(false);
    }
  }

  /**
   * Constrói canvas com transformações geométricas (rotação, flip)
   */
  _buildGeometryCanvas() {
    // Começar do canvas de trabalho com imagem original
    let canvas = document.createElement('canvas');
    canvas.width  = this.origW;
    canvas.height = this.origH;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(this.originalImage, 0, 0);

    // Aplicar flip
    if (this.flipH || this.flipV) {
      if (this.flipH) canvas = window.PixelFilters.flipCanvas(canvas, 'h');
      if (this.flipV) canvas = window.PixelFilters.flipCanvas(canvas, 'v');
    }

    // Aplicar rotação
    if (this.rotation !== 0) {
      canvas = window.PixelFilters.rotateCanvas(canvas, this.rotation);
    }

    return canvas;
  }

  /**
   * Renderiza o canvas processado no canvas de exibição com zoom
   */
  _drawToDisplay(sourceCanvas) {
    const maxW = this.canvas.parentElement?.clientWidth  || 800;
    const maxH = this.canvas.parentElement?.clientHeight || 600;

    // Calcular escala para caber na área de preview
    const scaleX = maxW / sourceCanvas.width;
    const scaleY = maxH / sourceCanvas.height;
    const baseScale = Math.min(scaleX, scaleY, 1);
    const scale = baseScale * this.zoom;

    this.canvas.width  = Math.round(sourceCanvas.width  * scale);
    this.canvas.height = Math.round(sourceCanvas.height * scale);

    this.ctx.imageSmoothingEnabled = true;
    this.ctx.imageSmoothingQuality = 'high';
    this.ctx.drawImage(sourceCanvas, 0, 0, this.canvas.width, this.canvas.height);
  }

  /* -------------------------------------------------------
     TRANSFORMAÇÕES
  ------------------------------------------------------- */

  rotate(degrees) {
    this.rotation = (this.rotation + degrees + 360) % 360;
    this.scheduleRender(0);
  }

  flip(direction) {
    if (direction === 'h') this.flipH = !this.flipH;
    else                   this.flipV = !this.flipV;
    this.scheduleRender(0);
  }

  /* -------------------------------------------------------
     PRESETS
  ------------------------------------------------------- */
  applyPreset(presetName) {
    const preset = window.PixelFilters.PRESETS[presetName];
    if (!preset) return;

    // Reset apenas os campos de filtro (não as configurações geométricas)
    const base = {
      brightness: 0, contrast: 0, saturation: 0, exposure: 0,
      hue: 0, sharpness: 0, noise: 0, blur: 0,
      grayscale: false, blackwhite: false, sepia: false, invert: false,
      vignette: 0, temperature: 0
    };
    Object.assign(this.settings, base, preset.settings);
    this.settings.preset = presetName;

    this.scheduleRender(0);
  }

  /* -------------------------------------------------------
     GETTERS/SETTERS de configurações
  ------------------------------------------------------- */
  setSetting(key, value) {
    this.settings[key] = value;
    this.scheduleRender();
  }

  setExportSetting(key, value) {
    this.exportSettings[key] = value;
    this.scheduleRender(100);
  }

  setZoom(zoom) {
    this.zoom = Math.max(0.1, Math.min(5, zoom));
    this.scheduleRender(0);
  }

  zoomIn()  { this.setZoom(this.zoom * 1.25); }
  zoomOut() { this.setZoom(this.zoom * 0.8); }
  zoomFit() { this.zoom = 1.0; this.scheduleRender(0); }

  /* -------------------------------------------------------
     RESET
  ------------------------------------------------------- */
  resetAll() {
    this.settings = {
      brightness: 0, contrast: 0, saturation: 0, exposure: 0,
      hue: 0, sharpness: 0, noise: 0, blur: 0,
      grayscale: false, blackwhite: false, sepia: false, invert: false,
      vignette: 0, temperature: 0, preset: 'none'
    };
    this.exportSettings.width    = null;
    this.exportSettings.height   = null;
    this.exportSettings.cropTop  = 0;
    this.exportSettings.cropBottom = 0;
    this.exportSettings.cropLeft   = 0;
    this.exportSettings.cropRight  = 0;
    this.rotation = 0;
    this.flipH    = false;
    this.flipV    = false;
    this.zoom     = 1.0;
    this.scheduleRender(0);
  }

  /* -------------------------------------------------------
     EXPORT / DOWNLOAD
  ------------------------------------------------------- */

  /**
   * Gera o canvas final para exportação (full resolution)
   * @returns {Promise<HTMLCanvasElement>}
   */
  async getExportCanvas() {
    // 1. Geometry
    let srcCanvas = this._buildGeometryCanvas();

    // 2. Resize
    const dims = window.PixelFilters.calcAspectRatio(
      srcCanvas.width,
      srcCanvas.height,
      this.exportSettings.width  || null,
      this.exportSettings.height || null
    );
    let exportCanvas = srcCanvas;
    if (dims.w !== srcCanvas.width || dims.h !== srcCanvas.height) {
      exportCanvas = window.PixelFilters.resizeImage(srcCanvas, dims.w, dims.h);
    }

    // 3. Crop
    const crop = {
      top:    this.exportSettings.cropTop,
      bottom: this.exportSettings.cropBottom,
      left:   this.exportSettings.cropLeft,
      right:  this.exportSettings.cropRight
    };
    if (Object.values(crop).some(v => v > 0)) {
      exportCanvas = window.PixelFilters.cropImage(exportCanvas, crop);
    }

    // 4. Filtros
    const ctx     = exportCanvas.getContext('2d', { willReadFrequently: true });
    const imgData = ctx.getImageData(0, 0, exportCanvas.width, exportCanvas.height);
    const processed = window.PixelFilters.processImage(
      imgData,
      this.settings,
      exportCanvas.width,
      exportCanvas.height
    );
    ctx.putImageData(processed, 0, 0);

    return exportCanvas;
  }

  /**
   * Converte para BMP (format não suportado nativamente por todos os browsers)
   * Implementação manual do header BMP
   */
  _canvasToBMP(canvas) {
    const w = canvas.width;
    const h = canvas.height;
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, w, h);
    const data = imageData.data;

    // BMP file structure
    const rowSize   = Math.ceil(w * 3 / 4) * 4; // alinhado a 4 bytes
    const pixelSize = rowSize * h;
    const fileSize  = 54 + pixelSize;

    const buffer = new ArrayBuffer(fileSize);
    const view   = new DataView(buffer);

    // === FILE HEADER (14 bytes) ===
    view.setUint8(0, 0x42); // 'B'
    view.setUint8(1, 0x4D); // 'M'
    view.setUint32(2,  fileSize,  true); // file size
    view.setUint32(6,  0,         true); // reserved
    view.setUint32(10, 54,        true); // pixel data offset

    // === INFO HEADER (40 bytes) ===
    view.setUint32(14, 40,         true); // header size
    view.setInt32( 18, w,          true); // width
    view.setInt32( 22, -h,         true); // height (negativo = top-down)
    view.setUint16(26, 1,          true); // color planes
    view.setUint16(28, 24,         true); // bits per pixel
    view.setUint32(30, 0,          true); // compression (BI_RGB)
    view.setUint32(34, pixelSize,  true); // image size
    view.setInt32( 38, 2835,       true); // x pixels per meter
    view.setInt32( 42, 2835,       true); // y pixels per meter
    view.setUint32(46, 0,          true); // colors in table
    view.setUint32(50, 0,          true); // important colors

    // === PIXEL DATA ===
    let offset = 54;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const srcIdx = (y * w + x) * 4;
        view.setUint8(offset++, data[srcIdx + 2]); // B
        view.setUint8(offset++, data[srcIdx + 1]); // G
        view.setUint8(offset++, data[srcIdx]);     // R
      }
      // Padding
      const pad = rowSize - w * 3;
      for (let p = 0; p < pad; p++) view.setUint8(offset++, 0);
    }

    return new Blob([buffer], { type: 'image/bmp' });
  }

  /**
   * Faz o download da imagem processada
   */
  async download() {
    const { format, quality, filename } = this.exportSettings;
    const exportCanvas = await this.getExportCanvas();
    const ext = this._getExtension(format);
    const name = (filename || this._sanitizeFilename(this.record.name)) + '.' + ext;

    if (format === 'image/bmp') {
      // BMP manual
      const blob = this._canvasToBMP(exportCanvas);
      this._triggerDownload(URL.createObjectURL(blob), name);
    } else if (format === 'image/gif') {
      // GIF: converter para PNG (GIF animado não suportado via Canvas)
      // Usar PNG como fallback com extensão .gif
      exportCanvas.toBlob(blob => {
        this._triggerDownload(URL.createObjectURL(blob), name);
      }, 'image/png');
    } else {
      exportCanvas.toBlob(blob => {
        this._triggerDownload(URL.createObjectURL(blob), name);
      }, format, quality);
    }

    return name;
  }

  /**
   * Copia para clipboard
   */
  async copyToClipboard() {
    const exportCanvas = await this.getExportCanvas();
    return new Promise((resolve, reject) => {
      exportCanvas.toBlob(async blob => {
        try {
          await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob })
          ]);
          resolve();
        } catch (err) {
          reject(err);
        }
      }, 'image/png');
    });
  }

  /**
   * Retorna o canvas processado como Blob
   */
  async toBlob() {
    const { format, quality } = this.exportSettings;
    const exportCanvas = await this.getExportCanvas();

    if (format === 'image/bmp') {
      return this._canvasToBMP(exportCanvas);
    }

    return new Promise(resolve => {
      exportCanvas.toBlob(resolve, format, quality);
    });
  }

  /* -------------------------------------------------------
     HELPERS
  ------------------------------------------------------- */

  _getExtension(format) {
    const map = {
      'image/jpeg': 'jpg',
      'image/png':  'png',
      'image/bmp':  'bmp',
      'image/gif':  'gif',
      'image/webp': 'webp'
    };
    return map[format] || 'jpg';
  }

  _sanitizeFilename(name) {
    return name.replace(/\.[^/.]+$/, '').replace(/[^a-z0-9_-]/gi, '_').toLowerCase();
  }

  _triggerDownload(url, filename) {
    const a = document.createElement('a');
    a.href     = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(url);
      a.remove();
    }, 1000);
  }

  _showLoading(show) {
    const el = document.getElementById('canvasLoading');
    if (el) el.classList.toggle('show', show);
  }

  _updateInfoBar(canvas) {
    const origDimsEl   = document.getElementById('infoOrigDims');
    const newDimsEl    = document.getElementById('infoNewDims');
    const formatEl     = document.getElementById('infoFormat');
    const estDimsEl    = document.getElementById('estDimensions');

    if (origDimsEl) origDimsEl.innerHTML = `<i class="fas fa-expand-arrows-alt"></i> Original: ${this.origW}×${this.origH}`;
    if (newDimsEl)  newDimsEl.innerHTML  = `<i class="fas fa-crop-alt"></i> Novo: ${canvas.width}×${canvas.height}`;
    if (formatEl)   formatEl.innerHTML   = `<i class="fas fa-file-alt"></i> ${this._getExtension(this.exportSettings.format).toUpperCase()}`;
    if (estDimsEl)  estDimsEl.textContent = `${canvas.width} × ${canvas.height} px`;

    // Atualizar estimativa de tamanho
    this._updateFileSizeEstimate(canvas);
  }

  async _updateFileSizeEstimate(canvas) {
    const { format, quality } = this.exportSettings;
    const bytes = await window.PixelFilters.estimateFileSize(canvas, format, quality);
    const sizeEl = document.getElementById('infoFileSize');
    const estSizeEl = document.getElementById('estFileSize');
    const formatted = window.PixelFilters.formatBytes(bytes);
    if (sizeEl) sizeEl.innerHTML = `<i class="fas fa-file-image"></i> ${formatted}`;
    if (estSizeEl) estSizeEl.textContent = formatted;
  }

  /**
   * Gera thumbnail para o card da galeria
   * @returns {string} dataURL
   */
  async getThumbnailDataURL() {
    const exportCanvas = await this.getExportCanvas();
    const thumb = window.PixelFilters.resizeImage(exportCanvas, 400, 300);
    return thumb.toDataURL('image/jpeg', 0.7);
  }

  /**
   * Retorna estado completo de edições para serialização
   */
  getState() {
    return {
      settings:       { ...this.settings },
      exportSettings: { ...this.exportSettings },
      rotation:       this.rotation,
      flipH:          this.flipH,
      flipV:          this.flipV
    };
  }

  /**
   * Restaura estado previamente salvo
   */
  restoreState(state) {
    if (state.settings)       Object.assign(this.settings, state.settings);
    if (state.exportSettings) Object.assign(this.exportSettings, state.exportSettings);
    if (state.rotation !== undefined) this.rotation = state.rotation;
    if (state.flipH !== undefined)    this.flipH    = state.flipH;
    if (state.flipV !== undefined)    this.flipV    = state.flipV;
    this.scheduleRender(0);
  }
}

/* Expõe globalmente */
window.ImageEditor = ImageEditor;
