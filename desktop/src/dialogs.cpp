#include "dialogs.hpp"

#include <QCheckBox>
#include <QComboBox>
#include <QDateTime>
#include <QDialogButtonBox>
#include <QFormLayout>
#include <QHBoxLayout>
#include <QLabel>
#include <QLineEdit>
#include <QPushButton>
#include <QScrollArea>
#include <QSpinBox>
#include <QTextEdit>
#include <QTimer>
#include <QVBoxLayout>

#include "crypto.hpp"
#include "generator.hpp"

// ===========================================================================
//  EntryDialog
// ===========================================================================
EntryDialog::EntryDialog(const vault::Entry& e, const QVector<vault::Folder>& folders, QWidget* parent)
    : QDialog(parent), e_(e), folders_(folders) {
    setWindowTitle(e.title.isEmpty() ? "New item" : "Edit item");
    setModal(true);
    setMinimumWidth(460);

    auto* root = new QVBoxLayout(this);
    auto* form = new QFormLayout();
    form->setLabelAlignment(Qt::AlignLeft);
    form->setFieldGrowthPolicy(QFormLayout::AllNonFixedFieldsGrow);

    auto addLine = [&](const QString& key, const QString& label, const QString& val, bool mono = false) {
        auto* le = new QLineEdit(val, this);
        if (mono) le->setObjectName("mono");
        fields_[key] = le;
        form->addRow(label, le);
        return le;
    };

    addLine("title", "Title", e.title);

    const QString t = e.type;
    if (t == "login") {
        addLine("username", "Username / email", e.username, true);

        // password with reveal + generate
        pwEdit_ = new QLineEdit(e.password, this);
        pwEdit_->setObjectName("mono");
        pwEdit_->setEchoMode(QLineEdit::Password);
        auto* rev = new QPushButton("👁", this);
        rev->setObjectName("ghost");
        rev->setCheckable(true);
        rev->setFixedWidth(38);
        connect(rev, &QPushButton::toggled, this, [this](bool on) { pwEdit_->setEchoMode(on ? QLineEdit::Normal : QLineEdit::Password); });
        auto* gen = new QPushButton("Generate", this);
        connect(gen, &QPushButton::clicked, this, [this] {
            QDialog d(this);
            d.setWindowTitle("Password generator");
            d.setMinimumWidth(420);
            auto* v = new QVBoxLayout(&d);
            auto* g = new GeneratorWidget(&d, true);
            v->addWidget(g);
            connect(g, &GeneratorWidget::useRequested, &d, [this, &d](const QString& val) {
                pwEdit_->setText(val);
                d.accept();
            });
            d.exec();
        });
        auto* pwRow = new QHBoxLayout();
        pwRow->addWidget(pwEdit_, 1);
        pwRow->addWidget(rev);
        pwRow->addWidget(gen);
        form->addRow("Password", pwRow);
        pwStrength_ = new QLabel(this);
        pwStrength_->setObjectName("muted");
        form->addRow("", pwStrength_);
        auto upStr = [this] {
            vc::Strength s = vc::analyzeStrength(pwEdit_->text().toStdString());
            pwStrength_->setText(pwEdit_->text().isEmpty() ? "" : QString("Strength: ~%1 bits").arg(int(s.entropyBits)));
        };
        connect(pwEdit_, &QLineEdit::textChanged, this, [upStr] { upStr(); });
        upStr();

        addLine("url", "Website", e.url, true);
        addLine("totp", "2FA secret (otpauth:// or base32)", e.totp, true);
        totpPreview_ = new QLabel(this);
        totpPreview_->setObjectName("code");
        form->addRow("2FA code", totpPreview_);
        connect(fields_["totp"], &QLineEdit::textChanged, this, [this] { refreshTotp(); });
    } else if (t == "note") {
        // handled below with the big notes editor
    } else if (t == "card") {
        addLine("cardholder", "Cardholder", e.cardholder);
        addLine("cardNumber", "Card number", e.cardNumber, true);
        addLine("cardExpiry", "Expiry (MM/YY)", e.cardExpiry, true);
        addLine("cardCvv", "CVV", e.cardCvv, true);
    } else if (t == "identity") {
        addLine("fullName", "Full name", e.fullName);
        addLine("email", "Email", e.email, true);
        addLine("phone", "Phone", e.phone, true);
        address_ = new QTextEdit(e.address, this);
        address_->setFixedHeight(70);
        form->addRow("Address", address_);
    } else if (t == "totp") {
        addLine("otpSecret", "2FA secret (otpauth:// or base32)", e.otpSecret, true);
        addLine("otpIssuer", "Issuer", e.otpIssuer);
        totpPreview_ = new QLabel(this);
        totpPreview_->setObjectName("code");
        form->addRow("2FA code", totpPreview_);
        connect(fields_["otpSecret"], &QLineEdit::textChanged, this, [this] { refreshTotp(); });
    }

    // shared: folder + tags + favorite + notes
    folder_ = new QComboBox(this);
    folder_->addItem("No folder", "");
    for (const auto& f : folders_) folder_->addItem(f.icon + " " + f.name, f.id);
    int fi = folder_->findData(e.folder);
    if (fi >= 0) folder_->setCurrentIndex(fi);
    form->addRow("Folder", folder_);

    tags_ = new QLineEdit(e.tags.join(", "), this);
    form->addRow("Tags (comma separated)", tags_);

    favorite_ = new QCheckBox("Favorite", this);
    favorite_->setChecked(e.favorite);
    form->addRow("", favorite_);

    notes_ = new QTextEdit(e.notes, this);
    notes_->setFixedHeight(t == "note" ? 180 : 80);
    form->addRow(t == "note" ? "Content" : "Notes", notes_);

    root->addLayout(form);

    auto* bb = new QDialogButtonBox(QDialogButtonBox::Save | QDialogButtonBox::Cancel, this);
    bb->button(QDialogButtonBox::Save)->setObjectName("accent");
    connect(bb, &QDialogButtonBox::accepted, this, &QDialog::accept);
    connect(bb, &QDialogButtonBox::rejected, this, &QDialog::reject);
    root->addWidget(bb);

    if (totpPreview_) {
        totpTimer_ = new QTimer(this);
        connect(totpTimer_, &QTimer::timeout, this, &EntryDialog::refreshTotp);
        totpTimer_->start(1000);
        refreshTotp();
    }
}

void EntryDialog::refreshTotp() {
    if (!totpPreview_) return;
    const QString raw = e_.type == "login" ? (fields_.contains("totp") ? fields_["totp"]->text() : QString())
                                            : (fields_.contains("otpSecret") ? fields_["otpSecret"]->text() : QString());
    vc::OtpAuth p = vc::parseOtpAuth(raw.toStdString());
    if (p.secret.empty()) {
        totpPreview_->setText(raw.isEmpty() ? "—" : "invalid");
        return;
    }
    int rem = 0;
    std::string code = vc::totp(p.secret, QDateTime::currentSecsSinceEpoch(), p.digits, p.period, rem);
    QString pretty = QString::fromStdString(code);
    if (pretty.size() == 6) pretty = pretty.left(3) + " " + pretty.mid(3);
    totpPreview_->setText(QString("%1   (%2s)").arg(pretty).arg(rem));
}

vault::Entry EntryDialog::result() const {
    vault::Entry e = e_;
    auto get = [&](const QString& k) { return fields_.contains(k) ? fields_[k]->text() : QString(); };
    e.title = get("title");
    e.username = get("username");
    if (pwEdit_) {
        QString np = pwEdit_->text();
        if (np != e_.password && !e_.password.isEmpty()) e.passwordHistory.prepend(e_.password);
        if (e.passwordHistory.size() > 10) e.passwordHistory = e.passwordHistory.mid(0, 10);
        e.password = np;
    }
    e.url = get("url");
    e.totp = get("totp");
    e.cardholder = get("cardholder");
    e.cardNumber = get("cardNumber");
    if (!e.cardNumber.isEmpty()) e.cardBrand = vault::detectCardBrand(e.cardNumber);
    e.cardExpiry = get("cardExpiry");
    e.cardCvv = get("cardCvv");
    e.fullName = get("fullName");
    e.email = get("email");
    e.phone = get("phone");
    if (address_) e.address = address_->toPlainText();
    e.otpSecret = get("otpSecret");
    e.otpIssuer = get("otpIssuer");
    e.folder = folder_->currentData().toString();
    e.tags.clear();
    for (const QString& tg : tags_->text().split(',', Qt::SkipEmptyParts)) e.tags << tg.trimmed();
    e.favorite = favorite_->isChecked();
    e.notes = notes_->toPlainText();
    if (e.title.isEmpty())
        e.title = !e.url.isEmpty() ? vault::domainOf(e.url) : (!e.username.isEmpty() ? e.username : e.type);
    e.updated = QDateTime::currentMSecsSinceEpoch();
    return e;
}

// ===========================================================================
//  SettingsDialog
// ===========================================================================
SettingsDialog::SettingsDialog(const vault::Settings& s, QWidget* parent) : QDialog(parent), s_(s) {
    setWindowTitle("Settings");
    setModal(true);
    setMinimumWidth(440);
    auto* root = new QVBoxLayout(this);
    auto* form = new QFormLayout();

    autoLock_ = new QSpinBox(this);
    autoLock_->setRange(0, 120);
    autoLock_->setValue(s.autoLockMinutes);
    autoLock_->setSuffix(" min");
    form->addRow("Auto-lock after", autoLock_);

    clip_ = new QSpinBox(this);
    clip_->setRange(0, 300);
    clip_->setValue(s.clipboardClearSeconds);
    clip_->setSuffix(" s");
    form->addRow("Clear clipboard after", clip_);

    conceal_ = new QCheckBox("Conceal passwords by default", this);
    conceal_->setChecked(s.concealByDefault);
    form->addRow("", conceal_);

    lockMin_ = new QCheckBox("Lock when minimized / hidden", this);
    lockMin_->setChecked(s.lockOnMinimize);
    form->addRow("", lockMin_);

    tray_ = new QCheckBox("Minimize to system tray", this);
    tray_->setChecked(s.minimizeToTray);
    form->addRow("", tray_);

    quick_ = new QCheckBox("Quick Capture — save credentials with Ctrl+Shift+A", this);
    quick_->setChecked(s.quickCapture);
    form->addRow("", quick_);

    reveal_ = new QSpinBox(this);
    reveal_->setRange(0, 120);
    reveal_->setValue(s.revealSeconds);
    reveal_->setSuffix(" s");
    form->addRow("Re-hide revealed after", reveal_);

    theme_ = new QComboBox(this);
    theme_->addItem("Dark", "dark");
    theme_->addItem("Light", "light");
    theme_->setCurrentIndex(s.theme == "light" ? 1 : 0);
    connect(theme_, QOverload<int>::of(&QComboBox::currentIndexChanged), this, [this] {
        emit themePreview(theme_->currentData().toString());
    });
    form->addRow("Theme", theme_);

    kdf_ = new QComboBox(this);
    kdf_->addItem("Fast (64 MB)", "interactive");
    kdf_->addItem("Recommended (256 MB)", "moderate");
    kdf_->addItem("Paranoid (1 GB)", "sensitive");
    kdf_->setCurrentIndex(s.kdf == "interactive" ? 0 : s.kdf == "sensitive" ? 2 : 1);
    form->addRow("Key strength (next save)", kdf_);

    root->addLayout(form);

    auto* actions = new QHBoxLayout();
    auto* chg = new QPushButton("Change master password", this);
    auto* exp = new QPushButton("Export backup", this);
    auto* fld = new QPushButton("Open vault folder", this);
    connect(chg, &QPushButton::clicked, this, [this] { emit changeMasterRequested(); });
    connect(exp, &QPushButton::clicked, this, [this] { emit exportRequested(); });
    connect(fld, &QPushButton::clicked, this, [this] { emit openFolderRequested(); });
    actions->addWidget(chg);
    actions->addWidget(exp);
    actions->addWidget(fld);
    root->addLayout(actions);

    auto* wipe = new QPushButton("Erase this vault", this);
    wipe->setObjectName("danger");
    connect(wipe, &QPushButton::clicked, this, [this] { emit wipeRequested(); });
    root->addWidget(wipe);

    auto* bb = new QDialogButtonBox(QDialogButtonBox::Save | QDialogButtonBox::Cancel, this);
    bb->button(QDialogButtonBox::Save)->setObjectName("accent");
    connect(bb, &QDialogButtonBox::accepted, this, &QDialog::accept);
    connect(bb, &QDialogButtonBox::rejected, this, [this] {
        emit themePreview(s_.theme);  // revert live preview on cancel
        reject();
    });
    root->addWidget(bb);
}

vault::Settings SettingsDialog::result() const {
    vault::Settings s = s_;
    s.autoLockMinutes = autoLock_->value();
    s.clipboardClearSeconds = clip_->value();
    s.concealByDefault = conceal_->isChecked();
    s.lockOnMinimize = lockMin_->isChecked();
    s.minimizeToTray = tray_->isChecked();
    s.quickCapture = quick_->isChecked();
    s.revealSeconds = reveal_->value();
    s.theme = theme_->currentData().toString();
    s.kdf = kdf_->currentData().toString();
    return s;
}

// ===========================================================================
//  AuditDialog
// ===========================================================================
AuditDialog::AuditDialog(const vault::Audit& a, QWidget* parent) : QDialog(parent) {
    setWindowTitle("Security audit");
    setModal(true);
    setMinimumSize(460, 460);
    auto* root = new QVBoxLayout(this);

    const QString col = a.score >= 80 ? "#22c55e" : a.score >= 55 ? "#eab308" : "#ef4444";
    auto* score = new QLabel(QString("<span style='font-size:44px;font-weight:700;color:%1'>%2</span>"
                                     "<span style='color:#8b929e'> / 100</span>")
                                 .arg(col)
                                 .arg(a.score),
                             this);
    root->addWidget(score);
    auto* meta = new QLabel(QString("%1 logins · avg ~%2 bits entropy")
                                .arg(a.totalWithPasswords)
                                .arg(int(a.avgEntropy)),
                            this);
    meta->setObjectName("muted");
    root->addWidget(meta);

    auto* area = new QScrollArea(this);
    area->setWidgetResizable(true);
    area->setFrameShape(QFrame::NoFrame);
    auto* inner = new QWidget();
    auto* iv = new QVBoxLayout(inner);

    auto section = [&](const QString& title, const QVector<vault::AuditIssue>& items, const QString& c) {
        if (items.isEmpty()) return;
        auto* h = new QLabel(QString("<b style='color:%1'>%2</b> (%3)").arg(c).arg(title).arg(items.size()), inner);
        iv->addWidget(h);
        for (const auto& it : items) {
            auto* row = new QLabel(QString("• %1 — <span style='color:#8b929e'>%2</span>").arg(it.title.toHtmlEscaped(), it.detail), inner);
            iv->addWidget(row);
        }
    };
    section("Weak passwords", a.weak, "#ef4444");
    section("Reused passwords", a.reused, "#f97316");
    section("Aging passwords", a.old, "#eab308");
    section("Missing 2FA", a.no2fa, "#67e8f9");
    section("Insecure URLs", a.insecure, "#f97316");
    if (a.weak.isEmpty() && a.reused.isEmpty() && a.old.isEmpty() && a.no2fa.isEmpty() && a.insecure.isEmpty())
        iv->addWidget(new QLabel("<b style='color:#22c55e'>No issues found — your vault looks healthy.</b>", inner));
    iv->addStretch();
    area->setWidget(inner);
    root->addWidget(area, 1);

    auto* bb = new QDialogButtonBox(QDialogButtonBox::Close, this);
    connect(bb, &QDialogButtonBox::rejected, this, &QDialog::accept);
    connect(bb, &QDialogButtonBox::accepted, this, &QDialog::accept);
    root->addWidget(bb);
}

// ===========================================================================
//  ChangeMasterDialog
// ===========================================================================
ChangeMasterDialog::ChangeMasterDialog(QWidget* parent) : QDialog(parent) {
    setWindowTitle("Change master password");
    setModal(true);
    setMinimumWidth(380);
    auto* root = new QVBoxLayout(this);
    auto* form = new QFormLayout();
    cur_ = new QLineEdit(this);
    cur_->setEchoMode(QLineEdit::Password);
    nw_ = new QLineEdit(this);
    nw_->setEchoMode(QLineEdit::Password);
    nw2_ = new QLineEdit(this);
    nw2_->setEchoMode(QLineEdit::Password);
    form->addRow("Current password", cur_);
    form->addRow("New password", nw_);
    form->addRow("Confirm new", nw2_);
    root->addLayout(form);
    err_ = new QLabel(this);
    err_->setStyleSheet("color:#ff6b6b;");
    root->addWidget(err_);
    auto* bb = new QDialogButtonBox(QDialogButtonBox::Ok | QDialogButtonBox::Cancel, this);
    bb->button(QDialogButtonBox::Ok)->setObjectName("accent");
    connect(bb, &QDialogButtonBox::accepted, this, [this] {
        if (nw_->text() != nw2_->text()) { err_->setText("New passwords don't match."); return; }
        if (vc::analyzeStrength(nw_->text().toStdString()).score < 2) { err_->setText("Choose a stronger password."); return; }
        accept();
    });
    connect(bb, &QDialogButtonBox::rejected, this, &QDialog::reject);
    root->addWidget(bb);
}
QString ChangeMasterDialog::currentPassword() const { return cur_->text(); }
QString ChangeMasterDialog::newPassword() const { return nw_->text(); }
