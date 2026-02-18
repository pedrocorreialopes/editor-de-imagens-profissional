# 🎨 PixelCraft — Editor de Imagens Profissional

> Site desenvolvido por **Pedro Correia** | 📞 85 98900-2536

---

## 📋 Sobre o Projeto

**PixelCraft** é um editor de imagens profissional 100% client-side, construído com HTML5 semântico, CSS3 avançado e JavaScript puro (Vanilla ES6+). Toda a manipulação de imagens é feita via **Canvas API** diretamente no browser — sem servidores externos, sem upload de dados.

---

## ✅ Funcionalidades Implementadas

### 📁 Upload de Imagens
- Upload múltiplo simultâneo (todos os formatos de imagem)
- Drag & Drop na zona de upload ou em qualquer parte da página
- Suporte a: **JPG, PNG, GIF, BMP, WEBP, SVG**
- Preview imediato após carregamento
- Informações: dimensões e tamanho de arquivo

### 🎛️ Ajustes de Imagem (Aba "Ajustes")
| Controle | Faixa | Descrição |
|---|---|---|
| Brilho | -100 a +100 | Aumenta/diminui luminosidade |
| Contraste | -100 a +100 | Realça/reduz diferença tonal |
| Saturação | -100 a +100 | Intensidade das cores |
| Exposição | -100 a +100 | Gamma-based (fotografia) |
| Matiz (Hue) | -180° a +180° | Rotação do ângulo de cor |
| Nitidez | 0 a 10 | Unsharp mask (realce de bordas) |
| Ruído | 0 a 100 | Adiciona grão aleatório |
| Desfoque | 0 a 20 | Box blur multi-pass |

### 🎨 Filtros e Modos de Cor (Aba "Filtros")
- **Escala de cinza** — Luminância ponderada (ITU-R BT.709)
- **Preto & Branco** — Limiar adaptativo
- **Sépia** — Matriz de tons marrons clássicos
- **Inverter Cores** — Negativo fotográfico
- **Vinheta** — Escurecimento radial a partir das bordas
- **Temperatura de cor** — Frio (azulado) → Quente (laranja)
- **12 Filtros Preset** com miniatura: Original, Vívido, Frio, Quente, Vintage, Dramático, Noir, Desbotado, Bloom, Pôr do Sol, Floresta, Neon

### 🔲 Transformações (Aba "Transformar")
- **Redimensionamento** com manutenção de proporção (lock ratio)
- **Presets de tamanho**: HD (1920×1080), 720p, 800×600, 400², 1080², OG (1200×628)
- **Rotação**: -90° e +90°
- **Flip Horizontal e Vertical**
- **Recorte percentual** (Topo, Base, Esquerda, Direita)

### 📤 Exportação (Aba "Exportar")
- **Formatos**: JPG, PNG, BMP, GIF, WEBP
- **Qualidade** ajustável (1–100%) para JPG e WEBP
- **Nome do arquivo** personalizável
- **Estimativa de tamanho** em tempo real
- Encoder **BMP manual** (header BMP implementado em JavaScript puro)
- **Copiar para Clipboard** (PNG)

### 🗂️ Gerenciamento da Galeria
- Grid responsivo com miniaturas
- Seleção individual e "Selecionar Todas"
- **Download em lote** (todas ou selecionadas)
- **Aplicar filtros atuais a todas** as imagens
- Remoção individual e "Limpar Tudo"
- Badge "Editado" nos cards que foram modificados

### 🌙 Tema Claro / Escuro
- Toggle manual + detecção automática via `@media (prefers-color-scheme)`
- Persistido no `localStorage`

---

## 🏗️ Estrutura do Projeto

```
/
├── index.html          → Estrutura HTML5 semântica principal
├── css/
│   └── style.css       → Design system completo (Custom Properties + BEM + Responsive)
├── js/
│   ├── filters.js      → Motor de processamento (algoritmos de pixel, Canvas API)
│   ├── editor.js       → Classe ImageEditor (gerencia uma imagem aberta)
│   └── app.js          → Aplicação principal (UI, galeria, eventos, estado)
└── README.md           → Este arquivo
```

---

## 🗄️ Modelos de Dados

### imageRecord (em memória)
```js
{
  id:           string,      // UUID único
  file:         File,        // Arquivo original
  name:         string,      // Nome do arquivo
  originalName: string,      // Nome preservado
  size:         number,      // Bytes
  type:         string,      // MIME type (image/jpeg ...)
  dataURL:      string,      // Base64 data URL original
  element:      HTMLImageElement,
  editorState:  object|null, // Estado serializado do editor
  thumbnail:    string|null, // Data URL do thumbnail editado
  edited:       boolean
}
```

### editorState (serializado)
```js
{
  settings: {
    brightness, contrast, saturation, exposure, hue,
    sharpness, noise, blur, grayscale, blackwhite,
    sepia, invert, vignette, temperature, preset
  },
  exportSettings: {
    format, quality, filename, width, height,
    cropTop, cropBottom, cropLeft, cropRight
  },
  rotation: 0 | 90 | 180 | 270,
  flipH: boolean,
  flipV: boolean
}
```

---

## 🔗 URIs / Endpoints

| Rota | Descrição |
|---|---|
| `/` ou `/index.html` | Página principal do editor |

> ⚠️ Aplicação 100% estática. Não há endpoints de API — todo processamento ocorre no browser via Canvas API.

---

## 🚀 Tecnologias Utilizadas

| Tecnologia | Uso |
|---|---|
| HTML5 Semântico | Estrutura acessível (WCAG 2.1 AA) |
| CSS3 Custom Properties | Design tokens, dark mode nativo |
| CSS Grid + Flexbox | Layout responsivo mobile-first |
| Canvas API | Processamento pixel-level |
| Vanilla JS ES6+ | Sem dependências de framework |
| Font Awesome 6 | Iconografia |
| Google Fonts (Inter + Space Grotesk) | Tipografia |
| Intersection Observer API | Animações de scroll |
| ResizeObserver API | Canvas responsivo |
| LocalStorage | Persistência de tema |
| Clipboard API | Copiar imagem |

---

## 🔮 Próximas Evoluções Sugeridas

- [ ] **Camadas** (layers) para composição
- [ ] **Ferramenta de texto** sobre a imagem
- [ ] **Brush / Pincel** para retoques manuais
- [ ] **Histórico de ações** (undo/redo) com pilha de estados
- [ ] **Compressão ZIP** para download em lote
- [ ] **Exportação WebP animado** para GIFs
- [ ] **Crop interativo** com handles de arrastar
- [ ] **Filtros de detecção de bordas** (Sobel, Canny)
- [ ] **Color picker** para pinpoint corrections
- [ ] **PWA / Service Worker** para uso offline completo

---

## 👨‍💻 Desenvolvedor

**Site desenvolvido por Pedro Correia**  
📞 Contato: **85 98900-2536**

---

*PixelCraft © 2026 — Todos os direitos reservados*
