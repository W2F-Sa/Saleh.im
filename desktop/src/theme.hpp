// ============================================================================
//  Vault — application theme engine (Qt stylesheet).
//
//  A curated registry of hand-tuned colour palettes — deep darks, warm lights
//  and everything between — each rendered into a complete Qt Style Sheet by a
//  single builder. Adding a theme is one line in palettes().
//
//  Every widget the app uses (buttons, lists, tables, tabs, sliders, tree,
//  group boxes, toolbars, menus…) is styled here so the whole surface stays
//  visually coherent no matter which palette is active.
// ============================================================================
#pragma once
#include <QColor>
#include <QString>
#include <QStringList>
#include <QVector>

namespace theme {

// A complete colour scheme. `dark` only drives a couple of highlight tweaks.
struct Palette {
    QString id;      // stable key persisted in settings
    QString name;    // human label shown in the picker
    QString group;   // "Dark" | "Light" — for grouping in the picker
    bool dark;
    QString bg;      // window background
    QString bg2;     // panels / cards
    QString bg3;     // inputs / raised chips
    QString line;    // hairlines
    QString line2;   // stronger borders
    QString fg;      // primary text
    QString fg2;     // muted text
    QString acc;     // brand accent
    QString acc2;    // secondary accent (gradients)
    QString onAcc;   // text/ink on top of the accent
};

// ---------------------------------------------------------------------------
//  The registry — 18 palettes. Order defines the picker layout.
// ---------------------------------------------------------------------------
inline const QVector<Palette>& palettes() {
    static const QVector<Palette> P = {
        // ---- Dark ----------------------------------------------------------
        {"carbon", "Carbon Lime", "Dark", true,
         "#0b0c0e", "#15171c", "#1d2028", "#242832", "#333a46", "#e9ebf0", "#8b929e",
         "#c8ff4d", "#67e8f9", "#0b0c0e"},
        {"obsidian", "Obsidian Violet", "Dark", true,
         "#0a0a0f", "#141420", "#1c1c2b", "#26263a", "#353552", "#ececf5", "#8b8ba6",
         "#a78bfa", "#f472b6", "#0a0a0f"},
        {"midnight", "Midnight Sky", "Dark", true,
         "#080d18", "#0f1626", "#161f33", "#1f2a42", "#2c3a58", "#e6edf7", "#8595b0",
         "#38bdf8", "#818cf8", "#050912"},
        {"nord", "Nord Frost", "Dark", true,
         "#242933", "#2e3440", "#3b4252", "#434c5e", "#4c566a", "#eceff4", "#a0aabb",
         "#88c0d0", "#81a1c1", "#22262e"},
        {"dracula", "Dracula", "Dark", true,
         "#21222c", "#282a36", "#343746", "#424458", "#565872", "#f8f8f2", "#a2a4b8",
         "#bd93f9", "#ff79c6", "#21222c"},
        {"gruvbox", "Gruvbox Ember", "Dark", true,
         "#1b1c1a", "#242320", "#32302c", "#3c3836", "#504945", "#f2e5bc", "#a89984",
         "#fabd2f", "#fe8019", "#1b1c1a"},
        {"forest", "Deep Forest", "Dark", true,
         "#0a1310", "#0f1c17", "#16271f", "#1e3329", "#2b4a3b", "#e4f0e9", "#87a397",
         "#4ade80", "#2dd4bf", "#08110d"},
        {"ember", "Ember Rose", "Dark", true,
         "#140c0e", "#1e1216", "#2a191f", "#382229", "#4d2f39", "#f6e7ec", "#b3909c",
         "#fb7185", "#fbbf24", "#140c0e"},
        {"solar-dark", "Solarized Dark", "Dark", true,
         "#002b36", "#073642", "#0a4048", "#0e4b55", "#586e75", "#eee8d5", "#93a1a1",
         "#2aa198", "#268bd2", "#002b36"},
        {"ocean", "Cyan Ocean", "Dark", true,
         "#07141c", "#0c1e29", "#122a38", "#193848", "#254e63", "#e3f1f7", "#84a7b8",
         "#22d3ee", "#34d399", "#04101a"},
        {"wine", "Crimson Wine", "Dark", true,
         "#160a10", "#1f0f18", "#2c1622", "#3a1e2d", "#50293c", "#f6e6ee", "#b592a3",
         "#f43f5e", "#a855f7", "#160a10"},
        {"mono-dark", "Graphite Mono", "Dark", true,
         "#0c0c0d", "#161617", "#1f1f21", "#2a2a2d", "#3a3a3e", "#ededf0", "#9a9aa1",
         "#e5e7eb", "#9ca3af", "#0c0c0d"},
        // ---- Light ---------------------------------------------------------
        {"paper", "Warm Paper", "Light", false,
         "#f2eee4", "#ffffff", "#eae5db", "#e2dccf", "#cdc4b2", "#191510", "#6d6657",
         "#e5432a", "#b4531f", "#ffffff"},
        {"solar-light", "Solarized Light", "Light", false,
         "#fdf6e3", "#fffdf5", "#f3ecd6", "#e9e2c9", "#d9d2b8", "#33403f", "#657b83",
         "#268bd2", "#2aa198", "#ffffff"},
        {"frost", "Frost Blue", "Light", false,
         "#eef2f8", "#ffffff", "#e4eaf3", "#d6deeb", "#c3cede", "#141a24", "#586a82",
         "#2563eb", "#0ea5e9", "#ffffff"},
        {"rose-quartz", "Rose Quartz", "Light", false,
         "#f8eef3", "#fffafc", "#f1e2ea", "#e7d3de", "#d8bccb", "#2a1620", "#8a6476",
         "#db2777", "#7c3aed", "#ffffff"},
        {"sand", "Desert Sand", "Light", false,
         "#efe9dd", "#fbf7ef", "#e6ddcb", "#d8ccb4", "#c4b593", "#241d10", "#7a6c52",
         "#b45309", "#0f766e", "#ffffff"},
        {"mint", "Fresh Mint", "Light", false,
         "#edf6f0", "#fbfffc", "#e0efe6", "#d0e6d8", "#b6d5c1", "#0f1f17", "#4f7563",
         "#059669", "#0284c7", "#ffffff"},
    };
    return P;
}

// Fallback-safe lookup. Accepts palette ids as well as the legacy
// "dark"/"light" values that older vaults persisted.
inline const Palette& paletteFor(const QString& id) {
    const auto& P = palettes();
    QString key = id;
    if (key == "dark") key = "carbon";
    else if (key == "light") key = "paper";
    for (const Palette& p : P)
        if (p.id == key) return p;
    return P.front();  // carbon
}

inline bool isDark(const QString& id) { return paletteFor(id).dark; }
inline QString accent(const QString& id) { return paletteFor(id).acc; }
inline QString accent2(const QString& id) { return paletteFor(id).acc2; }

// hex "#rrggbb" -> "rgba(r,g,b,a)" for translucent QSS fills.
inline QString rgba(const QString& hex, double a) {
    QColor c(hex);
    if (!c.isValid()) c = QColor("#888888");
    return QString("rgba(%1,%2,%3,%4)").arg(c.red()).arg(c.green()).arg(c.blue()).arg(a, 0, 'f', 3);
}

// Nudge a hex colour lighter (toward white) — used to fake a glassy top sheen.
inline QString lighten(const QString& hex, int amt) {
    QColor c(hex);
    if (!c.isValid()) return hex;
    return QColor(qMin(255, c.red() + amt), qMin(255, c.green() + amt), qMin(255, c.blue() + amt)).name();
}

// ---------------------------------------------------------------------------
//  Stylesheet builder — renders one Palette into a full Qt Style Sheet.
// ---------------------------------------------------------------------------
inline QString qssFor(const Palette& p) {
    const QString bg = p.bg, bg2 = p.bg2, bg3 = p.bg3;
    const QString line = p.line, line2 = p.line2;
    const QString fg = p.fg, fg2 = p.fg2;
    const QString acc = p.acc, acc2 = p.acc2, onAcc = p.onAcc;
    const QString accSoft = rgba(acc, 0.14);
    const QString accSoft2 = rgba(acc, 0.10);
    const QString accSoft3 = rgba(acc, 0.20);
    const QString topHi = p.dark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.55)";
    // soft vertical "glass" gradients — a lighter top edge fading into the base
    const QString cardBg = QString("qlineargradient(x1:0,y1:0,x2:0,y2:1, stop:0 %1, stop:1 %2)").arg(lighten(bg2, p.dark ? 9 : 5), bg2);
    const QString btnBg = QString("qlineargradient(x1:0,y1:0,x2:0,y2:1, stop:0 %1, stop:1 %2)").arg(lighten(bg3, p.dark ? 8 : 4), bg3);

    return QString(R"QSS(
* { outline: none; }
QWidget { background: %BG%; color: %FG%; font-size: 14px;
  font-family: "Inter","Ubuntu","Noto Sans","Segoe UI",sans-serif; }
QMainWindow, QDialog { background: %BG%; }
QToolTip { background: %BG2%; color: %FG%; border: 1px solid %LINE2%; padding: 6px 10px; border-radius: 10px; }

#sidebar { background: %BG2%; border-right: 1px solid %LINE%; }
#detail  { background: %BG2%; border-left: 1px solid %LINE%; }
#sidebarInner, #detailInner { background: %BG2%; }
#topbar  { background: %BG%; }
#card    { background: %CARDBG%; border: 1px solid %LINE%; border-radius: 18px; }
#hero    { background: qlineargradient(x1:0,y1:0,x2:1,y2:1, stop:0 %ACCSOFT%, stop:1 transparent);
           border: 1px solid %LINE%; border-radius: 18px; }

QLabel#h1 { font-size: 27px; font-weight: 800; }
QLabel#h2 { font-size: 19px; font-weight: 700; }
QLabel#h3 { font-size: 15px; font-weight: 700; }
QLabel#muted { color: %FG2%; }
QLabel#label { color: %FG2%; font-size: 10px; font-weight: 700; letter-spacing: 1.3px; }
QLabel#mono, QLineEdit#mono { font-family: "JetBrains Mono","DejaVu Sans Mono",monospace; }
QLabel#code { font-family: "JetBrains Mono","DejaVu Sans Mono",monospace; font-size: 26px; font-weight: 700; color: %ACC%; letter-spacing: 2px; }
QLabel#bigstat { font-size: 34px; font-weight: 800; color: %ACC%; }
QLabel#pill { background: %BG3%; border: 1px solid %LINE%; border-radius: 999px; padding: 4px 12px; color: %FG2%; font-size: 12px; }
QLabel#accentPill { background: %ACCSOFT%; border: 1px solid %ACC%; border-radius: 999px; padding: 4px 12px; color: %ACC%; font-size: 12px; font-weight: 700; }

QLineEdit, QTextEdit, QPlainTextEdit, QComboBox, QSpinBox, QDoubleSpinBox {
  background: %BG3%; color: %FG%; border: 1px solid %LINE2%; border-radius: 13px;
  padding: 10px 14px; selection-background-color: %ACC%; selection-color: %ONACC%; }
QLineEdit:focus, QTextEdit:focus, QPlainTextEdit:focus, QComboBox:focus, QSpinBox:focus, QDoubleSpinBox:focus { border: 1px solid %ACC%; }
QLineEdit:hover, QComboBox:hover, QSpinBox:hover { border: 1px solid %LINE2%; }
QLineEdit:disabled, QComboBox:disabled { color: %FG2%; }
QComboBox::drop-down { border: none; width: 26px; }
QComboBox::down-arrow { image: none; border-left: 4px solid transparent; border-right: 4px solid transparent;
  border-top: 5px solid %FG2%; margin-right: 10px; }
QComboBox QAbstractItemView { background: %BG2%; border: 1px solid %LINE2%; border-radius: 12px;
  selection-background-color: %ACC%; selection-color: %ONACC%; padding: 5px; }
QSpinBox::up-button, QSpinBox::down-button, QDoubleSpinBox::up-button, QDoubleSpinBox::down-button { width: 0; border: none; }

QPushButton { background: %BTNBG%; color: %FG%; border: 1px solid %LINE2%; border-radius: 13px; padding: 10px 16px; font-weight: 500; }
QPushButton:hover { border-color: %ACC%; color: %ACC%; }
QPushButton:pressed { background: %LINE%; }
QPushButton:disabled { color: %FG2%; border-color: %LINE%; }
QPushButton#accent { background: qlineargradient(x1:0,y1:0,x2:1,y2:1, stop:0 %ACC%, stop:1 %ACC2%);
  color: %ONACC%; border: none; font-weight: 700; }
QPushButton#accent:hover { color: %ONACC%; }
QPushButton#accent:disabled { background: %BG3%; color: %FG2%; }
QPushButton#ghost { background: transparent; border: none; color: %FG2%; padding: 6px; font-size: 15px; }
QPushButton#ghost:hover { color: %ACC%; background: %BG3%; }
QPushButton#ghost:checked { color: %ACC%; background: %ACCSOFT%; }
QPushButton#danger { color: #ff6b6b; border-color: rgba(255,107,107,0.35); }
QPushButton#danger:hover { color: #ff6b6b; border-color: #ff6b6b; background: rgba(255,107,107,0.10); }
QPushButton#chip { background: %BG3%; border: 1px solid %LINE%; border-radius: 999px; padding: 5px 13px; color: %FG2%; font-size: 12px; }
QPushButton#chip:hover { border-color: %ACC%; color: %ACC%; }
QPushButton#chip:checked { background: %ACCSOFT%; border-color: %ACC%; color: %ACC%; font-weight: 700; }
QPushButton#nav { background: transparent; border: none; text-align: left; padding: 10px 12px; border-radius: 13px; color: %FG2%; }
QPushButton#nav:hover { background: %BG3%; color: %FG%; }
QPushButton#nav:checked { background: qlineargradient(x1:0,y1:0,x2:1,y2:0, stop:0 %ACCSOFT%, stop:1 transparent); color: %ACC%; font-weight: 700; border-left: 2px solid %ACC%; }
QPushButton#swatch { border-radius: 12px; min-height: 54px; }
QPushButton#swatch:checked { border: 2px solid %ACC%; }
QPushButton::menu-indicator { image: none; }
QToolButton { background: transparent; border: none; border-radius: 9px; padding: 6px; color: %FG2%; }
QToolButton:hover { background: %BG3%; color: %ACC%; }

QListWidget, QTreeWidget, QTableWidget { background: transparent; border: none; }
QListWidget::item { background: %CARDBG%; border: 1px solid %LINE%; border-radius: 16px; padding: 12px; margin: 3px 1px; }
QListWidget::item:hover { border-color: %LINE2%; }
QListWidget::item:selected { background: qlineargradient(x1:0,y1:0,x2:1,y2:0, stop:0 %ACCSOFT%, stop:1 %BG2%);
  border: 1px solid %ACC%; color: %FG%; }

QTreeWidget::item { padding: 6px 4px; border-radius: 8px; }
QTreeWidget::item:hover { background: %BG3%; }
QTreeWidget::item:selected { background: %ACCSOFT%; color: %ACC%; }
QTreeWidget::branch { background: transparent; }
QHeaderView::section { background: %BG3%; color: %FG2%; border: none; border-bottom: 1px solid %LINE2%;
  padding: 8px 10px; font-size: 11px; font-weight: 700; letter-spacing: 0.6px; }
QTableWidget { gridline-color: %LINE%; }
QTableWidget::item { padding: 8px 10px; border-bottom: 1px solid %LINE%; }
QTableWidget::item:selected { background: %ACCSOFT%; color: %FG%; }
QTableCornerButton::section { background: %BG3%; border: none; }

QTabWidget::pane { border: 1px solid %LINE%; border-radius: 14px; top: -1px; background: %BG2%; }
QTabBar::tab { background: transparent; color: %FG2%; padding: 9px 18px; margin-right: 4px;
  border-top-left-radius: 10px; border-top-right-radius: 10px; font-weight: 600; }
QTabBar::tab:hover { color: %FG%; }
QTabBar::tab:selected { color: %ACC%; background: %BG2%; border-bottom: 2px solid %ACC%; }

QGroupBox { border: 1px solid %LINE%; border-radius: 18px; margin-top: 16px; padding: 16px 14px 14px 14px; background: %CARDBG%; }
QGroupBox::title { subcontrol-origin: margin; left: 14px; padding: 2px 8px; color: %FG2%;
  font-size: 10px; font-weight: 700; letter-spacing: 1.2px; }

QScrollBar:vertical { background: transparent; width: 10px; margin: 3px; }
QScrollBar::handle:vertical { background: %LINE2%; border-radius: 5px; min-height: 34px; }
QScrollBar::handle:vertical:hover { background: %FG2%; }
QScrollBar::add-line, QScrollBar::sub-line { height: 0; }
QScrollBar:horizontal { height: 10px; margin: 3px; background: transparent; }
QScrollBar::handle:horizontal { background: %LINE2%; border-radius: 5px; min-width: 34px; }
QScrollBar::handle:horizontal:hover { background: %FG2%; }

QCheckBox::indicator, QRadioButton::indicator { width: 19px; height: 19px; border: 1px solid %LINE2%; background: %BG3%; }
QCheckBox::indicator { border-radius: 6px; }
QRadioButton::indicator { border-radius: 10px; }
QCheckBox::indicator:checked, QRadioButton::indicator:checked { background: %ACC%; border-color: %ACC%; }
QCheckBox::indicator:hover, QRadioButton::indicator:hover { border-color: %ACC%; }

QProgressBar { background: %BG3%; border: none; border-radius: 4px; height: 7px; text-align: center; }
QProgressBar::chunk { border-radius: 4px; background: %ACC%; }
QSlider::groove:horizontal { height: 6px; background: %BG3%; border-radius: 3px; }
QSlider::handle:horizontal { width: 18px; height: 18px; margin: -6px 0; border-radius: 9px;
  background: qlineargradient(x1:0,y1:0,x2:1,y2:1, stop:0 %ACC%, stop:1 %ACC2%); }
QSlider::sub-page:horizontal { background: %ACC%; border-radius: 3px; }

QMenu { background: %BG2%; border: 1px solid %LINE2%; border-radius: 14px; padding: 6px; }
QMenu::item { padding: 7px 22px; border-radius: 7px; }
QMenu::item:selected { background: %BG3%; color: %ACC%; }
QMenu::separator { height: 1px; background: %LINE%; margin: 4px 8px; }
QMenu::icon { padding-left: 8px; }

QToolBar { background: %BG2%; border: none; border-bottom: 1px solid %LINE%; padding: 6px; spacing: 6px; }
QStatusBar { background: %BG2%; color: %FG2%; border-top: 1px solid %LINE%; }
QStatusBar::item { border: none; }
QSplitter::handle { background: %LINE%; }
QSplitter::handle:hover { background: %ACC%; }
)QSS")
        .replace("%CARDBG%", cardBg)
        .replace("%BTNBG%", btnBg)
        .replace("%ACCSOFT3%", accSoft3)
        .replace("%ACCSOFT2%", accSoft2)
        .replace("%ACCSOFT%", accSoft)
        .replace("%TOPHI%", topHi)
        .replace("%BG3%", bg3)
        .replace("%BG2%", bg2)
        .replace("%BG%", bg)
        .replace("%LINE2%", line2)
        .replace("%LINE%", line)
        .replace("%FG2%", fg2)
        .replace("%FG%", fg)
        .replace("%ACC2%", acc2)
        .replace("%ACC%", acc)
        .replace("%ONACC%", onAcc);
}

// Convenience: build a stylesheet directly from a theme id (or legacy mode).
inline QString qss(const QString& id) { return qssFor(paletteFor(id)); }

}  // namespace theme
