let previousSettings = {};
const ns = "custom-canvas-font";
const defaultFontFamily = "GWENT";
const defaultFontFile = "/modules/custom-canvas-font/fonts/hinted-GWENT-ExtraBold.ttf";

Hooks.once("init", () => {
    // Font dropdown (placeholder; will update dynamically)
    game.settings.register(ns, "fontChoice", {
        name: "Font Choice",
        hint: "Pick a font already loaded in Foundry. Custom file overrides this.",
        scope: "world",
        config: true,
        type: String,
        choices: { [defaultFontFamily]: defaultFontFamily },
        default: defaultFontFamily
    });

    // Font file picker (overrides dropdown)
    game.settings.register(ns, "fontFile", {
        name: "Font File (Overrides Dropdown)",
        hint: "Upload or select a font file (.ttf or .otf).",
        scope: "world",
        config: true,
        type: String,
        default: defaultFontFile,
        filePicker: "any"
    });

    // Font fill
    game.settings.register(ns, "fontFill", {
        name: "Font Fill Color",
        hint: "Color of the font.",
        scope: "world",
        config: true,
        type: String,
        default: "#FFFFFF",
        colorPicker: true
    });

    // Font size (Does not work with most fonts)
    game.settings.register(ns, "fontSize", {
        name: "Font Size",
        hint: "Size of the token font (px) [Does not work with most fonts].",
        scope: "world",
        config: true,
        type: Number,
        default: 28,
        range: { min: 10, max: 72, step: 1 }
    });

    // Stroke color
    game.settings.register(ns, "fontStroke", {
        name: "Font Stroke Color",
        hint: "Outline color for the font.",
        scope: "world",
        config: true,
        type: String,
        default: "#000000",
        colorPicker: true
    });

    // Stroke thickness
    game.settings.register(ns, "strokeThickness", {
        name: "Stroke Thickness",
        hint: "Thickness of the text outline.",
        scope: "world",
        config: true,
        type: Number,
        default: 2,
        range: { min: 0, max: 10, step: 1 }
    });

    // Socket for GM -> players
    game.socket.on(`module.${ns}`, data => {
        if (data.action === "refresh" && !game.user.isGM) {
            ui.notifications.info("The GM changed font settings. Reloading…");
            setTimeout(() => window.location.reload(), 1000);
        }
    });
});

// Dynamically populate Font Choice dropdown on settings render
Hooks.on("renderSettingsConfig", (app, html) => {
    if (!game.user.isGM) return;

    // Ensure html is a jQuery object
    const $html = html instanceof jQuery ? html : $(html);

    // Capture previous settings
    previousSettings = {
        fontChoice: game.settings.get(ns, "fontChoice"),
        fontFile: game.settings.get(ns, "fontFile"),
        fontFill: game.settings.get(ns, "fontFill"),
        fontSize: game.settings.get(ns, "fontSize"),
        fontStroke: game.settings.get(ns, "fontStroke"),
        strokeThickness: game.settings.get(ns, "strokeThickness")
    };

    // Delay slightly to ensure fonts are recognized by browser
    setTimeout(() => {
        const availableFonts = Array.from(document.fonts)
            .map(f => f.family)
            .filter((v, i, a) => !!v && a.indexOf(v) === i);

        if (!availableFonts.includes(defaultFontFamily)) availableFonts.push(defaultFontFamily);

        const fontChoices = availableFonts.reduce((obj, f) => {
            obj[f] = f;
            return obj;
        }, {});

        const $select = $html.find(`select[name="${ns}.fontChoice"]`);
        $select.empty();
        for (const [key, label] of Object.entries(fontChoices)) {
            const selected = key === game.settings.get(ns, "fontChoice") ? "selected" : "";
            $select.append(`<option value="${key}" ${selected}>${label}</option>`);
        }
    }, 100);
});

// Apply font settings and refresh tokens on ready
Hooks.once("ready", async () => {
    const fontChoice = game.settings.get(ns, "fontChoice");
    const fontFile = game.settings.get(ns, "fontFile");
    const fontFill = game.settings.get(ns, "fontFill");
    const fontSize = game.settings.get(ns, "fontSize");
    const fontStroke = game.settings.get(ns, "fontStroke");
    const strokeThickness = game.settings.get(ns, "strokeThickness");

    const fontFamily = fontFile ? defaultFontFamily : (fontChoice || defaultFontFamily);

    await loadAndEnsureFont(fontFamily, fontFile);

    CONFIG.canvasTextStyle = mergeObject(CONFIG.canvasTextStyle, {
        fontFamily,
        fontSize,
        fill: fontFill,
        stroke: fontStroke,
        strokeThickness
    });

    refreshAllTokenNameplates();

    console.log(`Custom Canvas Font applied: ${fontFamily}`, CONFIG.canvasTextStyle);
});

// After settings save
Hooks.on("closeSettingsConfig", () => {
    if (!game.user.isGM) return;

    const currentSettings = {
        fontChoice: game.settings.get(ns, "fontChoice"),
        fontFile: game.settings.get(ns, "fontFile"),
        fontFill: game.settings.get(ns, "fontFill"),
        fontSize: game.settings.get(ns, "fontSize"),
        fontStroke: game.settings.get(ns, "fontStroke"),
        strokeThickness: game.settings.get(ns, "strokeThickness")
    };

    const changed = Object.keys(previousSettings).some(k => previousSettings[k] !== currentSettings[k]);
    if (!changed) return;

    new Dialog({
        title: "Restart Required",
        content: `<p>Custom Font changes will not take effect until you refresh Foundry. All players will reload automatically.</p>`,
        buttons: {
            restart: {
                icon: '<i class="fas fa-sync"></i>',
                label: "Restart Now",
                callback: () => {
                    game.socket.emit(`module.${ns}`, { action: "refresh" });
                    window.location.reload();
                }
            },
            later: {
                icon: '<i class="fas fa-clock"></i>',
                label: "Later",
                callback: () => game.socket.emit(`module.${ns}`, { action: "refresh" })
            }
        },
        default: "later"
    }).render(true);
});

// Load font helper
async function loadAndEnsureFont(fontFamily, filePath) {
    try {
        if (filePath) {
            const ff = new FontFace(fontFamily, `url(${filePath})`);
            await ff.load();
            document.fonts.add(ff);
        }
        await document.fonts.load(`24px "${fontFamily}"`);
        await document.fonts.ready;
    } catch (err) {
        console.error("Font loading failed:", err);
    }
}

// Refresh tokens and future token updates
function refreshAllTokenNameplates() {
    if (!canvas?.tokens) return;

    for (const t of canvas.tokens.placeables) {
        try {
            t.refresh?.();
            const np = t.nameplate || t.text || t._text;
            if (np?.style) {
                np.style.fontFamily = CONFIG.canvasTextStyle.fontFamily;
                np.dirty = true;
                np.updateText?.();
            }
        } catch (e) {
            console.warn("Could not refresh token", t, e);
        }
    }

    const updateHook = () => queueMicrotask(() => canvas?.tokens?.placeables?.forEach(t => t.refresh?.()));
    Hooks.on("createToken", updateHook);
    Hooks.on("updateToken", updateHook);
}