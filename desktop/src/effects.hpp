// ============================================================================
//  Vault — lightweight visual effects: soft drop shadows + fade-in animation.
// ============================================================================
#pragma once
#include <QColor>
#include <QGraphicsDropShadowEffect>
#include <QGraphicsOpacityEffect>
#include <QPropertyAnimation>
#include <QWidget>

namespace fx {

// A soft, elevated drop shadow.
inline void shadow(QWidget* w, int blur = 42, int dy = 14, int alpha = 90) {
    if (!w) return;
    auto* e = new QGraphicsDropShadowEffect(w);
    e->setBlurRadius(blur);
    e->setOffset(0, dy);
    e->setColor(QColor(0, 0, 0, alpha));
    w->setGraphicsEffect(e);
}

// Fade a widget in (used for windows and the detail pane).
inline void fadeIn(QWidget* w, int ms = 220) {
    if (!w) return;
    auto* e = new QGraphicsOpacityEffect(w);
    w->setGraphicsEffect(e);
    auto* a = new QPropertyAnimation(e, "opacity", w);
    a->setDuration(ms);
    a->setStartValue(0.0);
    a->setEndValue(1.0);
    a->setEasingCurve(QEasingCurve::OutCubic);
    QObject::connect(a, &QPropertyAnimation::finished, w, [w] { w->setGraphicsEffect(nullptr); });
    a->start(QAbstractAnimation::DeleteWhenStopped);
}

}  // namespace fx
