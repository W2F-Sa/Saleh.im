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
    const QString cfg = QDir::homePath() + "/.config";
    struct Root { const char* rel; const char* name; const char* key; };
    const Root roots[] = {
        {"google-chrome", "Chrome", "chrome"},
        {"google-chrome-beta", "Chrome Beta", "chrome"},
        {"chromium", "Chromium", "chromium"},
        {"BraveSoftware/Brave-Browser", "Brave", "brave"},
        {"microsoft-edge", "Edge", "chromium"},
        {"vivaldi", "Vivaldi", "vivaldi"},
        {"opera", "Opera", "chromium"},
    };
    for (const auto& r : roots) addChromiumRoot(out, cfg + "/" + r.rel, r.name, r.key);

    // Firefox
    const QString ff = QDir::homePath() + "/.mozilla/firefox";
    QDir ffd(ff);
    if (ffd.exists()) {
        for (const QString& sub : ffd.entryList(QDir::Dirs | QDir::NoDotAndDotDot)) {
            QString logins = ff + "/" + sub + "/logins.json";
            if (QFile::exists(logins))
                out.append({"Firefox", "firefox", sub, ff + "/" + sub, logins, QString()});
        }
    }
    return out;
}

// ---------------------------------------------------------------------------
// readers
// ---------------------------------------------------------------------------
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
    for (const char* ext : {"-wal", "-shm"}) {
        const QString src = p.loginData + ext;
        if (QFile::exists(src)) QFile::copy(src, copy + ext);
    }

    // candidate decryption keys: keyring secret first, then the "peanuts" default
    QVector<QByteArray> keys;
    QByteArray kr = keyringPassword(p.keyringApp);
    if (!kr.isEmpty()) keys.append(deriveKey(kr));
    keys.append(deriveKey("peanuts"));

    int locked = 0;
    {
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
