const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('appAPI', {
  quit: () => ipcRenderer.invoke('app:quit'),
  isElectron: true
});
