// Terra Genesis desktop app (macOS): the built web app in its own window, fully offline.
// The site is served from app://terra/ (a private, secure origin) so ES modules, WebGL2 and
// IndexedDB saves all work exactly as on the web, without a local server.
const { app, BrowserWindow, protocol, net, shell } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');

protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } }]);

const root = path.join(__dirname, 'web');

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: 'Terra Genesis',
    backgroundColor: '#0b1912',
    webPreferences: { contextIsolation: true, sandbox: true },
  });
  win.loadURL('app://terra/index.html');
  // Links to the web (e.g. nodejs.org in Help) open in the normal browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });
  // Smoke test hook (used when building): save a screenshot after loading, then quit.
  if (process.env.TG_SMOKE_SHOT) {
    win.webContents.once('did-finish-load', () => {
      setTimeout(async () => {
        const img = await win.webContents.capturePage();
        fs.writeFileSync(process.env.TG_SMOKE_SHOT, img.toPNG());
        const info = await win.webContents.executeJavaScript('JSON.stringify({ version: window.__terraGenesis?.version, backend: window.__terraGenesis?.engine?.backend, cells: window.__terraGenesis?.engine?.world?.width })');
        fs.writeFileSync(process.env.TG_SMOKE_SHOT + '.json', info);
        app.quit();
      }, Number(process.env.TG_SMOKE_WAIT ?? 12000));
    });
  }
}

app.whenReady().then(() => {
  protocol.handle('app', (req) => {
    let p = decodeURIComponent(new URL(req.url).pathname);
    if (p === '/' || p === '') p = '/index.html';
    const file = path.normalize(path.join(root, p));
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file)) return new Response('Not found', { status: 404 });
    return net.fetch(pathToFileURL(file).toString());
  });
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
