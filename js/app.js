/**
 * PIXELCRAFT — APP PRINCIPAL
 * Coordena UI, galeria de imagens e comunicação com o editor
 * Autor: Pedro Correia | Contato: 85 98900-2536
 */

'use strict';

/* =============================================================
   ESTADO GLOBAL
   ============================================================= */
const App = {
  images:         [],      // Array de imageRecord
  activeEditorIdx: null,   // Índice da imagem aberta no modal
  activeEditor:    null,   // Instância do ImageEditor atual
  theme:          'light',
  lockAspectRatio: true
};

/* =============================================================
   TOAST NOTIFICATIONS
   ============================================================= */
const Toast = {
  show(message, type = 'info', duration = 3500) {
    const container = document.getElementById('toastContainer');
    const icons = {
      success: 'fa-check-circle',
      error:   'fa-times-circle',
      warning: 'fa-exclamation-triangle',
      info:    'fa-info-circle'
    };
    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;
    toast.setAttribute('role', 'status');
    toast.innerHTML = `
      <i class="fas ${icons[type] || icons.info} toast__icon" aria-hidden="true"></i>
      <span>${message}</span>
    `;
    container.appendChild(toast);

    // Auto-remover
    setTimeout(() => {
      toast.classList.add('removing');
      toast.addEventListener('animationend', () => toast.remove());
    }, duration);
  }
};

/* =============================================================
   PROGRESS OVERLAY
   ============================================================= */
const Progress = {
  show(text = 'Processando...') {
    const overlay = document.getElementById('progressOverlay');
    document.getElementById('progressText').textContent  = text;
    document.getElementById('progressBar').style.width   = '0%';
    document.getElementById('progressCount').textContent = '';
    overlay.classList.add('show');
    overlay.removeAttribute('aria-hidden');
  },
  update(current, total) {
    const pct = Math.round((current / total) * 100);
    document.getElementById('progressBar').style.width   = pct + '%';
    document.getElementById('progressCount').textContent = `${current}/${total}`;
  },
  hide() {
    const overlay = document.getElementById('progressOverlay');
    overlay.classList.remove('show');
    overlay.setAttribute('aria-hidden', 'true');
  }
};

/* =============================================================
   GERENCIAMENTO DE IMAGENS
   ============================================================= */

/**
 * Cria um imageRecord a partir de um File
 */
function createImageRecord(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const record = {
          id:           `img_${Date.now()}_${Math.random().toString(36).slice(2)}`,
          file,
          name:         file.name,
          originalName: file.name,
          size:         file.size,
          type:         file.type,
          dataURL:      e.target.result,
          element:      img,
          editorState:  null,    // estado salvo
          thumbnail:    null,    // thumbnail editado
          edited:       false
        };
        resolve(record);
      };
      img.onerror = () => reject(new Error(`Falha ao carregar: ${file.name}`));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error(`Falha ao ler: ${file.name}`));
    reader.readAsDataURL(file);
  });
}

/**
 * Processa uma lista de Files e adiciona à galeria
 */
async function loadFiles(files) {
  if (!files.length) return;

  // Filtrar apenas imagens
  const imageFiles = Array.from(files).filter(f => f.type.startsWith('image/'));
  if (!imageFiles.length) {
    Toast.show('Nenhuma imagem válida encontrada.', 'warning');
    return;
  }

  Progress.show(`Carregando ${imageFiles.length} imagem(ns)...`);

  const results = [];
  for (let i = 0; i < imageFiles.length; i++) {
    try {
      const record = await createImageRecord(imageFiles[i]);
      results.push(record);
      Progress.update(i + 1, imageFiles.length);
    } catch (err) {
      Toast.show(`Erro ao carregar ${imageFiles[i].name}`, 'error');
    }
  }

  Progress.hide();

  if (results.length) {
    App.images.push(...results);
    renderGallery();
    showWorkspace(true);
    Toast.show(`${results.length} imagem(ns) carregada(s) com sucesso!`, 'success');
  }
}

/* =============================================================
   GALERIA / GRID DE IMAGENS
   ============================================================= */

function renderGallery() {
  const grid = document.getElementById('imagesGrid');
  grid.innerHTML = '';

  App.images.forEach((record, idx) => {
    const card = createImageCard(record, idx);
    grid.appendChild(card);
  });

  // Atualizar contador
  updateBatchCount();
}

function createImageCard(record, idx) {
  const ext = record.type.split('/')[1]?.toUpperCase() || 'IMG';
  const dimsTxt = `${record.element.naturalWidth}×${record.element.naturalHeight}`;
  const sizeTxt = window.PixelFilters.formatBytes(record.size);
  const thumbSrc = record.thumbnail || record.dataURL;

  const article = document.createElement('article');
  article.className = `image-card anim-fade-in${record.edited ? ' has-edits' : ''}`;
  article.setAttribute('role', 'listitem');
  article.setAttribute('data-idx', idx);
  article.setAttribute('aria-label', `Imagem: ${record.name}`);

  article.innerHTML = `
    <div class="image-card__thumb">
      <img src="${thumbSrc}" alt="${record.name}" loading="lazy" decoding="async" />
      <div class="image-card__select">
        <input
          type="checkbox"
          class="image-card__checkbox"
          data-idx="${idx}"
          aria-label="Selecionar ${record.name}"
          title="Selecionar"
        />
      </div>
      <span class="image-card__badge">${ext}</span>
      <span class="image-card__edited">Editado</span>
      <div class="image-card__actions">
        <button class="btn btn--primary card-edit-btn" data-idx="${idx}" aria-label="Editar imagem">
          <i class="fas fa-edit"></i> Editar
        </button>
        <button class="btn btn--danger card-delete-btn" data-idx="${idx}" aria-label="Remover imagem">
          <i class="fas fa-trash"></i>
        </button>
      </div>
    </div>
    <footer class="image-card__footer">
      <p class="image-card__name" title="${record.name}">${record.name}</p>
      <p class="image-card__meta">${dimsTxt} &bull; ${sizeTxt}</p>
    </footer>
  `;

  // Clique no card abre o editor
  article.addEventListener('click', (e) => {
    if (e.target.closest('.card-edit-btn') || e.target.closest('.image-card__thumb:not(.card-delete-btn)')) {
      if (!e.target.closest('.card-delete-btn') && !e.target.classList.contains('image-card__checkbox')) {
        openEditor(idx);
      }
    }
  });

  return article;
}

function updateBatchCount() {
  const count = App.images.length;
  document.getElementById('batchCount').textContent =
    `${count} imagem${count !== 1 ? 's' : ''} carregada${count !== 1 ? 's' : ''}`;
}

function showWorkspace(show) {
  const ws = document.getElementById('workspace');
  const up = document.getElementById('uploadZone').parentElement;

  if (show) {
    ws.hidden = false;
    ws.style.animation = 'fadeIn 0.4s ease forwards';
    if (App.images.length > 0) {
      // Reduzir espaço do upload
      up.style.paddingTop    = 'var(--space-8)';
      up.style.paddingBottom = 'var(--space-4)';
    }
  } else {
    ws.hidden = true;
  }
}

/* =============================================================
   EDITOR MODAL
   ============================================================= */

function openEditor(idx) {
  const record = App.images[idx];
  if (!record) return;

  App.activeEditorIdx = idx;

  // Nome no modal
  document.getElementById('modalFileName').textContent = record.name;

  // Inicializar o editor
  const canvas = document.getElementById('editorCanvas');
  App.activeEditor = new window.ImageEditor(record, canvas);

  // Restaurar estado de edição salvo
  if (record.editorState) {
    App.activeEditor.restoreState(record.editorState);
  }

  // Sincronizar UI com o estado do editor
  syncUIToEditor(App.activeEditor);

  // Preencher filename
  document.getElementById('ctrlFilename').value =
    record.name.replace(/\.[^/.]+$/, '');

  // Abrir modal
  openModal();

  // Renderizar presets
  renderPresets(record);
}

function openModal() {
  const modal = document.getElementById('editorModal');
  modal.classList.add('open');
  modal.removeAttribute('aria-hidden');
  document.body.style.overflow = 'hidden';

  // Focus trap
  setTimeout(() => {
    document.getElementById('btnCloseModal')?.focus();
  }, 300);
}

function closeModal() {
  const modal = document.getElementById('editorModal');
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';

  // Salvar estado
  if (App.activeEditor && App.activeEditorIdx !== null) {
    const record = App.images[App.activeEditorIdx];
    record.editorState = App.activeEditor.getState();
    record.edited = true;

    // Atualizar thumbnail assíncrono
    App.activeEditor.getThumbnailDataURL().then(thumb => {
      record.thumbnail = thumb;
      // Atualizar card
      const card = document.querySelector(`[data-idx="${App.activeEditorIdx}"]`);
      if (card) {
        const img = card.querySelector('.image-card__thumb img');
        if (img) img.src = thumb;
        card.classList.add('has-edits');
      }
    });
  }

  App.activeEditor   = null;
  App.activeEditorIdx = null;
}

/* =============================================================
   SINCRONIZAÇÃO UI ↔ EDITOR
   ============================================================= */

function syncUIToEditor(editor) {
  const s = editor.settings;
  const exp = editor.exportSettings;

  // Sliders
  setSlider('ctrlBrightness',  'valBrightness',  s.brightness,  '');
  setSlider('ctrlContrast',    'valContrast',     s.contrast,    '');
  setSlider('ctrlSaturation',  'valSaturation',   s.saturation,  '');
  setSlider('ctrlExposure',    'valExposure',     s.exposure,    '');
  setSlider('ctrlHue',         'valHue',          s.hue,         '°');
  setSlider('ctrlSharpness',   'valSharpness',    s.sharpness,   '');
  setSlider('ctrlNoise',       'valNoise',        s.noise,       '');
  setSlider('ctrlBlur',        'valBlur',         s.blur,        '');
  setSlider('ctrlVignette',    'valVignette',     s.vignette,    '');
  setSlider('ctrlTemperature', 'valTemperature',  s.temperature, '');

  // Toggles
  setToggle('ctrlGrayscale',  s.grayscale);
  setToggle('ctrlBlackWhite', s.blackwhite);
  setToggle('ctrlSepia',      s.sepia);
  setToggle('ctrlInvert',     s.invert);

  // Dimensões
  if (exp.width)  document.getElementById('ctrlWidth').value  = exp.width;
  if (exp.height) document.getElementById('ctrlHeight').value = exp.height;

  // Crop
  document.getElementById('ctrlCropTop').value    = exp.cropTop    || 0;
  document.getElementById('ctrlCropBottom').value = exp.cropBottom || 0;
  document.getElementById('ctrlCropLeft').value   = exp.cropLeft   || 0;
  document.getElementById('ctrlCropRight').value  = exp.cropRight  || 0;

  // Qualidade
  const qualityPct = Math.round((exp.quality || 0.92) * 100);
  document.getElementById('ctrlQuality').value = qualityPct;
  document.getElementById('valQuality').textContent = qualityPct + '%';

  // Formato
  const formatInputs = document.querySelectorAll('[name="exportFormat"]');
  formatInputs.forEach(inp => {
    inp.checked = inp.value === (exp.format || 'image/jpeg');
  });
  updateFormatCards();
  updateQualityGroupVisibility(exp.format || 'image/jpeg');
}

function setSlider(sliderId, valueId, value, suffix) {
  const slider = document.getElementById(sliderId);
  const label  = document.getElementById(valueId);
  if (slider) slider.value = value;
  if (label)  label.textContent = value + suffix;
  // Atualizar fill do range
  updateRangeFill(slider);
}

function setToggle(id, value) {
  const el = document.getElementById(id);
  if (el) {
    el.checked = !!value;
    el.setAttribute('aria-checked', String(!!value));
  }
}

function updateRangeFill(rangeEl) {
  if (!rangeEl) return;
  const min   = parseFloat(rangeEl.min)   || 0;
  const max   = parseFloat(rangeEl.max)   || 100;
  const value = parseFloat(rangeEl.value) || 0;
  const pct   = ((value - min) / (max - min)) * 100;

  // Não aplica fill em hue/temp (gradient custom)
  if (!rangeEl.classList.contains('range-input--hue') && !rangeEl.classList.contains('range-input--temp')) {
    rangeEl.style.background = `linear-gradient(to right, var(--color-primary) ${pct}%, var(--color-border) ${pct}%)`;
  }
}

function updateFormatCards() {
  document.querySelectorAll('.format-card').forEach(card => {
    const input = card.querySelector('input[type="radio"]');
    card.classList.toggle('format-card--active', input?.checked);
  });
}

function updateQualityGroupVisibility(format) {
  const group = document.getElementById('qualityGroup');
  if (!group) return;
  // Qualidade só faz sentido para JPEG e WEBP
  const hasQuality = format === 'image/jpeg' || format === 'image/webp';
  group.style.display = hasQuality ? 'flex' : 'none';

  // Nota sobre transparência
  const note = document.getElementById('formatNote');
  if (note) {
    if (format === 'image/jpeg') {
      note.innerHTML = '<i class="fas fa-info-circle"></i> JPG não suporta transparência.';
      note.style.display = 'flex';
    } else if (format === 'image/gif') {
      note.innerHTML = '<i class="fas fa-info-circle"></i> GIF suporta apenas 256 cores.';
      note.style.display = 'flex';
    } else {
      note.style.display = 'none';
    }
  }
}

/* =============================================================
   RENDERIZAÇÃO DOS PRESETS
   ============================================================= */

function renderPresets(record) {
  const grid = document.getElementById('presetsGrid');
  if (!grid) return;
  grid.innerHTML = '';

  Object.entries(window.PixelFilters.PRESETS).forEach(([key, preset]) => {
    const card = document.createElement('div');
    card.className = 'preset-card';
    card.setAttribute('role', 'listitem');
    card.setAttribute('title', preset.name);
    card.dataset.preset = key;

    // Gerar thumbnail do preset
    const thumbCanvas = document.createElement('canvas');
    thumbCanvas.width  = 80;
    thumbCanvas.height = 60;
    const thumbCtx = thumbCanvas.getContext('2d');
    thumbCtx.drawImage(record.element, 0, 0, 80, 60);

    // Aplicar filtro do preset no thumbnail
    if (key !== 'none') {
      const imgData = thumbCtx.getImageData(0, 0, 80, 60);
      const processed = window.PixelFilters.processImage(imgData, preset.settings, 80, 60);
      thumbCtx.putImageData(processed, 0, 0);
    }

    card.innerHTML = `
      <div class="preset-card__thumb"></div>
      <span class="preset-card__name">${preset.icon} ${preset.name}</span>
    `;
    card.querySelector('.preset-card__thumb').appendChild(thumbCanvas);

    if (App.activeEditor?.settings?.preset === key) {
      card.classList.add('active');
    }

    card.addEventListener('click', () => {
      if (!App.activeEditor) return;
      App.activeEditor.applyPreset(key);
      syncUIToEditor(App.activeEditor);
      // Marcar card ativo
      grid.querySelectorAll('.preset-card').forEach(c => c.classList.remove('active'));
      card.classList.add('active');
    });

    grid.appendChild(card);
  });
}

/* =============================================================
   DOWNLOAD EM LOTE
   ============================================================= */

async function downloadAll() {
  const selected = getSelectedIndices();
  const targets  = selected.length > 0 ? selected : App.images.map((_, i) => i);

  if (targets.length === 0) {
    Toast.show('Nenhuma imagem para baixar.', 'warning');
    return;
  }

  Progress.show(`Baixando ${targets.length} imagem(ns)...`);

  for (let i = 0; i < targets.length; i++) {
    const idx    = targets[i];
    const record = App.images[idx];
    if (!record) continue;

    try {
      // Criar editor temporário com estado salvo
      const tempCanvas  = document.createElement('canvas');
      const tempEditor  = new window.ImageEditor(record, tempCanvas);
      if (record.editorState) tempEditor.restoreState(record.editorState);

      const blob = await tempEditor.toBlob();
      const ext  = tempEditor._getExtension(record.editorState?.exportSettings?.format || 'image/jpeg');
      const name = tempEditor._sanitizeFilename(record.name) + '_editado.' + ext;

      tempEditor._triggerDownload(URL.createObjectURL(blob), name);
      Progress.update(i + 1, targets.length);

      // Pequeno delay para não sobrecarregar
      await new Promise(r => setTimeout(r, 200));
    } catch (err) {
      console.error('[PixelCraft] Erro ao baixar:', record.name, err);
      Toast.show(`Erro ao processar ${record.name}`, 'error');
    }
  }

  Progress.hide();
  Toast.show(`${targets.length} imagem(ns) baixada(s)!`, 'success');
}

/* =============================================================
   SELEÇÃO DE IMAGENS
   ============================================================= */

function getSelectedIndices() {
  const checkboxes = document.querySelectorAll('.image-card__checkbox:checked');
  return Array.from(checkboxes).map(cb => parseInt(cb.dataset.idx, 10));
}

function selectAll(select) {
  document.querySelectorAll('.image-card__checkbox').forEach(cb => {
    cb.checked = select;
  });
  document.querySelectorAll('.image-card').forEach(card => {
    card.classList.toggle('selected', select);
  });
}

/* =============================================================
   APLICAR FILTROS ATUAIS A TODAS
   ============================================================= */

async function applyCurrentFiltersToAll() {
  if (!App.activeEditor) {
    Toast.show('Abra uma imagem no editor primeiro.', 'warning');
    return;
  }

  const currentState = App.activeEditor.getState();
  const selected     = getSelectedIndices();
  const targets      = selected.length > 0 ? selected : App.images.map((_, i) => i);

  if (targets.length === 0) return;

  Progress.show('Aplicando filtros a todas...');

  for (let i = 0; i < targets.length; i++) {
    const idx    = targets[i];
    const record = App.images[idx];
    if (!record) continue;
    record.editorState = { ...currentState };
    record.edited      = true;
    Progress.update(i + 1, targets.length);
    await new Promise(r => setTimeout(r, 10));
  }

  Progress.hide();
  renderGallery();
  Toast.show(`Filtros aplicados a ${targets.length} imagem(ns)!`, 'success');
}

/* =============================================================
   REMOÇÃO
   ============================================================= */

function removeImage(idx) {
  App.images.splice(idx, 1);
  renderGallery();
  if (App.images.length === 0) showWorkspace(false);
  Toast.show('Imagem removida.', 'info');
}

function clearAll() {
  if (App.images.length === 0) return;
  if (!confirm(`Remover todas as ${App.images.length} imagens?`)) return;
  App.images = [];
  renderGallery();
  showWorkspace(false);
  Toast.show('Galeria limpa.', 'info');
}

/* =============================================================
   TEMA CLARO / ESCURO
   ============================================================= */

function toggleTheme() {
  App.theme = App.theme === 'light' ? 'dark' : 'light';
  document.documentElement.dataset.theme = App.theme;
  const icon = document.getElementById('themeIcon');
  if (icon) {
    icon.className = App.theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
  }
  localStorage.setItem('pixelcraft_theme', App.theme);
}

function loadTheme() {
  const saved = localStorage.getItem('pixelcraft_theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  App.theme = saved || (prefersDark ? 'dark' : 'light');
  document.documentElement.dataset.theme = App.theme;
  const icon = document.getElementById('themeIcon');
  if (icon) icon.className = App.theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
}

/* =============================================================
   TABS DO MODAL
   ============================================================= */

function initTabs() {
  const tabBtns = document.querySelectorAll('.tab-btn');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = btn.dataset.tab;

      // Desativar todos
      tabBtns.forEach(b => {
        b.classList.remove('tab-btn--active');
        b.setAttribute('aria-selected', 'false');
      });
      document.querySelectorAll('.tab-panel').forEach(p => {
        p.hidden = true;
        p.classList.remove('tab-panel--active');
      });

      // Ativar selecionado
      btn.classList.add('tab-btn--active');
      btn.setAttribute('aria-selected', 'true');
      const panel = document.getElementById('tab' + tabId.charAt(0).toUpperCase() + tabId.slice(1));
      if (panel) {
        panel.hidden = false;
        panel.classList.add('tab-panel--active');
      }
    });
  });
}

/* =============================================================
   EVENT LISTENERS — UPLOAD
   ============================================================= */

function initUpload() {
  const zone      = document.getElementById('uploadZone');
  const fileInput = document.getElementById('fileInput');

  // Click na zona
  zone.addEventListener('click', (e) => {
    if (!e.target.closest('label')) fileInput.click();
  });

  // Keyboard na zona
  zone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fileInput.click();
    }
  });

  // Seleção de arquivo
  fileInput.addEventListener('change', () => {
    if (fileInput.files.length) {
      loadFiles(fileInput.files);
      fileInput.value = ''; // Reset para permitir re-upload do mesmo arquivo
    }
  });

  // Drag and drop
  ['dragenter', 'dragover'].forEach(evt => {
    zone.addEventListener(evt, (e) => {
      e.preventDefault();
      e.stopPropagation();
      zone.classList.add('drag-over');
    });
  });

  ['dragleave', 'dragend'].forEach(evt => {
    zone.addEventListener(evt, (e) => {
      e.preventDefault();
      zone.classList.remove('drag-over');
    });
  });

  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    zone.classList.remove('drag-over');
    const files = e.dataTransfer?.files;
    if (files?.length) loadFiles(files);
  });

  // Drop na página toda
  document.addEventListener('dragover',  (e) => e.preventDefault());
  document.addEventListener('drop', (e) => {
    e.preventDefault();
    const files = e.dataTransfer?.files;
    if (files?.length) loadFiles(files);
  });
}

/* =============================================================
   EVENT LISTENERS — GALERIA (Event Delegation)
   ============================================================= */

function initGalleryEvents() {
  const grid = document.getElementById('imagesGrid');

  grid.addEventListener('click', (e) => {
    // Botão Editar
    const editBtn = e.target.closest('.card-edit-btn');
    if (editBtn) {
      openEditor(parseInt(editBtn.dataset.idx, 10));
      return;
    }

    // Botão Deletar
    const deleteBtn = e.target.closest('.card-delete-btn');
    if (deleteBtn) {
      e.stopPropagation();
      removeImage(parseInt(deleteBtn.dataset.idx, 10));
      return;
    }

    // Checkbox de seleção
    const checkbox = e.target.closest('.image-card__checkbox');
    if (checkbox) {
      const card = checkbox.closest('.image-card');
      if (card) card.classList.toggle('selected', checkbox.checked);
      return;
    }
  });
}

/* =============================================================
   EVENT LISTENERS — MODAL / EDITOR
   ============================================================= */

function initEditorEvents() {

  // Fechar modal
  document.getElementById('btnCloseModal').addEventListener('click', closeModal);

  document.getElementById('editorModal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('editorModal')) closeModal();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const modal = document.getElementById('editorModal');
      if (modal.classList.contains('open')) closeModal();
    }
  });

  // ── AJUSTES (Sliders) ──
  const sliderMap = [
    { id: 'ctrlBrightness',  val: 'valBrightness',  key: 'brightness',  suffix: '' },
    { id: 'ctrlContrast',    val: 'valContrast',     key: 'contrast',    suffix: '' },
    { id: 'ctrlSaturation',  val: 'valSaturation',   key: 'saturation',  suffix: '' },
    { id: 'ctrlExposure',    val: 'valExposure',     key: 'exposure',    suffix: '' },
    { id: 'ctrlHue',         val: 'valHue',          key: 'hue',         suffix: '°' },
    { id: 'ctrlSharpness',   val: 'valSharpness',    key: 'sharpness',   suffix: '' },
    { id: 'ctrlNoise',       val: 'valNoise',        key: 'noise',       suffix: '' },
    { id: 'ctrlBlur',        val: 'valBlur',         key: 'blur',        suffix: '' },
    { id: 'ctrlVignette',    val: 'valVignette',     key: 'vignette',    suffix: '' },
    { id: 'ctrlTemperature', val: 'valTemperature',  key: 'temperature', suffix: '' }
  ];

  sliderMap.forEach(({ id, val, key, suffix }) => {
    const slider = document.getElementById(id);
    if (!slider) return;

    slider.addEventListener('input', () => {
      const value = parseFloat(slider.value);
      document.getElementById(val).textContent = value + suffix;
      updateRangeFill(slider);
      App.activeEditor?.setSetting(key, value);
    });
  });

  // ── TOGGLES ──
  const toggleMap = [
    { id: 'ctrlGrayscale',  key: 'grayscale' },
    { id: 'ctrlBlackWhite', key: 'blackwhite' },
    { id: 'ctrlSepia',      key: 'sepia' },
    { id: 'ctrlInvert',     key: 'invert' }
  ];

  toggleMap.forEach(({ id, key }) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('change', () => {
      el.setAttribute('aria-checked', String(el.checked));
      App.activeEditor?.setSetting(key, el.checked);
    });
  });

  // ── ZOOM ──
  document.getElementById('btnZoomIn') .addEventListener('click', () => App.activeEditor?.zoomIn());
  document.getElementById('btnZoomOut').addEventListener('click', () => App.activeEditor?.zoomOut());
  document.getElementById('btnZoomFit').addEventListener('click', () => App.activeEditor?.zoomFit());
  document.getElementById('btnResetFilters').addEventListener('click', () => {
    if (!App.activeEditor) return;
    App.activeEditor.resetAll();
    syncUIToEditor(App.activeEditor);
    // Resetar presets
    document.querySelectorAll('.preset-card').forEach(c => c.classList.remove('active'));
    const noneCard = document.querySelector('[data-preset="none"]');
    if (noneCard) noneCard.classList.add('active');
    Toast.show('Ajustes redefinidos.', 'info');
  });

  // ── TRANSFORMAÇÕES ──
  document.getElementById('btnRotateLeft') .addEventListener('click', () => App.activeEditor?.rotate(-90));
  document.getElementById('btnRotateRight').addEventListener('click', () => App.activeEditor?.rotate(90));
  document.getElementById('btnFlipH')      .addEventListener('click', () => App.activeEditor?.flip('h'));
  document.getElementById('btnFlipV')      .addEventListener('click', () => App.activeEditor?.flip('v'));

  // ── DIMENSÕES ──
  const ctrlWidth  = document.getElementById('ctrlWidth');
  const ctrlHeight = document.getElementById('ctrlHeight');

  const debounceDimension = debounce(() => {
    if (!App.activeEditor) return;
    const w = parseInt(ctrlWidth.value,  10) || null;
    const h = parseInt(ctrlHeight.value, 10) || null;
    App.activeEditor.setExportSetting('width',  w);
    App.activeEditor.setExportSetting('height', h);
  }, 600);

  ctrlWidth.addEventListener('input', () => {
    if (App.lockAspectRatio && App.activeEditor && ctrlWidth.value) {
      const ratio = App.activeEditor.origH / App.activeEditor.origW;
      ctrlHeight.value = Math.round(parseInt(ctrlWidth.value) * ratio) || '';
    }
    debounceDimension();
  });

  ctrlHeight.addEventListener('input', () => {
    if (App.lockAspectRatio && App.activeEditor && ctrlHeight.value) {
      const ratio = App.activeEditor.origW / App.activeEditor.origH;
      ctrlWidth.value = Math.round(parseInt(ctrlHeight.value) * ratio) || '';
    }
    debounceDimension();
  });

  // Lock ratio
  const btnLock = document.getElementById('btnLockRatio');
  btnLock.addEventListener('click', () => {
    App.lockAspectRatio = !App.lockAspectRatio;
    btnLock.setAttribute('aria-pressed', String(App.lockAspectRatio));
    document.getElementById('lockIcon').className = App.lockAspectRatio ? 'fas fa-lock' : 'fas fa-lock-open';
  });

  // Size presets
  document.querySelectorAll('.size-presets .btn--chip').forEach(btn => {
    btn.addEventListener('click', () => {
      const w = parseInt(btn.dataset.w);
      const h = parseInt(btn.dataset.h);
      ctrlWidth.value  = w;
      ctrlHeight.value = h;
      document.querySelectorAll('.size-presets .btn--chip').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      if (App.activeEditor) {
        App.activeEditor.setExportSetting('width',  w);
        App.activeEditor.setExportSetting('height', h);
      }
    });
  });

  // Crop
  const cropFields = [
    { id: 'ctrlCropTop',    key: 'cropTop' },
    { id: 'ctrlCropBottom', key: 'cropBottom' },
    { id: 'ctrlCropLeft',   key: 'cropLeft' },
    { id: 'ctrlCropRight',  key: 'cropRight' }
  ];
  cropFields.forEach(({ id, key }) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', debounce(() => {
      App.activeEditor?.setExportSetting(key, parseInt(el.value) || 0);
    }, 400));
  });

  // ── EXPORTAÇÃO ──

  // Formato
  document.querySelectorAll('[name="exportFormat"]').forEach(inp => {
    inp.addEventListener('change', () => {
      updateFormatCards();
      updateQualityGroupVisibility(inp.value);
      App.activeEditor?.setExportSetting('format', inp.value);
    });
  });

  // Clique nos cards de formato
  document.querySelectorAll('.format-card').forEach(card => {
    card.addEventListener('click', () => {
      const inp = card.querySelector('input[type="radio"]');
      if (inp) {
        inp.checked = true;
        inp.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
  });

  // Qualidade
  const ctrlQuality = document.getElementById('ctrlQuality');
  ctrlQuality.addEventListener('input', () => {
    const pct = parseInt(ctrlQuality.value);
    document.getElementById('valQuality').textContent = pct + '%';
    updateRangeFill(ctrlQuality);
    App.activeEditor?.setExportSetting('quality', pct / 100);
  });

  // Nome do arquivo
  document.getElementById('ctrlFilename').addEventListener('input', (e) => {
    App.activeEditor?.setExportSetting('filename', e.target.value);
  });

  // Download individual
  document.getElementById('btnDownloadSingle').addEventListener('click', async () => {
    if (!App.activeEditor) return;
    const btn = document.getElementById('btnDownloadSingle');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processando...';
    try {
      const name = await App.activeEditor.download();
      Toast.show(`Download iniciado: ${name}`, 'success');
    } catch (err) {
      console.error(err);
      Toast.show('Erro ao gerar download.', 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-download"></i> Baixar Imagem';
    }
  });

  // Copiar para clipboard
  document.getElementById('btnCopySingle').addEventListener('click', async () => {
    if (!App.activeEditor) return;
    try {
      await App.activeEditor.copyToClipboard();
      Toast.show('Imagem copiada para o clipboard!', 'success');
    } catch (err) {
      Toast.show('Não foi possível copiar para o clipboard.', 'error');
    }
  });

  // Scroll no canvas para zoom
  document.getElementById('editorCanvas').addEventListener('wheel', (e) => {
    if (!App.activeEditor) return;
    e.preventDefault();
    if (e.deltaY < 0) App.activeEditor.zoomIn();
    else              App.activeEditor.zoomOut();
  }, { passive: false });
}

/* =============================================================
   EVENT LISTENERS — BOTÕES DO HEADER / GALERIA
   ============================================================= */

function initHeaderEvents() {
  document.getElementById('btnToggleTheme').addEventListener('click', toggleTheme);
  document.getElementById('btnClearAll')   .addEventListener('click', clearAll);
  document.getElementById('btnDownloadAll').addEventListener('click', downloadAll);
  document.getElementById('btnSelectAll')  .addEventListener('click', () => selectAll(true));
  document.getElementById('btnApplyToAll') .addEventListener('click', applyCurrentFiltersToAll);
}

/* =============================================================
   UTILITÁRIOS
   ============================================================= */

function debounce(fn, delay) {
  let timer;
  return function(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

/* =============================================================
   INTERSECTION OBSERVER — animações de scroll
   ============================================================= */

function initScrollAnimations() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('anim-fade-in');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });

  // Observar novos cards adicionados
  const gridObserver = new MutationObserver((mutations) => {
    mutations.forEach(m => {
      m.addedNodes.forEach(node => {
        if (node.classList?.contains('image-card')) observer.observe(node);
      });
    });
  });
  gridObserver.observe(document.getElementById('imagesGrid'), { childList: true });
}

/* =============================================================
   RESIZE OBSERVER — atualizar canvas no resize
   ============================================================= */

function initResizeObserver() {
  if (!window.ResizeObserver) return;
  const canvasWrap = document.getElementById('canvasWrap');
  if (!canvasWrap) return;

  const ro = new ResizeObserver(debounce(() => {
    App.activeEditor?.render();
  }, 200));
  ro.observe(canvasWrap);
}

/* =============================================================
   INICIALIZAÇÃO GERAL
   ============================================================= */

function init() {
  // Tema
  loadTheme();

  // Upload
  initUpload();

  // Galeria
  initGalleryEvents();

  // Tabs do modal
  initTabs();

  // Eventos do editor
  initEditorEvents();

  // Header
  initHeaderEvents();

  // Animações
  initScrollAnimations();

  // Resize observer
  initResizeObserver();

  // Inicializar fills dos sliders
  document.querySelectorAll('.range-input').forEach(updateRangeFill);

  // Carregar qualidade inicial
  updateRangeFill(document.getElementById('ctrlQuality'));

  console.info('[PixelCraft] Inicializado com sucesso! © Pedro Correia - 85 98900-2536');
}

// Iniciar quando DOM estiver pronto
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
