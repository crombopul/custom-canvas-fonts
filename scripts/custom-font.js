let previousSettings = {};
const ns = "custom-canvas-font";
const defaultFontFamily = "GWENT";
const defaultFontFile = "/modules/custom-canvas-font/fonts/hinted-GWENT-ExtraBold.ttf";

// -------------------- INIT --------------------
Hooks.once("init", () => {
    // Font dropdown
    game.settings.register(ns, "fontChoice", {
        name: "Font Choice",
        hint: "Pick a font already loaded in Foundry. Custom file overrides this.",
        scope: "world",
        config: true,
        type: String,
        choices: { [defaultFontFamily]: defaultFontFamily },
        default: defaultFontFamily
    });

    // Font file picker
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

    // Font size
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

// -------------------- SETTINGS RENDER --------------------
Hooks.on("renderSettingsConfig", async (app, html) => {
    if (!game.user.isGM) return;
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

    // Load Pickr CSS & JS
    await loadCSS("https://cdn.jsdelivr.net/npm/@simonwep/pickr/dist/themes/classic.min.css");
    await loadJS("https://cdn.jsdelivr.net/npm/@simonwep/pickr/dist/pickr.min.js");

    // Populate Font Choice dropdown dynamically
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

    // -------------------- LIVE PREVIEW --------------------
    let $preview = $html.find(`#${ns}-font-preview`);
    if ($preview.length === 0) {
        $preview = $(`<div id="${ns}-font-preview" style="margin-top:10px; padding:10px; border:1px solid #ccc;">Sphinx of black quartz, judge my vow</div>`);
        $html.find(`select[name="${ns}.fontChoice"]`).after($preview);
    }

    const updatePreview = async () => {
        const selectedFont = $html.find(`select[name="${ns}.fontChoice"]`).val();
        const fontFile = $html.find(`input[name="${ns}.fontFile"]`).val();
        const fontSize = parseInt($html.find(`input[name="${ns}.fontSize"]`).val()) || 28;
        const strokeThickness = parseInt($html.find(`input[name="${ns}.strokeThickness"]`).val()) || 2;
        const fontFill = $html.find(`input[name="${ns}.fontFill"]`).val() || "#FFFFFF";
        const fontStroke = $html.find(`input[name="${ns}.fontStroke"]`).val() || "#000000";

        let fontFamily = selectedFont;
        if (fontFile) {
            fontFamily = "CROMBOPUL";
            try {
                const ff = new FontFace(fontFamily, `url(${fontFile})`);
                await ff.load();
                document.fonts.add(ff);
                await document.fonts.load(`24px "${fontFamily}"`);
            } catch (err) {
                console.error("Failed to load font file preview:", err);
            }
        }

        $preview.css({
            "font-family": `'${fontFamily}'`,
            "font-size": `${fontSize}px`,
            "color": fontFill,
            "text-shadow": `
                -${strokeThickness}px 0 ${fontStroke},
                ${strokeThickness}px 0 ${fontStroke},
                0 -${strokeThickness}px ${fontStroke},
                0 ${strokeThickness}px ${fontStroke}
            `
        });

        // -------------------- APPLY TO CANVAS --------------------
        CONFIG.canvasTextStyle = foundry.utils.mergeObject(CONFIG.canvasTextStyle, {
            fontFamily,
            fontSize,
            fill: fontFill,
            stroke: fontStroke,
            strokeThickness
        });

        refreshAllTokenNameplates();
    };

    $html.find(`select[name="${ns}.fontChoice"]`).on("change", updatePreview);
    $html.find(`input[name="${ns}.fontFile"]`).on("change", updatePreview);
    $html.find(`input[name="${ns}.fontSize"]`).on("input", updatePreview);
    $html.find(`input[name="${ns}.strokeThickness"]`).on("input", updatePreview);

    // -------------------- PICKR COLOR WHEELS --------------------
    const initPickr = ($input) => {
        if (!$input.length || $input.data("pickr-initialized")) return;
        $input.hide();
        const container = $('<div style="margin-top:5px;"></div>').insertAfter($input);
        const pickr = Pickr.create({
            el: container[0],
            theme: 'classic',
            default: $input.val(),
            components: {
                preview: true,
                opacity: true,
                hue: true,
                interaction: { input: true, save: true }
            }
        });
        pickr.on('change', color => {
            const hex = color.toHEXA().toString();
            $input.val(hex).trigger("change");
            updatePreview();
        });
        pickr.on('save', () => pickr.hide());
        $input.data("pickr-initialized", true);
    };
    initPickr($html.find(`input[name="${ns}.fontFill"]`));
    initPickr($html.find(`input[name="${ns}.fontStroke"]`));

    // -------------------- INITIAL PREVIEW --------------------
    updatePreview();

    // -------------------- CONFIGURE ADDITIONAL FONTS BUTTON --------------------
    /*
    const $fileInputGroup = $html.find(`input[name="${ns}.fontFile"]`).closest(".form-group");
    if ($fileInputGroup.length && $fileInputGroup.find(`button[data-key="core.fonts"]`).length === 0) {
        const $button = $(`
            <button type="button" data-action="openSubmenu" data-key="core.fonts">
                <i class="fa-solid fa-font"></i>
                <span>Configure Additional Fonts</span>
            </button>
        `);
        $fileInputGroup.append($button);
        $button.on("click", (event) => {
            const action = event.currentTarget.dataset.action;
            const key = event.currentTarget.dataset.key;
            if (action === "openSubmenu" && key) {
                ui.settings._onClickSubmenu(event);
            }
        });
    }
    */
});

// -------------------- APPLY ON READY --------------------
Hooks.once("ready", async () => {
    const fontChoice = game.settings.get(ns, "fontChoice");
    const fontFile = game.settings.get(ns, "fontFile");
    const fontFill = game.settings.get(ns, "fontFill");
    const fontSize = game.settings.get(ns, "fontSize");
    const fontStroke = game.settings.get(ns, "fontStroke");
    const strokeThickness = game.settings.get(ns, "strokeThickness");

    const fontFamily = fontFile ? defaultFontFamily : (fontChoice || defaultFontFamily);

    await loadAndEnsureFont(fontFamily, fontFile);

    CONFIG.canvasTextStyle = foundry.utils.mergeObject(CONFIG.canvasTextStyle, {
        fontFamily,
        fontSize,
        fill: fontFill,
        stroke: fontStroke,
        strokeThickness
    });

    refreshAllTokenNameplates();
    console.log(`Custom Canvas Font applied: ${fontFamily}`, CONFIG.canvasTextStyle);
});

// -------------------- AFTER SETTINGS SAVE --------------------
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

// -------------------- HELPERS --------------------
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

// -------------------- CSS/JS LOAD HELPERS --------------------
function loadCSS(url) {
    return new Promise(resolve => {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = url;
        link.onload = resolve;
        document.head.appendChild(link);
    });
}

function loadJS(url) {
    return new Promise(resolve => {
        const script = document.createElement("script");
        script.src = url;
        script.onload = resolve;
        document.head.appendChild(script);
    });
}
