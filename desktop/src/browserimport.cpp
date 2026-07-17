#include "browserimport.hpp"

#include <QByteArray>
#include <QDir>
#include <QFile>
#include <QFileInfo>
#include <QJsonArray>
#include <QJsonDocument>
#include <QJsonObject>
#include <QProcess>
#include <QRegularExpression>
#include <QSqlDatabase>
#include <QSqlError>
#include <QSqlQuery>
#include <QSqlRecord>
#include <QStandardPaths>
#include <QTemporaryDir>
#include <QUrl>
#include <QVariant>

#include <openssl/evp.h>

namespace bimport {

// ---------------------------------------------------------------------------
// method labels
// ---------------------------------------------------------------------------
QString methodLabel(Method m) {
    switch (m) {
        case Method::Google: return "Google";
        case Method::GitHub: return "GitHub";
        case Method::Facebook: return "Facebook";
        case Method::Apple: return "Apple";
        case Method::Microsoft: return "Microsoft";
        case Method::Federated: return "Single sign-on";
        case Method::Unknown: return "Unknown";
        default: return "Password";
    }
}
QString methodKey(Method m) {
    switch (m) {
        case Method::Google: return "google";
        case Method::GitHub: return "github";
        case Method::Facebook: return "facebook";
        case Method::Apple: return "apple";
        case Method::Microsoft: return "microsoft";
        case Method::Federated: return "sso";
        case Method::Unknown: return "unknown";
        default: return "password";
    }
}

static Method methodFromFederation(const QString& fedUrl) {
    if (fedUrl.isEmpty()) return Method::Password;
    QString h = QUrl(fedUrl.contains("://") ? fedUrl : "https://" + fedUrl).host().toLower();
    if (h.contains("google")) return Method::Google;
    if (h.contains("github")) return Method::GitHub;
    if (h.contains("facebook")) return Method::Facebook;
    if (h.contains("apple")) return Method::Apple;
    if (h.contains("microsoft") || h.contains("live.com") || h.contains("azure")) return Method::Microsoft;
    return Method::Federated;
}

static QString prettyHost(const QString& url) {
    QUrl u(url.contains("://") ? url : "https://" + url);
    QString h = u.host();
    if (h.startsWith("www.")) h = h.mid(4);
    if (h.isEmpty()) {
        // signon_realm like "android://...@com.example" or "https://site/"
        QString s = url;
        s.remove(QRegularExpression("^[a-z]+://"));
        s = s.split('/').value(0);
        return s.isEmpty() ? url : s;
    }
    return h;
}

// ---------------------------------------------------------------------------
// crypto (OpenSSL): Linux Chromium "v10/v11" scheme
// ---------------------------------------------------------------------------
static QByteArray deriveKey(const QByteArray& password) {
    QByteArray key(16, 0);
    const QByteArray salt = "saltysalt";
    PKCS5_PBKDF2_HMAC_SHA1(password.constData(), password.size(),
                           reinterpret_cast<const unsigned char*>(salt.constData()), salt.size(),
                           1, 16, reinterpret_cast<unsigned char*>(key.data()));
    return key;
}

static bool aes128cbc(const QByteArray& ct, const QByteArray& key, QByteArray& out) {
    if (ct.isEmpty() || (ct.size() % 16) != 0) return false;
    QByteArray iv(16, ' ');  // Chromium on Linux uses 16 spaces
    EVP_CIPHER_CTX* ctx = EVP_CIPHER_CTX_new();
    if (!ctx) return false;
    bool ok = false;
    QByteArray buf(ct.size() + 16, 0);
    int outl = 0, finl = 0;
    if (EVP_DecryptInit_ex(ctx, EVP_aes_128_cbc(), nullptr,
                           reinterpret_cast<const unsigned char*>(key.constData()),
                           reinterpret_cast<const unsigned char*>(iv.constData())) == 1 &&
        EVP_DecryptUpdate(ctx, reinterpret_cast<unsigned char*>(buf.data()), &outl,
                          reinterpret_cast<const unsigned char*>(ct.constData()), ct.size()) == 1 &&
        EVP_DecryptFinal_ex(ctx, reinterpret_cast<unsigned char*>(buf.data()) + outl, &finl) == 1) {
        buf.resize(outl + finl);
        out = buf;
        ok = true;
    }
    EVP_CIPHER_CTX_free(ctx);
    return ok;
}

static bool looksPrintable(const QByteArray& b) {
    if (b.isEmpty()) return false;
    for (unsigned char c : b)
        if (c != '\t' && c != '\n' && c != '\r' && (c < 0x20 || c == 0x7f)) return false;
    QString s = QString::fromUtf8(b);
    return !s.contains(QChar(QChar::ReplacementCharacter));
}

// Try to decrypt one Chromium password blob with the given candidate keys.
static bool decryptChromium(const QByteArray& blob, const QVector<QByteArray>& keys, QString& out) {
    if (blob.isEmpty()) return false;
    QByteArray ct = blob;
    const QByteArray prefix = blob.left(3);
    if (prefix == "v10" || prefix == "v11") ct = blob.mid(3);
    else {
        // legacy: some old Linux builds stored the password in the clear
        if (looksPrintable(blob)) { out = QString::fromUtf8(blob); return true; }
    }
    for (const QByteArray& key : keys) {
        QByteArray dec;
        if (!aes128cbc(ct, key, dec)) continue;
        // newer Chrome prepends a 32-byte SHA-256 of the origin — strip if present
        if (dec.size() > 32 && !looksPrintable(dec.left(32)) && looksPrintable(dec.mid(32))) dec = dec.mid(32);
        if (looksPrintable(dec)) { out = QString::fromUtf8(dec); return true; }
    }
    return false;
}

// Fetch the browser's "Safe Storage" password from the Secret Service, if the
// user's keyring is unlocked and secret-tool is installed. Silent on failure.
static QByteArray keyringPassword(const QString& app) {
    if (app.isEmpty()) return {};
    QProcess p;
    p.start("secret-tool", {"lookup", "application", app});
    if (!p.waitForFinished(1500)) { p.kill(); return {}; }
    if (p.exitStatus() != QProcess::NormalExit || p.exitCode() != 0) return {};
    QByteArray out = p.readAllStandardOutput();
    // secret-tool prints the secret without a trailing newline
    return out;
}

// ---------------------------------------------------------------------------
// profile detection
// ---------------------------------------------------------------------------
static void addChromiumRoot(QVector<Profile>& out, const QString& root, const QString& browser,
                            const QString& keyApp) {
    QDir dir(root);
    if (!dir.exists()) return;
    const QStringList candidates = dir.entryList(QDir::Dirs | QDir::NoDotAndDotDot);
    for (const QString& sub : candidates) {
        if (sub == "System Profile" || sub == "Guest Profile") continue;
        if (sub != "Default" && !sub.startsWith("Profile")) continue;
        QString login = root + "/" + sub + "/Login Data";
        if (QFile::exists(login))
            out.append({browser, "chromium", sub, root + "/" + sub, login, keyApp});
    }
}

QVector<Profile> detectProfiles() {
    QVector<Profile> out;
    const QString home = QDir::homePath();

    // Each Chromium browser can live in several places on Linux: the native
    // ~/.config path, a Flatpak sandbox (~/.var/app/<id>/config/...) or a Snap
    // (~/snap/<pkg>/...). Missing these is the #1 reason "nothing is detected"
    // on modern distros (e.g. Chrome/Brave via Flatpak, Chromium via Snap).
    struct Root { QString path; const char* name; const char* key; };
    QVector<Root> roots;
    auto add = [&](const QString& path, const char* name, const char* key) { roots.push_back({path, name, key}); };

    const QString cfg = home + "/.config";
    const QString var = home + "/.var/app";
    const QString snap = home + "/snap";

    // Chrome
    add(cfg + "/google-chrome", "Chrome", "chrome");
    add(cfg + "/google-chrome-beta", "Chrome Beta", "chrome");
    add(cfg + "/google-chrome-unstable", "Chrome Dev", "chrome");
    add(var + "/com.google.Chrome/config/google-chrome", "Chrome", "chrome");
    // Chromium
    add(cfg + "/chromium", "Chromium", "chromium");
    add(var + "/org.chromium.Chromium/config/chromium", "Chromium", "chromium");
    add(snap + "/chromium/common/chromium", "Chromium", "chromium");
    // Brave
    add(cfg + "/BraveSoftware/Brave-Browser", "Brave", "brave");
    add(var + "/com.brave.Browser/config/BraveSoftware/Brave-Browser", "Brave", "brave");
    // Edge
    add(cfg + "/microsoft-edge", "Edge", "chromium");
    add(var + "/com.microsoft.Edge/config/microsoft-edge", "Edge", "chromium");
    // Vivaldi
    add(cfg + "/vivaldi", "Vivaldi", "vivaldi");
    add(var + "/com.vivaldi.Vivaldi/config/vivaldi", "Vivaldi", "vivaldi");
    // Opera (single-profile: Login Data lives directly in the root)
    add(cfg + "/opera", "Opera", "chromium");
    add(var + "/com.opera.Opera/config/opera", "Opera", "chromium");

    for (const auto& r : roots) {
        addChromiumRoot(out, r.path, r.name, r.key);
        // Opera & some single-profile builds keep "Login Data" in the root itself.
        const QString directLogin = r.path + "/Login Data";
        if (QFile::exists(directLogin)) {
            bool already = false;
            for (const auto& e : out) if (e.loginData == directLogin) { already = true; break; }
            if (!already) out.append({QString(r.name), "chromium", "Default", r.path, directLogin, QString(r.key)});
        }
    }

    // Firefox — native, Flatpak and Snap locations.
    const QStringList ffRoots = {
        home + "/.mozilla/firefox",
        var + "/org.mozilla.firefox/.mozilla/firefox",
        snap + "/firefox/common/.mozilla/firefox",
    };
    for (const QString& ff : ffRoots) {
        QDir ffd(ff);
        if (!ffd.exists()) continue;
        for (const QString& sub : ffd.entryList(QDir::Dirs | QDir::NoDotAndDotDot)) {
            QString logins = ff + "/" + sub + "/logins.json";
            if (QFile::exists(logins)) {
                bool already = false;
                for (const auto& e : out) if (e.loginData == logins) { already = true; break; }
                if (!already) out.append({"Firefox", "firefox", sub, ff + "/" + sub, logins, QString()});
            }
        }
    }
    return out;
}

// ---------------------------------------------------------------------------
// readers
// ---------------------------------------------------------------------------
// Fallback path: read a Chromium "Login Data" copy with the `sqlite3` CLI when
// the Qt SQLite driver plugin isn't installed. This can't decrypt passwords
// (they stay in the encrypted blob) but it recovers the site + username, which
// is exactly what the live monitor needs to flag a *new* sign-in.
static QVector<Credential> readChromiumViaCli(const QString& dbCopy, const Profile& p) {
    QVector<Credential> out;
    const QString sep = QStringLiteral("\x1f");
    QProcess proc;
    proc.start("sqlite3", QStringList{ "-batch", "-noheader", "-separator", sep, dbCopy,
        "SELECT origin_url, username_value, signon_realm, blacklisted_by_user, coalesce(federation_url,'') FROM logins" });
    if (!proc.waitForStarted(1500)) return out;                    // sqlite3 not installed
    if (!proc.waitForFinished(6000)) { proc.kill(); return out; }
    if (proc.exitStatus() != QProcess::NormalExit || proc.exitCode() != 0) return out;
    const QString data = QString::fromUtf8(proc.readAllStandardOutput());
    const QStringList lines = data.split('\n', Qt::SkipEmptyParts);
    for (const QString& line : lines) {
        const QStringList f = line.split(sep);
        if (f.size() < 5) continue;
        if (f[3].trimmed() == "1") continue;                       // blacklisted_by_user
        Credential c;
        c.browser = p.browser;
        c.origin = f[0].isEmpty() ? f[2] : f[0];
        c.site = prettyHost(c.origin.isEmpty() ? f[2] : c.origin);
        c.username = f[1];
        const QString fed = f[4];
        c.method = methodFromFederation(fed);
        if (c.method != Method::Password) c.provider = QUrl(fed.contains("://") ? fed : "https://" + fed).host();
        if (c.username.isEmpty() && c.method == Method::Password) continue;
        out.append(c);
        if (out.size() > 4000) break;
    }
    return out;
}

static QVector<Credential> readChromium(const Profile& p, QString& note) {
    QVector<Credential> out;
    QTemporaryDir tmp;
    if (!tmp.isValid()) { note = "Could not create a temp copy."; return out; }
    // copy to the SAME base name (+ any WAL/SHM siblings) so SQLite sees a
    // consistent snapshot even while the browser holds the file open.
    const QString copy = tmp.path() + "/Login Data";
    QFile::remove(copy);
    if (!QFile::copy(p.loginData, copy)) { note = "Could not read the login database."; return out; }
    QFile::setPermissions(copy, QFile::ReadOwner | QFile::WriteOwner);
    // Copy ONLY the write-ahead log, never the -shm shared-memory index. A
    // just-saved Chromium login lives in the -wal until the next checkpoint;
    // SQLite replays it on open and rebuilds a fresh -shm. Copying a stale
    // -shm alongside it can make SQLite believe the WAL is already merged and
    // skip it entirely — which is exactly how a brand-new sign-in goes unseen.
    QFile::remove(copy + "-shm");
    {
        const QString wal = p.loginData + "-wal";
        if (QFile::exists(wal)) QFile::copy(wal, copy + "-wal");
    }

    // candidate decryption keys: keyring secret first, then the "peanuts" default
    QVector<QByteArray> keys;
    QByteArray kr = keyringPassword(p.keyringApp);
    if (!kr.isEmpty()) keys.append(deriveKey(kr));
    keys.append(deriveKey("peanuts"));

    int locked = 0;
    const bool haveDriver = QSqlDatabase::isDriverAvailable("QSQLITE");
    if (haveDriver) {
        const QString conn = "bimport_" + QString::number(reinterpret_cast<quintptr>(&p)) + "_" + p.name;
        QSqlDatabase db = QSqlDatabase::addDatabase("QSQLITE", conn);
        db.setDatabaseName(copy);  // our private, writable copy — WAL replay is fine
        if (db.open()) {
            QSqlQuery q(db);
            bool ok = q.exec("SELECT origin_url, username_value, password_value, signon_realm, "
                             "blacklisted_by_user, federation_url, date_created, times_used FROM logins");
            if (!ok) ok = q.exec("SELECT origin_url, username_value, password_value, signon_realm, "
                                 "blacklisted_by_user FROM logins");
            const bool hasFed = q.record().indexOf("federation_url") >= 0;
            while (q.next()) {
                if (q.value("blacklisted_by_user").toInt() == 1) continue;
                Credential c;
                c.browser = p.browser;
                c.origin = q.value("origin_url").toString();
                if (c.origin.isEmpty()) c.origin = q.value("signon_realm").toString();
                c.site = prettyHost(c.origin.isEmpty() ? q.value("signon_realm").toString() : c.origin);
                c.username = q.value("username_value").toString();
                const QString fed = hasFed ? q.value("federation_url").toString() : QString();
                c.method = methodFromFederation(fed);
                if (c.method != Method::Password) c.provider = QUrl(fed.contains("://") ? fed : "https://" + fed).host();
                if (q.record().indexOf("date_created") >= 0) {
                    // Chrome epoch = microseconds since 1601-01-01
                    qint64 chromeTime = q.value("date_created").toLongLong();
                    if (chromeTime > 0) c.created = chromeTime / 1000 - 11644473600000LL;
                }
                c.timesUsed = q.record().indexOf("times_used") >= 0 ? q.value("times_used").toInt() : 0;
                const QByteArray blob = q.value("password_value").toByteArray();
                if (c.method == Method::Password) {
                    QString pw;
                    if (!blob.isEmpty() && decryptChromium(blob, keys, pw)) { c.password = pw; c.passwordKnown = true; }
                    else if (!blob.isEmpty()) locked++;
                }
                if (c.username.isEmpty() && c.password.isEmpty() && c.method == Method::Password) continue;
                out.append(c);
                if (out.size() > 4000) break;
            }
            db.close();
        } else {
            note = "Could not open the login database.";
        }
        QSqlDatabase::removeDatabase(conn);
    }

    // Fallback: if the Qt SQLite driver is missing (or found nothing), try the
    // sqlite3 CLI so detection still works on systems without libqt6sql6-sqlite.
    if (out.isEmpty()) {
        QVector<Credential> cli = readChromiumViaCli(copy, p);
        if (!cli.isEmpty()) {
            note = QString("%1 login(s) via sqlite3 (passwords not decrypted)").arg(cli.size());
            return cli;
        }
        if (!haveDriver) {
            note = "Qt SQLite driver missing — install 'libqt6sql6-sqlite' (or 'sqlite3') to read Chromium logins.";
            return out;
        }
    }

    if (locked > 0)
        note = QString("%1 login(s) · %2 password(s) locked by the system keyring").arg(out.size()).arg(locked);
    else
        note = QString("%1 login(s) recovered").arg(out.size());
    return out;
}

static QVector<Credential> readFirefox(const Profile& p, QString& note) {
    QVector<Credential> out;
    QFile f(p.loginData);
    if (!f.open(QIODevice::ReadOnly)) { note = "Could not read logins.json."; return out; }
    QJsonParseError err{};
    QJsonDocument doc = QJsonDocument::fromJson(f.readAll(), &err);
    f.close();
    if (err.error != QJsonParseError::NoError) { note = "logins.json is not valid JSON."; return out; }
    const QJsonArray arr = doc.object().value("logins").toArray();
    for (const auto& v : arr) {
        QJsonObject o = v.toObject();
        Credential c;
        c.browser = "Firefox";
        c.origin = o.value("hostname").toString();
        c.site = prettyHost(c.origin);
        c.method = Method::Password;
        c.timesUsed = o.value("timesUsed").toInt();
        c.created = static_cast<qint64>(o.value("timeCreated").toDouble());
        // Firefox stores username & password NSS-encrypted; we can list the site only.
        c.username = QString();
        c.passwordKnown = false;
        out.append(c);
        if (out.size() > 4000) break;
    }
    note = QString("%1 Firefox site(s) — usernames & passwords are NSS-encrypted").arg(out.size());
    return out;
}

QVector<Credential> readProfile(const Profile& p, QString& note) {
    if (p.family == "firefox") return readFirefox(p, note);
    return readChromium(p, note);
}

// ---------------------------------------------------------------------------
// self-test (validates the decryption path without a real browser)
// ---------------------------------------------------------------------------
static bool aes128cbcEncrypt(const QByteArray& pt, const QByteArray& key, QByteArray& out) {
    QByteArray iv(16, ' ');
    EVP_CIPHER_CTX* ctx = EVP_CIPHER_CTX_new();
    if (!ctx) return false;
    bool ok = false;
    QByteArray buf(pt.size() + 32, 0);
    int outl = 0, finl = 0;
    if (EVP_EncryptInit_ex(ctx, EVP_aes_128_cbc(), nullptr,
                           reinterpret_cast<const unsigned char*>(key.constData()),
                           reinterpret_cast<const unsigned char*>(iv.constData())) == 1 &&
        EVP_EncryptUpdate(ctx, reinterpret_cast<unsigned char*>(buf.data()), &outl,
                          reinterpret_cast<const unsigned char*>(pt.constData()), pt.size()) == 1 &&
        EVP_EncryptFinal_ex(ctx, reinterpret_cast<unsigned char*>(buf.data()) + outl, &finl) == 1) {
        buf.resize(outl + finl);
        out = buf;
        ok = true;
    }
    EVP_CIPHER_CTX_free(ctx);
    return ok;
}

bool selfTest() {
    const QByteArray key = deriveKey("peanuts");
    const QString secret = "hunter2-\u0635\u0627\u0644\u062d-\u2713";  // unicode round-trip
    QByteArray ct;
    if (!aes128cbcEncrypt(secret.toUtf8(), key, ct)) return false;
    QByteArray blob = QByteArray("v10") + ct;
    QString out;
    return decryptChromium(blob, {deriveKey("peanuts")}, out) && out == secret;
}

}  // namespace bimport
