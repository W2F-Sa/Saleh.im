#include "livemonitor.hpp"

#include <QDateTime>
#include <QDir>
#include <QFileInfo>
#include <QFileSystemWatcher>
#include <QProcess>
#include <QSqlDatabase>
#include <QTimer>

namespace bimport {

LiveMonitor::LiveMonitor(QObject* parent) : QObject(parent) {
    // Create the timers first so the watcher callbacks below can safely
    // reference them (they only fire after construction, but keep it tidy).
    debounce_ = new QTimer(this);
    debounce_->setSingleShot(true);
    debounce_->setInterval(400);
    connect(debounce_, &QTimer::timeout, this, [this] { refreshWatchList(); });

    watcher_ = new QFileSystemWatcher(this);
    // A new login can surface either as a change to the store file itself or,
    // far more often on Chromium, as a change *inside* the profile directory
    // (the -wal sidecar being written / the file being atomically replaced).
    // Watch both and coalesce the flood of notifications into one rescan.
    connect(watcher_, &QFileSystemWatcher::fileChanged, this, [this](const QString&) { debounce_->start(); });
    connect(watcher_, &QFileSystemWatcher::directoryChanged, this, [this](const QString&) { debounce_->start(); });

    rediscoverTimer_ = new QTimer(this);
    rediscoverTimer_->setInterval(30000);  // pick up newly-installed browsers every 30s
    connect(rediscoverTimer_, &QTimer::timeout, this, [this] { refreshWatchList(); });

    // The safety net: Chromium journals new sign-ins into the WAL and only
    // folds them into "Login Data" on a later checkpoint — a moment the OS
    // file watcher very often does not report. Polling on a short, fixed
    // cadence guarantees the login is seen within a couple of seconds even
    // when no watcher event ever arrives. It is cheap because a profile is
    // only actually re-read when its store fingerprint has changed.
    pollTimer_ = new QTimer(this);
    pollTimer_->setInterval(kPollIntervalMs);
    connect(pollTimer_, &QTimer::timeout, this, [this] { refreshWatchList(); });
}

LiveMonitor::~LiveMonitor() = default;

void LiveMonitor::start() {
    if (running_) return;
    running_ = true;
    emit statusChanged("Scanning browsers…");
    refreshWatchList();   // first call baselines every newly-discovered profile
    rediscoverTimer_->start();
    pollTimer_->start();
    emit statusChanged(watcher_->files().isEmpty()
                           ? "No supported browsers with saved logins were found to watch."
                           : QString("Watching %1 login file(s) in real time.").arg(watcher_->files().size()));
}

void LiveMonitor::stop() {
    if (!running_) return;
    running_ = false;
    rediscoverTimer_->stop();
    pollTimer_->stop();
    debounce_->stop();
    const QStringList files = watcher_->files();
    if (!files.isEmpty()) watcher_->removePaths(files);
    const QStringList dirs = watcher_->directories();
    if (!dirs.isEmpty()) watcher_->removePaths(dirs);
    emit statusChanged("Live monitor stopped.");
}

void LiveMonitor::rescanNow() {
    if (!running_) return;
    refreshWatchList();
}

QString LiveMonitor::diagnostics() const {
    QStringList out;
    const bool drv = QSqlDatabase::isDriverAvailable("QSQLITE");
    out << QString("• Qt SQLite driver (QSQLITE): %1")
               .arg(drv ? "available ✓"
                        : "MISSING ✗  →  install the package  libqt6sql6-sqlite  (this is the #1 cause of "
                          "\"nothing is detected\": without it Vault cannot open Chromium's Login Data at all)");

    auto probe = [](const QString& exe, const QStringList& args) -> bool {
        QProcess p;
        p.start(exe, args);
        if (!p.waitForStarted(1200)) return false;
        p.waitForFinished(1500);
        return true;
    };
    out << QString("• sqlite3 CLI fallback: %1").arg(probe("sqlite3", {"-version"}) ? "available ✓" : "not found (optional — install 'sqlite3')");
    out << QString("• secret-tool (keyring): %1").arg(probe("secret-tool", {"--version"}) ? "available ✓" : "not found — saved passwords will stay locked (site + username are still detected)");

    const QVector<Profile> profiles = detectProfiles();
    out << "";
    out << QString("Detected %1 browser profile(s):").arg(profiles.size());
    if (profiles.isEmpty()) {
        out << "  (none) — no supported browser with saved logins was found. Have you saved at least one";
        out << "  password in Chrome/Chromium/Brave/Edge/Vivaldi/Opera/Firefox? Flatpak & Snap installs are checked too.";
    }
    for (const Profile& p : profiles) {
        QString note;
        const QVector<Credential> creds = readProfile(p, note);
        out << QString("  • %1 / %2 — %3 credential(s)%4")
                   .arg(p.browser, p.name)
                   .arg(creds.size())
                   .arg(note.isEmpty() ? QString() : QString("  ·  %1").arg(note));
    }

    out << "";
    out << QString("Monitor: %1  ·  watching %2 file(s)  ·  session feed: %3 entr(y/ies)")
               .arg(running_ ? "RUNNING" : "stopped")
               .arg(watcher_ ? watcher_->files().size() : 0)
               .arg(feed_.size());
    return out.join("\n");
}

int LiveMonitor::unreviewedCount() const {
    int n = 0;
    for (const auto& e : feed_) if (!e.reviewed) n++;
    return n;
}

void LiveMonitor::markAllReviewed() {
    for (auto& e : feed_) e.reviewed = true;
    emit feedChanged();
}

void LiveMonitor::clearFeed() {
    feed_.clear();
    emit feedChanged();
}

QString LiveMonitor::keyFor(const Credential& c) {
    // origin + username uniquely identifies "this site, this account" for our
    // purposes — a changed *password* on an already-known account is a normal
    // update, not a brand-new login, so it intentionally does not re-fire.
    return c.origin.toLower() + "\x1f" + c.username.toLower() + "\x1f" + methodKey(c.method);
}

qint64 LiveMonitor::storeFingerprint(const Profile& p) {
    // A cheap "has anything changed?" signal built from the size + mtime of
    // the login store and its write-ahead log. Chromium appends a freshly
    // saved credential to the -wal first, so watching the WAL's growth is the
    // most reliable way to notice a new sign-in before the next checkpoint.
    qint64 fp = 0;
    const QString paths[] = {p.loginData, p.loginData + "-wal"};
    for (const QString& path : paths) {
        QFileInfo fi(path);
        if (!fi.exists()) continue;
        fp = fp * 1000003 + fi.size();
        fp = fp * 1000003 + fi.lastModified().toMSecsSinceEpoch();
    }
    return fp;
}

void LiveMonitor::refreshWatchList() {
    const QVector<Profile> profiles = detectProfiles();

    // Re-arm the watcher against the current on-disk paths. Chromium/Firefox
    // sometimes replace the file's inode on checkpoint (WAL -> main db merge),
    // which silently drops it from QFileSystemWatcher — so every refresh both
    // adds new paths and re-adds ones QFileSystemWatcher may have lost. We also
    // watch each profile *directory*, because an atomic replace or a brand-new
    // -wal shows up there even when the file-level watch has gone stale.
    QStringList wantedFiles;
    QStringList wantedDirs;
    for (const auto& p : profiles) {
        wantedFiles << p.loginData;
        for (const char* ext : {"-wal", "-shm"}) {
            const QString sib = p.loginData + ext;
            if (QFileInfo::exists(sib)) wantedFiles << sib;
        }
        const QString dir = QFileInfo(p.loginData).absolutePath();
        if (!dir.isEmpty() && !wantedDirs.contains(dir)) wantedDirs << dir;
    }

    const QStringList curFiles = watcher_->files();
    QStringList addFiles;
    for (const QString& w : wantedFiles) if (!curFiles.contains(w)) addFiles << w;
    if (!addFiles.isEmpty()) watcher_->addPaths(addFiles);
    if (!wantedFiles.isEmpty()) watcher_->addPaths(wantedFiles);

    const QStringList curDirs = watcher_->directories();
    QStringList addDirs;
    for (const QString& d : wantedDirs) if (!curDirs.contains(d)) addDirs << d;
    if (!addDirs.isEmpty()) watcher_->addPaths(addDirs);

    for (const auto& p : profiles) {
        // A profile is only ever baselined the *first* time we've seen it —
        // on every later pass (whether triggered by a file change or a timer
        // tick) it gets a real diff scan, so a login that lands between events
        // is never silently swallowed.
        const bool firstTimeEver = !known_.contains(p.path);

        // Fast path for the frequent poll: if the on-disk store hasn't changed
        // since we last read this profile, skip the copy + decrypt entirely.
        const qint64 fp = storeFingerprint(p);
        if (!firstTimeEver && fp != 0 && fingerprints_.value(p.path, -1) == fp) continue;
        fingerprints_[p.path] = fp;

        scanProfile(p, firstTimeEver);
    }
}

void LiveMonitor::scanProfile(const Profile& p, bool baselineOnly) {
    QString note;
    const QVector<Credential> creds = readProfile(p, note);

    QSet<QString>& knownSet = known_[p.path];

    if (baselineOnly) {
        // Silent baseline: remember what's already there, report nothing.
        for (const auto& c : creds) knownSet.insert(keyFor(c));
        return;
    }

    for (const auto& c : creds) {
        const QString key = keyFor(c);
        if (knownSet.contains(key)) continue;
        knownSet.insert(key);

        LiveEvent ev;
        ev.cred = c;
        ev.seenAt = QDateTime::currentMSecsSinceEpoch();
        feed_.prepend(ev);
        if (feed_.size() > kMaxFeed) feed_.resize(kMaxFeed);

        emit newLogin(c);
        emit statusChanged(QString("New sign-in detected: %1 on %2")
                               .arg(c.username.isEmpty() ? methodLabel(c.method) : c.username, c.site));
    }
    if (!creds.isEmpty()) emit feedChanged();
}

}  // namespace bimport
