const { app, BrowserWindow } = require("electron");

// Tenta evitar tela cinza/preta na captura do TikTok Studio
app.disableHardwareAcceleration();

app.commandLine.appendSwitch("disable-gpu");
app.commandLine.appendSwitch("disable-gpu-compositing");
app.commandLine.appendSwitch("disable-direct-composition");

let janela;

function criarJanela() {
    janela = new BrowserWindow({
        width: 1100,
        height: 1000,

        minWidth: 360,
        minHeight: 640,

        resizable: true,
        autoHideMenuBar: true,
        backgroundColor: "#000000",
        title: "Jogo da Urna • Live",

        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            backgroundThrottling: false
        }
    });

    // Remove o menu superior do Electron
    janela.setMenu(null);

    // Abre o Jogo da Urna; uma URL opcional pode ser passada pelo terminal.
    const targetUrl = process.argv[2] && process.argv[2].startsWith("http")
        ? process.argv[2]
        : "http://localhost:3000/games/jogo-da-urna/?username=makiozinha9";

    janela.loadURL(targetUrl);

    // O console pode ser aberto com F12 quando necessário.

    // F5 e Ctrl + R recarregam o jogo
    janela.webContents.on(
        "before-input-event",
        (event, input) => {
            if (input.type !== "keyDown") return;

            const tecla = input.key.toLowerCase();

            if (input.key === "F12") {
                if (janela.webContents.isDevToolsOpened()) {
                    janela.webContents.closeDevTools();
                } else {
                    janela.webContents.openDevTools({ mode: "right" });
                }
                event.preventDefault();
                return;
            }

            if (
                input.key === "F5" ||
                (input.control && tecla === "r")
            ) {
                janela.reload();
                event.preventDefault();
            }
        }
    );

    janela.on("closed", () => {
        janela = null;
    });
}

app.whenReady().then(() => {
    criarJanela();

    app.on("activate", () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            criarJanela();
        }
    });
});

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
        app.quit();
    }
});
