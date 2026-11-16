const { ipcRenderer, webFrame } = require('electron');

window.ipcRenderer = ipcRenderer;
window.webFrame = webFrame;
window.isElectron = true;
