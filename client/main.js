const { app, BrowserWindow, globalShortcut, ipcMain, screen } = require('electron');
const path = require('path');

let mainWindow = null;
let isClickThrough = false;

// Register custom protocol vampir://
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient('vampir', process.execPath, [path.resolve(process.argv[1])]);
  }
} else {
  app.setAsDefaultProtocolClient('vampir');
}

function createWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;

  mainWindow = new BrowserWindow({
    width: Math.min(1280, width),
    height: Math.min(800, height),
    x: 40,
    y: 40,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    hasShadow: false,
    resizable: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  mainWindow.setAlwaysOnTop(true, 'screen-saver');
  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  // Handle deep link token on start
  handleProtocolUrl(process.argv);

  // Register Global Hotkeys (Work even when game is full screen / active window)
  registerGlobalHotkeys();

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function registerGlobalHotkeys() {
  // Numpad 1 to 6 -> Bosses 1 to 6
  for (let i = 1; i <= 6; i++) {
    globalShortcut.register(`num${i}`, () => {
      sendToRenderer('hotkey_boss', i);
    });
  }

  // Numpad 0 -> Central Boss
  globalShortcut.register('num0', () => {
    sendToRenderer('hotkey_boss', 0);
  });

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
  const urlArg = argv.find(arg => arg.startsWith('vampir://'));
  if (urlArg && mainWindow) {
    // vampir://token=eyJ...
    const url = new URL(urlArg);
    const token = url.searchParams.get('token');
    if (token) {
      sendToRenderer('auth_token_received', token);
    }
  }
}

// IPC from renderer
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
