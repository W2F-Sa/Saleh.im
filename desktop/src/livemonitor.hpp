// ============================================================================
//  Vault — live browser-login monitor.
//
//  Watches every detected browser profile's "Login Data" (Chromium family) or
//  "logins.json" (Firefox) file with QFileSystemWatcher. The moment a browser
//  saves a new sign-in — a fresh username/password pair, or a new federated
//  ("Sign in with Google/GitHub/…") record — this fires `newLogin` with the
//  decrypted credential, in real time, entirely on-device.
//
//  How it works:
//    1. On start(), every known profile's login-store file (and its SQLite
//       WAL/SHM siblings, when present) is added to a QFileSystemWatcher.
//    2. A first *silent* scan records a baseline (origin+username) key set
//       per profile — nothing already saved is reported as "new".
//    3. Every subsequent file-change notification is debounced (browsers can
//       touch the file several times in quick succession while writing) and
//       triggers a re-read; any credential whose key wasn't in the baseline
//       is emitted via `newLogin` and appended to a rolling session feed.
//    4. Because some editors/SQLite checkpoint operations replace the file's
//       inode, both the login file AND its containing profile directory are
//       watched, and the paths are re-armed defensively after every change.
//    5. Chromium commits new logins into the SQLite write-ahead log (-wal)
//       first and only merges into the main "Login Data" file on a later
//       checkpoint — an event QFileSystemWatcher routinely misses. To make
//       detection reliable regardless of the watcher, a short poll timer
//       re-scans on a fixed cadence, but only actually re-reads a profile
//       when its store fingerprint (size + mtime of the file and its WAL)
//       has changed, so idle profiles cost almost nothing.
//    6. A slow periodic sweep re-runs profile discovery so a browser that is
//       installed / signed into for the first time after the monitor starts
//       is picked up automatically (and silently baselined, never spammed).
//
//  Nothing here ever touches the network — it is a pure local file watcher
//  reusing the exact same decrypt path already used for the one-off import.
// ============================================================================
#pragma once

#include <QDateTime>
#include <QHash>
#include <QObject>
#include <QSet>
#include <QString>
#include <QVector>

#include "browserimport.hpp"

class QFileSystemWatcher;
class QTimer;

namespace bimport {

// One entry in the live activity feed — a captured credential plus when the
// monitor noticed it, so the UI can show a relative timestamp.
struct LiveEvent {
    Credential cred;
    qint64 seenAt = 0;  // ms epoch
    bool reviewed = false;  // user has opened/dismissed it in the feed UI
};

class LiveMonitor : public QObject {
    Q_OBJECT
public:
    explicit LiveMonitor(QObject* parent = nullptr);
    ~LiveMonitor() override;

    void start();
    void stop();
    bool isRunning() const { return running_; }

    // The rolling in-memory session feed, newest first.
    const QVector<LiveEvent>& feed() const { return feed_; }
    void markAllReviewed();
    void clearFeed();
    int unreviewedCount() const;

    // Force an immediate re-scan (e.g. a manual "check now" button).
    void rescanNow();

signals:
    void newLogin(const bimport::Credential& c);
    void statusChanged(const QString& text);
    void feedChanged();

private:
    void refreshWatchList();
    void scanProfile(const Profile& p, bool baselineOnly);
    static QString keyFor(const Credential& c);
    static qint64 storeFingerprint(const Profile& p);  // size+mtime of the login store (+WAL)

    QFileSystemWatcher* watcher_ = nullptr;
    QTimer* debounce_ = nullptr;
    QTimer* rediscoverTimer_ = nullptr;
    QTimer* pollTimer_ = nullptr;           // guaranteed-progress fallback rescan
    QHash<QString, QSet<QString>> known_;   // profile path -> known credential keys
    QHash<QString, qint64> fingerprints_;   // profile path -> last-seen store fingerprint
    QVector<LiveEvent> feed_;
    bool running_ = false;
    static constexpr int kMaxFeed = 500;
    static constexpr int kPollIntervalMs = 2500;  // WAL-safe: catch writes the watcher misses
};

}  // namespace bimport
