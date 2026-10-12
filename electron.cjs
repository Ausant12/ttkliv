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

        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            backgroundThrottling: false
        }
    });

    // Remove o menu superior do Electron
    janela.setMenu(null);

    // Abre o nosso jogo (permite passar URL via argumento se desejado, ex: npx electron electron.cjs http://localhost:3000/games/duelo-2d-kim-nik/)
    const targetUrl = process.argv[2] && process.argv[2].startsWith("http")
        ? process.argv[2]
        : "http://localhost:3000/games/batalha-videos/";

    janela.loadURL(targetUrl);


    // F5 e Ctrl + R recarregam o jogo
    janela.webContents.on(
        "before-input-event",
        (event, input) => {
            const tecla = input.key.toLowerCase();

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
