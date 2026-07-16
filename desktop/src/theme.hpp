// ============================================================================
//  Vault — application theme (Qt stylesheet). Dark + light, brand accent.
// ============================================================================
#pragma once
#include <QString>

namespace theme {

inline QString accent(const QString& mode) { return mode == "light" ? "#0f9b6c" : "#c8ff4d"; }
inline QString accent2(const QString& mode) { return mode == "light" ? "#0b7f86" : "#67e8f9"; }

inline QString qss(const QString& mode) {
    const bool light = (mode == "light");
    const QString bg    = light ? "#f2efe8" : "#0c0d10";
    const QString bg2   = light ? "#ffffff" : "#15171c";
    const QString bg3   = light ? "#eae5db" : "#1d2028";
    const QString line  = light ? "#e2dccf" : "#242832";
    const QString line2 = light ? "#cdc4b2" : "#333a46";
    const QString fg    = light ? "#191510" : "#e9ebf0";
    const QString fg2   = light ? "#6d6657" : "#8b929e";
    const QString acc   = accent(mode);
    const QString acc2  = accent2(mode);
    const QString onAcc = light ? "#ffffff" : "#0c0d10";

    return QString(R"QSS(
* { outline: none; }
QWidget { background: %BG%; color: %FG%; font-size: 14px;
  font-family: "Inter","Ubuntu","Noto Sans","Segoe UI",sans-serif; }
QToolTip { background: %BG2%; color: %FG%; border: 1px solid %LINE2%; padding: 5px 9px; border-radius: 8px; }

#sidebar { background: %BG2%; border-right: 1px solid %LINE%; }
#detail  { background: %BG2%; border-left: 1px solid %LINE%; }
#topbar  { background: %BG%; }

QLabel#h1 { font-size: 27px; font-weight: 800; }
QLabel#h2 { font-size: 19px; font-weight: 700; }
QLabel#muted { color: %FG2%; }
QLabel#label { color: %FG2%; font-size: 10px; font-weight: 700; letter-spacing: 1.3px; }
QLabel#mono, QLineEdit#mono { font-family: "JetBrains Mono","DejaVu Sans Mono",monospace; }
QLabel#code { font-family: "JetBrains Mono","DejaVu Sans Mono",monospace; font-size: 26px; font-weight: 700; color: %ACC%; letter-spacing: 2px; }
QLabel#pill { background: %BG3%; border: 1px solid %LINE%; border-radius: 999px; padding: 4px 12px; color: %FG2%; font-size: 12px; }

QLineEdit, QTextEdit, QPlainTextEdit, QComboBox, QSpinBox {
  background: %BG3%; color: %FG%; border: 1px solid %LINE2%; border-radius: 11px;
  padding: 9px 13px; selection-background-color: %ACC%; selection-color: %ONACC%; }
QLineEdit:focus, QTextEdit:focus, QComboBox:focus, QSpinBox:focus { border: 1px solid %ACC%; }
QLineEdit:hover, QComboBox:hover { border: 1px solid %LINE2%; }
QComboBox::drop-down { border: none; width: 26px; }
QComboBox QAbstractItemView { background: %BG2%; border: 1px solid %LINE2%; border-radius: 10px;
  selection-background-color: %ACC%; selection-color: %ONACC%; padding: 4px; }

QPushButton { background: %BG3%; color: %FG%; border: 1px solid %LINE2%; border-radius: 11px; padding: 9px 15px; font-weight: 500; }
QPushButton:hover { border-color: %ACC%; color: %ACC%; }
QPushButton:pressed { background: %LINE%; }
QPushButton#accent { background: qlineargradient(x1:0,y1:0,x2:1,y2:1, stop:0 %ACC%, stop:1 %ACC2%);
  color: %ONACC%; border: none; font-weight: 700; }
QPushButton#accent:hover { color: %ONACC%; }
QPushButton#ghost { background: transparent; border: none; color: %FG2%; padding: 6px; font-size: 15px; }
QPushButton#ghost:hover { color: %ACC%; background: %BG3%; }
QPushButton#danger { color: #ff6b6b; border-color: rgba(255,107,107,0.35); }
QPushButton#danger:hover { color: #ff6b6b; border-color: #ff6b6b; }
QPushButton#nav { background: transparent; border: none; text-align: left; padding: 10px 12px; border-radius: 11px; color: %FG2%; }
QPushButton#nav:hover { background: %BG3%; color: %FG%; }
QPushButton#nav:checked { background: qlineargradient(x1:0,y1:0,x2:1,y2:0, stop:0 rgba(200,255,77,0.16), stop:1 transparent); color: %ACC%; font-weight: 700; border-left: 2px solid %ACC%; }
QPushButton::menu-indicator { image: none; }

QListWidget { background: transparent; border: none; }
QListWidget::item { background: %BG2%; border: 1px solid %LINE%; border-radius: 14px; padding: 11px; margin: 3px 1px; }
QListWidget::item:hover { border-color: %LINE2%; }
QListWidget::item:selected { background: qlineargradient(x1:0,y1:0,x2:1,y2:0, stop:0 rgba(200,255,77,0.12), stop:1 %BG2%);
  border: 1px solid %ACC%; color: %FG%; }

QScrollBar:vertical { background: transparent; width: 10px; margin: 3px; }
QScrollBar::handle:vertical { background: %LINE2%; border-radius: 5px; min-height: 34px; }
QScrollBar::handle:vertical:hover { background: %FG2%; }
QScrollBar::add-line, QScrollBar::sub-line { height: 0; }
QScrollBar:horizontal { height: 0; }

QCheckBox::indicator { width: 19px; height: 19px; border-radius: 6px; border: 1px solid %LINE2%; background: %BG3%; }
QCheckBox::indicator:checked { background: %ACC%; border-color: %ACC%; }
QProgressBar { background: %BG3%; border: none; border-radius: 4px; height: 7px; }
QProgressBar::chunk { border-radius: 4px; }
QSlider::groove:horizontal { height: 6px; background: %BG3%; border-radius: 3px; }
QSlider::handle:horizontal { width: 18px; height: 18px; margin: -6px 0; border-radius: 9px;
  background: qlineargradient(x1:0,y1:0,x2:1,y2:1, stop:0 %ACC%, stop:1 %ACC2%); }
QSlider::sub-page:horizontal { background: %ACC%; border-radius: 3px; }
QMenu { background: %BG2%; border: 1px solid %LINE2%; border-radius: 10px; padding: 5px; }
QMenu::item { padding: 7px 22px; border-radius: 7px; }
QMenu::item:selected { background: %BG3%; color: %ACC%; }
QMenu::separator { height: 1px; background: %LINE%; margin: 4px 8px; }
QDialog { background: %BG%; }
)QSS")
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

}  // namespace theme
