const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  // App
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),

  // Updates
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  getUpdateStatus: () => ipcRenderer.invoke('get-update-status'),
  installUpdate: () => ipcRenderer.invoke('install-update'),
  openUpdateRelease: () => ipcRenderer.invoke('open-update-release'),
  onUpdateAvailable: (cb) => ipcRenderer.on('update-available', (_event, payload) => cb(payload)),
  onUpdateDownloaded: (cb) => ipcRenderer.on('update-downloaded', (_event, payload) => cb(payload)),
  onUpdateStatus: (cb) => ipcRenderer.on('update-status', (_event, payload) => cb(payload)),
  removeUpdateListeners: () => {
    ipcRenderer.removeAllListeners('update-available')
    ipcRenderer.removeAllListeners('update-downloaded')
    ipcRenderer.removeAllListeners('update-status')
  },

  // Local SQLite data
  listLocalEmployees: (options) => ipcRenderer.invoke('database:list-employees', options),
  listLocalTransactions: (options) => ipcRenderer.invoke('database:list-transactions', options),
  saveLocalEmployee: (employee) => ipcRenderer.invoke('database:save-employee', employee),
  cacheLocalEmployees: (employees) => ipcRenderer.invoke('database:cache-employees', employees),
  cacheLocalTransactions: (transactions) => ipcRenderer.invoke('database:cache-transactions', transactions),
  deleteLocalEmployee: (id) => ipcRenderer.invoke('database:delete-employee', id),
  recordLocalLeave: (payload) => ipcRenderer.invoke('database:record-leave', payload),
  getPendingChanges: () => ipcRenderer.invoke('database:pending-changes'),
  resolvePendingChange: (payload) => ipcRenderer.invoke('database:resolve-change', payload),

  // Whole-database migration
  backupDatabase: () => ipcRenderer.invoke('database:backup'),
  restoreDatabase: () => ipcRenderer.invoke('database:restore')
})
