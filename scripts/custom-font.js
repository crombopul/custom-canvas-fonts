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

    // Load Pickr
    await loadCSS("https://cdn.jsdelivr.net/npm/@simonwep/pickr/dist/themes/classic.min.css");
    await loadJS("https://cdn.jsdelivr.net/npm/@simonwep/pickr/dist/pickr.min.js");

    // -------------------- FONT DROPDOWN --------------------
    const availableFonts = Array.from(document.fonts)
        .map(f => f.family)
        .filter((v, i, a) => !!v && a.indexOf(v) === i);
    if (!availableFonts.includes(defaultFontFamily)) availableFonts.push(defaultFontFamily);

    const $select = $html.find(`select[name="${ns}.fontChoice"]`);
    $select.empty();
    for (const font of availableFonts) {
        const selected = font === game.settings.get(ns, "fontChoice") ? "selected" : "";
        $select.append(`<option value="${font}" ${selected} style="font-family:'${font}';">${font}</option>`);
    }

    // -------------------- LIVE PREVIEW --------------------
    let $preview = $html.find(`#${ns}-font-preview`);
    if ($preview.length === 0) {
        $preview = $(`<div id="${ns}-font-preview" style="margin-top:10px; padding:10px; border:1px solid #ccc;">Sphinx of black quartz, judge my vow</div>`);
        $select.after($preview);
    }

    const updatePreview = async () => {
        const selectedFont = $select.val();
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
    };

    $select.on("change", updatePreview);
    $html.find(`input[name="${ns}.fontSize"]`).on("input", updatePreview);
    $html.find(`input[name="${ns}.strokeThickness"]`).on("input", updatePreview);
    $html.find(`input[name="${ns}.fontFile"]`).on("change", updatePreview);

    // -------------------- PICKR COLOR WHEELS --------------------
    const initPickr = ($input) => {
        if (!$input.length || $input.data("pickr-initialized")) return;
        $input.hide();
        const container = $('<div style="margin-top:5px;"></div>').insertAfter($input);
        const pickr = Pickr.create({
            el: container[0],
            theme: 'classic',
            default: $input.val(),
            components: { preview: true, opacity: true, hue: true, interaction: { input: true, save: true } }
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

    // -------------------- CONFIGURE ADDITIONAL FONTS BUTTON --------------------
    //const $fileInputGroup = $html.find(`input[name="${ns}.fontFile"]`).closest(".form-group");
    //if ($fileInputGroup.length && $fileInputGroup.find(`button[data-key="core.fonts"]`).length === 0) {
    //    const $button = $(`
    //        <button type="button" data-action="openSubmenu" data-key="core.fonts">
    //            <i class="fa-solid fa-font"></i>
    //            <span>Configure Additional Fonts</span>
    //        </button>
    //    `);
    //    $fileInputGroup.append($button);
    //    $button.on("click", (event) => {
    //        const action = event.currentTarget.dataset.action;
    //        const key = event.currentTarget.dataset.key;
    //        if (action === "openSubmenu" && key) {
    //            ui.settings._onClickSubmenu(event);
    //        }
    //    });
    //}

    // -------------------- INITIAL PREVIEW --------------------
    updatePreview();
});

// -------------------- HELPER: LOAD CSS/JS --------------------
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
