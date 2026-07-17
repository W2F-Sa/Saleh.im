#include "mainwindow.hpp"

#include <QApplication>
#include <QCloseEvent>
#include <QClipboard>
#include <QComboBox>
#include <QDateTime>
#include <QDesktopServices>
#include <QEvent>
#include <QFile>
#include <QFileDialog>
#include <QFileInfo>
#include <QFrame>
#include <QGridLayout>
#include <QHBoxLayout>
#include <QIcon>
#include <QKeySequence>
#include <QLabel>
#include <QLineEdit>
#include <QListWidget>
#include <QListWidgetItem>
#include <QMenu>
#include <QMenuBar>
#include <QMessageBox>
#include <QPainter>
#include <QPainterPath>
#include <QPixmap>
#include <QProcess>
#include <QPushButton>
#include <QScrollArea>
#include <QShortcut>
#include <QVariantAnimation>
#include <QSize>
#include <QSystemTrayIcon>
#include <QTimer>
#include <QUrl>
#include <QVBoxLayout>

#include <algorithm>
#include <functional>

#include "authdialog.hpp"
#include "commandpalette.hpp"
#include "crypto.hpp"
#include "dialogs.hpp"
#include "effects.hpp"
#include "extradialogs.hpp"
#include "generator.hpp"
#include "theme.hpp"

static QColor entryColor(const vault::Entry& e) {
    if (!e.color.isEmpty()) return QColor(e.color);
    return QColor(vault::typeInfo(e.type).color);
}
static QString entryIcon(const vault::Entry& e) {
    return e.iconEmoji.isEmpty() ? vault::typeIcon(e.type) : e.iconEmoji;
}

// Crisp monochrome line-icons painted with QPainter — a professional,
// theme-tintable alternative to emoji in the toolbar.
static QIcon lineIcon(const QString& name, const QColor& color, int px = 18) {
    QPixmap pm(px, px);
    pm.fill(Qt::transparent);
    QPainter g(&pm);
    g.setRenderHint(QPainter::Antialiasing);
    QPen pen(color, 1.7);
    pen.setCapStyle(Qt::RoundCap);
    pen.setJoinStyle(Qt::RoundJoin);
    g.setPen(pen);
    g.setBrush(Qt::NoBrush);
    const qreal s = px;
    auto line = [&](qreal x1, qreal y1, qreal x2, qreal y2) { g.drawLine(QPointF(x1 * s, y1 * s), QPointF(x2 * s, y2 * s)); };
    auto dot = [&](qreal x, qreal y, qreal r) { g.setBrush(color); g.drawEllipse(QPointF(x * s, y * s), r * s, r * s); g.setBrush(Qt::NoBrush); };
    if (name == "command") {
        QPainterPath p; p.addRoundedRect(QRectF(0.12 * s, 0.12 * s, 0.76 * s, 0.76 * s), 0.16 * s, 0.16 * s); g.drawPath(p);
        line(0.32, 0.36, 0.46, 0.5); line(0.46, 0.5, 0.32, 0.64); line(0.54, 0.64, 0.7, 0.64);
    } else if (name == "dice") {
        QPainterPath p; p.addRoundedRect(QRectF(0.14 * s, 0.14 * s, 0.72 * s, 0.72 * s), 0.18 * s, 0.18 * s); g.drawPath(p);
        dot(0.34, 0.34, 0.05); dot(0.66, 0.34, 0.05); dot(0.5, 0.5, 0.05); dot(0.34, 0.66, 0.05); dot(0.66, 0.66, 0.05);
    } else if (name == "chart") {
        g.setBrush(color); g.setPen(Qt::NoPen);
        auto bar = [&](qreal x, qreal top) { QPainterPath p; p.addRoundedRect(QRectF(x * s, top * s, 0.16 * s, (0.84 - top) * s), 0.03 * s, 0.03 * s); g.drawPath(p); };
        bar(0.16, 0.52); bar(0.42, 0.28); bar(0.68, 0.42);
    } else if (name == "shield") {
        QPainterPath p; p.moveTo(0.5 * s, 0.12 * s); p.lineTo(0.84 * s, 0.24 * s); p.lineTo(0.84 * s, 0.5 * s);
        p.quadTo(0.84 * s, 0.78 * s, 0.5 * s, 0.9 * s); p.quadTo(0.16 * s, 0.78 * s, 0.16 * s, 0.5 * s);
        p.lineTo(0.16 * s, 0.24 * s); p.closeSubpath(); g.drawPath(p);
    } else if (name == "dots") {
        dot(0.24, 0.5, 0.07); dot(0.5, 0.5, 0.07); dot(0.76, 0.5, 0.07);
    } else if (name == "lock") {
        QPainterPath p; p.addRoundedRect(QRectF(0.22 * s, 0.44 * s, 0.56 * s, 0.44 * s), 0.09 * s, 0.09 * s); g.drawPath(p);
        QPainterPath a; a.moveTo(0.32 * s, 0.44 * s); a.lineTo(0.32 * s, 0.34 * s);
        a.arcTo(QRectF(0.32 * s, 0.16 * s, 0.36 * s, 0.36 * s), 180, -180); a.lineTo(0.68 * s, 0.44 * s); g.drawPath(a);
        dot(0.5, 0.63, 0.045);
    } else if (name == "browser") {
        g.drawEllipse(QRectF(0.14 * s, 0.14 * s, 0.72 * s, 0.72 * s));
        line(0.14, 0.5, 0.86, 0.5);
        QPainterPath m; m.moveTo(0.5 * s, 0.14 * s); m.quadTo(0.28 * s, 0.5 * s, 0.5 * s, 0.86 * s); m.quadTo(0.72 * s, 0.5 * s, 0.5 * s, 0.14 * s); g.drawPath(m);
    }
    g.end();
    return QIcon(pm);
}

MainWindow::MainWindow(const QString& path, const QString& password, const QByteArray& keyfile,
                       const QString& kdfPreset, const vault::Data& data, QWidget* parent)
    : QMainWindow(parent), path_(path), password_(password), keyfile_(keyfile),
      kdfPreset_(kdfPreset), data_(data) {
    setWindowTitle("Vault");
    resize(1200, 800);
    filter_ = data_.settings.startupView.isEmpty() ? "all" : data_.settings.startupView;
    buildUi();
    buildMenuBar();
    buildTray();
    installShortcuts();
    rebuildSidebar();
    rebuildList();

    idleTimer_ = new QTimer(this);
    idleTimer_->setSingleShot(true);
    connect(idleTimer_, &QTimer::timeout, this, &MainWindow::lock);
    auto resetIdle = [this] {
        if (data_.settings.autoLockMinutes > 0)
            idleTimer_->start(data_.settings.autoLockMinutes * 60 * 1000);
        else
            idleTimer_->stop();
    };
    resetIdle();
    qApp->installEventFilter(this);

    totpTimer_ = new QTimer(this);
    connect(totpTimer_, &QTimer::timeout, this, [this] {
        if (totpLabel_ && !totpSecretForDetail_.isEmpty()) {
            vc::OtpAuth p = vc::parseOtpAuth(totpSecretForDetail_.toStdString());
            if (!p.secret.empty()) {
                int rem = 0;
                std::string c = vc::totp(p.secret, QDateTime::currentSecsSinceEpoch(), p.digits, p.period, rem);
                QString pretty = QString::fromStdString(c);
                if (pretty.size() == 6) pretty = pretty.left(3) + " " + pretty.mid(3);
                totpLabel_->setText(QString("%1   (%2s)").arg(pretty).arg(rem));
            }
        }
    });
    totpTimer_->start(1000);

    clipTimer_ = new QTimer(this);
    clipTimer_->setSingleShot(true);
    connect(clipTimer_, &QTimer::timeout, this, [this] {
        if (!lastClip_.isEmpty() && QApplication::clipboard()->text() == lastClip_)
            QApplication::clipboard()->clear();
        lastClip_.clear();
    });

    revealTimer_ = new QTimer(this);
    revealTimer_->setSingleShot(true);
    connect(revealTimer_, &QTimer::timeout, this, [this] {
        if (reveal_) { reveal_ = false; showDetail(selectedId_); }
    });

    applyTheme(data_.settings.theme);
    updateStats();

    // smooth window fade-in
    setWindowOpacity(0.0);
    auto* wa = new QPropertyAnimation(this, "windowOpacity", this);
    wa->setDuration(240);
    wa->setStartValue(0.0);
    wa->setEndValue(1.0);
    wa->setEasingCurve(QEasingCurve::OutCubic);
    wa->start(QAbstractAnimation::DeleteWhenStopped);
}

QIcon MainWindow::avatarFor(const vault::Entry& e) const {
    QPixmap pm(40, 40);
    pm.fill(Qt::transparent);
    QPainter p(&pm);
    p.setRenderHint(QPainter::Antialiasing);
    QColor c = entryColor(e);
    QColor bg = c;
    bg.setAlpha(38);
    QPainterPath path;
    path.addRoundedRect(2, 2, 36, 36, 11, 11);
    p.fillPath(path, bg);
    p.setPen(QPen(c, 1.4));
    p.drawPath(path);
    p.setPen(c);
    QFont f = p.font();
    f.setPixelSize(18);
    p.setFont(f);
    p.drawText(QRect(2, 2, 36, 36), Qt::AlignCenter, entryIcon(e));
    p.end();
    return QIcon(pm);
}

// ---------------------------------------------------------------------------
// UI
// ---------------------------------------------------------------------------
void MainWindow::buildUi() {
    auto* central = new QWidget(this);
    auto* h = new QHBoxLayout(central);
    h->setContentsMargins(0, 0, 0, 0);
    h->setSpacing(0);

    // sidebar (scrollable — it now holds all types, folders and tags)
    auto* sideScroll = new QScrollArea(central);
    sideScroll->setObjectName("sidebar");
    sideScroll->setWidgetResizable(true);
    sideScroll->setFixedWidth(224);
    sideScroll->setFrameShape(QFrame::NoFrame);
    sideScroll->setHorizontalScrollBarPolicy(Qt::ScrollBarAlwaysOff);
    sidebar_ = new QWidget();
    sidebar_->setObjectName("sidebarInner");
    sidebarLayout_ = new QVBoxLayout(sidebar_);
    sidebarLayout_->setContentsMargins(10, 14, 10, 14);
    sidebarLayout_->setSpacing(2);
    sideScroll->setWidget(sidebar_);
    h->addWidget(sideScroll);

    // middle column
    auto* mid = new QWidget(central);
    auto* mv = new QVBoxLayout(mid);
    mv->setContentsMargins(14, 12, 14, 12);
    mv->setSpacing(10);

    auto* top = new QHBoxLayout();
    searchEdit_ = new QLineEdit(mid);
    searchEdit_->setPlaceholderText("Search vault…   (Ctrl+F)");
    searchEdit_->setClearButtonEnabled(true);
    connect(searchEdit_, &QLineEdit::textChanged, this, [this](const QString& t) {
        search_ = t;
        rebuildList();
    });
    top->addWidget(searchEdit_, 1);

    sortCombo_ = new QComboBox(mid);
    sortCombo_->addItem("Recent", "used");
    sortCombo_->addItem("Updated", "updated");
    sortCombo_->addItem("Created", "created");
    sortCombo_->addItem("Title", "title");
    sortCombo_->setToolTip("Sort");
    connect(sortCombo_, QOverload<int>::of(&QComboBox::currentIndexChanged), this, [this] { rebuildList(); });
    top->addWidget(sortCombo_);

    auto* newBtn = new QPushButton("＋ New", mid);
    newBtn->setObjectName("accent");
    auto* newMenu = new QMenu(newBtn);
    QString lastGroup;
    for (const auto& ty : vault::types()) {
        QString id = ty.id;
        newMenu->addAction(ty.icon + "  " + ty.label, this, [this, id] { newEntry(id); });
    }
    newBtn->setMenu(newMenu);
    top->addWidget(newBtn);
    fx::pulseGlow(newBtn, QColor(theme::accent(data_.settings.theme)), 8, 24, 2400);

    const QColor icoCol(theme::paletteFor(data_.settings.theme).fg2);
    auto tbtn = [&](const QString& icon, const QString& label, const QString& tip, auto slot) {
        auto* b = new QPushButton("  " + label, mid);
        b->setIcon(lineIcon(icon, icoCol, 17));
        b->setToolTip(tip);
        connect(b, &QPushButton::clicked, this, slot);
        top->addWidget(b);
        toolIcons_.append({b, icon});
        return b;
    };
    tbtn("command", "Palette", "Command palette (Ctrl+K)", [this] { openCommandPalette(); });
    tbtn("dice", "Generate", "Password generator (Ctrl+G)", [this] { openGenerator(); });
    tbtn("chart", "Stats", "Dashboard (Ctrl+D)", [this] { openStats(); });
    tbtn("shield", "Audit", "Security audit", [this] { openAudit(); });

    auto* moreBtn = new QPushButton("  More", mid);
    moreBtn->setIcon(lineIcon("dots", icoCol, 17));
    moreBtn->setToolTip("More");
    toolIcons_.append({moreBtn, "dots"});
    auto* moreMenu = new QMenu(moreBtn);
    moreMenu->addAction("Import from browsers…", this, [this] { importFromBrowsers(); });
    moreMenu->addAction("Import file…", this, [this] { importItems(); });
    moreMenu->addAction("Export items…", this, [this] { exportItems(); });
    moreMenu->addSeparator();
    moreMenu->addAction("Choose theme…", this, [this] { pickTheme(); });
    moreMenu->addAction("Manage folders…", this, &MainWindow::manageFolders);
    moreMenu->addAction("Settings", this, [this] { openSettings(); });
    moreMenu->addAction("About Vault", this, [this] { openAbout(); });
    moreBtn->setMenu(moreMenu);
    top->addWidget(moreBtn);

    tbtn("lock", "Lock", "Lock (Ctrl+L)", [this] { lock(); });
    mv->addLayout(top);

    crumbLabel_ = new QLabel(mid);
    crumbLabel_->setObjectName("h3");
    mv->addWidget(crumbLabel_);

    statsLabel_ = new QLabel(mid);
    statsLabel_->setObjectName("muted");
    mv->addWidget(statsLabel_);

    list_ = new QListWidget(mid);
    list_->setSpacing(2);
    list_->setIconSize(QSize(38, 38));
    list_->setContextMenuPolicy(Qt::CustomContextMenu);
    connect(list_, &QListWidget::customContextMenuRequested, this, &MainWindow::listContextMenu);
    connect(list_, &QListWidget::currentItemChanged, this, [this](QListWidgetItem* it) {
        if (it) showDetail(it->data(Qt::UserRole).toString());
    });
    connect(list_, &QListWidget::itemDoubleClicked, this, [this](QListWidgetItem* it) {
        if (it) editEntry(it->data(Qt::UserRole).toString());
    });
    mv->addWidget(list_, 1);
    h->addWidget(mid, 1);

    // detail
    auto* scroll = new QScrollArea(central);
    scroll->setObjectName("detail");
    scroll->setWidgetResizable(true);
    scroll->setFixedWidth(392);
    scroll->setFrameShape(QFrame::NoFrame);
    detail_ = new QWidget();
    detail_->setObjectName("detailInner");
    detailLayout_ = new QVBoxLayout(detail_);
    detailLayout_->setContentsMargins(20, 20, 20, 20);
    detailLayout_->setSpacing(10);
    detailLayout_->addStretch();
    scroll->setWidget(detail_);
    h->addWidget(scroll);

    setCentralWidget(central);
}

void MainWindow::buildMenuBar() {
    auto* mb = menuBar();

    auto* file = mb->addMenu("&File");
    auto* newMenu = file->addMenu("New item");
    for (const auto& ty : vault::types()) {
        QString id = ty.id;
        newMenu->addAction(ty.icon + "  " + ty.label, this, [this, id] { newEntry(id); });
    }
    file->addSeparator();
    file->addAction("Import from browsers…", this, [this] { importFromBrowsers(); });
    file->addAction("Import file…", this, [this] { importItems(); });
    file->addAction("Export…", this, [this] { exportItems(); });
    file->addAction("Encrypted backup…", this, &MainWindow::exportBackup);
    file->addSeparator();
    file->addAction("Lock", QKeySequence("Ctrl+L"), this, &MainWindow::lock);
    file->addAction("Quit", QKeySequence("Ctrl+Q"), this, [this] { quitting_ = true; qApp->quit(); });

    auto* view = mb->addMenu("&View");
    auto jump = [this](const QString& key) { filter_ = key; rebuildSidebar(); rebuildList(); };
    view->addAction("All items", this, [jump] { jump("all"); });
    view->addAction("Favorites", this, [jump] { jump("favorites"); });
    view->addAction("Recently used", this, [jump] { jump("recent"); });
    view->addSeparator();
    view->addAction("Trash", this, [jump] { jump("trash"); });
    view->addAction("Empty Trash…", this, &MainWindow::emptyTrash);
    view->addSeparator();
    view->addAction("Command palette", QKeySequence("Ctrl+K"), this, &MainWindow::openCommandPalette);

    auto* tools = mb->addMenu("&Tools");
    tools->addAction("Password generator", QKeySequence("Ctrl+G"), this, &MainWindow::openGenerator);
    tools->addAction("Security audit", this, &MainWindow::openAudit);
    tools->addAction("Dashboard", QKeySequence("Ctrl+D"), this, &MainWindow::openStats);
    tools->addSeparator();
    tools->addAction("Manage folders…", this, &MainWindow::manageFolders);
    tools->addAction("Choose theme…", this, &MainWindow::pickTheme);
    tools->addAction("Change master password…", this, &MainWindow::changeMaster);
    tools->addSeparator();
    tools->addAction("Settings", this, &MainWindow::openSettings);

    auto* help = mb->addMenu("&Help");
    help->addAction("About Vault", this, &MainWindow::openAbout);
    help->addAction("Open vault folder", this, &MainWindow::openVaultFolder);
}

void MainWindow::manageFolders() {
    FolderManagerDialog d(data_.folders, this);
    if (d.exec() != QDialog::Accepted) return;
    QVector<vault::Folder> updated = d.folders();
    // any entries whose folder was removed fall back to "no folder"
    QStringList ids;
    for (const auto& f : updated) ids << f.id;
    for (auto& e : data_.entries)
        if (!e.folder.isEmpty() && !ids.contains(e.folder)) e.folder.clear();
    data_.folders = updated;
    if (filter_.startsWith("folder:") && !ids.contains(filter_.mid(7))) filter_ = "all";
    persist();
    rebuildSidebar();
    rebuildList();
}

void MainWindow::rebuildSidebar() {
    QLayoutItem* item;
    while ((item = sidebarLayout_->takeAt(0)) != nullptr) {
        if (item->widget()) item->widget()->deleteLater();
        delete item;
    }
    auto countFor = [this](const QString& key) {
        int n = 0;
        for (const auto& e : data_.entries) {
            if (key == "trash") { if (e.trashed) n++; continue; }
            if (e.trashed) continue;
            if (key == "all") n++;
            else if (key == "favorites") { if (e.favorite) n++; }
            else if (key == "recent") { if (e.usedAt > 0) n++; }
            else if (key.startsWith("folder:")) { if (e.folder == key.mid(7)) n++; }
            else if (key.startsWith("tag:")) { if (e.tags.contains(key.mid(4))) n++; }
            else if (e.type == key) n++;
        }
        return n;
    };
    auto addBtn = [this, &countFor](const QString& key, const QString& label) {
        int c = countFor(key);
        auto* b = new QPushButton(QString("%1%2").arg(label, c > 0 ? "   " + QString::number(c) : QString()), sidebar_);
        b->setObjectName("nav");
        b->setCheckable(true);
        b->setChecked(filter_ == key);
        connect(b, &QPushButton::clicked, this, [this, key] {
            filter_ = key;
            rebuildSidebar();
            rebuildList();
            fx::fadeIn(list_, 260);
        });
        sidebarLayout_->addWidget(b);
    };
    auto addLabel = [this](const QString& text) {
        auto* lbl = new QLabel(text, sidebar_);
        lbl->setObjectName("label");
        lbl->setContentsMargins(10, 12, 0, 4);
        sidebarLayout_->addWidget(lbl);
    };

    addBtn("all", "🗂  All items");
    addBtn("favorites", "★  Favorites");
    addBtn("recent", "🕘  Recently used");

    // types with at least one item, plus the common ones always
    addLabel("TYPES");
    for (const auto& ty : vault::types()) {
        if (countFor(ty.id) > 0 || ty.id == "login" || ty.id == "note")
            addBtn(ty.id, ty.icon + "  " + ty.label + "s");
    }

    if (!data_.folders.isEmpty()) {
        addLabel("FOLDERS");
        for (const auto& f : data_.folders) addBtn("folder:" + f.id, f.icon + "  " + f.name);
    }

    // tags (unique, from non-trashed entries)
    QStringList tags;
    for (const auto& e : data_.entries) {
        if (e.trashed) continue;
        for (const QString& t : e.tags)
            if (!tags.contains(t)) tags << t;
    }
    tags.sort(Qt::CaseInsensitive);
    if (!tags.isEmpty()) {
        addLabel("TAGS");
        for (const QString& t : tags) addBtn("tag:" + t, "#  " + t);
    }

    addLabel("");
    addBtn("trash", "🗑  Trash");
    sidebarLayout_->addStretch();
    fx::fadeIn(sidebar_, 240);
}

void MainWindow::rebuildList() {
    list_->clear();
    const QString q = search_.trimmed().toLower();
    const QStringList terms = q.split(' ', Qt::SkipEmptyParts);

    QVector<const vault::Entry*> rows;
    for (const auto& e : data_.entries) {
        if (filter_ == "trash") {
            if (!e.trashed) continue;
        } else {
            if (e.trashed) continue;
            if (filter_ == "favorites") { if (!e.favorite) continue; }
            else if (filter_ == "recent") { if (e.usedAt <= 0) continue; }
            else if (filter_.startsWith("folder:")) { if (e.folder != filter_.mid(7)) continue; }
            else if (filter_.startsWith("tag:")) { if (!e.tags.contains(filter_.mid(4))) continue; }
            else if (filter_ != "all") { if (e.type != filter_) continue; }
        }
        if (!terms.isEmpty()) {
            const QString hay = (e.title + " " + e.username + " " + e.url + " " + e.email + " " +
                                 e.notes + " " + e.otpIssuer + " " + e.cardholder + " " + e.fullName + " " +
                                 e.wifiSsid + " " + e.serverHost + " " + e.bankName + " " + e.walletType + " " +
                                 e.licenseOwner + " " + e.tags.join(" ")).toLower();
            bool all = true;
            for (const QString& t : terms) if (!hay.contains(t)) { all = false; break; }
            if (!all) continue;
        }
        rows.append(&e);
    }

    const QString sortKey = sortCombo_ ? sortCombo_->currentData().toString() : "updated";
    std::sort(rows.begin(), rows.end(), [&](const vault::Entry* a, const vault::Entry* b) {
        if (sortKey == "title") return a->title.compare(b->title, Qt::CaseInsensitive) < 0;
        if (sortKey == "created") return a->created > b->created;
        if (sortKey == "used") return (a->usedAt ? a->usedAt : a->updated) > (b->usedAt ? b->usedAt : b->updated);
        return a->updated > b->updated;
    });

    const bool compact = data_.settings.compactList;
    const bool badges = data_.settings.showStrengthBadges;
    for (const vault::Entry* e : rows) {
        QString sub = vault::subtitleFor(*e);
        QString badge;
        if (badges && vault::typeHasPassword(e->type) && !e->password.isEmpty() &&
            vc::analyzeStrength(e->password.toStdString()).score <= 1)
            badge = "  ⚠";
        QString text = compact
                           ? QString("%1%2   %3").arg(e->title.isEmpty() ? "—" : e->title,
                                                      e->favorite ? "  ★" : "", sub)
                           : QString("%1%2%3\n%4").arg(e->title.isEmpty() ? "—" : e->title,
                                                       e->favorite ? "   ★" : "", badge, sub);
        auto* it = new QListWidgetItem(avatarFor(*e), text);
        it->setData(Qt::UserRole, e->id);
        list_->addItem(it);
    }

    // breadcrumb
    QString crumb = filter_ == "all"       ? "All items"
                    : filter_ == "favorites" ? "Favorites"
                    : filter_ == "recent"    ? "Recently used"
                    : filter_ == "trash"     ? "Trash"
                    : filter_.startsWith("folder:") ? "Folder"
                    : filter_.startsWith("tag:")    ? "#" + filter_.mid(4)
                                                    : vault::typeLabel(filter_) + "s";
    if (crumbLabel_) crumbLabel_->setText(QString("%1  ·  %2").arg(crumb).arg(rows.size()));

    if (list_->count() > 0) list_->setCurrentRow(0);
    else showDetail(QString());
}

void MainWindow::addDetailRow(QVBoxLayout* v, const QString& label, const QString& value, bool copyable, bool secret) {
    if (value.isEmpty()) return;
    auto* l = new QLabel(label.toUpper(), detail_);
    l->setObjectName("label");
    v->addWidget(l);
    auto* row = new QHBoxLayout();
    auto* val = new QLabel(secret && !reveal_ ? QString("•").repeated(qMin(16, value.size())) : value, detail_);
    val->setObjectName("mono");
    val->setWordWrap(true);
    val->setTextInteractionFlags(Qt::TextSelectableByMouse);
    row->addWidget(val, 1);
    if (secret) {
        auto* eye = new QPushButton(reveal_ ? "🙈" : "👁", detail_);
        eye->setObjectName("ghost");
        eye->setFixedWidth(34);
        connect(eye, &QPushButton::clicked, this, [this] { reveal_ = !reveal_; showDetail(selectedId_); });
        row->addWidget(eye);
    }
    if (copyable) {
        auto* cp = new QPushButton("⧉", detail_);
        cp->setObjectName("ghost");
        cp->setFixedWidth(34);
        connect(cp, &QPushButton::clicked, this, [this, value] { copyValue(value); });
        row->addWidget(cp);
    }
    v->addLayout(row);
}

void MainWindow::addTotpRow(QVBoxLayout* v, const QString& secret) {
    if (secret.isEmpty()) return;
    auto* l = new QLabel("2FA CODE", detail_);
    l->setObjectName("label");
    v->addWidget(l);
    totpLabel_ = new QLabel("…", detail_);
    totpLabel_->setObjectName("code");
    totpSecretForDetail_ = secret;
    auto* row = new QHBoxLayout();
    row->addWidget(totpLabel_, 1);
    auto* cp = new QPushButton("⧉", detail_);
    cp->setObjectName("ghost");
    cp->setFixedWidth(34);
    connect(cp, &QPushButton::clicked, this, [this] {
        vc::OtpAuth p = vc::parseOtpAuth(totpSecretForDetail_.toStdString());
        if (!p.secret.empty()) { int r; copyValue(QString::fromStdString(vc::totp(p.secret, QDateTime::currentSecsSinceEpoch(), p.digits, p.period, r))); }
    });
    row->addWidget(cp);
    v->addLayout(row);
}

void MainWindow::addCustomFieldRows(QVBoxLayout* v, const vault::Entry& e) {
    if (e.customFields.isEmpty()) return;
    for (const auto& f : e.customFields)
        addDetailRow(v, f.label.isEmpty() ? "Field" : f.label, f.value, true, f.secret);
}

void MainWindow::showDetail(const QString& id) {
    selectedId_ = id;
    totpLabel_ = nullptr;
    totpSecretForDetail_.clear();
    QLayoutItem* item;
    while ((item = detailLayout_->takeAt(0)) != nullptr) {
        if (item->widget()) item->widget()->deleteLater();
        if (item->layout()) {
            QLayoutItem* c;
            while ((c = item->layout()->takeAt(0)) != nullptr) {
                if (c->widget()) c->widget()->deleteLater();
                delete c;
            }
        }
        delete item;
    }
    const vault::Entry* e = findEntry(id);
    if (!e) {
        // ---- animated "home" dashboard shown when nothing is selected ----
        vault::Stats st = vault::computeStats(data_);
        vault::Audit au = vault::audit(data_.entries, data_.settings.passwordAgeDays);

        auto* hero = new QFrame(detail_);
        hero->setObjectName("hero");
        auto* hv = new QVBoxLayout(hero);
        hv->setContentsMargins(18, 16, 18, 16);
        auto* hi = new QLabel("🔓  VAULT UNLOCKED", hero);
        hi->setObjectName("label");
        auto* ht = new QLabel(st.total > 0 ? QString("%1 items secured").arg(st.total) : "Your vault is empty", hero);
        ht->setObjectName("h2");
        hv->addWidget(hi);
        hv->addWidget(ht);
        detailLayout_->addWidget(hero);
        fx::fadeInDelayed(hero, 320, 0);

        struct SC { QString v; QString l; QString col; };
        QVector<SC> cards = {
            {QString::number(st.total), "ITEMS", QString()},
            {QString::number(au.weak.size()), "WEAK", au.weak.size() ? QString("#ef4444") : QString()},
            {QString::number(st.withTotp), "WITH 2FA", QString("#22c55e")},
            {QString::number(st.favorites), "FAVORITES", QString()},
        };
        auto* grid = new QGridLayout();
        grid->setSpacing(8);
        for (int i = 0; i < cards.size(); ++i) {
            auto* c = new QFrame(detail_);
            c->setObjectName("card");
            auto* cv = new QVBoxLayout(c);
            cv->setContentsMargins(14, 12, 14, 12);
            auto* bignum = new QLabel(cards[i].v, c);
            bignum->setObjectName("bigstat");
            if (!cards[i].col.isEmpty()) bignum->setStyleSheet(QString("color:%1;").arg(cards[i].col));
            // count-up animation from 0 → value
            int target = cards[i].v.toInt();
            if (target > 0 && target <= 99999) {
                bignum->setText("0");
                auto* anim = new QVariantAnimation(bignum);
                anim->setStartValue(0);
                anim->setEndValue(target);
                anim->setDuration(750);
                anim->setEasingCurve(QEasingCurve::OutCubic);
                connect(anim, &QVariantAnimation::valueChanged, bignum, [bignum](const QVariant& v) { bignum->setText(QString::number(v.toInt())); });
                QTimer::singleShot(140 + i * 70, bignum, [anim] { anim->start(QAbstractAnimation::DeleteWhenStopped); });
            }
            auto* lab = new QLabel(cards[i].l, c);
            lab->setObjectName("label");
            cv->addWidget(bignum);
            cv->addWidget(lab);
            grid->addWidget(c, i / 2, i % 2);
            fx::fadeInDelayed(c, 300, 90 + i * 70);
        }
        detailLayout_->addLayout(grid);

        auto* qaLabel = new QLabel("QUICK ACTIONS", detail_);
        qaLabel->setObjectName("label");
        qaLabel->setContentsMargins(2, 10, 0, 2);
        detailLayout_->addWidget(qaLabel);
        struct QA { QString label; std::function<void()> fn; };
        QVector<QA> actions = {
            {"🔑  New login", [this] { newEntry("login"); }},
            {"🌐  Import browser logins", [this] { importFromBrowsers(); }},
            {"🎲  Generator", [this] { openGenerator(); }},
            {"📊  Dashboard", [this] { openStats(); }},
            {"🛡  Security audit", [this] { openAudit(); }},
        };
        for (int i = 0; i < actions.size(); ++i) {
            auto* b = new QPushButton(actions[i].label, detail_);
            b->setObjectName("nav");
            auto fn = actions[i].fn;
            connect(b, &QPushButton::clicked, this, [fn] { fn(); });
            detailLayout_->addWidget(b);
            fx::fadeInDelayed(b, 280, 260 + i * 60);
        }

        // recent items
        QVector<const vault::Entry*> recent;
        for (const auto& x : data_.entries)
            if (!x.trashed) recent.append(&x);
        std::sort(recent.begin(), recent.end(), [](const vault::Entry* a, const vault::Entry* b) {
            return (a->usedAt ? a->usedAt : a->updated) > (b->usedAt ? b->usedAt : b->updated);
        });
        if (!recent.isEmpty()) {
            auto* rl = new QLabel("RECENT", detail_);
            rl->setObjectName("label");
            rl->setContentsMargins(2, 10, 0, 2);
            detailLayout_->addWidget(rl);
            int shown = 0;
            for (const vault::Entry* r : recent) {
                if (shown >= 5) break;
                auto* b = new QPushButton(QString("%1  %2").arg(entryIcon(*r), r->title.isEmpty() ? "—" : r->title), detail_);
                b->setObjectName("nav");
                QString rid = r->id;
                connect(b, &QPushButton::clicked, this, [this, rid] {
                    for (int i = 0; i < list_->count(); ++i)
                        if (list_->item(i)->data(Qt::UserRole).toString() == rid) { list_->setCurrentRow(i); return; }
                    showDetail(rid);
                });
                detailLayout_->addWidget(b);
                fx::fadeInDelayed(b, 260, 460 + shown * 55);
                shown++;
            }
        }

        auto* tip = new QLabel("🔒 Everything is encrypted locally with Argon2id + XChaCha20-Poly1305. Press Ctrl+K for the command palette.", detail_);
        tip->setObjectName("muted");
        tip->setWordWrap(true);
        tip->setContentsMargins(2, 12, 2, 0);
        detailLayout_->addWidget(tip);
        detailLayout_->addStretch();
        return;
    }

    // header
    auto* head = new QHBoxLayout();
    auto* title = new QLabel(QString("%1 %2").arg(entryIcon(*e), e->title), detail_);
    title->setObjectName("h2");
    title->setWordWrap(true);
    head->addWidget(title, 1);
    auto* fav = new QPushButton(e->favorite ? "★" : "☆", detail_);
    fav->setObjectName("ghost");
    fav->setFixedWidth(34);
    QString id2 = e->id;
    connect(fav, &QPushButton::clicked, this, [this, id2] { toggleFavorite(id2); });
    head->addWidget(fav);
    detailLayout_->addLayout(head);

    auto* typeTag = new QLabel(vault::typeLabel(e->type).toUpper(), detail_);
    typeTag->setObjectName("label");
    detailLayout_->addWidget(typeTag);

    // expiry banner
    if (e->expiresAt > 0) {
        const qint64 now = QDateTime::currentMSecsSinceEpoch();
        QString when = QDateTime::fromMSecsSinceEpoch(e->expiresAt).toString("yyyy-MM-dd");
        bool expired = e->expiresAt < now;
        auto* ex = new QLabel(QString("<span style='color:%1'>%2 %3</span>")
                                  .arg(expired ? "#ef4444" : "#eab308",
                                       expired ? "⚠ Expired" : "⏳ Expires", when), detail_);
        detailLayout_->addWidget(ex);
    }

    const QString t = e->type;
    if (t == "login") {
        addDetailRow(detailLayout_, "Username", e->username, true);
        addDetailRow(detailLayout_, "Password", e->password, true, true);
        addDetailRow(detailLayout_, "Website", e->url, true);
        if (!e->url.isEmpty()) {
            QString url = e->url, pw = e->password;
            auto* openRow = new QHBoxLayout();
            auto* open = new QPushButton("Open website ↗", detail_);
            connect(open, &QPushButton::clicked, this, [url] { QDesktopServices::openUrl(QUrl(url.contains("://") ? url : "https://" + url)); });
            openRow->addWidget(open, 1);
            if (!pw.isEmpty()) {
                auto* co = new QPushButton("Copy & open", detail_);
                co->setObjectName("accent");
                connect(co, &QPushButton::clicked, this, [this, url, pw] {
                    copyValue(pw);
                    QDesktopServices::openUrl(QUrl(url.contains("://") ? url : "https://" + url));
                });
                openRow->addWidget(co);
            }
            detailLayout_->addLayout(openRow);
        }
        addTotpRow(detailLayout_, e->totp);
    } else if (t == "note") {
        auto* n = new QLabel(e->notes, detail_);
        n->setWordWrap(true);
        n->setTextInteractionFlags(Qt::TextSelectableByMouse);
        detailLayout_->addWidget(n);
    } else if (t == "card") {
        addDetailRow(detailLayout_, "Cardholder", e->cardholder, true);
        addDetailRow(detailLayout_, QString("Number%1").arg(e->cardBrand.isEmpty() ? "" : " · " + e->cardBrand), e->cardNumber, true, true);
        addDetailRow(detailLayout_, "Expiry", e->cardExpiry, true);
        addDetailRow(detailLayout_, "CVV", e->cardCvv, true, true);
        addDetailRow(detailLayout_, "PIN", e->cardPin, true, true);
    } else if (t == "identity") {
        addDetailRow(detailLayout_, "Full name", e->fullName, true);
        addDetailRow(detailLayout_, "Email", e->email, true);
        addDetailRow(detailLayout_, "Phone", e->phone, true);
        addDetailRow(detailLayout_, "Address", e->address, true);
    } else if (t == "totp") {
        addTotpRow(detailLayout_, e->otpSecret);
        addDetailRow(detailLayout_, "Issuer", e->otpIssuer, true);
    } else if (t == "ssh") {
        addDetailRow(detailLayout_, "User", e->username, true);
        addDetailRow(detailLayout_, "Host", e->url, true);
        addDetailRow(detailLayout_, "Passphrase", e->password, true, true);
        addDetailRow(detailLayout_, "Public key", e->sshPublicKey, true);
        addDetailRow(detailLayout_, "Private key", e->sshPrivateKey, true, true);
    } else if (t == "api") {
        addDetailRow(detailLayout_, "Endpoint", e->url, true);
        addDetailRow(detailLayout_, "API key", e->apiKey, true, true);
        addDetailRow(detailLayout_, "API secret", e->apiSecret, true, true);
    } else if (t == "wifi") {
        addDetailRow(detailLayout_, "Network", e->wifiSsid, true);
        addDetailRow(detailLayout_, "Security", e->wifiSecurity, false);
        addDetailRow(detailLayout_, "Password", e->password, true, true);
    } else if (t == "bank") {
        addDetailRow(detailLayout_, "Bank", e->bankName, true);
        addDetailRow(detailLayout_, "Account holder", e->cardholder, true);
        addDetailRow(detailLayout_, "Account number", e->accountNumber, true, true);
        addDetailRow(detailLayout_, "Routing / sort", e->routingNumber, true);
        addDetailRow(detailLayout_, "IBAN", e->iban, true, true);
        addDetailRow(detailLayout_, "SWIFT / BIC", e->swift, true);
        addDetailRow(detailLayout_, "PIN / access", e->password, true, true);
    } else if (t == "crypto") {
        addDetailRow(detailLayout_, "Network / wallet", e->walletType, true);
        addDetailRow(detailLayout_, "Public address", e->walletAddress, true);
        addDetailRow(detailLayout_, "Recovery phrase", e->walletSeed, true, true);
        addDetailRow(detailLayout_, "Spending password", e->password, true, true);
    } else if (t == "server") {
        addDetailRow(detailLayout_, "Host", e->serverHost, true);
        addDetailRow(detailLayout_, "Port", e->serverPort, true);
        addDetailRow(detailLayout_, "User", e->username, true);
        addDetailRow(detailLayout_, "Password", e->password, true, true);
        addDetailRow(detailLayout_, "Database", e->dbName, true);
    } else if (t == "license") {
        addDetailRow(detailLayout_, "Licensed to", e->licenseOwner, true);
        addDetailRow(detailLayout_, "Licence key", e->licenseKey, true, true);
        addDetailRow(detailLayout_, "Vendor", e->url, true);
    }

    addCustomFieldRows(detailLayout_, *e);

    if (!e->notes.isEmpty() && t != "note")
        addDetailRow(detailLayout_, "Notes", e->notes, false);
    if (!e->tags.isEmpty()) {
        auto* tags = new QLabel("#" + e->tags.join("  #"), detail_);
        tags->setObjectName("muted");
        detailLayout_->addWidget(tags);
    }

    // password history
    if (vault::typeHasPassword(t) && !e->passwordHistory.isEmpty()) {
        auto* hist = new QPushButton(QString("Password history (%1)").arg(e->passwordHistory.size()), detail_);
        hist->setObjectName("chip");
        connect(hist, &QPushButton::clicked, this, [this, id2] { showHistory(id2); });
        detailLayout_->addWidget(hist, 0, Qt::AlignLeft);
    }

    // actions
    auto* actions = new QHBoxLayout();
    if (e->trashed) {
        auto* rest = new QPushButton("Restore", detail_);
        rest->setObjectName("accent");
        connect(rest, &QPushButton::clicked, this, [this, id2] { restoreEntry(id2); });
        auto* purge = new QPushButton("Delete forever", detail_);
        purge->setObjectName("danger");
        connect(purge, &QPushButton::clicked, this, [this, id2] { purgeEntry(id2); });
        actions->addWidget(rest, 1);
        actions->addWidget(purge);
    } else {
        auto* edit = new QPushButton("Edit", detail_);
        edit->setObjectName("accent");
        connect(edit, &QPushButton::clicked, this, [this, id2] { editEntry(id2); });
        auto* del = new QPushButton("Delete", detail_);
        del->setObjectName("danger");
        connect(del, &QPushButton::clicked, this, [this, id2] { deleteEntry(id2); });
        actions->addWidget(edit, 1);
        actions->addWidget(del);
    }
    detailLayout_->addLayout(actions);
    detailLayout_->addStretch();

    fx::fadeIn(detail_, 180);
    if (reveal_ && data_.settings.revealSeconds > 0)
        revealTimer_->start(data_.settings.revealSeconds * 1000);
    else if (revealTimer_)
        revealTimer_->stop();
}

// ---------------------------------------------------------------------------
// actions
// ---------------------------------------------------------------------------
const vault::Entry* MainWindow::findEntry(const QString& id) const {
    for (const auto& e : data_.entries)
        if (e.id == id) return &e;
    return nullptr;
}

void MainWindow::newEntry(const QString& type) {
    vault::Entry e = vault::newEntry(type);
    EntryDialog d(e, data_.folders, this);
    if (d.exec() == QDialog::Accepted) {
        data_.entries.prepend(d.result());
        persist();
        rebuildSidebar();
        rebuildList();
    }
}

void MainWindow::editEntry(const QString& id) {
    const vault::Entry* e = findEntry(id);
    if (!e) return;
    EntryDialog d(*e, data_.folders, this);
    if (d.exec() == QDialog::Accepted) {
        vault::Entry updated = d.result();
        for (auto& x : data_.entries)
            if (x.id == id) { x = updated; break; }
        persist();
        rebuildSidebar();
        rebuildList();
        showDetail(id);
    }
}

void MainWindow::deleteEntry(const QString& id) {
    if (data_.settings.confirmDelete &&
        QMessageBox::question(this, "Move to Trash", "Move this item to the Trash?") != QMessageBox::Yes)
        return;
    for (auto& e : data_.entries)
        if (e.id == id) { e.trashed = true; e.trashedAt = QDateTime::currentMSecsSinceEpoch(); break; }
    persist();
    rebuildSidebar();
    rebuildList();
}

void MainWindow::restoreEntry(const QString& id) {
    for (auto& e : data_.entries)
        if (e.id == id) { e.trashed = false; e.trashedAt = 0; break; }
    persist();
    rebuildSidebar();
    rebuildList();
}

void MainWindow::purgeEntry(const QString& id) {
    if (QMessageBox::warning(this, "Delete forever", "Permanently delete this item? This cannot be undone.",
                             QMessageBox::Yes | QMessageBox::No) != QMessageBox::Yes)
        return;
    for (int i = 0; i < data_.entries.size(); ++i)
        if (data_.entries[i].id == id) { data_.entries.remove(i); break; }
    persist();
    rebuildSidebar();
    rebuildList();
}

void MainWindow::emptyTrash() {
    int n = 0;
    for (const auto& e : data_.entries) if (e.trashed) n++;
    if (n == 0) { QMessageBox::information(this, "Trash", "The Trash is already empty."); return; }
    if (QMessageBox::warning(this, "Empty Trash", QString("Permanently delete %1 item(s)?").arg(n),
                             QMessageBox::Yes | QMessageBox::No) != QMessageBox::Yes)
        return;
    QVector<vault::Entry> kept;
    for (const auto& e : data_.entries) if (!e.trashed) kept.append(e);
    data_.entries = kept;
    persist();
    rebuildSidebar();
    rebuildList();
}

void MainWindow::toggleFavorite(const QString& id) {
    for (auto& e : data_.entries)
        if (e.id == id) { e.favorite = !e.favorite; break; }
    persist();
    rebuildList();
    showDetail(id);
}

void MainWindow::showHistory(const QString& id) {
    const vault::Entry* e = findEntry(id);
    if (!e) return;
    PasswordHistoryDialog d(e->title, e->passwordHistory, this);
    connect(&d, &PasswordHistoryDialog::copyRequested, this, [this](const QString& v) { copyValue(v); });
    if (d.exec() == QDialog::Accepted && !d.restored().isEmpty()) {
        for (auto& x : data_.entries)
            if (x.id == id) {
                if (!x.password.isEmpty()) x.passwordHistory.prepend(x.password);
                x.password = d.restored();
                x.updated = QDateTime::currentMSecsSinceEpoch();
                break;
            }
        persist();
        showDetail(id);
    }
}

void MainWindow::openGenerator() {
    QDialog d(this);
    d.setWindowTitle("Password generator");
    d.setMinimumWidth(460);
    auto* v = new QVBoxLayout(&d);
    v->addWidget(new GeneratorWidget(&d, false));
    d.exec();
}

void MainWindow::openAudit() {
    AuditDialog d(vault::audit(data_.entries, data_.settings.passwordAgeDays), this);
    d.exec();
}

void MainWindow::openStats() {
    StatsDialog d(data_, this);
    d.exec();
}

void MainWindow::openAbout() {
    AboutDialog d(this);
    d.exec();
}

void MainWindow::pickTheme() {
    ThemePickerDialog d(data_.settings.theme, this);
    connect(&d, &ThemePickerDialog::preview, this, [this](const QString& id) { applyTheme(id); });
    if (d.exec() == QDialog::Accepted) {
        data_.settings.theme = d.selected();
        persist();
    }
    applyTheme(data_.settings.theme);
}

void MainWindow::openCommandPalette() {
    QVector<CommandPalette::Item> items;
    // actions
    items.append({"action", "new-login", "New login", "Create a new login", "🔑"});
    items.append({"action", "new-note", "New secure note", "Create a note", "📝"});
    items.append({"action", "new-card", "New payment card", "", "💳"});
    items.append({"action", "generator", "Password generator", "", "🎲"});
    items.append({"action", "audit", "Security audit", "", "🛡"});
    items.append({"action", "stats", "Dashboard", "Vault statistics & health", "📊"});
    items.append({"action", "theme", "Choose theme", "Change the colour palette", "🎨"});
    items.append({"action", "import-browsers", "Import browser logins", "Chrome · Brave · Edge · Firefox", "🌐"});
    items.append({"action", "import", "Import from file", "JSON / CSV", "📥"});
    items.append({"action", "export", "Export items", "", "📤"});
    items.append({"action", "settings", "Settings", "", "⚙"});
    items.append({"action", "lock", "Lock vault", "", "🔒"});
    items.append({"action", "trash", "Open Trash", "", "🗑"});
    // entries
    for (const auto& e : data_.entries) {
        if (e.trashed) continue;
        items.append({"entry", e.id, e.title, vault::typeLabel(e.type) + " · " + vault::subtitleFor(e), entryIcon(e)});
    }

    CommandPalette pal(items, this);
    connect(&pal, &CommandPalette::chosen, this, [this](const QString& kind, const QString& id) {
        if (kind == "entry") {
            filter_ = "all";
            search_.clear();
            if (searchEdit_) searchEdit_->clear();
            rebuildSidebar();
            rebuildList();
            for (int i = 0; i < list_->count(); ++i)
                if (list_->item(i)->data(Qt::UserRole).toString() == id) { list_->setCurrentRow(i); break; }
        } else {
            if (id == "new-login") newEntry("login");
            else if (id == "new-note") newEntry("note");
            else if (id == "new-card") newEntry("card");
            else if (id == "generator") openGenerator();
            else if (id == "audit") openAudit();
            else if (id == "stats") openStats();
            else if (id == "theme") pickTheme();
            else if (id == "import-browsers") importFromBrowsers();
            else if (id == "import") importItems();
            else if (id == "export") exportItems();
            else if (id == "settings") openSettings();
            else if (id == "lock") lock();
            else if (id == "trash") { filter_ = "trash"; rebuildSidebar(); rebuildList(); }
        }
    });
    pal.exec();
}

void MainWindow::importItems() {
    QString src = QFileDialog::getOpenFileName(this, "Import items", QString(),
                                               "Data files (*.json *.csv);;JSON (*.json);;CSV (*.csv)");
    if (src.isEmpty()) return;
    QFile f(src);
    if (!f.open(QIODevice::ReadOnly)) { QMessageBox::warning(this, "Import", "Could not read that file."); return; }
    QByteArray raw = f.readAll();
    QVector<vault::Entry> imported;
    QString err;
    bool ok = src.endsWith(".csv", Qt::CaseInsensitive)
                  ? vault::importCsv(raw, imported, err)
                  : vault::importPlaintextJson(raw, imported, err);
    if (!ok) { QMessageBox::warning(this, "Import", err); return; }
    if (QMessageBox::question(this, "Import",
                              QString("Import %1 item(s) into your vault?").arg(imported.size())) != QMessageBox::Yes)
        return;
    for (auto& e : imported) data_.entries.prepend(e);
    persist();
    rebuildSidebar();
    rebuildList();
    QMessageBox::information(this, "Import", QString("Imported %1 item(s).").arg(imported.size()));
}

void MainWindow::importFromBrowsers() {
    BrowserImportDialog d(this);
    if (d.exec() != QDialog::Accepted) return;
    const QVector<bimport::Credential> creds = d.selected();
    if (creds.isEmpty()) return;
    int n = 0;
    for (const auto& c : creds) {
        vault::Entry e = vault::newEntry("login");
        e.title = c.site.isEmpty() ? c.origin : c.site;
        e.url = c.origin;
        e.username = c.username;
        e.password = c.password;
        const QString method = bimport::methodLabel(c.method);
        e.tags = QStringList{"imported", c.browser.toLower(), bimport::methodKey(c.method)};
        e.notes = QString("Imported from %1 · sign-in: %2").arg(c.browser, method);
        e.customFields.append({"Sign-in", method + (c.provider.isEmpty() ? QString() : " (" + c.provider + ")"), false});
        data_.entries.prepend(e);
        n++;
    }
    persist();
    rebuildSidebar();
    rebuildList();
    QMessageBox::information(this, "Import", QString("Imported %1 login(s) from your browsers.").arg(n));
}

void MainWindow::exportItems() {
    QMessageBox box(this);
    box.setWindowTitle("Export items");
    box.setIcon(QMessageBox::Warning);
    box.setText("Exports are UNENCRYPTED plaintext.\nAnyone with the file can read every secret.");
    box.setInformativeText("Choose a format, or Cancel.");
    auto* json = box.addButton("Export JSON", QMessageBox::AcceptRole);
    auto* csv = box.addButton("Export CSV (logins)", QMessageBox::AcceptRole);
    box.addButton(QMessageBox::Cancel);
    box.exec();
    QAbstractButton* clicked = box.clickedButton();
    if (clicked != json && clicked != csv) return;

    const bool asCsv = (clicked == csv);
    QString suffix = asCsv ? "csv" : "json";
    QString dst = QFileDialog::getSaveFileName(
        this, "Export items",
        QDateTime::currentDateTime().toString("'vault-export-'yyyy-MM-dd'." + suffix + "'"),
        asCsv ? "CSV (*.csv)" : "JSON (*.json)");
    if (dst.isEmpty()) return;
    QFile f(dst);
    if (!f.open(QIODevice::WriteOnly)) { QMessageBox::warning(this, "Export", "Could not write that file."); return; }
    f.write(asCsv ? vault::exportCsv(data_) : vault::exportPlaintextJson(data_));
    f.close();
    QFile::setPermissions(dst, QFile::ReadOwner | QFile::WriteOwner);
    QMessageBox::information(this, "Export", "Saved. Store or shred it carefully.");
}

void MainWindow::openSettings() {
    SettingsDialog d(data_.settings, this);
    connect(&d, &SettingsDialog::themePreview, this, [this](const QString& m) { applyTheme(m); });
    connect(&d, &SettingsDialog::pickThemeRequested, this, [this, &d] {
        ThemePickerDialog tp(data_.settings.theme, this);
        connect(&tp, &ThemePickerDialog::preview, this, [this](const QString& id) { applyTheme(id); });
        tp.exec();
    });
    connect(&d, &SettingsDialog::changeMasterRequested, this, &MainWindow::changeMaster);
    connect(&d, &SettingsDialog::exportRequested, this, &MainWindow::exportBackup);
    connect(&d, &SettingsDialog::wipeRequested, this, &MainWindow::wipeVault);
    connect(&d, &SettingsDialog::openFolderRequested, this, &MainWindow::openVaultFolder);
    if (d.exec() == QDialog::Accepted) {
        data_.settings = d.result();
        kdfPreset_ = data_.settings.kdf;
        persist();
        applyTheme(data_.settings.theme);
        rebuildSidebar();
        rebuildList();
    } else {
        applyTheme(data_.settings.theme);
    }
}

void MainWindow::changeMaster() {
    ChangeMasterDialog d(this);
    if (d.exec() != QDialog::Accepted) return;
    if (d.currentPassword() != password_) {
        QMessageBox::warning(this, "Vault", "Current password is incorrect.");
        return;
    }
    password_ = d.newPassword();
    persist();
    QMessageBox::information(this, "Vault", "Master password changed.");
}

void MainWindow::exportBackup() {
    QString dst = QFileDialog::getSaveFileName(this, "Export encrypted backup",
                                               QDateTime::currentDateTime().toString("'vault-backup-'yyyy-MM-dd'.svlt'"),
                                               "Vault backup (*.svlt)");
    if (dst.isEmpty()) return;
    QString err;
    if (vault::exportBackup(path_, dst, err))
        QMessageBox::information(this, "Vault", "Encrypted backup saved.");
    else
        QMessageBox::warning(this, "Vault", err);
}

void MainWindow::wipeVault() {
    if (QMessageBox::warning(this, "Erase vault",
                             "This permanently deletes the encrypted vault on this device. Continue?",
                             QMessageBox::Yes | QMessageBox::No) != QMessageBox::Yes)
        return;
    QFile::remove(path_);
    quitting_ = true;
    qApp->quit();
}

void MainWindow::lock() {
    password_.fill('*');
    password_.clear();
    keyfile_.fill('*');
    keyfile_.clear();
    data_ = vault::Data{};
    hide();
    if (tray_) tray_->hide();

    AuthDialog auth(path_, nullptr);
    if (auth.exec() != QDialog::Accepted) {
        quitting_ = true;
        qApp->quit();
        return;
    }
    password_ = auth.password();
    keyfile_ = auth.keyfile();
    kdfPreset_ = auth.kdfPreset();
    data_ = auth.data();
    rebuildSidebar();
    rebuildList();
    updateStats();
    applyTheme(data_.settings.theme);
    if (tray_) tray_->show();
    showNormal();
    raise();
    activateWindow();
    if (idleTimer_ && data_.settings.autoLockMinutes > 0)
        idleTimer_->start(data_.settings.autoLockMinutes * 60 * 1000);
}

void MainWindow::copyValue(const QString& text) {
    QApplication::clipboard()->setText(text);
    lastClip_ = text;
    if (data_.settings.clipboardClearSeconds > 0)
        clipTimer_->start(data_.settings.clipboardClearSeconds * 1000);
    bumpUsed(selectedId_);
}

void MainWindow::bumpUsed(const QString& id) {
    if (id.isEmpty()) return;
    for (auto& e : data_.entries)
        if (e.id == id) { e.usedAt = QDateTime::currentMSecsSinceEpoch(); break; }
}

void MainWindow::applyTheme(const QString& id) {
    qApp->setStyleSheet(theme::qss(id));
    const QColor ic(theme::paletteFor(id).fg2);
    for (const auto& t : toolIcons_)
        if (t.first) t.first->setIcon(lineIcon(t.second, ic, 17));
}

// ---------------------------------------------------------------------------
// tray + shortcuts + events
// ---------------------------------------------------------------------------
void MainWindow::buildTray() {
    if (!QSystemTrayIcon::isSystemTrayAvailable()) return;
    tray_ = new QSystemTrayIcon(windowIcon(), this);
    tray_->setToolTip("Vault");
    auto* menu = new QMenu(this);
    menu->addAction("Show", this, [this] { showNormal(); raise(); activateWindow(); });
    menu->addAction("Command palette", this, [this] { showNormal(); raise(); activateWindow(); openCommandPalette(); });
    menu->addAction("Lock now", this, &MainWindow::lock);
    menu->addSeparator();
    menu->addAction("Quit", this, [this] { quitting_ = true; qApp->quit(); });
    tray_->setContextMenu(menu);
    connect(tray_, &QSystemTrayIcon::activated, this, [this](QSystemTrayIcon::ActivationReason r) {
        if (r == QSystemTrayIcon::Trigger) {
            if (isVisible()) hide();
            else { showNormal(); raise(); activateWindow(); }
        }
    });
    tray_->show();
}

void MainWindow::installShortcuts() {
    // Ctrl+K/L/G/D/Q are owned by the menu-bar actions (avoids ambiguous overloads);
    // these are the extras that have no menu entry.
    new QShortcut(QKeySequence("Ctrl+F"), this, [this] { searchEdit_->setFocus(); searchEdit_->selectAll(); });
    new QShortcut(QKeySequence("Ctrl+N"), this, [this] { newEntry(data_.settings.defaultNewType); });
    new QShortcut(QKeySequence("Ctrl+Shift+A"), this, [this] { quickCapture(); });
}

void MainWindow::changeEvent(QEvent* e) {
    if (e->type() == QEvent::WindowStateChange && isMinimized()) {
        if (data_.settings.lockOnMinimize) {
            QTimer::singleShot(0, this, &MainWindow::lock);
        } else if (data_.settings.minimizeToTray && tray_) {
            QTimer::singleShot(0, this, [this] { hide(); });
        }
    }
    QMainWindow::changeEvent(e);
}

void MainWindow::closeEvent(QCloseEvent* e) {
    if (!quitting_ && data_.settings.minimizeToTray && tray_ && tray_->isVisible()) {
        e->ignore();
        hide();
        return;
    }
    if (!lastClip_.isEmpty() && QApplication::clipboard()->text() == lastClip_)
        QApplication::clipboard()->clear();
    QMainWindow::closeEvent(e);
}

bool MainWindow::eventFilter(QObject* o, QEvent* e) {
    if (idleTimer_ && (e->type() == QEvent::MouseMove || e->type() == QEvent::KeyPress ||
                       e->type() == QEvent::MouseButtonPress || e->type() == QEvent::Wheel)) {
        if (data_.settings.autoLockMinutes > 0 && isVisible()) idleTimer_->start(data_.settings.autoLockMinutes * 60 * 1000);
    }
    return QMainWindow::eventFilter(o, e);
}

void MainWindow::persist() {
    QString err;
    if (!vault::save(path_, password_, keyfile_, kdfPreset_, data_, err))
        QMessageBox::warning(this, "Vault", "Could not save: " + err);
    updateStats();
}

void MainWindow::updateStats() {
    if (!statsLabel_) return;
    vault::Stats st = vault::computeStats(data_);
    int weak = 0;
    for (const auto& e : data_.entries)
        if (!e.trashed && vault::typeHasPassword(e.type) && !e.password.isEmpty() &&
            vc::analyzeStrength(e.password.toStdString()).score <= 1) weak++;
    QString extra = weak ? QString("   ·   ⚠ %1 weak").arg(weak) : QString("   ·   ✓ healthy");
    if (st.expired + st.expiringSoon > 0) extra += QString("   ·   ⏳ %1 expiring").arg(st.expired + st.expiringSoon);
    statsLabel_->setText(QString("🗂 %1 items   ·   🛡 %2 with 2FA%3").arg(st.total).arg(st.withTotp).arg(extra));
}

void MainWindow::duplicateEntry(const QString& id) {
    const vault::Entry* e = findEntry(id);
    if (!e) return;
    vault::Entry c = *e;
    c.id = vault::newId();
    c.title = e->title + " (copy)";
    c.created = c.updated = QDateTime::currentMSecsSinceEpoch();
    c.usedAt = 0;
    data_.entries.prepend(c);
    persist();
    rebuildList();
}

void MainWindow::moveToFolder(const QString& id, const QString& folderId) {
    for (auto& e : data_.entries)
        if (e.id == id) { e.folder = folderId; break; }
    persist();
    rebuildSidebar();
    rebuildList();
}

void MainWindow::openVaultFolder() {
    QDesktopServices::openUrl(QUrl::fromLocalFile(QFileInfo(path_).absolutePath()));
}

void MainWindow::listContextMenu(const QPoint& pos) {
    QListWidgetItem* it = list_->itemAt(pos);
    if (!it) return;
    const QString id = it->data(Qt::UserRole).toString();
    const vault::Entry* e = findEntry(id);
    if (!e) return;

    QMenu m(this);
    if (e->trashed) {
        m.addAction("Restore", this, [this, id] { restoreEntry(id); });
        m.addAction("Delete forever", this, [this, id] { purgeEntry(id); });
        m.addSeparator();
        m.addAction("Empty Trash", this, [this] { emptyTrash(); });
        m.exec(list_->mapToGlobal(pos));
        return;
    }

    const QString user = e->username, pass = e->password, url = e->url;
    const QString otp = e->type == "login" ? e->totp : e->otpSecret;
    const bool fav = e->favorite;
    const QString type = e->type;

    if (!user.isEmpty()) m.addAction("Copy username", this, [this, id, user] { selectedId_ = id; copyValue(user); });
    if (!pass.isEmpty()) m.addAction("Copy password", this, [this, id, pass] { selectedId_ = id; copyValue(pass); });
    if (!otp.isEmpty())
        m.addAction("Copy 2FA code", this, [this, id, otp] {
            vc::OtpAuth p = vc::parseOtpAuth(otp.toStdString());
            if (!p.secret.empty()) { int r; selectedId_ = id; copyValue(QString::fromStdString(vc::totp(p.secret, QDateTime::currentSecsSinceEpoch(), p.digits, p.period, r))); }
        });
    if (!url.isEmpty())
        m.addAction("Open website", this, [url] { QDesktopServices::openUrl(QUrl(url.contains("://") ? url : "https://" + url)); });
    m.addSeparator();
    m.addAction("Edit", this, [this, id] { editEntry(id); });
    m.addAction("Duplicate", this, [this, id] { duplicateEntry(id); });
    m.addAction(fav ? "Unfavorite" : "Favorite", this, [this, id] { toggleFavorite(id); });
    QMenu* mv = m.addMenu("Move to folder");
    mv->addAction("No folder", this, [this, id] { moveToFolder(id, QString()); });
    for (const auto& f : data_.folders) {
        QString fid = f.id;
        mv->addAction(f.icon + " " + f.name, this, [this, id, fid] { moveToFolder(id, fid); });
    }
    m.addSeparator();
    m.addAction("Move to Trash", this, [this, id] { deleteEntry(id); });
    m.exec(list_->mapToGlobal(pos));
}

void MainWindow::quickCapture() {
    if (!data_.settings.quickCapture) {
        QMessageBox::information(this, "Vault", "Quick Capture is turned off in Settings.");
        return;
    }
    QString site;
    QProcess p;
    p.start("xdotool", {"getactivewindow", "getwindowname"});
    if (p.waitForFinished(700)) site = QString::fromUtf8(p.readAllStandardOutput()).trimmed();
    for (const char* suf : {" - Mozilla Firefox", " — Mozilla Firefox", " - Google Chrome",
                            " - Chromium", " - Brave", " - Microsoft Edge", " — Chromium"}) {
        int i = site.indexOf(QLatin1String(suf));
        if (i >= 0) site = site.left(i);
    }
    vault::Entry e = vault::newEntry("login");
    e.title = site;
    EntryDialog dlg(e, data_.folders, this);
    dlg.setWindowTitle("Quick Capture — save credential");
    showNormal();
    raise();
    activateWindow();
    if (dlg.exec() == QDialog::Accepted) {
        data_.entries.prepend(dlg.result());
        persist();
        rebuildSidebar();
        rebuildList();
    }
}
