// ============================================================================
//  Vault — headless UI smoke test.
//
//  Constructs the full main window plus every dialog against a synthetic vault
//  and cycles through every colour palette. Run offscreen to confirm the whole
//  UI surface builds, styles and renders without crashing:
//
//     QT_QPA_PLATFORM=offscreen ./build/vault-smoke
//
//  It never touches a real vault file and exits automatically.
// ============================================================================
#include <QApplication>
#include <QDateTime>
#include <QTimer>

#include <cstdio>

#include "browserimport.hpp"
#include "commandpalette.hpp"
#include "crypto.hpp"
#include "dialogs.hpp"
#include "extradialogs.hpp"
#include "generator.hpp"
#include "mainwindow.hpp"
#include "theme.hpp"
#include "vault.hpp"

static vault::Entry sample(const QString& type, const QString& title) {
    vault::Entry e = vault::newEntry(type);
    e.title = title;
    e.username = "user@example.com";
    e.password = "S0me-Str0ng-Pass!";
    e.url = "https://example.com";
    e.notes = "notes";
    e.tags = {"demo", type};
    e.customFields = {{"Recovery", "abcd-efgh", true}, {"Reference", "R-102", false}};
    e.passwordHistory = {"old-one-1", "older-two-2"};
    return e;
}

int main(int argc, char** argv) {
    QApplication app(argc, argv);
    if (!vc::init()) { std::printf("sodium init failed\n"); return 2; }
    std::printf("browser-crypto self-test: %s\n", bimport::selfTest() ? "OK" : "FAILED");
    if (!bimport::selfTest()) return 3;

    vault::Data data;
    data.version = 2;
    data.folders = {{"personal", "Personal", "◆"}, {"work", "Work", "▲"}};
    for (const auto& t : vault::types()) data.entries.append(sample(t.id, "Demo " + t.label));
    data.entries[3].trashed = true;                       // one in the trash
    data.entries[2].expiresAt = QDateTime::currentMSecsSinceEpoch();  // one expiring

    // exercise every palette's stylesheet
    for (const auto& p : theme::palettes()) {
        QString qss = theme::qssFor(p);
        if (qss.isEmpty()) { std::printf("empty QSS for %s\n", qPrintable(p.id)); return 1; }
    }
    app.setStyleSheet(theme::qss("carbon"));

    // main window
    auto* w = new MainWindow("/tmp/__vault_smoke_should_not_write.svlt", "pw", {}, "moderate", data);
    w->show();

    // every dialog / widget (non-modal show, no exec)
    (new EntryDialog(sample("login", "Edit me"), data.folders))->show();
    (new EntryDialog(sample("ssh", "SSH me"), data.folders))->show();
    (new EntryDialog(sample("crypto", "Wallet"), data.folders))->show();
    (new SettingsDialog(data.settings))->show();
    (new AuditDialog(vault::audit(data.entries)))->show();
    (new StatsDialog(data))->show();
    (new ThemePickerDialog("carbon"))->show();
    (new PasswordHistoryDialog("Demo", {"a1b2c3d4", "z9y8x7w6"}))->show();
    (new AboutDialog())->show();
    (new BrowserImportDialog())->show();
    (new GeneratorWidget(nullptr, true))->show();

    QVector<CommandPalette::Item> items = {{"action", "lock", "Lock", "", "🔒"},
                                           {"entry", data.entries.first().id, "Demo Login", "login", "🔑"}};
    (new CommandPalette(items))->show();

    QTimer::singleShot(400, &app, &QApplication::quit);
    int rc = app.exec();
    std::printf(rc == 0 ? "SMOKE OK (%d palettes, %d entries)\n" : "SMOKE FAILED\n",
                int(theme::palettes().size()), int(data.entries.size()));
    return rc;
}
