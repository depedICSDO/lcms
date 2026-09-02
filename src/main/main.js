import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import electronUpdater from 'electron-updater'
import path from 'path'
import { fileURLToPath } from 'url'
import {
  backupDatabase,
  cacheEmployees,
  cacheTransactions,
  closeDatabase,
  deleteEmployee,
  getPendingChanges,
  initializeDatabase,
  listEmployees,
  listTransactions,
  recordLeaveTransaction,
  resolvePendingChange,
  restoreDatabase,
  saveEmployee
} from './database.js'

const { autoUpdater } = electronUpdater

// In ES Modules, __dirname is not available by default, define it like this:
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

app.disableHardwareAcceleration()

let mainWindow
let updateTimer
let updateStatus = { state: 'idle', message: 'Ready to check for updates.' }
const githubReleaseBaseUrl = 'https://github.com/depedICSDO/lcms/releases'

function publishUpdateStatus(nextStatus) {
  updateStatus = { ...updateStatus, ...nextStatus }
  mainWindow?.webContents.send('update-status', updateStatus)
}

async function checkForUpdates(manual = false) {
  if (isDev) {
    const status = { state: 'development', message: 'Updates are checked only in the installed application.' }
    if (manual) publishUpdateStatus(status)
    return status
  }
  if (['checking', 'downloading'].includes(updateStatus.state)) return updateStatus

  publishUpdateStatus({ state: 'checking', message: 'Checking GitHub for updates…' })
  try {
    await autoUpdater.checkForUpdates()
  } catch (error) {
    publishUpdateStatus({ state: 'error', message: error.message || 'Update check failed.' })
  }
  return updateStatus
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 680,
    title: 'Leave Credits Management System (LCMS)',
    backgroundColor: '#f9f9f8',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    },
    // No frame customization — keeps native window controls
    show: false
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'))
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
}

app.whenReady().then(() => {
  initializeDatabase()
  createWindow()
  if (!isDev) {
    // Windows installs downloaded NSIS updates in-app. On macOS, LCMS sends the
    // user to the matching GitHub Release so they can choose the correct DMG.
    autoUpdater.autoDownload = process.platform === 'win32'
    autoUpdater.autoInstallOnAppQuit = true
    setTimeout(() => checkForUpdates(), 5000)
    updateTimer = setInterval(() => checkForUpdates(), 4 * 60 * 60 * 1000)
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  if (updateTimer) clearInterval(updateTimer)
  closeDatabase()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

// --- Auto-updater IPC ---
ipcMain.handle('check-for-updates', () => checkForUpdates(true))
ipcMain.handle('get-update-status', () => updateStatus)

autoUpdater.on('checking-for-update', () => {
  publishUpdateStatus({ state: 'checking', message: 'Checking GitHub for updates…' })
})

autoUpdater.on('update-available', async info => {
  if (process.platform === 'darwin') {
    const releaseUrl = `${githubReleaseBaseUrl}/tag/v${encodeURIComponent(info.version)}`
    publishUpdateStatus({ state: 'available', version: info.version, releaseUrl, message: `Version ${info.version} is available on GitHub.` })
    const result = await dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'LCMS Update Available',
      message: `LCMS version ${info.version} is available.`,
      detail: 'Open the GitHub Release page to download the new macOS installer.',
      buttons: ['Open GitHub Release', 'Later'],
      defaultId: 0,
      cancelId: 1,
      noLink: true
    })
    if (result.response === 0) await shell.openExternal(releaseUrl)
    return
  }

  publishUpdateStatus({ state: 'downloading', version: info.version, percent: 0, message: `Downloading version ${info.version}…` })
  mainWindow?.webContents.send('update-available', { version: info.version })
})

autoUpdater.on('update-not-available', info => {
  publishUpdateStatus({ state: 'current', version: info.version, message: 'LCMS is up to date.' })
})

autoUpdater.on('download-progress', progress => {
  const percent = Math.round(progress.percent || 0)
  publishUpdateStatus({ state: 'downloading', percent, message: `Downloading update… ${percent}%` })
})

autoUpdater.on('update-downloaded', async info => {
  publishUpdateStatus({ state: 'downloaded', version: info.version, percent: 100, message: `Version ${info.version} is ready to install.` })
  mainWindow?.webContents.send('update-downloaded', { version: info.version })
  const result = await dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: 'LCMS Update Ready',
    message: `LCMS version ${info.version} has been downloaded.`,
    detail: 'Press OK to install the update now. The application will close and restart automatically.',
    buttons: ['OK', 'Later'],
    defaultId: 0,
    cancelId: 1,
    noLink: true
  })
  if (result.response === 0) autoUpdater.quitAndInstall(true, true)
})

autoUpdater.on('error', error => {
  publishUpdateStatus({ state: 'error', message: error.message || 'Automatic update failed.' })
})

ipcMain.handle('install-update', () => {
  autoUpdater.quitAndInstall(true, true)
})
ipcMain.handle('open-update-release', () => {
  const releaseUrl = updateStatus.releaseUrl || `${githubReleaseBaseUrl}/latest`
  return shell.openExternal(releaseUrl)
})

// --- App info IPC ---
ipcMain.handle('get-app-version', () => app.getVersion())

// --- Local SQLite data and backup IPC ---
ipcMain.handle('database:list-employees', (_event, options) => listEmployees(options))
ipcMain.handle('database:list-transactions', (_event, options) => listTransactions(options))
ipcMain.handle('database:save-employee', (_event, employee) => saveEmployee(employee))
ipcMain.handle('database:cache-employees', (_event, employees) => cacheEmployees(employees))
ipcMain.handle('database:cache-transactions', (_event, transactions) => cacheTransactions(transactions))
ipcMain.handle('database:delete-employee', (_event, id) => deleteEmployee(id))
ipcMain.handle('database:record-leave', (_event, payload) => {
  recordLeaveTransaction(payload.transaction, payload.employee)
  return { success: true }
})
ipcMain.handle('database:pending-changes', () => getPendingChanges())
ipcMain.handle('database:resolve-change', (_event, payload) => resolvePendingChange(payload))
ipcMain.handle('database:backup', () => backupDatabase())
ipcMain.handle('database:restore', () => restoreDatabase())
