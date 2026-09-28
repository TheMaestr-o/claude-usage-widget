// Application state
let credentials = null;
let updateInterval = null;
let countdownInterval = null;
let tickInterval = null; // the two main countdowns tick every second
let latestUsageData = null;
let isExpanded = false;
let isCompactMode = false;
let compactSpendOpen = false; // spend row toggled open within compact mode
let _settingsOpenedFromCompact = false;
let usageChart = null;
let graphVisible = false;
let graphWasVisible = false; // preserves graph state across compact mode toggle
let appInitializing = true;  // suppresses _saveViewState during startup restore
let isFetching = false;       // in-flight guard — prevents overlapping fetchUsageData calls
const UPDATE_INTERVAL = 5 * 60 * 1000; // 5 minutes
const WIDGET_HEIGHT_COLLAPSED = 184; // two 96 px rings; main.js uses the same number
const WIDGET_ROW_HEIGHT = 30;

// Looks chosen in Settings (stored by main.js; see get-settings for the defaults)
let trayStyle = 'ring';       // menu bar picture: 'ring' | 'bars' | 'rings' | 'ringsText'
let gaugeStyle = 'rings';     // top rings: 'rings' (side by side) | 'concentric' (ring in ring)
let statsStyle = 'line';      // statistics: 'line' | 'bars' | 'summary'
let statsPeriod = 'day';      // statistics period: 'day' | 'week' | 'month'
let menuBarDark = false;      // macOS menu bar appearance, for the coloured tray picture
let trayRefreshing = false;   // a manual refresh is out — the tray shows its refreshing frame

// Elapsed-time ring thresholds (session/weekly/extra-row countdown circles).
// Deliberately hardcoded and independent from the user-configurable
// warnThreshold/dangerThreshold settings below, which describe *usage volume*
// getting close to a limit. Time elapsing toward a reset is a different,
// unrelated metric — nearing 100% elapsed just means the window is about to
// refresh, which is a neutral-to-good thing, not a warning. Reusing the usage
// thresholds/colors here was accidental coupling, not a deliberate choice.
const ELAPSED_AMBER_THRESHOLD = 75;
const ELAPSED_GREEN_THRESHOLD = 90;

// Debug logging — only shows in DevTools (development mode).
// Regular users won't see verbose logs in production.
const DEBUG = (new URLSearchParams(window.location.search)).has('debug');
function debugLog(...args) {
  if (DEBUG) console.log('[Debug]', ...args);
}

// DOM elements
const elements = {
    loadingContainer: document.getElementById('loadingContainer'),
    loginContainer: document.getElementById('loginContainer'),
    noUsageContainer: document.getElementById('noUsageContainer'),
    mainContent: document.getElementById('mainContent'),
    loginStep1: document.getElementById('loginStep1'),
    loginStep2: document.getElementById('loginStep2'),
    autoDetectBtn: document.getElementById('autoDetectBtn'),
    autoDetectError: document.getElementById('autoDetectError'),
    openBrowserLink: document.getElementById('openBrowserLink'),
    nextStepBtn: document.getElementById('nextStepBtn'),
    backStepBtn: document.getElementById('backStepBtn'),
    sessionKeyInput: document.getElementById('sessionKeyInput'),
    connectBtn: document.getElementById('connectBtn'),
    sessionKeyError: document.getElementById('sessionKeyError'),
    refreshBtn: document.getElementById('refreshBtn'),
    graphBtn: document.getElementById('graphBtn'),
    minimizeBtn: document.getElementById('minimizeBtn'),
    closeBtn: document.getElementById('closeBtn'),

    sessionGauge: document.getElementById('sessionGauge'),
    weeklyGauge: document.getElementById('weeklyGauge'),
    sessionPercentage: document.getElementById('sessionPercentage'),
    sessionProgress: document.getElementById('sessionProgress'),
    sessionTimer: document.getElementById('sessionTimer'),
    sessionTimeText: document.getElementById('sessionTimeText'),

    weeklyPercentage: document.getElementById('weeklyPercentage'),
    weeklyProgress: document.getElementById('weeklyProgress'),
    weeklyTimer: document.getElementById('weeklyTimer'),
    weeklyTimeText: document.getElementById('weeklyTimeText'),
    weeklyResetsAt: document.getElementById('weeklyResetsAt'),

    sessionResetsAt: document.getElementById('sessionResetsAt'),

    expandToggle: document.getElementById('expandToggle'),
    expandArrow: document.getElementById('expandArrow'),
    expandSection: document.getElementById('expandSection'),
    extraRows: document.getElementById('extraRows'),
    graphSection: document.getElementById('graphSection'),
    usageChart: document.getElementById('usageChart'),
    statsTitle: document.getElementById('statsTitle'),
    statsPeriodSwitch: document.getElementById('statsPeriodSwitch'),
    statsCards: document.getElementById('statsCards'),
    statsHeat: document.getElementById('statsHeat'),
    statsSummary: document.getElementById('statsSummary'),
    trayStyleCol: document.getElementById('trayStyleCol'),
    trayStylePicker: document.getElementById('trayStylePicker'),
    gaugeStylePicker: document.getElementById('gaugeStylePicker'),
    statsStylePicker: document.getElementById('statsStylePicker'),

    settingsBtn: document.getElementById('settingsBtn'),
    settingsOverlay: document.getElementById('settingsOverlay'),
    closeSettingsBtn: document.getElementById('closeSettingsBtn'),
    logoutBtn: document.getElementById('logoutBtn'),
    coffeeBtn: document.getElementById('coffeeBtn'),
    autoStartCol: document.getElementById('autoStartCol'),
    autoStartToggle: document.getElementById('autoStartToggle'),
    autoStartHint: document.getElementById('autoStartHint'),
    minimizeToTrayToggle: document.getElementById('minimizeToTrayToggle'),
    alwaysOnTopToggle: document.getElementById('alwaysOnTopToggle'),
    showTrayStatsToggle: document.getElementById('showTrayStatsToggle'),
    warnThreshold: document.getElementById('warnThreshold'),
    dangerThreshold: document.getElementById('dangerThreshold'),
    themeBtns: document.querySelectorAll('.theme-btn'),
    timeFormat: document.getElementById('timeFormat'),
    weeklyDateFormat: document.getElementById('weeklyDateFormat'),
    refreshInterval: document.getElementById('refreshInterval'),
    orgSelector: document.getElementById('orgSelector'),
    orgSelectorCol: document.getElementById('orgSelectorCol'),

    updateBanner: document.getElementById('updateBanner'),
    updateBannerText: document.getElementById('updateBannerText'),
    updateBannerDismiss: document.getElementById('updateBannerDismiss'),
    settingsVersionLabel: document.getElementById('settingsVersionLabel'),
    settingsUpdateLink: document.getElementById('settingsUpdateLink'),
    usageAlertsToggle: document.getElementById('usageAlertsToggle'),
    compactModeToggle: document.getElementById('compactModeToggle'),
    compactModeToggleCompact: document.getElementById('compactModeToggleCompact'),
    compactContent: document.getElementById('compactContent'),
    compactCollapseBtn: document.getElementById('compactCollapseBtn'),
    compactExpandBtn: document.getElementById('compactExpandBtn'),
    compactSessionFill: document.getElementById('compactSessionFill'),
    compactSessionPct: document.getElementById('compactSessionPct'),
    compactWeeklyFill: document.getElementById('compactWeeklyFill'),
    compactWeeklyPct: document.getElementById('compactWeeklyPct'),
    compactFableRow: document.getElementById('compactFableRow'),
    compactFableFill: document.getElementById('compactFableFill'),
    compactFablePct: document.getElementById('compactFablePct'),
    compactSpendToggle: document.getElementById('compactSpendToggle'),
    compactSpendArrow: document.getElementById('compactSpendArrow'),
    compactSpendRow: document.getElementById('compactSpendRow'),
    compactSpendFill: document.getElementById('compactSpendFill'),
    compactSpendPct: document.getElementById('compactSpendPct'),
    compactSettingsOverlay: document.getElementById('compactSettingsOverlay'),
    closeCompactSettingsBtn: document.getElementById('closeCompactSettingsBtn'),
    languageSelect: document.getElementById('languageSelect')
};

// Populate organization selector dropdown
function populateOrgSelector(organizations, selectedOrgId) {
    if (!organizations || organizations.length === 0) {
        // No orgs - hide selector column
        elements.orgSelectorCol.style.display = 'none';
        return;
    }

    // Only show selector if user has multiple chat orgs
    if (organizations.length > 1) {
        elements.orgSelectorCol.style.display = '';  // Show column (use default flex display)
        
        // Clear existing options
        elements.orgSelector.innerHTML = '';
        
        // Add each org as an option
        organizations.forEach(org => {
            const option = document.createElement('option');
            option.value = org.id;
            option.textContent = `${org.name} (${t(org.isTeam ? 'org.team' : 'org.personal')})`;
            if (org.id === selectedOrgId) {
                option.selected = true;
            }
            elements.orgSelector.appendChild(option);
        });
    } else {
        // Single org - hide selector column
        elements.orgSelectorCol.style.display = 'none';
    }
}

// Handle organization change
async function handleOrgChange() {
    const newOrgId = elements.orgSelector.value;
    if (newOrgId && newOrgId !== credentials.organizationId) {
        credentials.organizationId = newOrgId;
        await window.electronAPI.saveCredentials(credentials);
        // Refresh usage data with new org
        await fetchUsageData();
    }
}

// Initialize
async function init() {
    setupEventListeners();
    credentials = await window.electronAPI.getCredentials();

    // macOS: the window is system glass (vibrancy in main.js) and the system shapes its
    // corners, so we draw no radius or edge of our own — otherwise the corners would clash
    if (window.electronAPI.platform === 'darwin') document.body.classList.add('vibrant');

    // Apply saved theme and load thresholds immediately
    const settings = await window.electronAPI.getSettings();
    window._cachedSettings = settings;
    populateLanguageSelect();
    applyLanguage(settings.language || 'en');
    applyTheme(settings.theme);
    if (window.electronAPI.platform === 'darwin') {
        applyTrayLabel();
    }
    warnThreshold = settings.warnThreshold;
    dangerThreshold = settings.dangerThreshold;
    compactSpendOpen = !!settings.compactSpendOpen;
    applyCompactSpendRow();
    trayStyle = TRAY_STYLES.includes(settings.trayStyle) ? settings.trayStyle : 'ring';
    statsStyle = STATS_STYLES.includes(settings.statsStyle) ? settings.statsStyle : 'line';
    statsPeriod = STATS_PERIODS.includes(settings.statsPeriod) ? settings.statsPeriod : 'day';
    applyGaugeStyle(settings.gaugeStyle);
    placeThresholdTicks();
    markStatsPeriod();
    if (window.electronAPI.platform === 'darwin' && window.electronAPI.getMenuBarDark) {
        try { menuBarDark = !!(await window.electronAPI.getMenuBarDark()); } catch { menuBarDark = false; }
    }

    // Restore compact mode from saved settings
    if (settings.compactMode) {
        applyCompactMode(true);
    } else {
        // Ensure compact overlay is hidden in normal mode
        if (elements.compactSettingsOverlay) elements.compactSettingsOverlay.style.display = 'none';
    }

    // Restore graph visibility
    if (settings.graphVisible) {
        if (!settings.compactMode) {
            // Normal mode — show graph immediately
            graphVisible = true;
            elements.graphBtn.classList.add('active');
            elements.graphSection.style.display = 'block';
        } else {
            // Compact mode — store so it restores when exiting compact
            graphWasVisible = true;
        }
    }

    // Restore expanded state
    if (settings.expandedOpen) {
        isExpanded = true;
        elements.expandArrow.classList.add('expanded');
        elements.expandSection.style.display = 'block';
    }

    if (credentials.sessionKey && credentials.organizationId) {
        // Populate org selector if user has multiple orgs
        if (credentials.organizations && credentials.organizations.length > 0) {
            populateOrgSelector(credentials.organizations, credentials.organizationId);
        }
        showMainContent();
        await fetchUsageData();
        startAutoUpdate();
    } else {
        showLoginRequired();
    }

    // Populate version label then check for updates after a short delay
    const version = await window.electronAPI.getAppVersion();
    if (elements.settingsVersionLabel) {
        elements.settingsVersionLabel.textContent = t('settings.version', { v: version });
        elements.settingsVersionLabel.dataset.version = version;
    }
    setTimeout(checkForUpdate, 2000);
    // Also check once every 24 hours for users who never close the app
    setInterval(checkForUpdate, 24 * 60 * 60 * 1000);

    // Startup restore complete — allow _saveViewState to persist changes
    appInitializing = false;
}

// Event Listeners
function setupEventListeners() {
    // Step 1: Login via BrowserWindow
    elements.autoDetectBtn.addEventListener('click', handleAutoDetect);

    // Step navigation
    elements.nextStepBtn.addEventListener('click', () => {
        elements.loginStep1.style.display = 'none';
        elements.loginStep2.style.display = 'block';
        elements.sessionKeyInput.focus();
    });

    elements.backStepBtn.addEventListener('click', () => {
        elements.loginStep2.style.display = 'none';
        elements.loginStep1.style.display = 'flex';
        elements.sessionKeyError.textContent = '';
    });

    // Open browser link in step 2
    elements.openBrowserLink.addEventListener('click', (e) => {
        e.preventDefault();
        window.electronAPI.openExternal('https://claude.ai');
    });

    // Step 2: Manual sessionKey connect
    elements.connectBtn.addEventListener('click', handleConnect);
    elements.sessionKeyInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleConnect();
        elements.sessionKeyError.textContent = '';
    });

    // A deliberate press gets the recharge: the arcs themselves orbit while the request is
    // out and land on the fresh values (see rechargeRefresh). Auto-refresh stays quiet.
    elements.refreshBtn.addEventListener('click', async () => {
        debugLog('Refresh button clicked');
        if (recharge || compactSweep) return;
        await rechargeRefresh();
    });

    // Statistics period — applies at once and is remembered like the graph toggle
    elements.statsPeriodSwitch.addEventListener('click', (event) => {
        const btn = event.target.closest('[data-period]');
        if (!btn || btn.dataset.period === statsPeriod) return;
        statsPeriod = btn.dataset.period;
        markStatsPeriod();
        renderStats();
        _saveViewState();
    });

    // Looks in Settings: each applies at once (a live preview, like the theme) and is
    // stored with Done
    elements.trayStylePicker.addEventListener('click', (event) => {
        const btn = event.target.closest('[data-tray-style]');
        if (!btn) return;
        trayStyle = btn.dataset.trayStyle;
        markPicker(elements.trayStylePicker, 'trayStyle', trayStyle);
        pushTrayImage(true);
    });
    // Rings and statistics sit under the sheet, so a pick saves and closes it at once —
    // the choice is on screen right away (statistics opens its panel if it was closed)
    const showPick = () => setTimeout(() => elements.closeSettingsBtn.click(), 180);
    elements.gaugeStylePicker.addEventListener('click', (event) => {
        const btn = event.target.closest('[data-gauge-style]');
        if (!btn) return;
        applyGaugeStyle(btn.dataset.gaugeStyle);
        showPick();
    });
    elements.statsStylePicker.addEventListener('click', (event) => {
        const btn = event.target.closest('[data-stats-style]');
        if (!btn) return;
        statsStyle = btn.dataset.statsStyle;
        markPicker(elements.statsStylePicker, 'statsStyle', statsStyle);
        if (!graphVisible) {
            graphVisible = true;
            elements.graphBtn.classList.add('active');
            elements.graphSection.style.display = 'block';
            loadChart();
            _saveViewState();
        } else renderStats();
        showPick();
    });
    document.getElementById('maestroLink').addEventListener('click', () => {
        window.electronAPI.openExternal('https://github.com/TheMaestr-o');
    });

    elements.graphBtn.addEventListener('click', async () => {
        graphVisible = !graphVisible;
        elements.graphBtn.classList.toggle('active', graphVisible);
        elements.graphSection.style.display = graphVisible ? 'block' : 'none';
        if (graphVisible) {
            await loadChart();
        }
        if (!isCompactMode) resizeWidget();
        _saveViewState();
    });

    elements.minimizeBtn.addEventListener('click', () => {
        window.electronAPI.minimizeWindow();
    });

    elements.closeBtn.addEventListener('click', () => {
        window.electronAPI.closeWindow();
    });

    // Expand/collapse toggle
    elements.expandToggle.addEventListener('click', async () => {
        const wasExpanded = isExpanded;
        isExpanded = !isExpanded;
        elements.expandArrow.classList.toggle('expanded', isExpanded);
        elements.expandSection.style.display = isExpanded ? 'block' : 'none';
        if (graphVisible) {
            loadChart();
        }
        resizeWidget();
        
        // CRITICAL: Update expandedOpen setting IMMEDIATELY (no debounce) to prevent race condition
        // If we wait for the debounced save, auto-refresh might fetch with stale expandedOpen=false
        const settings = window._cachedSettings || await window.electronAPI.getSettings();
        settings.expandedOpen = isExpanded;
        window._cachedSettings = settings;
        await window.electronAPI.saveSettings(settings);
        
        // Trigger immediate fetch if panel was just opened (collapsed → expanded)
        // This ensures fresh overage/prepaid data is available when user expands the panel
        // Pass forceExtended to bypass any cached setting and fetch extended data immediately
        if (!wasExpanded && isExpanded) {
            debugLog('[Conditional Polling] Panel expanded - triggering immediate fetch with extended data');
            await fetchUsageData({ forceExtended: true });
        }
    });

    // Settings close
    elements.closeSettingsBtn.addEventListener('click', async () => {
        await saveSettings();
        elements.settingsOverlay.style.display = 'none';
        if (_settingsOpenedFromCompact) {
            _settingsOpenedFromCompact = false;
            if (isCompactMode) {
                window.electronAPI.setCompactMode(true);
            } else {
                resizeWidget();
            }
        } else if (!isCompactMode) {
            resizeWidget();
        }
        startAutoUpdate();
    });

    elements.logoutBtn.addEventListener('click', async () => {
        await window.electronAPI.deleteCredentials();
        credentials = { sessionKey: null, organizationId: null };
        elements.settingsOverlay.style.display = 'none';
        showLoginRequired();
    });

    elements.coffeeBtn.addEventListener('click', () => {
        window.electronAPI.openExternal('https://paypal.me/SlavomirDurej?country.x=GB&locale.x=en_GB');
    });

    elements.timeFormat.addEventListener('change', refreshDateOptions);

    // Language — applies at once, saved with Done like the theme
    elements.languageSelect.addEventListener('change', () => {
        applyLanguage(elements.languageSelect.value);
    });

    // Theme buttons
    elements.themeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            elements.themeBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            applyTheme(btn.dataset.theme);
        });
    });

    // Prevent accidental app hiding: bidirectional coupling between Hide from Taskbar and Show Tray Stats
    // If user enables "Hide from Taskbar", automatically enable "Show Tray Stats" (ensures tray icon is visible)
    elements.minimizeToTrayToggle.addEventListener('change', () => {
        if (elements.minimizeToTrayToggle.checked && !elements.showTrayStatsToggle.checked) {
            elements.showTrayStatsToggle.checked = true;
        }
    });

    // If user disables "Show Tray Stats", automatically disable "Hide from Taskbar" (prevents app from being completely hidden)
    elements.showTrayStatsToggle.addEventListener('change', () => {
        if (!elements.showTrayStatsToggle.checked && elements.minimizeToTrayToggle.checked) {
            elements.minimizeToTrayToggle.checked = false;
        }
        applyTrayStyleRowState();
    });
    elements.minimizeToTrayToggle.addEventListener('change', applyTrayStyleRowState);

    // Listen for refresh requests from tray — quiet in the widget; the menu bar picture
    // shows its refreshing frame, since that is where the user is looking
    window.electronAPI.onRefreshUsage(async () => {
        if (elements.refreshBtn && !recharge) elements.refreshBtn.classList.add('spinning');
        await fetchUsageData({ trayFrame: true });
        if (elements.refreshBtn) elements.refreshBtn.classList.remove('spinning');
    });

    // The menu bar switched between light and dark: redraw its picture for it
    window.electronAPI.onMenuBarAppearance?.((dark) => {
        menuBarDark = dark;
        pushTrayImage();
    });

    // Listen for session expiration events (403 errors)
    window.electronAPI.onSessionExpired(() => {
        debugLog('Session expired event received');
        credentials = { sessionKey: null, organizationId: null };
        showLoginRequired();
    });

    // Update banner
    elements.updateBannerDismiss.addEventListener('click', () => {
        elements.updateBanner.style.display = 'none';
        resizeWidget();
    });
    elements.updateBannerText.addEventListener('click', () => {
        window.electronAPI.openExternal(`https://github.com/SlavomirDurej/claude-usage-widget/releases/latest`);
    });
    elements.settingsUpdateLink.addEventListener('click', () => {
        window.electronAPI.openExternal(`https://github.com/SlavomirDurej/claude-usage-widget/releases/latest`);
    });

    // Compact mode — collapse chevron (normal → compact)
    elements.compactCollapseBtn.addEventListener('click', async () => {
        applyCompactMode(true);
        await _saveCompactSetting(true);
    });

    // Compact mode — expand chevron (compact → normal)
    elements.compactExpandBtn.addEventListener('click', async () => {
        applyCompactMode(false);
        await _saveCompactSetting(false);
    });

    // Compact mode — spend row chevron (show/hide the Spend bar)
    elements.compactSpendToggle.addEventListener('click', async () => {
        compactSpendOpen = !compactSpendOpen;
        applyCompactSpendRow();

        // Persist immediately (not debounced): main's getCompactHeight() reads
        // this setting when re-sizing right below, so it must be stored first.
        const settings = window._cachedSettings || await window.electronAPI.getSettings();
        settings.compactSpendOpen = compactSpendOpen;
        window._cachedSettings = settings;
        await window.electronAPI.saveSettings(settings);

        // Re-assert compact bounds so the window grows/shrinks for the row
        if (isCompactMode) window.electronAPI.setCompactMode(true);

        // Opening the row: fetch fresh spend data right away — collapsed
        // compact mode doesn't poll the spend endpoints, so whatever is in
        // latestUsageData.extra_usage may be stale or missing until this lands
        if (compactSpendOpen) {
            await fetchUsageData({ forceExtended: true });
        }
    });

    // Compact mode toggle in normal settings panel — deferred to Done click

    // Compact mode toggle in compact settings panel — just updates the checkbox, Done applies it
    elements.compactModeToggleCompact.addEventListener('change', () => {
        // No immediate action — Done button reads this value and applies
    });

    // Organization selector — change triggers immediate save and refresh
    elements.orgSelector.addEventListener('change', handleOrgChange);

    // Settings button — always open full settings; if in compact mode, temporarily expand the window first
    elements.settingsBtn.addEventListener('click', async () => {
        stopAutoUpdate();
        if (isCompactMode) {
            _settingsOpenedFromCompact = true;
            window.electronAPI.setCompactMode(false);
        }
        await loadSettings();
        elements.settingsOverlay.style.display = 'flex';
        // Tall enough for every row without scrolling (one more row when the account has
        // organizations; the menu bar row only on a Mac) — measured, so no language cuts it
        window.electronAPI.resizeWindow(settingsSheetHeight());
    });

    // Close compact settings — apply compact toggle value then close
    elements.closeCompactSettingsBtn.addEventListener('click', async () => {
        const compact = elements.compactModeToggleCompact.checked;
        if (compact !== isCompactMode) {
            applyCompactMode(compact);
            await _saveCompactSetting(compact);
        }
        elements.compactSettingsOverlay.style.display = 'none';
        startAutoUpdate();
    });
}

// Handle manual sessionKey connect
async function handleConnect() {
    const sessionKey = elements.sessionKeyInput.value.trim();
    if (!sessionKey) {
        elements.sessionKeyError.textContent = t('key.empty');
        return;
    }

    elements.connectBtn.disabled = true;
    elements.connectBtn.textContent = '...';
    elements.sessionKeyError.textContent = '';

    try {
        const result = await window.electronAPI.validateSessionKey(sessionKey);
        if (result.success) {
            credentials = { 
                sessionKey, 
                organizationId: result.organizationId,
                organizations: result.organizations || []
            };
            await window.electronAPI.saveCredentials(credentials);
            populateOrgSelector(result.organizations || [], result.organizationId);
            elements.sessionKeyInput.value = '';
            showMainContent();
            await fetchUsageData();
            startAutoUpdate();
        } else {
            elements.sessionKeyError.textContent = result.error || t('key.invalid');
        }
    } catch (error) {
        elements.sessionKeyError.textContent = t('key.failed');
    } finally {
        elements.connectBtn.disabled = false;
        elements.connectBtn.textContent = 'Connect';
    }
}

// Handle auto-detect from browser cookies
async function handleAutoDetect() {
    elements.autoDetectBtn.disabled = true;
    elements.autoDetectBtn.textContent = 'Waiting...';
    elements.autoDetectError.textContent = '';

    try {
        const result = await window.electronAPI.detectSessionKey();
        if (!result.success) {
            elements.autoDetectError.textContent = result.error || t('login.failed');
            return;
        }

        // Got sessionKey from login, now validate it
        elements.autoDetectBtn.textContent = 'Validating...';
        const validation = await window.electronAPI.validateSessionKey(result.sessionKey);

        if (validation.success) {
            credentials = {
                sessionKey: result.sessionKey,
                organizationId: validation.organizationId,
                organizations: validation.organizations || []
            };
            await window.electronAPI.saveCredentials(credentials);
            populateOrgSelector(validation.organizations || [], validation.organizationId);
            showMainContent();
            await fetchUsageData();
            startAutoUpdate();
        } else {
            elements.autoDetectError.textContent =
                t('login.invalid');
        }
    } catch (error) {
        elements.autoDetectError.textContent = error.message || t('login.failed');
    } finally {
        elements.autoDetectBtn.disabled = false;
        elements.autoDetectBtn.textContent = 'Log in';
    }
}

// Fetch usage data from Claude API. Resolves true when fresh data arrived.
// options.trayFrame: a manual refresh — the menu bar picture shows its refreshing frame
// until the answer is in. A call made while a request is out waits for that one instead
// of sending another (so a refresh pressed mid-request still lands on its answer).
let inflightFetch = null;

async function fetchUsageData(options = {}) {
    debugLog('fetchUsageData called');

    if (isFetching) {
        debugLog('Fetch already in flight — waiting for it');
        return inflightFetch || false;
    }

    if (!credentials.sessionKey || !credentials.organizationId) {
        debugLog('Missing credentials, showing login');
        showLoginRequired();
        return false;
    }

    isFetching = true;
    if (options.trayFrame) {
        trayRefreshing = true;
        pushTrayImage();
    }
    inflightFetch = (async () => {
        try {
            debugLog('Calling electronAPI.fetchUsageData...');
            const data = await window.electronAPI.fetchUsageData(options);
            debugLog('Received usage data:', data);
            trayRefreshing = false;
            updateUI(data);
            return true;
        } catch (error) {
            console.error('Error fetching usage data:', error);
            if (error.message.includes('SessionExpired') || error.message.includes('Unauthorized')) {
                credentials = { sessionKey: null, organizationId: null };
                showLoginRequired();
            } else {
                debugLog('Failed to fetch usage data');
            }
            return false;
        } finally {
            isFetching = false;
            inflightFetch = null;
            if (trayRefreshing) {
                trayRefreshing = false;
                pushTrayImage();
            }
        }
    })();
    return inflightFetch;
}


// Update UI with usage data
// Format a cent-based amount with the correct currency symbol.
// Known unambiguous symbols are used; everything else falls back to the
// ISO 4217 code as a suffix so the display is always correct.
function formatCurrency(amountCents, currencyCode) {
  const amount = (amountCents / 100).toFixed(2);
  const symbols = { USD: '$', EUR: '€', GBP: '£' };
  const sym = symbols[currencyCode];
  return sym ? `${sym}${amount}` : `${amount} ${currencyCode || 'USD'}`;
}

// A translated phrase with some values styled apart: the word order belongs to the
// language, so the phrase is cut around markers instead of being glued back by hand
function fillPhrase(el, key, parts) {
    const names = Object.keys(parts);
    const marked = t(key, Object.fromEntries(names.map((name, i) => [name, `\u0001${i}\u0002`])));
    el.textContent = '';
    for (const piece of marked.split(/(\u0001\d+\u0002)/)) {
        const mark = piece.match(/^\u0001(\d+)\u0002$/);
        if (!mark) {
            if (piece) el.appendChild(document.createTextNode(piece));
            continue;
        }
        const [text, className] = parts[names[Number(mark[1])]];
        const span = document.createElement('span');
        span.className = className;
        span.textContent = text;
        el.appendChild(span);
    }
}

// Extra row label mapping for API fields
// Row label in the current language: '<Model> · week', or a fixed key
function rowLabel(config) {
    return config.labelKey ? t(config.labelKey) : t('model.week', { name: config.model });
}

const EXTRA_ROW_CONFIG = {
    seven_day_sonnet: { model: 'Sonnet', color: 'sonnet' },
    seven_day_opus: { model: 'Opus', color: 'opus' },
    seven_day_fable: { model: 'Fable', color: 'fable' },
    seven_day_cowork: { model: 'Cowork', color: 'cowork' },
    seven_day_omelette: { model: 'Design', color: 'design' },
    seven_day_oauth_apps: { labelKey: 'model.apps', color: 'oauth' },
    extra_usage: { labelKey: 'extra.label', color: 'extra' },
};

// Expiry warning thresholds for the credits row (days until next_expires_at)
const CREDIT_EXPIRY_WARN_DAYS = 21;
const CREDIT_EXPIRY_DANGER_DAYS = 7;

// Builds the credit-balance row shown beneath Monthly Spend.
// Promo/paid split renders only when purchased credits exist (money at risk);
// the expiry chip renders only when the next expiry is within the warn window.
function buildCreditsRow(value) {
    const row = document.createElement('div');
    row.className = 'usage-section credits-row';

    const label = document.createElement('span');
    label.className = 'usage-label credits-label';
    // Invisible clone of the spend row's ON/OFF badge so "Credits" aligns
    // with "Monthly Spend" regardless of badge width
    if (value.is_enabled === true || value.is_enabled === false) {
        const spacer = document.createElement('span');
        spacer.className = 'extra-status badge-spacer';
        spacer.textContent = value.is_enabled ? t('status.on') : t('status.off');
        label.appendChild(spacer);
    }
    label.appendChild(document.createTextNode(` ${t('credits')}`));
    row.appendChild(label);

    const amount = document.createElement('span');
    amount.className = 'credits-amount';
    amount.textContent = formatCurrency(value.balance_cents, value.currency);
    row.appendChild(amount);

    if (typeof value.paid_cents === 'number' && value.paid_cents > 0) {
        const split = document.createElement('span');
        split.className = 'credits-split';
        split.textContent = t('credits.split', { promo: formatCurrency(value.promo_cents || 0, value.currency), paid: formatCurrency(value.paid_cents, value.currency) });
        row.appendChild(split);
    }

    if (value.next_expires_at && typeof value.next_expiry_cents === 'number' && value.next_expiry_cents > 0) {
        const daysLeft = Math.ceil((new Date(value.next_expires_at).getTime() - Date.now()) / 86400000);
        if (daysLeft >= 0 && daysLeft <= CREDIT_EXPIRY_WARN_DAYS) {
            const chip = document.createElement('span');
            chip.className = 'credits-chip' + (daysLeft <= CREDIT_EXPIRY_DANGER_DAYS ? ' danger' : '');
            const when = daysLeft <= CREDIT_EXPIRY_DANGER_DAYS
                ? t('credits.inDays', { n: daysLeft })
                : new Date(value.next_expires_at).toLocaleDateString(currentLocale(), { month: 'short', day: 'numeric' });
            chip.textContent = t('credits.expires', { amount: formatCurrency(value.next_expiry_cents, value.currency), when });
            chip.title = t('credits.expiresOn', { date: new Date(value.next_expires_at).toLocaleDateString(currentLocale()) });
            row.appendChild(chip);
        }
    }

    return row;
}

// Model rows are rebuilt on every update; each bar starts at the width it had before and
// eases to the new one (the fill's CSS width transition does the easing)
const extraRowWidths = new Map();

function makeExtraFill(key, colorClass, utilization) {
    const target = Math.min(Math.max(utilization, 0), 100);
    const progressFill = document.createElement('div');
    progressFill.className = `progress-fill ${colorClass}`;
    const previous = extraRowWidths.get(key);
    progressFill.style.width = `${previous ?? target}%`;
    if (previous !== undefined && previous !== target) progressFill.dataset.target = String(target);
    extraRowWidths.set(key, target);
    progressFill.classList.toggle('has-value', utilization > 0);
    return progressFill;
}

function buildExtraRows(data) {

    // Don't clear existing rows if we don't have new data to replace them with
    // This preserves the last known state when expanding the panel
    const hasAnyExtendedData = Object.entries(EXTRA_ROW_CONFIG).some(([key, config]) => {
        const value = data[key];
        const hasUtilization = value && value.utilization !== undefined;
        const hasBalance = key === 'extra_usage' && value && value.balance_cents != null;
        return hasUtilization || hasBalance;
    });
    
    // Only rebuild if we have data, otherwise keep existing rows
    if (!hasAnyExtendedData && elements.extraRows.children.length > 0) {
        return; // Keep existing rows
    }
    
    elements.extraRows.innerHTML = '';
    let count = 0;

    for (const [key, config] of Object.entries(EXTRA_ROW_CONFIG)) {
        const value = data[key];
        // extra_usage is valid with utilization OR balance_cents (prepaid only)
        const hasUtilization = value && value.utilization !== undefined;
        const hasBalance = key === 'extra_usage' && value && value.balance_cents != null;
        if (!hasUtilization && !hasBalance) continue;

        const utilization = value.utilization || 0;
        const resetsAt = value.resets_at;
        const colorClass = config.color;

        const row = document.createElement('div');
        row.className = 'usage-section';

        // Build row using DOM methods (no innerHTML)
        const label = document.createElement('span');
        label.className = 'usage-label';
        
        if (key === 'extra_usage') {
            // Extra usage: ON/OFF indicator goes next to label
            if (value.is_enabled === true) {
                const statusTag = document.createElement('span');
                statusTag.className = 'extra-status on';
                statusTag.textContent = t('status.on');
                label.appendChild(statusTag);
            } else if (value.is_enabled === false) {
                const statusTag = document.createElement('span');
                statusTag.className = 'extra-status off';
                statusTag.textContent = t('status.off');
                label.appendChild(statusTag);
            }
            label.appendChild(document.createTextNode(` ${t('spend.monthly')}`));
        } else {
            label.textContent = rowLabel(config);
        }
        row.appendChild(label);

        if (key === 'extra_usage') {
            // Spend row uses flex (like the credits row): label | stretching bar | right-flush $ text
            row.classList.add('spend-row');
            const barGroup = document.createElement('div');
            barGroup.className = 'usage-bar-group spend-bar-group';
            const progressBar = document.createElement('div');
            progressBar.className = 'progress-bar';
            const progressFill = makeExtraFill(key, colorClass, utilization);

            // Apply warning/danger thresholds to extra usage bar
            if (utilization >= dangerThreshold) {
                progressFill.classList.add('danger');
            } else if (utilization >= warnThreshold) {
                progressFill.classList.add('warning');
            }
            
            progressBar.appendChild(progressFill);
            barGroup.appendChild(progressBar);
            row.appendChild(barGroup);

            // Dollar text lives in the (now empty) timer+resets columns so the
            // bar keeps the full bar-column width like the session/weekly rows
            const spendText = document.createElement('span');
            if (value.used_cents != null && value.limit_cents != null) {
                spendText.className = 'usage-percentage extra-spending spend-cap-text';
                let limitStr = formatCurrency(value.limit_cents, value.currency);
                if (value.limit_cents % 100 === 0) limitStr = limitStr.replace('.00', '');
                const over = value.used_cents > value.limit_cents;
                fillPhrase(spendText, 'spend.of', {
                    used: [formatCurrency(value.used_cents, value.currency), over ? 'spend-used over' : 'spend-used'],
                    limit: [limitStr, 'spend-limit']
                });
            } else {
                spendText.className = 'usage-percentage spend-cap-text';
                spendText.textContent = `${Math.round(utilization)}%`;
            }
            row.appendChild(spendText);
        } else {
            const totalMinutes = key.includes('seven_day') ? 7 * 24 * 60 : 5 * 60;

            const barGroup = document.createElement('div');
            barGroup.className = 'usage-bar-group';
            const progressBar = document.createElement('div');
            progressBar.className = 'progress-bar';
            const progressFill = makeExtraFill(key, colorClass, utilization);
            // Apply warning/danger thresholds — same check the spend row and
            // compact mode already use, previously missing here so every
            // model row (Sonnet, Opus, Fable, etc.) rendered flat regardless
            // of usage level.
            if (utilization >= dangerThreshold) {
                progressFill.classList.add('danger');
            } else if (utilization >= warnThreshold) {
                progressFill.classList.add('warning');
            }
            progressBar.appendChild(progressFill);
            barGroup.appendChild(progressBar);

            const percentage = document.createElement('span');
            percentage.className = 'usage-percentage';
            percentage.textContent = `${Math.round(utilization)}%`;
            barGroup.appendChild(percentage);
            row.appendChild(barGroup);

            const elapsedGroup = document.createElement('div');
            elapsedGroup.className = 'usage-elapsed-group';
            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.setAttribute('class', 'mini-timer');
            svg.setAttribute('width', '24');
            svg.setAttribute('height', '24');
            svg.setAttribute('viewBox', '0 0 24 24');
            const circleBg = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            circleBg.setAttribute('class', 'timer-bg');
            circleBg.setAttribute('cx', '12');
            circleBg.setAttribute('cy', '12');
            circleBg.setAttribute('r', '10');
            svg.appendChild(circleBg);
            const circleProgress = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            circleProgress.setAttribute('class', `timer-progress ${colorClass}`);
            circleProgress.setAttribute('cx', '12');
            circleProgress.setAttribute('cy', '12');
            circleProgress.setAttribute('r', '10');
            circleProgress.style.strokeDasharray = '63';
            circleProgress.style.strokeDashoffset = '63';
            svg.appendChild(circleProgress);
            elapsedGroup.appendChild(svg);
            row.appendChild(elapsedGroup);

            const timerText = document.createElement('div');
            timerText.className = 'timer-text';
            timerText.dataset.resets = resetsAt || '';
            timerText.dataset.total = totalMinutes;
            timerText.textContent = '--:--';
            row.appendChild(timerText);

            const resetsText = document.createElement('span');
            resetsText.className = 'resets-at-text';
            if (resetsAt) {
                const settings = window._cachedSettings || {};
                resetsText.textContent = formatResetsAt(resetsAt, true, settings.timeFormat || '12h', settings.weeklyDateFormat || 'date');
            }
            row.appendChild(resetsText);
        }

        elements.extraRows.appendChild(row);
        count++;

        // Credit balance gets its own row beneath Monthly Spend
        if (key === 'extra_usage' && value.balance_cents != null) {
            elements.extraRows.appendChild(buildCreditsRow(value));
            count++;
        }
    }

    // Bars that changed: the rows were drawn at their old widths — commit that, then move
    const moving = elements.extraRows.querySelectorAll('.progress-fill[data-target]');
    if (moving.length) {
        void elements.extraRows.offsetWidth;
        moving.forEach((fill) => {
            fill.style.width = `${fill.dataset.target}%`;
            delete fill.dataset.target;
        });
    }

    // Hide toggle if no extra rows
    elements.expandToggle.style.display = count > 0 ? 'flex' : 'none';
    if (count === 0 && isExpanded) {
        isExpanded = false;
        elements.expandArrow.classList.remove('expanded');
        elements.expandSection.style.display = 'none';
    }

    return count;
}

function refreshExtraTimers() {
    // Pair each row's timer text with its own circle. Pairing the two
    // querySelectorAll lists by index breaks as soon as a row has a text but
    // no circle (the extra_usage row), which shifts every later row's circle
    // and leaves those timers stuck at --:--.
    elements.extraRows.querySelectorAll('.usage-section').forEach((row) => {
        const textEl = row.querySelector('.timer-text');
        const circleEl = row.querySelector('.timer-progress');
        if (!textEl || !circleEl) return;
        const resetsAt = textEl.dataset.resets;
        const totalMinutes = parseInt(textEl.dataset.total);
        if (resetsAt) {
            updateTimer(circleEl, textEl, resetsAt, totalMinutes);
        }
    });
}

const BANNER_HEIGHT = 28;
const EXPAND_OVERHEAD = 28; // margin-top(12) + padding-top(6) + bottom buffer(10)

function resizeWidget(bannerVisible) {
    // The settings sheet sets its own height; shrinking under it would cut it off
    if (elements.settingsOverlay.style.display === 'flex') return;
    const hasBanner = bannerVisible !== undefined
        ? bannerVisible
        : elements.updateBanner.style.display !== 'none';
    const bannerOffset = hasBanner ? BANNER_HEIGHT : 0;
    const extraCount = elements.extraRows.children.length;
    const expandedOffset = isExpanded && extraCount > 0
        ? EXPAND_OVERHEAD + (extraCount * WIDGET_ROW_HEIGHT)
        : 0;
    const graphOffset = graphVisible ? statsSectionHeight() : 0;
    const totalHeight = WIDGET_HEIGHT_COLLAPSED + expandedOffset + graphOffset + bannerOffset;
    window.electronAPI.resizeWindow(totalHeight);
}

function normalizeUsageData(data) {
    // The synthetic seven_day_<name> fields for scoped weekly limits (e.g.
    // Fable) are produced centrally in main.js (normalize-usage-limits.js), so
    // `data` already carries them here. This renderer step only ensures every
    // scoped model has a matching EXTRA_ROW_CONFIG entry: statically known
    // models (Fable) already do; any unknown model is registered generically
    // (label "<DisplayName> (7d)", fallback color) while keeping extra_usage as
    // the last row so it stays grouped below the model rows.
    for (const limit of (data && data.limits) || []) {
        if (!limit || limit.kind !== 'weekly_scoped' || limit.percent == null) continue;
        const displayName = limit.scope && limit.scope.model && limit.scope.model.display_name;
        if (!displayName) continue;
        const key = 'seven_day_' + String(displayName).toLowerCase().replace(/[^a-z0-9]+/g, '_');
        if (EXTRA_ROW_CONFIG[key]) continue; // already known (e.g. seven_day_fable)
        const extraUsage = EXTRA_ROW_CONFIG.extra_usage;
        delete EXTRA_ROW_CONFIG.extra_usage;
        EXTRA_ROW_CONFIG[key] = { model: displayName, color: 'scoped' };
        EXTRA_ROW_CONFIG.extra_usage = extraUsage;
    }
    return data;
}

function updateUI(data) {
    latestUsageData = normalizeUsageData(data);

    showMainContent();
    buildExtraRows(data);
    refreshTimers();
    if (isExpanded) refreshExtraTimers();
    if (!isCompactMode) resizeWidget();
    startCountdown();
    if (graphVisible) {
        loadChart();
    }

    // Update compact bars in parallel if compact mode is active
    if (isCompactMode) updateCompactBars(data);

    // macOS menu bar picture follows every update
    pushTrayImage();

    // On first load, seed alert flags so we don't fire for thresholds
    // the user can already see when the app starts
    if (isFirstDataLoad) {
        isFirstDataLoad = false;
        seedAlertFlags(data);
    }

    checkUsageAlerts(data);
}

// Fire OS desktop notifications when usage crosses warn/danger thresholds.
// Only fires once per threshold crossing per session window — not on every refresh.
function checkUsageAlerts(data) {
    const settings = window._cachedSettings || {};
    if (!settings.usageAlerts) return;

    const sessionPct = data.five_hour?.utilization || 0;
    const weeklyPct = data.seven_day?.utilization || 0;

    // Reset alert flags when a session window resets (utilization drops back low)
    if (sessionPct < warnThreshold) {
        alertFired.session_warn = false;
        alertFired.session_danger = false;
    }
    if (weeklyPct < warnThreshold) {
        alertFired.weekly_warn = false;
        alertFired.weekly_danger = false;
    }

    // Current Session — danger threshold (check first, higher priority)
    // Capped below 100 so the dedicated "limit reached" notification owns that moment exclusively
    if (sessionPct >= dangerThreshold && sessionPct < 100 && !alertFired.session_danger) {
        alertFired.session_danger = true;
        alertFired.session_warn = true; // suppress warn if we jumped straight to danger
        window.electronAPI.showNotification(
            t('notify.title'),
            t('notify.sessionDanger', { p: Math.round(sessionPct) })
        );
    // Current Session — warn threshold
    } else if (sessionPct >= warnThreshold && sessionPct < 100 && !alertFired.session_warn) {
        alertFired.session_warn = true;
        window.electronAPI.showNotification(
            t('notify.title'),
            t('notify.sessionWarn', { p: Math.round(sessionPct) })
        );
    }

    // Weekly Limit — danger threshold
    // Capped below 100 so the dedicated "limit reached" notification owns that moment exclusively
    if (weeklyPct >= dangerThreshold && weeklyPct < 100 && !alertFired.weekly_danger) {
        alertFired.weekly_danger = true;
        alertFired.weekly_warn = true;
        window.electronAPI.showNotification(
            t('notify.title'),
            t('notify.weeklyDanger', { p: Math.round(weeklyPct) })
        );
    // Weekly Limit — warn threshold
    } else if (weeklyPct >= warnThreshold && weeklyPct < 100 && !alertFired.weekly_warn) {
        alertFired.weekly_warn = true;
        window.electronAPI.showNotification(
            t('notify.title'),
            t('notify.weeklyWarn', { p: Math.round(weeklyPct) })
        );
    }

    // Combined blocked/available — fires once when the user actually can't use
    // Claude anymore (either window at 100%), and once when it genuinely clears.
    // Single flag by design: if weekly is still at 100% when session resets, isBlocked
    // stays true, so a session-only reset never fires a false "available again".
    // Weekly checked first since it's the more restrictive limit when both are maxed.
    const isBlocked = weeklyPct >= 100 || sessionPct >= 100;
    if (isBlocked && !alertFired.blocked) {
        alertFired.blocked = true;
        if (weeklyPct >= 100) {
            window.electronAPI.showNotification(
                t('notify.weeklyReached'),
                // Build date and time as separate pieces and join with "at" — formatResetsAt's
                // combined date-day-time mode concatenates them with no connector, which read
                // run-on. Independent of dashboard's weeklyDateFormat setting on purpose.
                t('notify.weeklyReachedBody', {
                    date: formatResetsAt(data.seven_day?.resets_at, true, settings.timeFormat || '12h', 'date-day'),
                    time: formatResetsAt(data.seven_day?.resets_at, false, settings.timeFormat || '12h', 'date-day'),
                })
            );
        } else {
            window.electronAPI.showNotification(
                t('notify.sessionReached'),
                t('notify.sessionReachedBody', { time: formatResetsAt(data.five_hour?.resets_at, false, settings.timeFormat || '12h', settings.weeklyDateFormat || 'date') })
            );
        }
    } else if (!isBlocked && alertFired.blocked) {
        alertFired.blocked = false;
        window.electronAPI.showNotification(
            t('notify.title'),
            t('notify.available')
        );
    }
}

// Apply or remove compact mode — switches view, resizes window, syncs all toggles
function applyCompactMode(compact) {
    // A recharge belongs to the rings, a sweep to the bars: switching views ends both
    stopRecharge();
    endCompactSweep();
    isCompactMode = compact;

    // Add/remove compact-mode class from body for CSS styling
    if (compact) {
        document.body.classList.add('compact-mode');
    } else {
        document.body.classList.remove('compact-mode');
    }

    // Show/hide the correct content view
    elements.mainContent.style.display = compact ? 'none' : 'block';
    elements.compactContent.style.display = compact ? 'flex' : 'none';

    // Collapse extra rows when entering compact — prevents stale isExpanded state
    if (compact && isExpanded) {
        isExpanded = false;
        elements.expandArrow.classList.remove('expanded');
        elements.expandSection.style.display = 'none';
    }

    if (compact && graphVisible) {
        graphWasVisible = true;
        graphVisible = false;
        elements.graphBtn.classList.remove('active');
        elements.graphSection.style.display = 'none';
    } else if (!compact && graphWasVisible) {
        graphWasVisible = false;
        graphVisible = true;
        elements.graphBtn.classList.add('active');
        elements.graphSection.style.display = 'block';
        loadChart();
    }

    // Show/hide the collapse chevron (only visible in normal mode with data)
    if (elements.compactCollapseBtn) {
        elements.compactCollapseBtn.style.display = compact ? 'none' : 'flex';
    }

    // Keep refresh button visible in compact mode so users can see when data updates
    // Hide graph button in compact mode (not applicable)
    if (elements.graphBtn) {
        elements.graphBtn.style.display = compact ? 'none' : '';
    }

    // Tell main process to resize the window width
    window.electronAPI.setCompactMode(compact);

    // Sync both settings toggles
    if (elements.compactModeToggle) elements.compactModeToggle.checked = compact;
    if (elements.compactModeToggleCompact) elements.compactModeToggleCompact.checked = compact;

    // Update compact bars if we have data
    if (compact && latestUsageData) updateCompactBars(latestUsageData);
    if (!compact) resizeWidget();

    // Persist graph/expanded state changes caused by compact mode toggle
    _saveViewState();
}

// Update the compact mode progress bars
function placeCompactPercents() {
    document.querySelectorAll('.compact-bar-bg > .compact-pct').forEach((pct) => {
        pct.parentElement.parentElement.appendChild(pct);
    });
}

function updateCompactBars(data) {
    // While the light sweeps the tracks the fresh values wait; they ease in when it ends
    if (compactSweep) {
        compactSweep.pending = data;
        return;
    }
    placeCompactPercents();
    const sessionPct = Math.min(Math.max(data.five_hour?.utilization || 0, 0), 100);
    const weeklyPct = Math.min(Math.max(data.seven_day?.utilization || 0, 0), 100);

    elements.compactSessionFill.style.width = `${sessionPct}%`;
    showPercent(elements.compactSessionPct, Math.round(sessionPct));
    elements.compactWeeklyFill.style.width = `${weeklyPct}%`;
    showPercent(elements.compactWeeklyPct, Math.round(weeklyPct));

    // Apply warning/danger classes to compact bars
    elements.compactSessionFill.className = 'compact-bar-fill';
    if (sessionPct >= dangerThreshold) elements.compactSessionFill.classList.add('danger');
    else if (sessionPct >= warnThreshold) elements.compactSessionFill.classList.add('warning');

    elements.compactWeeklyFill.className = 'compact-bar-fill weekly';
    if (weeklyPct >= dangerThreshold) elements.compactWeeklyFill.classList.add('danger');
    else if (weeklyPct >= warnThreshold) elements.compactWeeklyFill.classList.add('warning');

    // A small share still reads as a short bar, not a dot
    elements.compactSessionFill.classList.toggle('has-value', sessionPct > 0);
    elements.compactWeeklyFill.classList.toggle('has-value', weeklyPct > 0);

    // Fable — only shown when the account has a scoped Fable weekly limit
    // (data.seven_day_fable, normalized centrally by main.js before this ever
    // reaches the renderer — see src/normalize-usage-limits.js)
    if (data.seven_day_fable) {
        const fablePct = Math.min(Math.max(data.seven_day_fable.utilization || 0, 0), 100);
        elements.compactFableRow.style.display = '';
        elements.compactFableFill.style.width = `${fablePct}%`;
        showPercent(elements.compactFablePct, Math.round(fablePct));
        elements.compactFableFill.className = 'compact-bar-fill fable';
        if (fablePct >= dangerThreshold) elements.compactFableFill.classList.add('danger');
        else if (fablePct >= warnThreshold) elements.compactFableFill.classList.add('warning');
        elements.compactFableFill.classList.toggle('has-value', fablePct > 0);
    } else {
        elements.compactFableRow.style.display = 'none';
    }

    // Spend — only populated while the row is toggled open (collapsed compact
    // mode doesn't poll the spend endpoints, so data.extra_usage may be
    // stale or absent until the row is opened and a fetch completes)
    if (compactSpendOpen && data.extra_usage && data.extra_usage.utilization !== undefined) {
        const spendPct = Math.min(Math.max(data.extra_usage.utilization || 0, 0), 100);
        elements.compactSpendFill.style.width = `${spendPct}%`;
        showPercent(elements.compactSpendPct, Math.round(spendPct));
        elements.compactSpendFill.className = 'compact-bar-fill spend';
        if (spendPct >= dangerThreshold) elements.compactSpendFill.classList.add('danger');
        else if (spendPct >= warnThreshold) elements.compactSpendFill.classList.add('warning');
        elements.compactSpendFill.classList.toggle('has-value', spendPct > 0);
    }
}

// Sync the compact spend chevron + row visibility from compactSpendOpen state
function applyCompactSpendRow() {
    if (!elements.compactSpendToggle) return;
    elements.compactSpendArrow.classList.toggle('expanded', compactSpendOpen);
    elements.compactSpendToggle.title = compactSpendOpen ? t('compact.hideSpend') : t('compact.showSpend');
    elements.compactSpendRow.style.display = compactSpendOpen ? '' : 'none';
}
// Persist compact mode setting without touching the rest of settings — debounced
let _saveCompactTimer = null;
async function _saveCompactSetting(compact) {
    if (_saveCompactTimer) clearTimeout(_saveCompactTimer);
    _saveCompactTimer = setTimeout(async () => {
        const settings = window._cachedSettings || await window.electronAPI.getSettings();
        settings.compactMode = compact;
        window._cachedSettings = settings;
        await window.electronAPI.saveSettings(settings);
    }, 300);
}

// Persist graph/expanded visibility state — debounced to avoid hammering disk on rapid toggles
let _saveViewStateTimer = null;
async function _saveViewState() {
    if (appInitializing) return;
    if (_saveViewStateTimer) clearTimeout(_saveViewStateTimer);
    _saveViewStateTimer = setTimeout(async () => {
        const settings = window._cachedSettings || await window.electronAPI.getSettings();
        settings.graphVisible = graphVisible;
        settings.expandedOpen = isExpanded;
        settings.statsPeriod = statsPeriod;
        window._cachedSettings = settings;
        await window.electronAPI.saveSettings(settings);
    }, 300);
}

let sessionResetTriggered = false;
let weeklyResetTriggered = false;
let isFirstDataLoad = true; // used to seed alert flags on startup

// Track which usage alert thresholds have already fired this window
// Prevents repeat notifications on every refresh cycle
// Keys: 'session_warn', 'session_danger', 'weekly_warn', 'weekly_danger', 'blocked'
// Seeded on startup so thresholds already exceeded at launch don't fire immediately
// 'blocked' is a single combined flag (not per-window) — see checkUsageAlerts for why:
// it must stay true if EITHER session or weekly is at 100%, so a session-only reset
// while weekly is still maxed never fires a false "available again" notification.
const alertFired = {
    session_warn: false,
    session_danger: false,
    weekly_warn: false,
    weekly_danger: false,
    blocked: false
};

// Seed alertFired flags based on current utilization at startup.
// Any threshold already exceeded when the app launches is treated as already fired,
// so the user doesn't get a notification for something they can already see.
function seedAlertFlags(data) {
    const sessionPct = data.five_hour?.utilization || 0;
    const weeklyPct = data.seven_day?.utilization || 0;

    if (sessionPct >= dangerThreshold) {
        alertFired.session_danger = true;
        alertFired.session_warn = true;
    } else if (sessionPct >= warnThreshold) {
        alertFired.session_warn = true;
    }

    if (weeklyPct >= dangerThreshold) {
        alertFired.weekly_danger = true;
        alertFired.weekly_warn = true;
    } else if (weeklyPct >= warnThreshold) {
        alertFired.weekly_warn = true;
    }

    // Seed the combined blocked flag the same way — if either is already at 100%
    // when the app launches, don't fire "limit reached" immediately.
    if (sessionPct >= 100 || weeklyPct >= 100) {
        alertFired.blocked = true;
    }
}

function refreshTimers() {
    if (!latestUsageData) return;

    const settings = window._cachedSettings || {};
    const timeFormat = settings.timeFormat || '12h';
    const weeklyDateFormat = settings.weeklyDateFormat || 'date';

    // Session data
    const sessionUtilization = latestUsageData.five_hour?.utilization || 0;
    const sessionResetsAt = latestUsageData.five_hour?.resets_at;

    // Check if session timer has expired and we need to refresh
    if (sessionResetsAt) {
        const sessionDiff = new Date(sessionResetsAt) - new Date();
        if (sessionDiff <= 0 && !sessionResetTriggered) {
            sessionResetTriggered = true;
            debugLog('Session timer expired, triggering refresh...');
            // Wait a few seconds for the server to update, then refresh
            setTimeout(() => {
                fetchUsageData();
                checkForUpdate();
            }, 3000);
        } else if (sessionDiff > 0) {
            sessionResetTriggered = false; // Reset flag when timer is active again
        }
    }

    updateProgressBar(
        elements.sessionProgress,
        elements.sessionPercentage,
        sessionUtilization
    );

    updateTimer(
        elements.sessionTimer,
        elements.sessionTimeText,
        sessionResetsAt,
        5 * 60 // 5 hours in minutes
    );
    elements.sessionResetsAt.textContent = sessionResetsAt ? t('reset.at', { time: formatResetsAt(sessionResetsAt, false, timeFormat, weeklyDateFormat) }) : '—';
    elements.sessionResetsAt.style.opacity = sessionResetsAt ? '1' : '0.4';

    // Weekly data
    const weeklyUtilization = latestUsageData.seven_day?.utilization || 0;
    const weeklyResetsAt = latestUsageData.seven_day?.resets_at;

    // Check if weekly timer has expired and we need to refresh
    if (weeklyResetsAt) {
        const weeklyDiff = new Date(weeklyResetsAt) - new Date();
        if (weeklyDiff <= 0 && !weeklyResetTriggered) {
            weeklyResetTriggered = true;
            debugLog('Weekly timer expired, triggering refresh...');
            setTimeout(() => {
                fetchUsageData();
            }, 3000);
        } else if (weeklyDiff > 0) {
            weeklyResetTriggered = false;
        }
    }

    updateProgressBar(
        elements.weeklyProgress,
        elements.weeklyPercentage,
        weeklyUtilization,
        true
    );

    updateTimer(
        elements.weeklyTimer,
        elements.weeklyTimeText,
        weeklyResetsAt,
        7 * 24 * 60 // 7 days in minutes
    );
    elements.weeklyResetsAt.textContent = weeklyResetsAt ? t('reset.on', { date: formatResetsAt(weeklyResetsAt, true, timeFormat, weeklyDateFormat) }) : '—';
    elements.weeklyResetsAt.style.opacity = weeklyResetsAt ? '1' : '0.4';
}

function startCountdown() {
    if (countdownInterval) clearInterval(countdownInterval);
    countdownInterval = setInterval(() => {
        refreshTimers();
        if (isExpanded) refreshExtraTimers();
    }, 30000);
    if (tickInterval) clearInterval(tickInterval);
    tickInterval = setInterval(tickCountdowns, 1000);
}

// The two main countdowns tick every second; model rows keep the 30 s refresh
function tickCountdowns() {
    if (!latestUsageData || isCompactMode) return;
    updateTimer(elements.sessionTimer, elements.sessionTimeText, latestUsageData.five_hour?.resets_at, 5 * 60);
    updateTimer(elements.weeklyTimer, elements.weeklyTimeText, latestUsageData.seven_day?.resets_at, 7 * 24 * 60);
}

// The number counts up to its new value; on first show it starts from zero
function animatePercent(el, to, duration = 900) {
    // Already counting towards this value: let that count finish undisturbed
    if (el._raf && el.dataset.v === String(to)) return;
    const from = el.dataset.v === undefined ? 0 : Number(el.dataset.v);
    el.dataset.v = String(to);
    const render = (v) => {
        const n = String(Math.round(v));
        if (el.classList.contains('gauge-num') || el.classList.contains('gauge-meta-pct')) {
            // Big number with a small percent sign next to it
            const pct = document.createElement('span');
            pct.className = 'gauge-pct';
            pct.textContent = '%';
            el.replaceChildren(document.createTextNode(n), pct);
        } else {
            el.textContent = `${n}%`;
        }
    };
    if (el._raf) cancelAnimationFrame(el._raf);
    el._raf = 0;
    if (from === to || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        render(to);
        return;
    }
    const start = performance.now();
    const step = (now) => {
        const t = Math.min(1, (now - start) / duration);
        render(from + (to - from) * (1 - Math.pow(1 - t, 3)));
        el._raf = t < 1 ? requestAnimationFrame(step) : 0;
    };
    el._raf = requestAnimationFrame(step);
}

// A number that a flying ring holds back: it waits on the element until the ring lands
// (see the recharge below); otherwise it counts to the value at once
function showPercent(el, value) {
    if (rechargeHolds(el)) {
        el.dataset.pending = String(value);
        return;
    }
    delete el.dataset.pending;
    animatePercent(el, value);
}

// Update a progress bar — or a ring: a ring's arc carries its circumference in data-c
function updateProgressBar(progressElement, percentageElement, value, isWeekly = false) {
    const percentage = Math.min(Math.max(value, 0), 100);
    const circumference = Number(progressElement.dataset.c || 0);
    const gauge = progressElement.closest('.gauge');
    // A ring in flight lands on this value instead of jumping to it now
    const flight = rechargeFlight(gauge);

    if (circumference) {
        if (flight) flight.target = percentage / 100;
        else progressElement.style.strokeDashoffset = `${circumference * (1 - percentage / 100)}`;
    } else {
        progressElement.style.width = `${percentage}%`;
    }
    showPercent(percentageElement, Math.round(percentage));
    // Style B shows the same number beside the rings
    const metaPct = gauge && gauge.querySelector('.gauge-meta-pct');
    if (metaPct) showPercent(metaPct, Math.round(percentage));

    // State of the whole gauge — drives the colour and the soft glow at thresholds
    const state = percentage >= dangerThreshold ? 'danger' : percentage >= warnThreshold ? 'warning' : '';
    if (flight && !flight.released) flight.pendingState = state;
    else applyGaugeState(progressElement, gauge, state);
}

function applyGaugeState(progressElement, gauge, state) {
    progressElement.classList.remove('warning', 'danger');
    if (gauge) gauge.classList.remove('is-warning', 'is-danger');
    if (state === 'danger') {
        progressElement.classList.add('danger');
        if (gauge) gauge.classList.add('is-danger');
    } else if (state === 'warning') {
        progressElement.classList.add('warning');
        if (gauge) gauge.classList.add('is-warning');
    }
}

// ---------- Recharge: the manual refresh ----------
// One continuous movement, nothing swapped or drained: each usage arc takes off (spins up
// while shrinking to a comet and fading its tail), orbits while the request is out, and
// lands — decelerating onto the next full turn so it stops exactly at twelve o'clock —
// growing to the fresh value with a slight spring. The thin time arc turns with it; the
// big number dims in flight and counts to the new value as the ring lands. The week ring
// starts a little later, so the two land apart. Never shorter than RECHARGE.minFlight.
const RECHARGE = {
    speed: 400,        // cruising angular speed, degrees per second
    takeoff: 450,      // ms from rest to cruising speed
    minFlight: 1100,   // ms — no ring lands sooner than this after its start
    comet: 0.24,       // arc length in flight, as a share of the ring
    tail: 0.06,        // opacity of the arc's start (its tail) in flight
    stagger: 120,      // ms between the session and the week ring
    dim: 0.55,         // opacity of the big number in flight
    minTurn: 200,      // degrees — the landing turn is at least this long
};
let recharge = null;

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const lerp = (a, b, k) => a + (b - a) * k;
const smoothstep = (a, b, x) => {
    const k = clamp01((x - a) / (b - a));
    return k * k * (3 - 2 * k);
};
// Gentle spring: settles on 1 after a small overshoot (about 6 % of the move)
const easeOutBack = (x) => {
    const c1 = 1.25;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
};
const easeInOutSine = (x) => -(Math.cos(Math.PI * x) - 1) / 2;

function rechargeFlight(gauge) {
    if (!recharge || !gauge) return null;
    return recharge.rings.find((ring) => ring.gauge === gauge && ring.phase !== 'done') || null;
}

// Numbers are held while their ring is in flight and has not started to land yet
function rechargeHolds(el) {
    if (!recharge) return false;
    const ring = recharge.rings.find((r) => r.nums.includes(el));
    return !!ring && ring.phase !== 'done' && !ring.released;
}

async function rechargeRefresh() {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (isCompactMode) {
        await compactSweepRefresh(reduced);
        return;
    }
    const ringsShown = elements.mainContent.style.display !== 'none' && !!latestUsageData;
    if (reduced || !ringsShown) {
        await fetchUsageData({ trayFrame: true });
        return;
    }
    startRecharge();
    await fetchUsageData({ trayFrame: true });
    if (recharge) {
        recharge.fetched = true;
        await recharge.done;
    }
}

function startRecharge() {
    const start = performance.now();
    const icon = elements.refreshBtn.querySelector('svg');
    const values = [latestUsageData?.five_hour?.utilization || 0, latestUsageData?.seven_day?.utilization || 0];
    const rings = [elements.sessionGauge, elements.weeklyGauge].map((gauge, i) => {
        const arc = gauge.querySelector('.ring-usage');
        const C = Number(arc.dataset.c);
        // Start from what is on screen right now, even mid-transition
        const shown = parseFloat(getComputedStyle(arc).strokeDashoffset);
        const from = Number.isFinite(shown) ? clamp01(1 - shown / C) : clamp01(values[i] / 100);
        return {
            gauge, arc, C, from,
            time: gauge.querySelector('.ring-time'),
            nums: [...gauge.querySelectorAll('.gauge-num, .gauge-meta-pct')],
            start: start + i * RECHARGE.stagger,
            target: clamp01(Math.min(values[i], 100) / 100),
            phase: 'wait', theta: 0, len: from, tail: 1, dim: 1,
            released: false, pendingState: undefined,
        };
    });
    recharge = { rings, icon, fetched: false, raf: 0, resolve: null };
    recharge.done = new Promise((resolve) => { recharge.resolve = resolve; });
    elements.refreshBtn.classList.remove('spinning');
    document.body.classList.add('recharging');
    rings.forEach(paintRing);
    recharge.raf = requestAnimationFrame(rechargeFrame);
}

function rechargeFrame(now) {
    const r = recharge;
    if (!r) return;
    // The rings went away (login screen, compact view): stop cleanly
    if (elements.mainContent.style.display === 'none' || isCompactMode) {
        stopRecharge();
        return;
    }
    for (const ring of r.rings) stepRing(ring, now, r.fetched);
    // The refresh icon turns with the session ring, so it also comes to rest upright
    if (r.icon) r.icon.style.transform = `rotate(${(r.rings[0].theta % 360).toFixed(2)}deg)`;
    if (r.rings.every((ring) => ring.phase === 'done')) {
        finishRecharge();
        return;
    }
    r.raf = requestAnimationFrame(rechargeFrame);
}

function stepRing(ring, now, fetched) {
    if (ring.phase === 'done') return;
    const w = RECHARGE.speed / 1000; // degrees per ms
    const t = now - ring.start;
    if (t < 0) return; // the week ring waits for its turn
    if (ring.phase === 'wait') ring.phase = 'takeoff';

    if (ring.phase === 'takeoff') {
        if (t < RECHARGE.takeoff) {
            // Constant acceleration from rest up to cruising speed
            ring.theta = 0.5 * (w / RECHARGE.takeoff) * t * t;
            const k = easeInOutSine(t / RECHARGE.takeoff);
            ring.len = lerp(ring.from, RECHARGE.comet, k);
            ring.tail = lerp(1, RECHARGE.tail, k);
            ring.dim = lerp(1, RECHARGE.dim, k);
        } else {
            ring.phase = 'orbit';
        }
    }

    if (ring.phase === 'orbit') {
        const cruise = t - RECHARGE.takeoff;
        ring.theta = 0.5 * w * RECHARGE.takeoff + w * cruise;
        ring.len = RECHARGE.comet;
        ring.tail = RECHARGE.tail;
        ring.dim = RECHARGE.dim;
        if (fetched && t >= RECHARGE.minFlight) {
            // Land on the next full turn at least minTurn ahead. θ(u) = θ0 + Δ·(1 − (1 − u)^1.7)
            // leaves at cruising speed when the duration is 1.7·Δ/ω, and stops at rest.
            ring.phase = 'landing';
            ring.landStart = now;
            ring.theta0 = ring.theta;
            ring.delta = Math.ceil((ring.theta + RECHARGE.minTurn) / 360) * 360 - ring.theta;
            ring.landDur = (1.7 * ring.delta) / w;
            ring.landTo = ring.target;
            ring.spring = ring.landTo < 0.88; // a full ring must not overshoot into itself
        }
    }

    if (ring.phase === 'landing') {
        const u = clamp01((now - ring.landStart) / ring.landDur);
        ring.theta = ring.theta0 + ring.delta * (1 - Math.pow(1 - u, 1.7));
        const grow = smoothstep(0.3, 1, u);
        ring.len = clamp01(lerp(RECHARGE.comet, ring.landTo, ring.spring ? easeOutBack(grow) : grow));
        ring.tail = lerp(RECHARGE.tail, 1, smoothstep(0.25, 0.85, u));
        ring.dim = lerp(RECHARGE.dim, 1, smoothstep(0.3, 0.8, u));
        if (!ring.released && u >= 0.3) releaseRing(ring, 0.7 * ring.landDur);
        if (u >= 1) {
            ring.theta = ring.theta0 + ring.delta;
            ring.len = ring.landTo;
            ring.tail = 1;
            ring.dim = 1;
            ring.phase = 'done';
            paintRing(ring);
            landRing(ring);
            return;
        }
    }
    paintRing(ring);
}

function paintRing(ring) {
    const turn = `rotate(${(ring.theta % 360).toFixed(3)}deg)`;
    ring.arc.style.transform = turn;
    if (ring.time) ring.time.style.transform = turn;
    ring.arc.style.strokeDashoffset = (ring.C * (1 - ring.len)).toFixed(3);
    ring.gauge.style.setProperty('--tail', ring.tail.toFixed(3));
    for (const el of ring.nums) el.style.opacity = ring.dim.toFixed(3);
}

// The ring starts to grow: colour state and the held numbers go with it
function releaseRing(ring, countMs) {
    ring.released = true;
    if (ring.pendingState !== undefined) {
        applyGaugeState(ring.arc, ring.gauge, ring.pendingState);
        ring.pendingState = undefined;
    }
    for (const el of ring.nums) {
        if (el.dataset.pending === undefined) continue;
        const value = Number(el.dataset.pending);
        delete el.dataset.pending;
        animatePercent(el, value, countMs);
    }
}

// Landed: hand the ring back to the normal styles, then a short glow
function landRing(ring) {
    releaseRing(ring, 400);
    ring.arc.style.transform = '';
    if (ring.time) ring.time.style.transform = '';
    ring.gauge.style.removeProperty('--tail');
    for (const el of ring.nums) el.style.opacity = '';
    // A value that arrived during the landing still wins
    ring.arc.style.strokeDashoffset = `${ring.C * (1 - ring.target)}`;
    ring.gauge.classList.remove('landed');
    void ring.gauge.offsetWidth;
    ring.gauge.classList.add('landed');
    clearTimeout(ring.gauge._landedTimer);
    ring.gauge._landedTimer = setTimeout(() => ring.gauge.classList.remove('landed'), 650);
}

function finishRecharge() {
    const r = recharge;
    if (!r) return;
    if (r.icon) r.icon.style.transform = '';
    recharge = null;
    document.body.classList.remove('recharging');
    r.resolve();
}

// Stop at once (the rings went away): everything back to its plain state and values
function stopRecharge() {
    const r = recharge;
    if (!r) return;
    cancelAnimationFrame(r.raf);
    for (const ring of r.rings) {
        if (ring.phase === 'done') continue;
        ring.phase = 'done';
        ring.arc.style.transform = '';
        if (ring.time) ring.time.style.transform = '';
        ring.gauge.style.removeProperty('--tail');
        ring.arc.style.strokeDashoffset = `${ring.C * (1 - ring.target)}`;
        for (const el of ring.nums) el.style.opacity = '';
        releaseRing(ring, 0);
    }
    finishRecharge();
}

// ---------- Compact view: a light sweeps the bar tracks while the request is out ----------
let compactSweep = null;
const COMPACT_SWEEP_MIN = 900; // ms — at least one pass of the light

async function compactSweepRefresh(reduced) {
    if (reduced) {
        await fetchUsageData({ trayFrame: true });
        return;
    }
    compactSweep = { pending: null };
    elements.compactContent.classList.add('sweeping');
    const onePass = new Promise((resolve) => setTimeout(resolve, COMPACT_SWEEP_MIN));
    await fetchUsageData({ trayFrame: true });
    await onePass;
    endCompactSweep();
}

// The light fades where it is; the waiting values ease in (bar widths have transitions)
function endCompactSweep() {
    const sweep = compactSweep;
    if (!sweep) return;
    compactSweep = null;
    elements.compactContent.classList.remove('sweeping');
    if (sweep.pending && isCompactMode) updateCompactBars(sweep.pending);
}

// Format reset date for the "Resets At" column
// Session: shows time like "3:59 PM" or "15:59"
// Weekly: shows date like "Mar 13", "Fri Mar 13", or "Fri Mar 13 3:59 PM"
function formatResetsAt(resetsAt, isWeekly, timeFormat, weeklyDateFormat) {
    if (!resetsAt) return '—';
    const date = new Date(resetsAt);
    const locale = currentLocale();

    const formatTime = (d) => {
        if (timeFormat === '24h') {
            return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
        }
        let hours = d.getHours();
        const minutes = d.getMinutes().toString().padStart(2, '0');
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12 || 12;
        return `${hours}:${minutes} ${ampm}`;
    };

    if (!isWeekly) return formatTime(date);
    return formatDateSample(date, weeklyDateFormat || 'date', locale, formatTime);
}

// A date the way the current language writes it: 'Mar 13' / '13 Mar' / '13. März',
// with the weekday and optionally the time. Also fills the Date format picker.
function formatDateSample(date, fmt, locale, formatTime) {
    const withDay = fmt === 'date-day' || fmt === 'date-day-time';
    const text = new Intl.DateTimeFormat(locale, withDay
        ? { weekday: 'short', day: 'numeric', month: 'short' }
        : { day: 'numeric', month: 'short' }).format(date);
    return fmt === 'date-day-time' ? `${text} ${formatTime(date)}` : text;
}

// Update circular timer
function updateTimer(timerElement, textElement, resetsAt, totalMinutes) {
    const circumference = Number(timerElement.dataset?.c || 63);
    const precise = Boolean(textElement.dataset?.precise);
    if (!resetsAt) {
        textElement.textContent = t('timer.notStarted');
        textElement.style.opacity = '0.45';
        textElement.style.fontSize = precise ? '' : '10px';
        textElement.title = t('timer.notStartedHint');
        timerElement.style.strokeDashoffset = circumference;
        return;
    }

    // Clear the greyed out styling when timer is active
    textElement.style.opacity = '1';
    textElement.style.fontSize = '';
    textElement.title = '';

    const resetDate = new Date(resetsAt);
    const now = new Date();
    const diff = resetDate - now;

    if (diff <= 0) {
        textElement.textContent = t('timer.resetting');
        timerElement.style.strokeDashoffset = 0;
        return;
    }

    textElement.textContent = formatCountdown(diff, precise);

    // Calculate progress (elapsed percentage)
    const totalMs = totalMinutes * 60 * 1000;
    const elapsedMs = totalMs - diff;
    const elapsedPercentage = (elapsedMs / totalMs) * 100;

    // Arc length from data-c (model-row mini circles have none: 63 ≈ 2π·10)
    const offset = circumference - (elapsedPercentage / 100) * circumference;
    timerElement.style.strokeDashoffset = offset;

    // Update color based on time remaining until reset — hardcoded thresholds,
    // intentionally independent of the usage warnThreshold/dangerThreshold
    // settings (see ELAPSED_AMBER_THRESHOLD/ELAPSED_GREEN_THRESHOLD above).
    timerElement.classList.remove('elapsed-warn', 'elapsed-soon');
    if (elapsedPercentage >= ELAPSED_GREEN_THRESHOLD) {
        timerElement.classList.add('elapsed-soon');
    } else if (elapsedPercentage >= ELAPSED_AMBER_THRESHOLD) {
        timerElement.classList.add('elapsed-warn');
    }
}

// '1:47:12' for the main rings (ticks every second); '4h 14m', '2d 4h' elsewhere
function formatCountdown(diff, precise) {
    const totalSec = Math.floor(diff / 1000);
    const days = Math.floor(totalSec / 86400);
    const hours = Math.floor((totalSec % 86400) / 3600);
    const minutes = Math.floor((totalSec % 3600) / 60);
    const seconds = totalSec % 60;
    if (days > 0) return t('cd.days', { d: days, h: hours });
    if (precise) {
        const mm = String(minutes).padStart(2, '0');
        const ss = String(seconds).padStart(2, '0');
        return hours > 0 ? `${hours}:${mm}:${ss}` : `${minutes}:${ss}`;
    }
    return hours > 0 ? t('cd.hours', { h: hours, m: minutes }) : t('cd.minutes', { m: minutes });
}

// UI State Management
function showLoginRequired() {
    elements.loadingContainer.style.display = 'none';
    elements.loginContainer.style.display = 'flex';
    elements.noUsageContainer.style.display = 'none';
    elements.mainContent.style.display = 'none';
    // Reset to step 1
    elements.loginStep1.style.display = 'flex';
    elements.loginStep2.style.display = 'none';
    elements.sessionKeyError.textContent = '';
    elements.sessionKeyInput.value = '';
    // Close any open overlays
    elements.settingsOverlay.style.display = 'none';
    elements.compactSettingsOverlay.style.display = 'none';
    // Hide header buttons during login
    elements.settingsBtn.style.display = 'none';
    elements.refreshBtn.style.display = 'none';
    elements.graphBtn.style.display = 'none';
    stopAutoUpdate();
    if (countdownInterval) {
        clearInterval(countdownInterval);
        countdownInterval = null;
    }
    // The rings and bars are gone: end any refresh animation cleanly
    stopRecharge();
    endCompactSweep();
    // Reset fetch guard so it can't get permanently stuck across login/logout
    isFetching = false;
    // Reset alert state so a new session doesn't inherit suppressed alerts
    isFirstDataLoad = true;
    alertFired.session_warn = false;
    alertFired.session_danger = false;
    alertFired.weekly_warn = false;
    alertFired.weekly_danger = false;
    // Resize window to fit login content — without this the window stays at
    // the default 155px widget height and the "Log in"/"Manual" buttons are
    // clipped off-screen and unreachable on a frameless, non-resizable window.
    window.electronAPI.resizeWindow(360);
}

function showMainContent() {
    elements.loadingContainer.style.display = 'none';
    elements.loginContainer.style.display = 'none';
    elements.noUsageContainer.style.display = 'none';
    // Respect compact mode — don't force mainContent visible if we're in compact
    if (!isCompactMode) {
        elements.mainContent.style.display = 'block';
    }
    elements.compactContent.style.display = isCompactMode ? 'flex' : 'none';
    // Always show collapse chevron here — applyCompactMode hides it when needed
    if (elements.compactCollapseBtn) {
        elements.compactCollapseBtn.style.display = isCompactMode ? 'none' : 'flex';
    }
    // Restore header buttons after login - but respect compact mode for graph button
    elements.settingsBtn.style.display = 'flex';
    elements.refreshBtn.style.display = 'flex';
    elements.graphBtn.style.display = isCompactMode ? 'none' : 'flex';
}

// Auto-update management
function startAutoUpdate() {
    stopAutoUpdate();
    const settings = window._cachedSettings || {};
    const intervalSecs = parseInt(settings.refreshInterval) || 300;
    updateInterval = setInterval(async () => {
        // A recharge already turns the icon; the quiet spin is for automatic refreshes only
        if (elements.refreshBtn && !recharge) elements.refreshBtn.classList.add('spinning');
        await fetchUsageData();
        if (elements.refreshBtn) elements.refreshBtn.classList.remove('spinning');
    }, intervalSecs * 1000);
}

function stopAutoUpdate() {
    if (updateInterval) {
        clearInterval(updateInterval);
        updateInterval = null;
    }
}

// ---------- Statistics ----------
// One history, three looks and three periods. Buckets: today by hour, the last 7 and the
// last 30 days by day (today last). The same numbers feed every look.
const STATS_STYLES = ['line', 'bars', 'summary'];
const STATS_PERIODS = ['day', 'week', 'month'];
const STATS_HEIGHTS = { line: 250, bars: 250, summary: 202 }; // must match .stats-section in CSS
const STATS_MARGIN = 12;
const MINUTE_MS = 60 * 1000;
const NEAR_LIMIT_GAP_CAP = 15 * MINUTE_MS; // a longer gap means the app was not watching
const ACTIVE_GAP_CAP = 10 * MINUTE_MS;
let statsHistory = [];

function statsSectionHeight() {
    return (STATS_HEIGHTS[statsStyle] || STATS_HEIGHTS.line) + STATS_MARGIN;
}

async function loadChart() {
    let history = [];
    try {
        history = await window.electronAPI.getUsageHistory();
    } catch (error) {
        debugLog('History unavailable', error);
    }
    statsHistory = Array.isArray(history) ? history : [];
    renderStats();
}

// Bucket edges in local time, from calendar arithmetic so DST days stay right
function statsWindow(period, nowMs) {
    const today = new Date(nowMs);
    today.setHours(0, 0, 0, 0);
    const buckets = [];
    if (period === 'day') {
        for (let h = 0; h < 24; h++) {
            const from = new Date(today);
            from.setHours(h);
            const to = new Date(today);
            to.setHours(h + 1);
            buckets.push({ start: from.getTime(), end: to.getTime() });
        }
    } else {
        const days = period === 'week' ? 7 : 30;
        for (let i = days - 1; i >= 0; i--) {
            const from = new Date(today);
            from.setDate(from.getDate() - i);
            const to = new Date(from);
            to.setDate(to.getDate() + 1);
            buckets.push({ start: from.getTime(), end: to.getTime() });
        }
    }
    return { start: buckets[0].start, end: buckets[buckets.length - 1].end, buckets };
}

// Monthly spend is only polled while the spend is on screen; readings taken without it
// store 0. Carry the last known value over those, so they are neither a drop nor a jump.
function spendSeries(samples) {
    let last = 0;
    return samples.map((entry) => {
        const v = entry.extraUsage || 0;
        if (v > 0) last = v;
        return v > 0 ? v : last;
    });
}

function computeStats(history, period, nowMs) {
    const win = statsWindow(period, nowMs);
    const samples = history.filter((e) => e && e.timestamp >= win.start && e.timestamp < win.end);
    const buckets = win.buckets.map((b) => ({
        ...b, peak: null, weekLast: null, sum: 0, n: 0, activeMs: 0, spendMax: null,
        future: b.start > nowMs, current: b.start <= nowMs && nowMs < b.end,
    }));
    const spend = spendSeries(history.filter((e) => e && e.timestamp < win.end));
    const spendOffset = spend.length - samples.length; // spend[] also covers the readings before the window

    let bi = 0;
    let nearMs = 0;
    let activeMs = 0;
    let sum = 0;
    let peak = null;
    let spendUp = 0;
    samples.forEach((e, i) => {
        while (bi < buckets.length - 1 && e.timestamp >= buckets[bi].end) bi++;
        const b = buckets[bi];
        const session = e.session || 0;
        const weekly = e.weekly || 0;
        b.peak = Math.max(b.peak ?? 0, session);
        b.weekLast = weekly; // where the week stood at the end of the bucket (it resets weekly)
        b.sum += session;
        b.n++;
        sum += session;
        peak = Math.max(peak ?? 0, session);
        const money = spend[spendOffset + i];
        b.spendMax = Math.max(b.spendMax ?? 0, money);
        // Spend: every rise counts, a monthly reset does not subtract
        const before = spendOffset + i - 1 >= 0 ? spend[spendOffset + i - 1] : null;
        if (before !== null && money > before) spendUp += money - before;
        if (i === 0) return;
        const prev = samples[i - 1];
        const gap = e.timestamp - prev.timestamp;
        if ((prev.session || 0) >= dangerThreshold) nearMs += Math.min(gap, NEAR_LIMIT_GAP_CAP);
        if (session > (prev.session || 0) || weekly > (prev.weekly || 0)) {
            const d = Math.min(gap, ACTIVE_GAP_CAP);
            activeMs += d;
            b.activeMs += d;
        }
    });

    // Busiest bucket: the highest peak; on a tie the one with more activity, then the later
    let busiest = null;
    buckets.forEach((b) => {
        if (b.peak === null) return;
        if (!busiest || b.peak > busiest.peak || (b.peak === busiest.peak && b.activeMs >= busiest.activeMs)) busiest = b;
    });

    const money = spendAxis();
    return {
        period, win, buckets, samples, busiest,
        count: samples.length,
        peak, avg: samples.length ? sum / samples.length : null,
        nearMs, activeMs,
        spend: money ? { amount: spendUp * money.perPct, currency: money.currency, perPct: money.perPct } : null,
        currentIndex: buckets.findIndex((b) => b.current),
    };
}

// ---- formatting ----
function fmtPct(v) {
    return v === null || v === undefined ? '—' : `${Math.round(v)} %`;
}

function fmtDuration(ms) {
    const total = Math.round(ms / MINUTE_MS);
    const h = Math.floor(total / 60);
    const m = total % 60;
    if (h === 0) return t('dur.m', { m });
    if (h >= 10) return t('dur.h', { h: m >= 30 ? h + 1 : h });
    return m === 0 ? t('dur.h', { h }) : t('dur.hm', { h, m });
}

function fmtMoney(amount, currency) {
    return formatCurrency(Math.round(amount * 100), currency);
}

function hourLabel(ms) {
    const d = new Date(ms);
    const tf = (window._cachedSettings || {}).timeFormat || '12h';
    if (tf === '24h') return `${String(d.getHours()).padStart(2, '0')}:00`;
    const h = d.getHours() % 12 || 12;
    return `${h} ${d.getHours() >= 12 ? 'PM' : 'AM'}`;
}

function capitalize(text) {
    return text ? text.charAt(0).toLocaleUpperCase(currentLocale()) + text.slice(1) : text;
}

function dayLabel(ms, form) {
    const d = new Date(ms);
    if (form === 'weekday') return capitalize(new Intl.DateTimeFormat(currentLocale(), { weekday: 'short' }).format(d));
    if (form === 'weekdayLong') return capitalize(new Intl.DateTimeFormat(currentLocale(), { weekday: 'long' }).format(d));
    return new Intl.DateTimeFormat(currentLocale(), { day: 'numeric', month: 'short' }).format(d);
}

// A bucket's name: '15:00', 'Fri', 'Sep 26'
function bucketLabel(bucket, period, long) {
    if (period === 'day') return hourLabel(bucket.start);
    if (period === 'week') return dayLabel(bucket.start, long ? 'weekdayLong' : 'weekday');
    return dayLabel(bucket.start, 'date');
}

// ---- rendering ----
function markStatsPeriod() {
    elements.statsPeriodSwitch?.querySelectorAll('[data-period]').forEach((btn) => {
        const on = btn.dataset.period === statsPeriod;
        btn.classList.toggle('active', on);
        btn.setAttribute('aria-checked', String(on));
    });
}

function renderStats() {
    const section = elements.graphSection;
    section.dataset.style = statsStyle;
    elements.statsTitle.textContent = t(`stats.title.${statsPeriod}`);
    markStatsPeriod();
    if (usageChart) {
        usageChart.destroy();
        usageChart = null;
    }
    elements.statsCards.replaceChildren();
    elements.statsHeat.replaceChildren();
    elements.statsSummary.replaceChildren();

    const stats = computeStats(statsHistory, statsPeriod, Date.now());
    section.classList.toggle('is-empty', stats.count === 0);
    if (stats.count === 0 || section.style.display === 'none') return;

    if (statsStyle === 'summary') {
        renderStatsCards(stats);
        return;
    }
    if (statsStyle === 'bars') renderBarChart(stats);
    else renderLineChart(stats);

    const items = statsStyle === 'bars'
        ? [
            [t('stats.peak'), fmtPct(stats.peak)],
            [t(stats.period === 'day' ? 'stats.busiestHour' : 'stats.busiestDay'), stats.busiest ? bucketLabel(stats.busiest, stats.period, true) : '—'],
            [t('stats.active'), fmtDuration(stats.activeMs)],
        ]
        : [
            [t('stats.peak'), fmtPct(stats.peak)],
            [t('stats.average'), fmtPct(stats.avg)],
            [t('stats.nearLimit'), fmtDuration(stats.nearMs)],
            stats.spend ? [t('stats.spend'), fmtMoney(stats.spend.amount, stats.spend.currency)] : [t('stats.active'), fmtDuration(stats.activeMs)],
        ];
    for (const [label, value] of items) {
        const item = document.createElement('div');
        item.className = 'stats-item';
        const l = document.createElement('span');
        l.className = 'stats-item-label';
        l.textContent = label;
        const v = document.createElement('span');
        v.className = 'stats-item-value';
        v.textContent = value;
        item.append(l, v);
        elements.statsSummary.appendChild(item);
    }
}

function chartFont(size, weight) {
    return { size, weight, family: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", sans-serif' };
}

// A day at a 15-second refresh is thousands of readings on a 500-pixel line: fold them into
// at most maxPoints bins (the session's peak and the week's last value of each bin)
function thinSamples(samples, maxPoints = 720) {
    if (samples.length <= maxPoints) return samples;
    const first = samples[0].timestamp;
    const bin = Math.max(1, (samples[samples.length - 1].timestamp - first) / maxPoints);
    const out = [];
    let current = null;
    let key = null;
    for (const e of samples) {
        const k = Math.floor((e.timestamp - first) / bin);
        if (k !== key) {
            if (current) out.push(current);
            current = { ...e };
            key = k;
            continue;
        }
        current.session = Math.max(current.session || 0, e.session || 0);
        current.weekly = e.weekly;
        if (e.extraUsage > 0 || !(current.extraUsage > 0)) current.extraUsage = e.extraUsage;
        current.timestamp = e.timestamp;
    }
    if (current) out.push(current);
    return out;
}

// A: session and week over the period. Today uses every reading; a week or a month one point
// per day (the session's peak, the week's level at the day's end), so five-hour windows
// don't turn the line into a saw.
function renderLineChart(stats) {
    const ink = chartInk();
    const { win, period } = stats;
    const perDay = period !== 'day';
    const mid = (b) => b.start + (b.end - b.start) / 2;
    const readings = perDay ? [] : thinSamples(stats.samples);
    const sessionPts = perDay
        ? stats.buckets.filter((b) => !b.future).map((b) => ({ x: mid(b), y: b.peak }))
        : readings.map((e) => ({ x: e.timestamp, y: e.session || 0 }));
    const weekPts = perDay
        ? stats.buckets.filter((b) => !b.future).map((b) => ({ x: mid(b), y: b.weekLast }))
        : readings.map((e) => ({ x: e.timestamp, y: e.weekly || 0 }));
    const lastSession = sessionPts.reduce((last, p, i) => (p.y !== null ? i : last), -1);

    const line = {
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 3,
        pointHitRadius: 10,
        cubicInterpolationMode: 'monotone',
        spanGaps: false,
    };
    const datasets = [
        {
            ...line,
            label: t('chart.session'),
            data: sessionPts,
            borderColor: ink.session,
            // A soft wash under the session line gives the chart a surface without a second colour
            backgroundColor(context) {
                const area = context.chart.chartArea;
                if (!area) return 'transparent';
                const wash = context.chart.ctx.createLinearGradient(0, area.top, 0, area.bottom);
                wash.addColorStop(0, inkAlpha(ink.session, 0.1));
                wash.addColorStop(1, inkAlpha(ink.session, 0));
                return wash;
            },
            fill: 'origin',
            // The line ends in a dot: where things stand now
            pointRadius: (ctx) => (ctx.dataIndex === lastSession ? 3 : 0),
            pointBackgroundColor: ink.session,
            pointBorderWidth: 0,
        },
        { ...line, label: t('chart.weekly'), data: weekPts, borderColor: ink.weekly, backgroundColor: 'transparent' },
    ];

    // Spend on its own money axis while the model rows (and so the spend row) are open
    const spend = isExpanded ? stats.spend : null;
    if (spend) {
        const money = spendSeries(readings);
        const spendPts = perDay
            ? stats.buckets.filter((b) => !b.future).map((b) => ({ x: mid(b), y: b.spendMax === null ? null : b.spendMax * spend.perPct }))
            : readings.map((e, i) => ({ x: e.timestamp, y: money[i] * spend.perPct }));
        if (spendPts.some((p) => p.y > 0)) {
            datasets.push({
                ...line,
                label: t('extra.label'),
                data: spendPts,
                yAxisID: 'spend',
                borderColor: ink.extra,
                borderDash: [4, 3],
                backgroundColor: 'transparent',
                cubicInterpolationMode: 'default',
                stepped: !perDay,
            });
        }
    }

    const tf = (window._cachedSettings || {}).timeFormat || '12h';
    const ticks = [];
    if (period === 'day') {
        for (const h of [0, 6, 12, 18, 24]) {
            const d = new Date(win.start);
            d.setHours(h);
            const label = tf === '24h' ? String(h).padStart(2, '0') : `${h % 12 || 12} ${h % 24 >= 12 ? 'PM' : 'AM'}`;
            ticks.push({ value: d.getTime(), label });
        }
    } else {
        const n = stats.buckets.length;
        stats.buckets.forEach((b, i) => {
            // A week: every day; a month: every fifth day, counted back from today
            if (period === 'week' || (n - 1 - i) % 5 === 0) {
                ticks.push({ value: mid(b), label: period === 'week' ? dayLabel(b.start, 'weekday') : dayLabel(b.start, 'date') });
            }
        });
    }
    const tickLabels = new Map(ticks.map((tk) => [tk.value, tk.label]));

    usageChart = new Chart(elements.usageChart.getContext('2d'), {
        type: 'line',
        data: { datasets },
        options: {
            animation: false,
            responsive: true,
            maintainAspectRatio: false,
            layout: { padding: { top: 4, right: spend ? 0 : 6 } },
            interaction: { intersect: false, mode: 'nearest', axis: 'x' },
            scales: {
                x: {
                    type: 'linear',
                    min: win.start,
                    max: win.end,
                    afterBuildTicks(axis) {
                        axis.ticks = ticks.map((tk) => ({ value: tk.value }));
                    },
                    ticks: {
                        autoSkip: false,
                        maxRotation: 0,
                        minRotation: 0,
                        color: ink.text,
                        font: chartFont(10),
                        callback: (value) => tickLabels.get(value) ?? '',
                    },
                    grid: { display: false },
                    border: { display: false },
                },
                y: {
                    min: 0,
                    max: 100,
                    ticks: {
                        stepSize: 25,
                        color: ink.text,
                        font: chartFont(10),
                        callback: (value) => (value === 0 ? '0' : value % 50 === 0 ? `${value}%` : ''),
                    },
                    grid: { color: ink.grid },
                    border: { display: false },
                },
                ...(datasets.some((d) => d.yAxisID === 'spend') ? {
                    spend: {
                        position: 'right',
                        min: 0,
                        grace: '10%',
                        ticks: {
                            color: ink.text,
                            font: chartFont(10),
                            maxTicksLimit: 4,
                            callback: (value) => formatCurrency(Math.round(value * 100), spend.currency).replace(/\.00$/, ''),
                        },
                        grid: { display: false },
                        border: { display: false },
                    },
                } : {}),
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: ink.tipBg,
                    titleColor: ink.tipInk,
                    bodyColor: ink.tipInk,
                    borderColor: ink.tipEdge,
                    borderWidth: 1,
                    cornerRadius: 8,
                    padding: 8,
                    boxWidth: 7,
                    boxHeight: 7,
                    usePointStyle: true,
                    titleFont: chartFont(11, '600'),
                    bodyFont: chartFont(11),
                    filter: (item) => item.parsed.y !== null,
                    callbacks: {
                        labelColor(item) {
                            return { borderColor: item.dataset.borderColor, backgroundColor: item.dataset.borderColor };
                        },
                        title(items) {
                            const x = items[0].parsed.x;
                            if (!perDay) {
                                return new Date(x).toLocaleTimeString(currentLocale(), { hour: '2-digit', minute: '2-digit', hour12: tf !== '24h' });
                            }
                            return new Date(x).toLocaleDateString(currentLocale(), { weekday: 'short', month: 'short', day: 'numeric' });
                        },
                        label(item) {
                            if (item.dataset.yAxisID === 'spend') {
                                return `${item.dataset.label}: ${formatCurrency(Math.round(item.parsed.y * 100), spend.currency)}`;
                            }
                            return `${item.dataset.label}: ${Math.round(item.parsed.y)}%`;
                        },
                    },
                },
            },
        },
    });
}

// B: one bar per bucket — its peak. The current bucket is marked and carries a hint;
// hours still ahead are faint stubs.
function renderBarChart(stats) {
    const ink = chartInk();
    const { buckets, period } = stats;
    const current = stats.currentIndex;
    const colours = buckets.map((b, i) => (i === current ? ink.weekly : b.future ? inkAlpha(ink.session, 0.1) : inkAlpha(ink.session, 0.55)));
    const n = buckets.length;
    const tickShown = (i) => {
        if (period === 'week') return true;
        if (period === 'day') return i % 6 === 0 || i === n - 1;
        return (n - 1 - i) % 5 === 0;
    };
    const tickText = (i) => {
        const b = buckets[i];
        if (period === 'day') {
            const h = new Date(b.start).getHours();
            const tf = (window._cachedSettings || {}).timeFormat || '12h';
            return tf === '24h' ? String(h).padStart(2, '0') : `${h % 12 || 12} ${h >= 12 ? 'PM' : 'AM'}`;
        }
        return period === 'week' ? dayLabel(b.start, 'weekday') : dayLabel(b.start, 'date');
    };

    // Keeps the hint over the current bucket whenever the pointer is not on the chart —
    // placed again after every update, so a resize never leaves it behind
    const pinCurrent = {
        id: 'pinCurrent',
        afterUpdate(chart) {
            if (!chart.$pointerIn) pinTooltip(chart, current);
        },
        afterEvent(chart, args) {
            const type = args.event.type;
            if (type === 'mousemove') chart.$pointerIn = true;
            if (type === 'mouseout') {
                chart.$pointerIn = false;
                if (pinTooltip(chart, current)) args.changed = true;
            }
        },
    };

    usageChart = new Chart(elements.usageChart.getContext('2d'), {
        type: 'bar',
        data: {
            labels: buckets.map((b, i) => String(i)),
            datasets: [{
                data: buckets.map((b) => (b.future ? 0 : b.peak ?? 0)),
                backgroundColor: colours,
                hoverBackgroundColor: colours,
                borderRadius: 3,
                minBarLength: 3,
                categoryPercentage: period === 'month' ? 0.74 : 0.8,
                barPercentage: 1,
            }],
        },
        options: {
            animation: false,
            responsive: true,
            maintainAspectRatio: false,
            layout: { padding: { top: 30 } }, // room for the hint above a full bar
            interaction: { intersect: false, mode: 'index' },
            scales: {
                x: {
                    grid: { display: false },
                    border: { display: false },
                    ticks: {
                        autoSkip: false,
                        maxRotation: 0,
                        minRotation: 0,
                        color: ink.text,
                        font: chartFont(10),
                        callback: (value, index) => (tickShown(index) ? tickText(index) : ''),
                    },
                },
                y: {
                    min: 0,
                    max: 100,
                    ticks: { display: false, stepSize: 50 },
                    grid: { color: ink.grid, drawTicks: false },
                    border: { display: false },
                },
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    // An inverted pill: light on dark, dark on light
                    backgroundColor: ink.pillBg,
                    bodyColor: ink.pillInk,
                    borderWidth: 0,
                    cornerRadius: 7,
                    padding: { x: 8, y: 5 },
                    caretSize: 0,
                    yAlign: 'bottom',
                    displayColors: false,
                    bodyFont: chartFont(11, '600'),
                    filter: (item) => !buckets[item.dataIndex].future,
                    callbacks: {
                        title: () => '',
                        label: (item) => {
                            const b = buckets[item.dataIndex];
                            return `${bucketLabel(b, period)} · ${b.peak === null ? '—' : fmtPct(b.peak)}`;
                        },
                    },
                },
            },
        },
        plugins: [pinCurrent],
    });
}

function pinTooltip(chart, index) {
    if (!chart || index < 0 || !chart.tooltip) return false;
    const bar = chart.getDatasetMeta(0).data[index];
    if (!bar) return false;
    chart.tooltip.setActiveElements([{ datasetIndex: 0, index }], { x: bar.x, y: bar.y });
    return true;
}

// C: three cards with a small line each, and a strip of bucket peaks
function renderStatsCards(stats) {
    const ink = chartInk();
    const upto = stats.currentIndex >= 0 ? stats.currentIndex : stats.buckets.length - 1;
    const shown = stats.buckets.slice(0, upto + 1);
    const cards = [
        { label: t('stats.peak'), value: fmtPct(stats.peak), series: shown.map((b) => b.peak ?? 0), colour: ink.session },
        { label: t('stats.average'), value: fmtPct(stats.avg), series: shown.map((b) => (b.n ? b.sum / b.n : 0)), colour: ink.weekly },
        { label: t('stats.active'), value: fmtDuration(stats.activeMs), series: shown.map((b) => b.activeMs), colour: ink.weekly },
    ];
    const n = stats.buckets.length;
    for (const card of cards) {
        const el = document.createElement('div');
        el.className = 'stats-card';
        const label = document.createElement('span');
        label.className = 'stats-card-label';
        label.textContent = card.label;
        const value = document.createElement('span');
        value.className = 'stats-card-value';
        value.textContent = card.value;
        el.append(label, value, sparkline(card.series, n, card.colour));
        elements.statsCards.appendChild(el);
    }

    const label = document.createElement('span');
    label.className = 'stats-heat-label';
    label.textContent = t(stats.period === 'day' ? 'stats.byHour' : 'stats.byDay');
    const cells = document.createElement('div');
    cells.className = 'stats-heat-cells';
    cells.style.gridTemplateColumns = `repeat(${n}, minmax(0, 1fr))`;
    stats.buckets.forEach((b) => {
        const cell = document.createElement('span');
        cell.className = 'heat-cell';
        if (b.future) cell.classList.add('future');
        else if (b.peak) cell.style.background = inkAlpha(ink.weekly, 0.16 + 0.84 * Math.min(b.peak, 100) / 100);
        if (b.current) cell.classList.add('current');
        cell.title = `${bucketLabel(b, stats.period)} · ${b.future ? '—' : fmtPct(b.peak)}`;
        cells.appendChild(cell);
    });
    elements.statsHeat.append(label, cells);
}

// A small line over the whole period's width, drawn up to now
function sparkline(series, slots, colour) {
    const W = 142;
    const H = 22;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'stats-spark');
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('preserveAspectRatio', 'none');
    const max = Math.max(...series, 0);
    const x = (i) => (slots > 1 ? (i / (slots - 1)) * W : W / 2);
    const y = (v) => (max > 0 ? H - 2 - (v / max) * (H - 4) : H - 2);
    const d = series.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(2)} ${y(v).toFixed(2)}`).join(' ');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', series.length === 1 ? `M0 ${y(series[0]).toFixed(2)} ${d.replace('M', 'L')}` : d);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', colour);
    path.setAttribute('stroke-width', '1.5');
    path.setAttribute('stroke-linejoin', 'round');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('vector-effect', 'non-scaling-stroke');
    svg.appendChild(path);
    return svg;
}

// Graph colours follow the theme: light lines on dark, deeper ones on white (the pastels
// that glow on dark wash out on a light window)
function chartInk() {
    const light = document.body.classList.contains('theme-light');
    return light
        ? {
            session: '#1d1d1f', weekly: '#5856d6', fable: '#0f9f7c', sonnet: '#d6336c', opus: '#b7791f',
            cowork: '#0a7fc2', design: '#7c4dff', oauth: '#6b7385', extra: '#f08c00',
            grid: 'rgba(0, 0, 0, 0.06)', text: 'rgba(29, 29, 31, 0.64)',
            tipBg: 'rgba(255, 255, 255, 0.97)', tipInk: '#1d1d1f', tipEdge: 'rgba(0, 0, 0, 0.1)',
            pillBg: '#1d1d1f', pillInk: '#ffffff'
        }
        : {
            session: '#f5f7fa', weekly: '#9fb4ff', fable: '#5fd4ae', sonnet: '#ff8fae', opus: '#f2c46d',
            cowork: '#62c8f5', design: '#c9a7ff', oauth: '#aab4c8', extra: '#ffb547',
            grid: 'rgba(255, 255, 255, 0.06)', text: 'rgba(245, 247, 250, 0.52)',
            tipBg: 'rgba(44, 44, 48, 0.97)', tipInk: '#f5f7fa', tipEdge: 'rgba(255, 255, 255, 0.12)',
            pillBg: '#f5f7fa', pillInk: '#1d1d1f'
        };
}

// '#rrggbb' at the given opacity — for the soft fill under the session line
function inkAlpha(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

// Spend gets its own money axis: as a share of the cap it can reach 500 % and would
// flatten every limit line down to the floor
// The cap is only fetched while the spend is on screen, so the last known one is kept
let knownSpendAxis = null;
function spendAxis() {
    const extra = latestUsageData?.extra_usage;
    if (extra && extra.limit_cents != null && extra.limit_cents > 0) {
        knownSpendAxis = { perPct: extra.limit_cents / 10000, currency: extra.currency };
    } else if (extra && extra.is_enabled === false) {
        knownSpendAxis = null;
    }
    return knownSpendAxis;
}

// Add spinning animation for refresh button
const style = document.createElement('style');
style.textContent = `
    @keyframes spin-refresh {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
    }
    
    .refresh-btn.spinning svg {
        animation: spin-refresh 1s linear infinite;
    }
`;
document.head.appendChild(style);

// ---------- Menu bar picture (macOS) ----------
// One status item with both numbers, drawn here on a canvas at 2x (36 px = 18 pt) in the
// system font with tabular digits, and handed to main.js as a PNG. Below the warn
// threshold it is a template image (black, dimmed parts by alpha) that macOS tints like
// its own icons; from the threshold on, the value that crossed it is drawn in colour for
// the current menu bar appearance and everything else in plain white or black.
const TRAY_STYLES = ['ring', 'bars', 'rings', 'ringsText'];
const TRAY_HEIGHT = 36;
const TRAY_FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", sans-serif';
const TRAY_ACCENTS = {
    dark: { warn: '#ffb340', danger: '#ff6259' },
    light: { warn: '#c26a00', danger: '#d70015' },
};
let trayCanvas = null;
let lastTrayPush = '';

function trayLevel(value) {
    return value >= dangerThreshold ? 'danger' : value >= warnThreshold ? 'warn' : null;
}

// Widest digit of the current font: every digit is drawn centred in a cell this wide
function digitCell(ctx) {
    let widest = 0;
    for (const d of '0123456789') widest = Math.max(widest, ctx.measureText(d).width);
    return widest;
}

function drawDigits(ctx, text, x, baseline, cell) {
    for (const ch of text) {
        const w = ctx.measureText(ch).width;
        ctx.fillText(ch, x + (cell - w) / 2, baseline);
        x += cell;
    }
    return x;
}

// Baseline that centres the digits on a line
function digitBaseline(ctx, centreY) {
    const m = ctx.measureText('0');
    return centreY + (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2;
}

function trayRing(ctx, cx, cy, r, lineWidth, share, colour, ink, comet) {
    ctx.lineWidth = lineWidth;
    ctx.globalAlpha = 0.32;
    ctx.strokeStyle = ink;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = colour;
    const top = -Math.PI / 2;
    if (comet !== undefined) {
        // Refreshing: a short comet, its tail in fading segments
        const length = 0.3;
        const parts = 6;
        for (let i = 0; i < parts; i++) {
            const from = comet - length + (length * i) / parts;
            const to = from + (length / parts) * (i === parts - 1 ? 1 : 0.8);
            ctx.globalAlpha = 0.14 + 0.86 * ((i + 1) / parts);
            ctx.lineCap = i === parts - 1 ? 'round' : 'butt';
            ctx.beginPath();
            ctx.arc(cx, cy, r, top + Math.PI * 2 * from, top + Math.PI * 2 * to);
            ctx.stroke();
        }
        ctx.globalAlpha = 1;
        return;
    }
    if (share <= 0) return;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(cx, cy, r, top, top + Math.PI * 2 * Math.min(share, 1));
    ctx.stroke();
}

function trayBar(ctx, x, cy, length, share, colour, ink, segment) {
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = ink;
    ctx.beginPath();
    ctx.roundRect(x, cy - 3, length, 6, 3);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = colour;
    let from = 0;
    let to = share;
    if (segment) [from, to] = segment; // refreshing: a short bright piece of the track
    else if (share <= 0) return;
    const w = Math.max(6, length * (to - from));
    ctx.beginPath();
    ctx.roundRect(x + length * from, cy - 3, Math.min(w, length - length * from), 6, 3);
    ctx.fill();
}

// o: { style, session, week, refreshing, template, ink, accents }
function drawTrayPicture(canvas, o) {
    const ctx = canvas.getContext('2d');
    const session = Math.round(Math.min(Math.max(o.session || 0, 0), 100));
    const week = Math.round(Math.min(Math.max(o.week || 0, 0), 100));
    const colourOf = (value) => {
        const level = trayLevel(value);
        return o.template || !level ? o.ink : o.accents[level];
    };
    const sColour = colourOf(session);
    const wColour = colourOf(week);
    const sText = String(session);
    const wText = String(week);
    const numbersAlpha = o.refreshing ? 0.45 : 1;
    const bigFont = `500 26px ${TRAY_FONT}`;
    const smallFont = `600 18px ${TRAY_FONT}`;
    const gap = 6;

    // Measure first: setting the canvas size resets the context
    ctx.font = bigFont;
    const bigCell = digitCell(ctx);
    const dotWidth = ctx.measureText('·').width;
    ctx.font = smallFont;
    const smallCell = digitCell(ctx);
    const stackWidth = Math.max(sText.length, wText.length) * smallCell;
    let width;
    if (o.style === 'bars') width = 41 + stackWidth + 2;
    else if (o.style === 'rings') width = 32;
    else if (o.style === 'ringsText') width = 39 + stackWidth + 2;
    else width = 38 + (sText.length + wText.length) * bigCell + gap * 2 + dotWidth + 2;
    canvas.width = Math.ceil(width / 2) * 2;
    canvas.height = TRAY_HEIGHT;

    const stacked = (x) => {
        ctx.font = smallFont;
        ctx.globalAlpha = numbersAlpha;
        ctx.fillStyle = sColour;
        drawDigits(ctx, sText, x, digitBaseline(ctx, 10.5), smallCell);
        ctx.fillStyle = wColour;
        drawDigits(ctx, wText, x, digitBaseline(ctx, 26.5), smallCell);
        ctx.globalAlpha = 1;
    };

    if (o.style === 'bars') {
        trayBar(ctx, 2, 10.5, 34, session / 100, sColour, o.ink, o.refreshing ? [0.22, 0.5] : null);
        trayBar(ctx, 2, 26.5, 34, week / 100, wColour, o.ink, o.refreshing ? [0.52, 0.8] : null);
        stacked(41);
    } else if (o.style === 'rings' || o.style === 'ringsText') {
        trayRing(ctx, 16, 18, 13, 3.4, session / 100, sColour, o.ink, o.refreshing ? 0.36 : undefined);
        trayRing(ctx, 16, 18, 6.6, 3.4, week / 100, wColour, o.ink, o.refreshing ? 0.86 : undefined);
        if (o.style === 'ringsText') stacked(39);
    } else {
        trayRing(ctx, 15, 18, 11.5, 3.6, session / 100, sColour, o.ink, o.refreshing ? 0.36 : undefined);
        ctx.font = bigFont;
        const baseline = digitBaseline(ctx, 18);
        ctx.globalAlpha = numbersAlpha;
        ctx.fillStyle = sColour;
        let x = drawDigits(ctx, sText, 38, baseline, bigCell) + gap;
        ctx.globalAlpha = 0.5 * numbersAlpha;
        ctx.fillStyle = o.ink;
        ctx.fillText('·', x, baseline);
        x += dotWidth + gap;
        ctx.globalAlpha = numbersAlpha;
        ctx.fillStyle = wColour;
        drawDigits(ctx, wText, x, baseline, bigCell);
        ctx.globalAlpha = 1;
    }
}

function currentTrayValues() {
    if (!latestUsageData) return null;
    return {
        session: latestUsageData.five_hour?.utilization || 0,
        week: latestUsageData.seven_day?.utilization || 0,
    };
}

// Draw and hand over the menu bar picture — only on a Mac, only while the numbers are on
function pushTrayImage(force = false) {
    if (window.electronAPI.platform !== 'darwin' || !window.electronAPI.setTrayImage) return;
    const sheetOpen = elements.settingsOverlay.style.display === 'flex';
    const on = !!(window._cachedSettings || {}).showTrayStats || (sheetOpen && elements.showTrayStatsToggle.checked);
    if (!on) return;
    const values = currentTrayValues();
    if (!values) return;
    const template = !trayLevel(values.session) && !trayLevel(values.week);
    trayCanvas = trayCanvas || document.createElement('canvas');
    drawTrayPicture(trayCanvas, {
        style: trayStyle,
        ...values,
        refreshing: trayRefreshing,
        template,
        ink: template || !menuBarDark ? '#000000' : '#ffffff',
        accents: TRAY_ACCENTS[menuBarDark ? 'dark' : 'light'],
    });
    const png = trayCanvas.toDataURL('image/png');
    const key = `${template}|${png}`;
    if (!force && key === lastTrayPush) return;
    lastTrayPush = key;
    window.electronAPI.setTrayImage({ png, template });
}

// Settings: each look drawn as it would appear, in the theme's ink
function drawTrayPreviews() {
    const light = document.body.classList.contains('theme-light');
    const values = currentTrayValues() || { session: 35, week: 12 };
    elements.trayStylePicker?.querySelectorAll('[data-tray-style]').forEach((btn) => {
        const canvas = btn.querySelector('canvas');
        if (!canvas) return;
        drawTrayPicture(canvas, {
            style: btn.dataset.trayStyle,
            ...values,
            refreshing: false,
            template: false,
            ink: light ? '#1d1d1f' : '#f5f7fa',
            accents: TRAY_ACCENTS[light ? 'light' : 'dark'],
        });
        canvas.style.width = `${canvas.width / 2}px`;
        canvas.style.height = `${TRAY_HEIGHT / 2}px`;
    });
}

// ---------- Looks: pickers, ring style, threshold ticks ----------
function markPicker(picker, key, value) {
    picker?.querySelectorAll('button').forEach((btn) => {
        const on = btn.dataset[key] === value;
        btn.classList.toggle('active', on);
        btn.setAttribute('aria-checked', String(on));
    });
}

function applyGaugeStyle(style) {
    gaugeStyle = style === 'concentric' ? 'concentric' : 'rings';
    document.body.classList.toggle('gauges-b', gaugeStyle === 'concentric');
    markPicker(elements.gaugeStylePicker, 'gaugeStyle', gaugeStyle);
}

// The menu bar row: a Mac-only choice, quiet while the numbers are off
function applyTrayStyleRowState() {
    const row = elements.trayStyleCol;
    if (!row) return;
    row.style.display = window.electronAPI.platform === 'darwin' ? '' : 'none';
    row.classList.toggle('settings-col-disabled', !elements.showTrayStatsToggle.checked);
}

// Two dots on each ring's track mark the warn and danger thresholds (the ring is turned
// by CSS so that angle 0 is twelve o'clock)
function placeThresholdTicks() {
    const place = (tick, pct) => {
        if (!tick) return;
        const angle = 2 * Math.PI * Math.min(Math.max(pct, 0), 100) / 100;
        tick.setAttribute('cx', (48 + 42 * Math.cos(angle)).toFixed(2));
        tick.setAttribute('cy', (48 + 42 * Math.sin(angle)).toFixed(2));
    };
    document.querySelectorAll('.gauge .ring').forEach((svg) => {
        place(svg.querySelector('.ring-tick-warn'), warnThreshold);
        place(svg.querySelector('.ring-tick-danger'), dangerThreshold);
    });
}

// Settings sheet height from its content: header, every visible group, footer
function settingsSheetHeight() {
    const content = elements.settingsOverlay.querySelector('.settings-content');
    const header = content.querySelector('.settings-header');
    const body = content.querySelector('.settings-body');
    const footer = content.querySelector('.settings-footer');
    // scrollHeight is the full content even while the window is still small
    return Math.ceil(header.getBoundingClientRect().height + body.scrollHeight + footer.getBoundingClientRect().height);
}

// Settings management
let warnThreshold = 75;
let dangerThreshold = 90;

async function loadSettings() {
    const settings = await window.electronAPI.getSettings();
    const isLinux = window.electronAPI.platform === 'linux';
    const isPortable = window.electronAPI.isPortable;
    const autoStartUnsupported = isLinux || isPortable;

    elements.autoStartToggle.checked = autoStartUnsupported ? false : settings.autoStart;
    elements.autoStartToggle.disabled = autoStartUnsupported;
    if (elements.autoStartCol) {
        elements.autoStartCol.classList.toggle('settings-col-disabled', autoStartUnsupported);
    }
    if (elements.autoStartHint) {
        elements.autoStartHint.style.display = autoStartUnsupported ? 'inline' : 'none';
        elements.autoStartHint.textContent = isPortable ? t('settings.noPortable') : t('settings.noLinux');
    }
    elements.minimizeToTrayToggle.checked = settings.minimizeToTray;
    elements.alwaysOnTopToggle.checked = settings.alwaysOnTop;
    elements.showTrayStatsToggle.checked = settings.showTrayStats || false;
    elements.warnThreshold.value = settings.warnThreshold;
    elements.dangerThreshold.value = settings.dangerThreshold;
    elements.languageSelect.value = settings.language || 'en';
    elements.timeFormat.value = settings.timeFormat || '12h';
    elements.weeklyDateFormat.value = settings.weeklyDateFormat || 'date';
    if (elements.refreshInterval) elements.refreshInterval.value = settings.refreshInterval || '300';
    elements.usageAlertsToggle.checked = settings.usageAlerts !== false;
    if (elements.compactModeToggle) elements.compactModeToggle.checked = !!settings.compactMode;

    // Populate org selector if user has organizations
    if (credentials.organizations && credentials.organizations.length > 0) {
        populateOrgSelector(credentials.organizations, credentials.organizationId);
    }

    warnThreshold = settings.warnThreshold;
    dangerThreshold = settings.dangerThreshold;

    elements.themeBtns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.theme === settings.theme);
    });

    applyTheme(settings.theme);
    if (window.electronAPI.platform === 'darwin') {
        applyTrayLabel();
    }

    // Looks
    trayStyle = TRAY_STYLES.includes(settings.trayStyle) ? settings.trayStyle : 'ring';
    statsStyle = STATS_STYLES.includes(settings.statsStyle) ? settings.statsStyle : 'line';
    applyGaugeStyle(settings.gaugeStyle);
    markPicker(elements.trayStylePicker, 'trayStyle', trayStyle);
    markPicker(elements.statsStylePicker, 'statsStyle', statsStyle);
    applyTrayStyleRowState();
    drawTrayPreviews();
}

async function saveSettings() {
    const activeThemeBtn = document.querySelector('.theme-btn.active');
    const warn = parseInt(elements.warnThreshold.value) || 75;
    const danger = parseInt(elements.dangerThreshold.value) || 90;

    warnThreshold = warn;
    dangerThreshold = danger;

    // Apply compact mode change first, then include in saved settings
    const compactToggleValue = elements.compactModeToggle.checked;
    if (compactToggleValue !== isCompactMode) {
        applyCompactMode(compactToggleValue);
    }

    const settings = {
        autoStart: (window.electronAPI.platform === 'linux' || window.electronAPI.isPortable) ? false : elements.autoStartToggle.checked,
        minimizeToTray: elements.minimizeToTrayToggle.checked,
        alwaysOnTop: elements.alwaysOnTopToggle.checked,
        showTrayStats: elements.showTrayStatsToggle.checked,
        theme: activeThemeBtn ? activeThemeBtn.dataset.theme : 'dark',
        warnThreshold: warn,
        dangerThreshold: danger,
        language: elements.languageSelect.value || 'en',
        timeFormat: elements.timeFormat.value || '12h',
        weeklyDateFormat: elements.weeklyDateFormat.value || 'date',
        refreshInterval: elements.refreshInterval ? (elements.refreshInterval.value || '300') : '300',
        usageAlerts: elements.usageAlertsToggle.checked,
        compactMode: isCompactMode,
        graphVisible: graphVisible,
        expandedOpen: isExpanded,
        compactSpendOpen: compactSpendOpen,
        trayStyle,
        gaugeStyle,
        statsStyle,
        statsPeriod
    };
    await window.electronAPI.saveSettings(settings);
    window._cachedSettings = settings;
    applyTheme(settings.theme);
    if (window.electronAPI.platform === 'darwin') {
        applyTrayLabel();
    }
    placeThresholdTicks();
    // The tray item may have just been created or rebuilt: always hand it a fresh picture
    pushTrayImage(true);
    if (graphVisible) renderStats();

    // Re-render resets-at values immediately with new format
    if (latestUsageData) {
        refreshTimers();
        // Rebuild extra rows to apply new threshold colors
        if (isExpanded) {
            buildExtraRows(latestUsageData);
            refreshExtraTimers();
        }
    }
    // Restart auto-update with new interval if it changed
    startAutoUpdate();
}

// ---------- Language ----------

function populateLanguageSelect() {
    if (elements.languageSelect.options.length) return;
    for (const lang of LANGUAGES) {
        const option = document.createElement('option');
        option.value = lang.code;
        option.textContent = lang.name;
        elements.languageSelect.appendChild(option);
    }
}

// 'Hide from Dock' on a Mac, 'Hide from taskbar' elsewhere — in the current language
function applyTrayLabel() {
    const label = document.getElementById('trayLabel');
    if (!label) return;
    label.dataset.i18n = window.electronAPI.platform === 'darwin' ? 'settings.hideDock' : 'settings.hideTaskbar';
    label.textContent = t(label.dataset.i18n);
}

// Date format picker shows real examples in the current language
function refreshDateOptions() {
    const sample = new Date(new Date().getFullYear(), 2, 13, 15, 59);
    const tf = elements.timeFormat.value || (window._cachedSettings || {}).timeFormat || '12h';
    const time = (d) => formatResetsAt(d.toISOString(), false, tf, 'date');
    for (const option of elements.weeklyDateFormat.options) {
        const base = formatDateSample(sample, option.value === 'date' ? 'date' : 'date-day', currentLocale(), time);
        option.textContent = option.value === 'date-day-time' ? t('date.withTime', { sample: base }) : base;
    }
}

// Switch every visible text to another language — static markup and everything
// app.js has already drawn (dates, countdowns, model rows, graph, org names)
function applyLanguage(lang) {
    setLanguage(lang);
    applyTrayLabel();
    refreshDateOptions();
    const version = elements.settingsVersionLabel.dataset.version;
    if (version) elements.settingsVersionLabel.textContent = t('settings.version', { v: version });
    applyCompactSpendRow();
    if (credentials && credentials.organizations && credentials.organizations.length > 0) {
        populateOrgSelector(credentials.organizations, credentials.organizationId);
    }
    if (latestUsageData) {
        refreshTimers();
        tickCountdowns();
        buildExtraRows(latestUsageData);
        if (isExpanded) refreshExtraTimers();
        if (graphVisible) loadChart();
    }
}

let themeSetting = 'dark';
const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');

function applyTheme(theme) {
    themeSetting = theme;
    // The window glass is native: main.js switches it to the same theme
    window.electronAPI.setTheme?.(theme);
    const useDark = theme === 'dark' || (theme === 'system' && darkQuery.matches);
    const changed = document.body.classList.contains('theme-light') === useDark;
    document.body.classList.toggle('theme-light', !useDark);
    // The chart paints its colours once — repaint it in the new ink
    if (changed && graphVisible && latestUsageData) {
        if (statsHistory.length) renderStats();
        else loadChart();
    }
    if (changed && elements.settingsOverlay.style.display === 'flex') drawTrayPreviews();
}

// 'Auto' follows macOS live, and settles once the native theme has switched over
darkQuery.addEventListener('change', () => {
    if (themeSetting === 'system') applyTheme('system');
});

// Update check
async function checkForUpdate() {
    try {
        const result = await window.electronAPI.checkForUpdate();
        if (!result.hasUpdate) return;

        const version = result.version;

        // Show banner and resize to compensate. resizeWidget() is normal-mode
        // only (it hardcodes WIDGET_WIDTH via the resize-window IPC channel),
        // so in compact mode re-assert compact bounds instead — main.js's
        // getCompactHeight() already accounts for the banner via
        // updateBannerVisible, set in the same check-for-update call above.
        // This build has its own design; the author's release would replace it, so instead
        // of a banner over the rings there is only a quiet line in Settings
        debugLog(`Upstream version available: v${version}`);

        // Populate settings panel link if already visible
        if (elements.settingsUpdateLink) {
            elements.settingsUpdateLink.textContent = t('settings.upstream', { v: version });
            elements.settingsUpdateLink.style.display = 'inline';
        }

        debugLog(`Update available: v${version}`);
    } catch (e) {
        debugLog('Update check failed silently', e);
    }
}

// Start the application
init();
window.addEventListener('beforeunload', () => {
    stopAutoUpdate();
    if (countdownInterval) clearInterval(countdownInterval);
    if (tickInterval) clearInterval(tickInterval);
});
