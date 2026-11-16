const { app, BrowserWindow, globalShortcut, ipcMain, screen } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow = null;
let isClickThrough = false;

// Custom protocol vampir://
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient('vampir', process.execPath, [path.resolve(process.argv[1])]);
  }
} else {
  app.setAsDefaultProtocolClient('vampir');
}

// Config file for auto-loading live server overlay (zero-download updates)
const configPath = path.join(app.getPath('userData'), 'overlay-config.json');
const boundsPath = path.join(app.getPath('userData'), 'window-bounds.json');

function loadJson(p) {
  try {
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) {}
  return {};
}

function saveJson(p, data) {
  try {
    fs.writeFileSync(p, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {}
}

function createWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;
  const savedBounds = loadJson(boundsPath);
  const savedConfig = loadJson(configPath);

  // Default size: on big displays (like 43" 4K/2K), default to comfortable 1500x950
  const isLargeDisplay = width >= 2560 || height >= 1400;
  const defaultW = isLargeDisplay ? Math.min(1600, width - 80) : Math.min(1280, width - 40);
  const defaultH = isLargeDisplay ? Math.min(1050, height - 80) : Math.min(850, height - 40);

  mainWindow = new BrowserWindow({
    width: savedBounds.width || defaultW,
    height: savedBounds.height || defaultH,
    x: savedBounds.x !== undefined ? savedBounds.x : 40,
    y: savedBounds.y !== undefined ? savedBounds.y : 40,
    minWidth: 600,
    minHeight: 450,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    hasShadow: false,
    resizable: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: false
    }
  });

  mainWindow.setAlwaysOnTop(true, 'screen-saver');

  // Save window position & size when user resizes or moves it (great for 43" displays)
  function saveCurrentBounds() {
    if (!mainWindow || mainWindow.isDestroyed() || mainWindow.isMinimized()) return;
    saveJson(boundsPath, mainWindow.getBounds());
  }
  mainWindow.on('resize', saveCurrentBounds);
  mainWindow.on('move', saveCurrentBounds);

  // Load live server version if configured, else load local index.html
  loadTargetPage(savedConfig);

  // Handle deep link token on start
  handleProtocolUrl(process.argv);

  // Register Global Hotkeys (Work even when game is full screen / active window)
  registerGlobalHotkeys();

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function loadTargetPage(cfg) {
  if (!mainWindow) return;

  if (cfg && cfg.serverUrl && cfg.token) {
    const targetUrl = `${cfg.serverUrl.replace(/\/+$/, '')}/?token=${encodeURIComponent(cfg.token)}&app=1`;
    console.log(`🌐 [ELECTRON] Carregando interface ao vivo do servidor: ${targetUrl}`);
    mainWindow.loadURL(targetUrl).catch((err) => {
      console.warn('⚠️ [ELECTRON] Falha ao carregar servidor remoto, caindo para local:', err.message);
      mainWindow.loadFile(path.join(__dirname, 'index.html'));
    });
  } else {
    console.log('💻 [ELECTRON] Carregando interface local...');
    mainWindow.loadFile(path.join(__dirname, 'index.html'));
  }
}

function registerGlobalHotkeys() {
  // Numpad 0 -> Armar seleção de guilda (0 + 1-8 -> Guilda)
  globalShortcut.register('num0', () => {
    sendToRenderer('hotkey_guild_select_arm');
  });

  // Numpad 1 to 8 -> Dígitos (Bosses 1 a 6 ou Guildas 1 a 8)
  for (let i = 1; i <= 8; i++) {
    globalShortcut.register(`num${i}`, () => {
      sendToRenderer('hotkey_numpad_digit', i);
    });
  }

  // Numpad / (Divide) -> Alternar modo PVP / BOSS
  globalShortcut.register('numdiv', () => {
    sendToRenderer('hotkey_toggle_pvp');
  });

  // Numpad + (Add) -> Alternar Mapa (1 vs 2)
  globalShortcut.register('numadd', () => {
    sendToRenderer('hotkey_toggle_map');
  });

  // Numpad - (Subtract) -> Marcar Boss Morto
  globalShortcut.register('numsub', () => {
    sendToRenderer('hotkey_boss_dead');
  });

  // Numpad * (Multiply) -> Call Geral / All-In
  globalShortcut.register('nummult', () => {
    sendToRenderer('hotkey_call_geral');
  });

  // F8 -> Alternar Click-Through (clique atravessa para o jogo)
  globalShortcut.register('F8', () => {
    isClickThrough = !isClickThrough;
    if (mainWindow) {
      mainWindow.setIgnoreMouseEvents(isClickThrough, { forward: true });
      sendToRenderer('click_through_changed', isClickThrough);
    }
  });

  // F9 -> Ocultar / Mostrar Overlay
  globalShortcut.register('F9', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
      }
    }
  });
}

function sendToRenderer(channel, data) {
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send(channel, data);
  }
}

// Handle deep links when app is already open
app.on('second-instance', (event, commandLine) => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
    handleProtocolUrl(commandLine);
  }
});

function handleProtocolUrl(argv) {
  const urlArg = argv.find(arg => arg && arg.startsWith('vampir://'));
  if (urlArg && mainWindow) {
    try {
      const clean = urlArg.replace('vampir://', 'https://');
      const url = new URL(clean);
      const token = url.searchParams.get('token');
      const server = url.searchParams.get('server') || url.origin;
      if (token) {
        sendToRenderer('auth_data_received', { token, server });
      }
    } catch (e) {}
  }
}

// IPC from renderer
ipcMain.on('save_connection_config', (event, cfg) => {
  if (cfg && cfg.serverUrl && cfg.token) {
    saveJson(configPath, cfg);
    loadTargetPage(cfg);
  }
});

ipcMain.on('reload_window', () => {
  if (mainWindow) {
    const savedConfig = loadJson(configPath);
    loadTargetPage(savedConfig);
  }
});

ipcMain.on('set_click_through', (event, enabled) => {
  isClickThrough = enabled;
  if (mainWindow) {
    mainWindow.setIgnoreMouseEvents(enabled, { forward: true });
  }
});

ipcMain.on('minimize_window', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.on('close_window', () => {
  if (mainWindow) mainWindow.close();
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  globalShortcut.unregisterAll();
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});
