#include "extradialogs.hpp"

#include <QButtonGroup>
#include <QCheckBox>
#include <QDateTime>
#include <QDialogButtonBox>
#include <QFrame>
#include <QGridLayout>
#include <QGroupBox>
#include <QHBoxLayout>
#include <QIcon>
#include <QLabel>
#include <QLineEdit>
#include <QListWidget>
#include <QPainter>
#include <QPainterPath>
#include <QPixmap>
#include <QProgressBar>
#include <QPushButton>
#include <QScrollArea>
#include <QPlainTextEdit>
#include <QClipboard>
#include <QGuiApplication>
#include <QVBoxLayout>

#include <algorithm>

#include "crypto.hpp"
#include "effects.hpp"
#include "theme.hpp"

// ---------------------------------------------------------------------------
//  ThemePickerDialog
// ---------------------------------------------------------------------------
static QIcon swatchIcon(const theme::Palette& p) {
    QPixmap pm(64, 40);
    pm.fill(Qt::transparent);
    QPainter g(&pm);
    g.setRenderHint(QPainter::Antialiasing);
    QPainterPath path;
    path.addRoundedRect(0, 0, 64, 40, 9, 9);
    g.fillPath(path, QColor(p.bg));
    g.setPen(QPen(QColor(p.line2), 1));
    g.drawPath(path);
    // two accent chips + a text bar
    g.setPen(Qt::NoPen);
    g.setBrush(QColor(p.acc));
    g.drawRoundedRect(8, 9, 22, 22, 6, 6);
    g.setBrush(QColor(p.acc2));
    g.drawRoundedRect(34, 9, 14, 22, 5, 5);
    g.setBrush(QColor(p.fg2));
    g.drawRoundedRect(8, 34, 40, 3, 1, 1);
    g.end();
    return QIcon(pm);
}

ThemePickerDialog::ThemePickerDialog(const QString& currentId, QWidget* parent)
    : QDialog(parent), selected_(currentId), original_(currentId) {
    setWindowTitle("Choose a theme");
    setModal(true);
    setMinimumSize(640, 560);

    auto* root = new QVBoxLayout(this);
    auto* head = new QLabel("Pick a palette — the app updates live as you hover.", this);
    head->setObjectName("muted");
    root->addWidget(head);

    auto* scroll = new QScrollArea(this);
    scroll->setWidgetResizable(true);
    scroll->setFrameShape(QFrame::NoFrame);
    auto* inner = new QWidget();
    auto* iv = new QVBoxLayout(inner);

    auto* group = new QButtonGroup(this);
    group->setExclusive(true);

    auto addGroup = [&](const QString& name) -> QGridLayout* {
        auto* box = new QGroupBox(name, inner);
        auto* grid = new QGridLayout(box);
        grid->setSpacing(10);
        iv->addWidget(box);
        return grid;
    };
    QGridLayout* darkGrid = addGroup("DARK");
    QGridLayout* lightGrid = addGroup("LIGHT");
    int dc = 0, lc = 0;

    for (const auto& p : theme::palettes()) {
        auto* btn = new QPushButton(inner);
        btn->setObjectName("swatch");
        btn->setCheckable(true);
        btn->setChecked(p.id == currentId);
        btn->setIcon(swatchIcon(p));
        btn->setIconSize(QSize(64, 40));
        btn->setText("  " + p.name);
        btn->setMinimumHeight(58);
        btn->setStyleSheet(QString("QPushButton{background:%1;color:%2;border:1px solid %3;border-radius:12px;"
                                   "padding:8px 12px;text-align:left;font-weight:600;} "
                                   "QPushButton:checked{border:2px solid %4;} "
                                   "QPushButton:hover{border-color:%4;}")
                               .arg(p.bg2, p.fg, p.line2, p.acc));
        group->addButton(btn);
        QString id = p.id;
        connect(btn, &QPushButton::clicked, this, [this, id] {
            selected_ = id;
            emit preview(id);
        });
        if (p.dark) darkGrid->addWidget(btn, dc / 3, dc % 3), dc++;
        else lightGrid->addWidget(btn, lc / 3, lc % 3), lc++;
    }
    iv->addStretch();
    scroll->setWidget(inner);
    root->addWidget(scroll, 1);

    auto* bb = new QDialogButtonBox(QDialogButtonBox::Ok | QDialogButtonBox::Cancel, this);
    bb->button(QDialogButtonBox::Ok)->setObjectName("accent");
    bb->button(QDialogButtonBox::Ok)->setText("Apply theme");
    connect(bb, &QDialogButtonBox::accepted, this, &QDialog::accept);
    connect(bb, &QDialogButtonBox::rejected, this, [this] {
        emit preview(original_);  // revert live preview
        reject();
    });
    root->addWidget(bb);
    fx::popIn(this);
}

// ---------------------------------------------------------------------------
//  PasswordHistoryDialog
// ---------------------------------------------------------------------------
PasswordHistoryDialog::PasswordHistoryDialog(const QString& title, const QStringList& history, QWidget* parent)
    : QDialog(parent) {
    setWindowTitle("Password history");
    setModal(true);
    setMinimumSize(460, 420);
    auto* root = new QVBoxLayout(this);

    auto* h = new QLabel(QString("Previous passwords for <b>%1</b>").arg(title.toHtmlEscaped()), this);
    h->setWordWrap(true);
    root->addWidget(h);
    auto* sub = new QLabel("Copy an old value, or restore it as the current password.", this);
    sub->setObjectName("muted");
    root->addWidget(sub);

    auto* scroll = new QScrollArea(this);
    scroll->setWidgetResizable(true);
    scroll->setFrameShape(QFrame::NoFrame);
    auto* inner = new QWidget();
    auto* iv = new QVBoxLayout(inner);

    if (history.isEmpty()) {
        auto* none = new QLabel("No previous passwords recorded yet.", inner);
        none->setObjectName("muted");
        iv->addWidget(none);
    }

    int idx = 1;
    for (const QString& pw : history) {
        auto* card = new QFrame(inner);
        card->setObjectName("card");
        auto* cv = new QVBoxLayout(card);
        cv->setContentsMargins(12, 10, 12, 10);

        auto* topRow = new QHBoxLayout();
        auto* num = new QLabel(QString("#%1").arg(idx++), card);
        num->setObjectName("label");
        vc::Strength s = vc::analyzeStrength(pw.toStdString());
        static const char* col[] = {"#ef4444", "#f97316", "#eab308", "#84cc16", "#22c55e"};
        auto* str = new QLabel(QString("<span style='color:%1'>~%2 bits</span>")
                                   .arg(col[qBound(0, s.score, 4)]).arg(int(s.entropyBits)), card);
        topRow->addWidget(num);
        topRow->addStretch();
        topRow->addWidget(str);
        cv->addLayout(topRow);

        auto* valRow = new QHBoxLayout();
        auto* val = new QLineEdit(pw, card);
        val->setReadOnly(true);
        val->setObjectName("mono");
        val->setEchoMode(QLineEdit::Password);
        auto* eye = new QPushButton("👁", card);
        eye->setObjectName("ghost");
        eye->setCheckable(true);
        eye->setFixedWidth(34);
        connect(eye, &QPushButton::toggled, val, [val](bool on) {
            val->setEchoMode(on ? QLineEdit::Normal : QLineEdit::Password);
        });
        auto* cp = new QPushButton("Copy", card);
        connect(cp, &QPushButton::clicked, this, [this, pw] { emit copyRequested(pw); });
        auto* rs = new QPushButton("Restore", card);
        rs->setObjectName("accent");
        connect(rs, &QPushButton::clicked, this, [this, pw] { restored_ = pw; accept(); });
        valRow->addWidget(val, 1);
        valRow->addWidget(eye);
        valRow->addWidget(cp);
        valRow->addWidget(rs);
        cv->addLayout(valRow);
        iv->addWidget(card);
    }
    iv->addStretch();
    scroll->setWidget(inner);
    root->addWidget(scroll, 1);

    auto* bb = new QDialogButtonBox(QDialogButtonBox::Close, this);
    connect(bb, &QDialogButtonBox::rejected, this, &QDialog::reject);
    root->addWidget(bb);
}

// ---------------------------------------------------------------------------
//  StatsDialog
// ---------------------------------------------------------------------------
static QWidget* statCard(QWidget* parent, const QString& big, const QString& label) {
    auto* card = new QFrame(parent);
    card->setObjectName("card");
    auto* v = new QVBoxLayout(card);
    v->setContentsMargins(16, 14, 16, 14);
    auto* b = new QLabel(big, card);
    b->setObjectName("bigstat");
    auto* l = new QLabel(label.toUpper(), card);
    l->setObjectName("label");
    v->addWidget(b);
    v->addWidget(l);
    return card;
}

StatsDialog::StatsDialog(const vault::Data& data, QWidget* parent) : QDialog(parent) {
    setWindowTitle("Vault dashboard");
    setModal(true);
    setMinimumSize(560, 620);
    vault::Stats st = vault::computeStats(data);
    vault::Audit au = vault::audit(data.entries, data.settings.passwordAgeDays);

    auto* root = new QVBoxLayout(this);
    auto* scroll = new QScrollArea(this);
    scroll->setWidgetResizable(true);
    scroll->setFrameShape(QFrame::NoFrame);
    auto* inner = new QWidget();
    auto* iv = new QVBoxLayout(inner);
    iv->setSpacing(14);

    // hero: health score
    auto* hero = new QFrame(inner);
    hero->setObjectName("hero");
    auto* hv = new QVBoxLayout(hero);
    hv->setContentsMargins(20, 18, 20, 18);
    const QString col = au.score >= 80 ? "#22c55e" : au.score >= 55 ? "#eab308" : "#ef4444";
    auto* score = new QLabel(QString("<span style='font-size:15px;color:#8b929e'>SECURITY HEALTH</span><br>"
                                     "<span style='font-size:52px;font-weight:800;color:%1'>%2</span>"
                                     "<span style='color:#8b929e;font-size:20px'> / 100</span>")
                                 .arg(col).arg(au.score), hero);
    hv->addWidget(score);
    auto* gauge = new QProgressBar(hero);
    gauge->setRange(0, 100);
    gauge->setValue(au.score);
    gauge->setTextVisible(false);
    gauge->setStyleSheet(QString("QProgressBar::chunk{background:%1;border-radius:4px;}").arg(col));
    hv->addWidget(gauge);
    iv->addWidget(hero);

    // top stat cards
    auto* grid = new QGridLayout();
    grid->setSpacing(10);
    grid->addWidget(statCard(inner, QString::number(st.total), "Items"), 0, 0);
    grid->addWidget(statCard(inner, QString::number(st.favorites), "Favorites"), 0, 1);
    grid->addWidget(statCard(inner, QString::number(st.withTotp), "With 2FA"), 0, 2);
    grid->addWidget(statCard(inner, QString::number(au.weak.size()), "Weak"), 1, 0);
    grid->addWidget(statCard(inner, QString::number(au.reused.size()), "Reused"), 1, 1);
    grid->addWidget(statCard(inner, QString::number(st.expiringSoon + st.expired), "Expiring"), 1, 2);
    iv->addLayout(grid);

    // per-type breakdown
    auto* typeBox = new QGroupBox("BY TYPE", inner);
    auto* tv = new QVBoxLayout(typeBox);
    int maxCount = 1;
    for (const auto& kv : st.byType) maxCount = std::max(maxCount, kv.second);
    for (const auto& kv : st.byType) {
        auto* row = new QHBoxLayout();
        auto* name = new QLabel(vault::typeIcon(kv.first) + "  " + vault::typeLabel(kv.first), typeBox);
        name->setMinimumWidth(160);
        auto* bar = new QProgressBar(typeBox);
        bar->setRange(0, maxCount);
        bar->setValue(kv.second);
        bar->setTextVisible(false);
        bar->setFixedHeight(9);
        auto* cnt = new QLabel(QString::number(kv.second), typeBox);
        cnt->setObjectName("mono");
        cnt->setFixedWidth(36);
        cnt->setAlignment(Qt::AlignRight);
        row->addWidget(name);
        row->addWidget(bar, 1);
        row->addWidget(cnt);
        tv->addLayout(row);
    }
    if (st.byType.isEmpty()) tv->addWidget(new QLabel("Your vault is empty.", typeBox));
    iv->addWidget(typeBox);

    // coverage
    auto* covBox = new QGroupBox("COVERAGE", inner);
    auto* cvv = new QVBoxLayout(covBox);
    int creds = au.totalWithPasswords;
    int cov = creds > 0 ? (100 * (creds - au.no2fa.size()) / creds) : 100;
    auto* covLabel = new QLabel(QString("2FA coverage on logins: <b>%1%</b>  ·  avg entropy ~%2 bits")
                                    .arg(cov).arg(int(au.avgEntropy)), covBox);
    covLabel->setWordWrap(true);
    cvv->addWidget(covLabel);
    if (st.newestUpdate > 0) {
        auto* upd = new QLabel("Last change: " +
                                   QDateTime::fromMSecsSinceEpoch(st.newestUpdate).toString("yyyy-MM-dd HH:mm"),
                               covBox);
        upd->setObjectName("muted");
        cvv->addWidget(upd);
    }
    iv->addWidget(covBox);

    iv->addStretch();
    scroll->setWidget(inner);
    root->addWidget(scroll, 1);

    auto* bb = new QDialogButtonBox(QDialogButtonBox::Close, this);
    connect(bb, &QDialogButtonBox::rejected, this, &QDialog::accept);
    connect(bb, &QDialogButtonBox::accepted, this, &QDialog::accept);
    root->addWidget(bb);
    fx::popIn(this);
}

// ---------------------------------------------------------------------------
//  AboutDialog
// ---------------------------------------------------------------------------
AboutDialog::AboutDialog(QWidget* parent) : QDialog(parent) {
    setWindowTitle("About Vault");
    setModal(true);
    setMinimumWidth(460);
    auto* root = new QVBoxLayout(this);

    auto* logo = new QLabel("🔐", this);
    logo->setStyleSheet("font-size:42px;");
    logo->setAlignment(Qt::AlignCenter);
    root->addWidget(logo);
    auto* title = new QLabel("Vault", this);
    title->setObjectName("h1");
    title->setAlignment(Qt::AlignCenter);
    root->addWidget(title);
    auto* ver = new QLabel("Version 2.0 · native Linux (Qt6 + libsodium)", this);
    ver->setObjectName("muted");
    ver->setAlignment(Qt::AlignCenter);
    root->addWidget(ver);

    auto* info = new QLabel(
        "<p style='line-height:1.6'>A zero-knowledge, offline password &amp; secrets manager. "
        "Everything is encrypted locally with <b>Argon2id</b> key derivation and "
        "<b>XChaCha20-Poly1305</b> authenticated encryption. No account, no cloud, no telemetry.</p>", this);
    info->setWordWrap(true);
    root->addWidget(info);

    auto* keys = new QLabel(
        "<b>Keyboard shortcuts</b><br>"
        "<span style='font-family:monospace'>"
        "Ctrl+K</span>  Command palette<br>"
        "<span style='font-family:monospace'>Ctrl+F</span>  Search<br>"
        "<span style='font-family:monospace'>Ctrl+N</span>  New login<br>"
        "<span style='font-family:monospace'>Ctrl+G</span>  Generator<br>"
        "<span style='font-family:monospace'>Ctrl+L</span>  Lock now<br>"
        "<span style='font-family:monospace'>Ctrl+Shift+A</span>  Quick Capture<br>"
        "<span style='font-family:monospace'>Ctrl+Q</span>  Quit", this);
    keys->setTextFormat(Qt::RichText);
    root->addWidget(keys);

    auto* bb = new QDialogButtonBox(QDialogButtonBox::Close, this);
    connect(bb, &QDialogButtonBox::rejected, this, &QDialog::accept);
    root->addWidget(bb);
}

// ---------------------------------------------------------------------------
//  FolderManagerDialog
// ---------------------------------------------------------------------------
FolderManagerDialog::FolderManagerDialog(const QVector<vault::Folder>& folders, QWidget* parent)
    : QDialog(parent) {
    setWindowTitle("Manage folders");
    setModal(true);
    setMinimumWidth(420);
    auto* root = new QVBoxLayout(this);
    auto* head = new QLabel("Organise your vault into folders. Use a short emoji or symbol as the icon.", this);
    head->setObjectName("muted");
    head->setWordWrap(true);
    root->addWidget(head);

    rows_ = new QVBoxLayout();
    rows_->setSpacing(6);
    root->addLayout(rows_);

    auto* add = new QPushButton("＋ Add folder", this);
    add->setObjectName("chip");
    connect(add, &QPushButton::clicked, this, [this] { addRow({vault::newId(), "", "◆"}); });
    root->addWidget(add, 0, Qt::AlignLeft);
    root->addStretch();

    for (const auto& f : folders) addRow(f);

    auto* bb = new QDialogButtonBox(QDialogButtonBox::Save | QDialogButtonBox::Cancel, this);
    bb->button(QDialogButtonBox::Save)->setObjectName("accent");
    connect(bb, &QDialogButtonBox::accepted, this, &QDialog::accept);
    connect(bb, &QDialogButtonBox::rejected, this, &QDialog::reject);
    root->addWidget(bb);
}

void FolderManagerDialog::addRow(const vault::Folder& f) {
    auto* container = new QWidget(this);
    auto* h = new QHBoxLayout(container);
    h->setContentsMargins(0, 0, 0, 0);
    h->setSpacing(6);
    auto* icon = new QLineEdit(f.icon, container);
    icon->setMaxLength(3);
    icon->setFixedWidth(52);
    icon->setAlignment(Qt::AlignCenter);
    auto* name = new QLineEdit(f.name, container);
    name->setPlaceholderText("Folder name");
    auto* del = new QPushButton("✕", container);
    del->setObjectName("ghost");
    del->setFixedWidth(32);
    h->addWidget(icon);
    h->addWidget(name, 1);
    h->addWidget(del);
    rows_->addWidget(container);

    Row row{icon, name, f.id.isEmpty() ? vault::newId() : f.id, container};
    items_.append(row);
    connect(del, &QPushButton::clicked, this, [this, container] {
        for (int i = 0; i < items_.size(); ++i)
            if (items_[i].container == container) { items_.remove(i); break; }
        container->deleteLater();
    });
}

// ---------------------------------------------------------------------------
//  BrowserImportDialog
// ---------------------------------------------------------------------------
static QColor browserColor(const QString& b) {
    if (b.startsWith("Chrome")) return QColor("#4285f4");
    if (b == "Chromium") return QColor("#5a8dee");
    if (b == "Brave") return QColor("#fb542b");
    if (b == "Edge") return QColor("#0c8ce9");
    if (b == "Vivaldi") return QColor("#ef3939");
    if (b == "Opera") return QColor("#ff1b2d");
    if (b == "Firefox") return QColor("#ff7139");
    return QColor("#8b929e");
}
static QColor methodColor(bimport::Method m) {
    using M = bimport::Method;
    switch (m) {
        case M::Google: return QColor("#ea4335");
        case M::GitHub: return QColor("#8b949e");
        case M::Microsoft: return QColor("#00a4ef");
        case M::Facebook: return QColor("#1877f2");
        case M::Apple: return QColor("#a2aaad");
        case M::Federated: return QColor("#a78bfa");
        default: return QColor("#4ade80");
    }
}
static QIcon browserBadge(const QString& browser) {
    QPixmap pm(44, 30);
    pm.fill(Qt::transparent);
    QPainter g(&pm);
    g.setRenderHint(QPainter::Antialiasing);
    QPainterPath path;
    path.addRoundedRect(1, 1, 42, 28, 8, 8);
    QColor c = browserColor(browser);
    g.fillPath(path, c);
    g.setPen(Qt::white);
    QFont f = g.font();
    f.setPixelSize(15);
    f.setBold(true);
    g.setFont(f);
    g.drawText(QRect(1, 1, 42, 28), Qt::AlignCenter, browser.left(1).toUpper());
    g.end();
    return QIcon(pm);
}

BrowserImportDialog::BrowserImportDialog(QWidget* parent) : QDialog(parent) {
    setWindowTitle("Import browser logins");
    setModal(true);
    setMinimumSize(700, 640);
    auto* root = new QVBoxLayout(this);

    auto* title = new QLabel("Import browser logins", this);
    title->setObjectName("h2");
    root->addWidget(title);
    auto* sub = new QLabel("Vault scans Chrome, Chromium, Brave, Edge, Vivaldi, Opera and Firefox for saved "
                           "logins, shows how you sign in to each site (Google, GitHub, a password…), and lets "
                           "you pull them into your vault. Everything happens locally.", this);
    sub->setObjectName("muted");
    sub->setWordWrap(true);
    root->addWidget(sub);

    // toolbar: search + rescan
    auto* tb = new QHBoxLayout();
    search_ = new QLineEdit(this);
    search_->setPlaceholderText("Search sites or usernames…");
    search_->setClearButtonEnabled(true);
    connect(search_, &QLineEdit::textChanged, this, [this](const QString& t) { query_ = t.trimmed().toLower(); applyFilter(); });
    tb->addWidget(search_, 1);
    auto* selAll = new QPushButton("Select all", this);
    selAll->setObjectName("chip");
    connect(selAll, &QPushButton::clicked, this, [this] { for (auto& r : rows_) if (r.w->isVisible()) r.cb->setChecked(true); });
    auto* selNone = new QPushButton("None", this);
    selNone->setObjectName("chip");
    connect(selNone, &QPushButton::clicked, this, [this] { for (auto& r : rows_) r.cb->setChecked(false); });
    auto* rescanBtn = new QPushButton("↻ Rescan", this);
    connect(rescanBtn, &QPushButton::clicked, this, [this] { rescan(); rebuild(); });
    tb->addWidget(selAll);
    tb->addWidget(selNone);
    tb->addWidget(rescanBtn);
    root->addLayout(tb);

    // method filter chips
    auto* chips = new QHBoxLayout();
    chips->setSpacing(6);
    auto* grp = new QButtonGroup(this);
    grp->setExclusive(true);
    struct F { const char* label; const char* key; };
    const F filters[] = {{"All", "all"}, {"Password", "password"}, {"Google", "google"}, {"GitHub", "github"}, {"Microsoft", "microsoft"}, {"SSO", "sso"}};
    for (const auto& f : filters) {
        auto* c = new QPushButton(f.label, this);
        c->setObjectName("chip");
        c->setCheckable(true);
        if (QString(f.key) == "all") c->setChecked(true);
        QString key = f.key;
        connect(c, &QPushButton::clicked, this, [this, key] { methodFilter_ = key; applyFilter(); });
        grp->addButton(c);
        chips->addWidget(c);
    }
    chips->addStretch();
    root->addLayout(chips);

    // list
    auto* scroll = new QScrollArea(this);
    scroll->setWidgetResizable(true);
    scroll->setFrameShape(QFrame::NoFrame);
    auto* inner = new QWidget();
    listLayout_ = new QVBoxLayout(inner);
    listLayout_->setContentsMargins(0, 0, 0, 0);
    listLayout_->setSpacing(6);
    listLayout_->addStretch();
    scroll->setWidget(inner);
    root->addWidget(scroll, 1);

    status_ = new QLabel(this);
    status_->setObjectName("muted");
    root->addWidget(status_);

    auto* bb = new QDialogButtonBox(QDialogButtonBox::Cancel, this);
    auto* imp = bb->addButton("Import selected", QDialogButtonBox::AcceptRole);
    imp->setObjectName("accent");
    connect(bb, &QDialogButtonBox::accepted, this, [this] {
        chosen_.clear();
        for (const auto& r : rows_) if (r.cb->isChecked()) chosen_.append(r.cred);
        accept();
    });
    connect(bb, &QDialogButtonBox::rejected, this, &QDialog::reject);
    root->addWidget(bb);

    rescan();
    rebuild();
    fx::popIn(this);
}

void BrowserImportDialog::rescan() {
    all_.clear();
    const QVector<bimport::Profile> profiles = bimport::detectProfiles();
    int browsers = 0;
    QString last;
    for (const auto& p : profiles) {
        QString note;
        QVector<bimport::Credential> creds = bimport::readProfile(p, note);
        all_ += creds;
        if (p.browser != last) { browsers++; last = p.browser; }
    }
    if (all_.isEmpty())
        status_->setText(profiles.isEmpty() ? "No supported browsers with saved logins were found."
                                            : "Browsers were found, but no readable logins.");
    else
        status_->setText(QString("Found %1 login(s) across %2 profile(s). Firefox entries are NSS-encrypted (site only).")
                             .arg(all_.size()).arg(profiles.size()));
}

void BrowserImportDialog::rebuild() {
    // clear existing rows (keep the trailing stretch)
    for (auto& r : rows_) r.w->deleteLater();
    rows_.clear();
    int insertAt = 0;
    for (const auto& c : all_) {
        auto* card = new QFrame();
        card->setObjectName("card");
        auto* h = new QHBoxLayout(card);
        h->setContentsMargins(12, 9, 12, 9);
        h->setSpacing(10);

        auto* cb = new QCheckBox(card);
        cb->setChecked(c.passwordKnown || !c.username.isEmpty());
        h->addWidget(cb);

        auto* badge = new QLabel(card);
        badge->setPixmap(browserBadge(c.browser).pixmap(44, 30));
        badge->setToolTip(c.browser);
        h->addWidget(badge);

        auto* mid = new QVBoxLayout();
        mid->setSpacing(1);
        auto* site = new QLabel(c.site.isEmpty() ? "—" : c.site, card);
        site->setObjectName("h3");
        auto* usr = new QLabel(c.username.isEmpty() ? "— no username —" : c.username, card);
        usr->setObjectName("muted");
        usr->setTextInteractionFlags(Qt::TextSelectableByMouse);
        mid->addWidget(site);
        mid->addWidget(usr);
        h->addLayout(mid, 1);

        // method chip
        QColor mc = methodColor(c.method);
        auto* chip = new QLabel(bimport::methodLabel(c.method), card);
        chip->setStyleSheet(QString("background:%1; color:%2; border-radius:999px; padding:3px 10px; font-size:11px; font-weight:700;")
                                .arg(QString("rgba(%1,%2,%3,0.16)").arg(mc.red()).arg(mc.green()).arg(mc.blue()), mc.name()));
        h->addWidget(chip);

        // password state
        if (c.method != bimport::Method::Password) {
            auto* s = new QLabel("SSO", card);
            s->setObjectName("muted");
            h->addWidget(s);
        } else if (c.passwordKnown) {
            auto* val = new QLabel("••••••••", card);
            val->setObjectName("mono");
            val->setTextInteractionFlags(Qt::TextSelectableByMouse);
            auto* eye = new QPushButton("👁", card);
            eye->setObjectName("ghost");
            eye->setFixedWidth(30);
            QString pw = c.password;
            connect(eye, &QPushButton::toggled, val, [val, pw](bool on) { val->setText(on ? pw : QString("•").repeated(qMax(6, qMin(14, pw.size())))); });
            eye->setCheckable(true);
            h->addWidget(val);
            h->addWidget(eye);
        } else {
            auto* s = new QLabel("🔒 locked", card);
            s->setStyleSheet("color:#eab308;");
            s->setToolTip("Encrypted by the system keyring. Unlock your keyring (or install libsecret-tools) and rescan.");
            h->addWidget(s);
        }

        listLayout_->insertWidget(insertAt++, card);
        Row row;
        row.w = card;
        row.cb = cb;
        row.cred = c;
        row.hay = (c.site + " " + c.username + " " + c.browser + " " + bimport::methodLabel(c.method)).toLower();
        rows_.append(row);
    }
    applyFilter();
}

void BrowserImportDialog::applyFilter() {
    const QStringList terms = query_.split(' ', Qt::SkipEmptyParts);
    int shown = 0;
    for (auto& r : rows_) {
        bool ok = true;
        if (methodFilter_ != "all" && bimport::methodKey(r.cred.method) != methodFilter_) ok = false;
        if (ok) for (const QString& t : terms) if (!r.hay.contains(t)) { ok = false; break; }
        r.w->setVisible(ok);
        if (ok) shown++;
    }
    if (!all_.isEmpty()) status_->setText(QString("Showing %1 of %2 login(s). Tick the ones to import.").arg(shown).arg(all_.size()));
}

QVector<vault::Folder> FolderManagerDialog::folders() const {
    QVector<vault::Folder> out;
    for (const auto& r : items_) {
        if (r.name->text().trimmed().isEmpty()) continue;
        out.append({r.id, r.name->text().trimmed(), r.icon->text().trimmed().isEmpty() ? "◆" : r.icon->text().trimmed()});
    }
    return out;
}


// ---------------------------------------------------------------------------
//  LiveMonitorDialog
// ---------------------------------------------------------------------------
static QString relativeTime(qint64 msEpoch) {
    const qint64 secs = (QDateTime::currentMSecsSinceEpoch() - msEpoch) / 1000;
    if (secs < 5) return "just now";
    if (secs < 60) return QString("%1s ago").arg(secs);
    if (secs < 3600) return QString("%1m ago").arg(secs / 60);
    if (secs < 86400) return QString("%1h ago").arg(secs / 3600);
    return QString("%1d ago").arg(secs / 86400);
}

LiveMonitorDialog::LiveMonitorDialog(bimport::LiveMonitor* monitor, bool startEnabled, QWidget* parent)
    : QDialog(parent), monitor_(monitor), enabled_(startEnabled) {
    setWindowTitle("Live browser-login monitor");
    setModal(false);  // stays usable while the app keeps running around it
    setMinimumSize(640, 620);
    auto* root = new QVBoxLayout(this);

    auto* title = new QLabel("Live browser-login monitor", this);
    title->setObjectName("h2");
    root->addWidget(title);
    auto* sub = new QLabel(
        "While this is on, Vault watches Chrome, Chromium, Brave, Edge, Vivaldi, Opera and Firefox's saved-login "
        "files and reports the instant a new sign-in is stored — which site, which account, and whether it was a "
        "password or a \"Sign in with…\" provider. Everything is read locally; nothing is sent anywhere.",
        this);
    sub->setObjectName("muted");
    sub->setWordWrap(true);
    root->addWidget(sub);

    // header: status pill + on/off toggle
    auto* head = new QFrame(this);
    head->setObjectName("card");
    auto* headL = new QHBoxLayout(head);
    headL->setContentsMargins(14, 12, 14, 12);
    auto* dot = new QLabel(head);
    dot->setFixedSize(10, 10);
    dot->setStyleSheet(QString("background:%1; border-radius:5px;").arg(enabled_ ? "#4ade80" : "#8b929e"));
    headL->addWidget(dot);
    status_ = new QLabel(enabled_ ? "Starting…" : "Monitor is off.", head);
    status_->setObjectName("h3");
    headL->addWidget(status_, 1);
    countBadge_ = new QLabel(head);
    countBadge_->setStyleSheet("background:rgba(74,222,128,0.16); color:#4ade80; border-radius:999px; padding:3px 10px; font-weight:700; font-size:11px;");
    countBadge_->setVisible(false);
    headL->addWidget(countBadge_);
    toggleBtn_ = new QPushButton(enabled_ ? "Turn off" : "Turn on", head);
    toggleBtn_->setObjectName(enabled_ ? "ghost" : "accent");
    connect(toggleBtn_, &QPushButton::clicked, this, [this] { setRunning(!enabled_); });
    headL->addWidget(toggleBtn_);
    root->addWidget(head);

    // toolbar: rescan + clear + mark all reviewed
    auto* tb = new QHBoxLayout();
    auto* rescanBtn = new QPushButton("↻ Check now", this);
    connect(rescanBtn, &QPushButton::clicked, this, [this] { if (monitor_) monitor_->rescanNow(); });
    auto* diagBtn = new QPushButton("🩺 Diagnostics", this);
    diagBtn->setObjectName("chip");
    diagBtn->setToolTip("Why isn't a login showing up? Run a self-check of the SQLite driver, keyring and detected browser profiles.");
    connect(diagBtn, &QPushButton::clicked, this, [this] {
        if (!monitor_) return;
        QDialog dlg(this);
        dlg.setWindowTitle("Live monitor diagnostics");
        dlg.setMinimumSize(560, 460);
        auto* l = new QVBoxLayout(&dlg);
        auto* intro = new QLabel("A local self-check — this is what Vault can see on this machine right now:", &dlg);
        intro->setObjectName("muted");
        intro->setWordWrap(true);
        l->addWidget(intro);
        auto* text = new QPlainTextEdit(&dlg);
        text->setReadOnly(true);
        text->setPlainText(monitor_->diagnostics());
        text->setStyleSheet("font-family: monospace; font-size: 12px;");
        l->addWidget(text, 1);
        auto* row = new QHBoxLayout();
        auto* copyBtn = new QPushButton("Copy report", &dlg);
        copyBtn->setObjectName("chip");
        connect(copyBtn, &QPushButton::clicked, &dlg, [text] { QGuiApplication::clipboard()->setText(text->toPlainText()); });
        auto* closeBtn = new QPushButton("Close", &dlg);
        closeBtn->setObjectName("accent");
        connect(closeBtn, &QPushButton::clicked, &dlg, &QDialog::accept);
        row->addWidget(copyBtn);
        row->addStretch();
        row->addWidget(closeBtn);
        l->addLayout(row);
        dlg.exec();
    });
    auto* markBtn = new QPushButton("Mark all reviewed", this);
    markBtn->setObjectName("chip");
    connect(markBtn, &QPushButton::clicked, this, [this] { if (monitor_) monitor_->markAllReviewed(); rebuildFeed(); });
    auto* clearBtn = new QPushButton("Clear feed", this);
    clearBtn->setObjectName("chip");
    connect(clearBtn, &QPushButton::clicked, this, [this] { if (monitor_) monitor_->clearFeed(); rebuildFeed(); });
    tb->addWidget(rescanBtn);
    tb->addWidget(diagBtn);
    tb->addWidget(markBtn);
    tb->addWidget(clearBtn);
    tb->addStretch();
    root->addLayout(tb);

    auto* feedTitle = new QLabel("Session feed", this);
    feedTitle->setObjectName("h3");
    root->addWidget(feedTitle);

    auto* scroll = new QScrollArea(this);
    scroll->setWidgetResizable(true);
    scroll->setFrameShape(QFrame::NoFrame);
    auto* inner = new QWidget();
    feedLayout_ = new QVBoxLayout(inner);
    feedLayout_->setContentsMargins(0, 0, 0, 0);
    feedLayout_->setSpacing(6);
    feedLayout_->addStretch();
    scroll->setWidget(inner);
    root->addWidget(scroll, 1);

    auto* bb = new QDialogButtonBox(QDialogButtonBox::Close, this);
    connect(bb, &QDialogButtonBox::rejected, this, &QDialog::reject);
    connect(bb, &QDialogButtonBox::accepted, this, &QDialog::accept);
    root->addWidget(bb);

    if (monitor_) {
        connect(monitor_, &bimport::LiveMonitor::statusChanged, this, [this](const QString& t) { status_->setText(t); });
        connect(monitor_, &bimport::LiveMonitor::feedChanged, this, [this] { rebuildFeed(); });
    }
    rebuildFeed();
    fx::popIn(this);
}

void LiveMonitorDialog::setRunning(bool on) {
    enabled_ = on;
    toggleBtn_->setText(on ? "Turn off" : "Turn on");
    toggleBtn_->setObjectName(on ? "ghost" : "accent");
    toggleBtn_->style()->unpolish(toggleBtn_);
    toggleBtn_->style()->polish(toggleBtn_);
    if (on) { if (monitor_) monitor_->start(); }
    else { if (monitor_) monitor_->stop(); status_->setText("Monitor is off."); }
    emit enabledChanged(on);
}

void LiveMonitorDialog::rebuildFeed() {
    // clear (keep the trailing stretch)
    QLayoutItem* item;
    while (feedLayout_->count() > 1 && (item = feedLayout_->takeAt(0)) != nullptr) {
        if (item->widget()) item->widget()->deleteLater();
        delete item;
    }
    if (!monitor_) return;

    const auto& feed = monitor_->feed();
    int unreviewed = 0;
    for (const auto& e : feed) if (!e.reviewed) unreviewed++;
    if (unreviewed > 0) {
        countBadge_->setText(QString("%1 new").arg(unreviewed));
        countBadge_->setVisible(true);
    } else {
        countBadge_->setVisible(false);
    }

    if (feed.isEmpty()) {
        auto* empty = new QLabel("No sign-ins captured yet this session. Log into a site in your browser to see it "
                                 "show up here instantly.", nullptr);
        empty->setObjectName("muted");
        empty->setWordWrap(true);
        feedLayout_->insertWidget(0, empty);
        return;
    }

    int insertAt = 0;
    for (const auto& e : feed) {
        const auto& c = e.cred;
        auto* card = new QFrame();
        card->setObjectName("card");
        if (!e.reviewed) card->setStyleSheet("QFrame#card { border: 1.5px solid #4ade80; }");
        auto* h = new QHBoxLayout(card);
        h->setContentsMargins(12, 9, 12, 9);
        h->setSpacing(10);

        auto* badge = new QLabel(card);
        badge->setPixmap(browserBadge(c.browser).pixmap(44, 30));
        badge->setToolTip(c.browser);
        h->addWidget(badge);

        auto* mid = new QVBoxLayout();
        mid->setSpacing(1);
        auto* site = new QLabel(c.site.isEmpty() ? "—" : c.site, card);
        site->setObjectName("h3");
        QString who = c.username.isEmpty() ? bimport::methodLabel(c.method) : c.username;
        auto* usr = new QLabel(who, card);
        usr->setObjectName("muted");
        mid->addWidget(site);
        mid->addWidget(usr);
        h->addLayout(mid, 1);

        QColor mc = methodColor(c.method);
        auto* chip = new QLabel(bimport::methodLabel(c.method), card);
        chip->setStyleSheet(QString("background:%1; color:%2; border-radius:999px; padding:3px 10px; font-size:11px; font-weight:700;")
                                .arg(QString("rgba(%1,%2,%3,0.16)").arg(mc.red()).arg(mc.green()).arg(mc.blue()), mc.name()));
        h->addWidget(chip);

        auto* when = new QLabel(relativeTime(e.seenAt), card);
        when->setObjectName("muted");
        when->setFixedWidth(64);
        h->addWidget(when);

        auto* addBtn = new QPushButton("Add to vault", card);
        addBtn->setObjectName("chip");
        connect(addBtn, &QPushButton::clicked, this, [this, c] { emit addToVaultRequested(c); });
        h->addWidget(addBtn);

        feedLayout_->insertWidget(insertAt++, card);
    }
}

