// ============================================================================
//  Vault — data model, storage & audit (implementation)
// ============================================================================
#include "vault.hpp"

#include <QCryptographicHash>
#include <QDateTime>
#include <QDir>
#include <QFile>
#include <QFileInfo>
#include <QHash>
#include <QJsonArray>
#include <QJsonDocument>
#include <QJsonObject>
#include <QRandomGenerator>
#include <QSaveFile>
#include <QStandardPaths>
#include <QUrl>

#include <cmath>

namespace vault {

// ---- Qt <-> std / bytes bridges -------------------------------------------
static vc::Bytes toBytes(const QByteArray& b) {
    const auto* p = reinterpret_cast<const unsigned char*>(b.constData());
    return vc::Bytes(p, p + b.size());
}
static QByteArray toQBA(const vc::Bytes& b) {
    return QByteArray(reinterpret_cast<const char*>(b.data()), static_cast<int>(b.size()));
}
static std::string sstr(const QString& s) { return s.toStdString(); }

// ---------------------------------------------------------------------------
// model <-> JSON
// ---------------------------------------------------------------------------
static QJsonObject entryToJson(const Entry& e) {
    QJsonObject o;
    o["id"] = e.id;
    o["type"] = e.type;
    o["title"] = e.title;
    o["favorite"] = e.favorite;
    o["folder"] = e.folder;
    o["tags"] = QJsonArray::fromStringList(e.tags);
    o["notes"] = e.notes;
    o["created"] = static_cast<double>(e.created);
    o["updated"] = static_cast<double>(e.updated);
    o["usedAt"] = static_cast<double>(e.usedAt);
    o["username"] = e.username;
    o["password"] = e.password;
    o["url"] = e.url;
    o["totp"] = e.totp;
    o["passwordHistory"] = QJsonArray::fromStringList(e.passwordHistory);
    o["cardholder"] = e.cardholder;
    o["cardNumber"] = e.cardNumber;
    o["cardExpiry"] = e.cardExpiry;
    o["cardCvv"] = e.cardCvv;
    o["cardBrand"] = e.cardBrand;
    o["fullName"] = e.fullName;
    o["email"] = e.email;
    o["phone"] = e.phone;
    o["address"] = e.address;
    o["otpSecret"] = e.otpSecret;
    o["otpIssuer"] = e.otpIssuer;
    return o;
}

static Entry entryFromJson(const QJsonObject& o) {
    Entry e;
    e.id = o["id"].toString();
    e.type = o["type"].toString("login");
    e.title = o["title"].toString();
    e.favorite = o["favorite"].toBool();
    e.folder = o["folder"].toString();
    for (auto v : o["tags"].toArray()) e.tags << v.toString();
    e.notes = o["notes"].toString();
    e.created = static_cast<qint64>(o["created"].toDouble());
    e.updated = static_cast<qint64>(o["updated"].toDouble());
    e.usedAt = static_cast<qint64>(o["usedAt"].toDouble());
    e.username = o["username"].toString();
    e.password = o["password"].toString();
    e.url = o["url"].toString();
    e.totp = o["totp"].toString();
    for (auto v : o["passwordHistory"].toArray()) e.passwordHistory << v.toString();
    e.cardholder = o["cardholder"].toString();
    e.cardNumber = o["cardNumber"].toString();
    e.cardExpiry = o["cardExpiry"].toString();
    e.cardCvv = o["cardCvv"].toString();
    e.cardBrand = o["cardBrand"].toString();
    e.fullName = o["fullName"].toString();
    e.email = o["email"].toString();
    e.phone = o["phone"].toString();
    e.address = o["address"].toString();
    e.otpSecret = o["otpSecret"].toString();
    e.otpIssuer = o["otpIssuer"].toString();
    return e;
}

QByteArray serialize(const Data& d) {
    QJsonObject root;
    root["version"] = d.version;
    root["createdAt"] = static_cast<double>(d.createdAt);

    QJsonArray entries;
    for (const auto& e : d.entries) entries.append(entryToJson(e));
    root["entries"] = entries;

    QJsonArray folders;
    for (const auto& f : d.folders) {
        QJsonObject o;
        o["id"] = f.id;
        o["name"] = f.name;
        o["icon"] = f.icon;
        folders.append(o);
    }
    root["folders"] = folders;

    QJsonObject s;
    s["autoLockMinutes"] = d.settings.autoLockMinutes;
    s["clipboardClearSeconds"] = d.settings.clipboardClearSeconds;
    s["concealByDefault"] = d.settings.concealByDefault;
    s["lockOnMinimize"] = d.settings.lockOnMinimize;
    s["minimizeToTray"] = d.settings.minimizeToTray;
    s["quickCapture"] = d.settings.quickCapture;
    s["revealSeconds"] = d.settings.revealSeconds;
    s["theme"] = d.settings.theme;
    s["kdf"] = d.settings.kdf;
    root["settings"] = s;

    return QJsonDocument(root).toJson(QJsonDocument::Compact);
}

bool deserialize(const QByteArray& json, Data& out) {
    QJsonParseError err{};
    QJsonDocument doc = QJsonDocument::fromJson(json, &err);
    if (err.error != QJsonParseError::NoError || !doc.isObject()) return false;
    QJsonObject root = doc.object();
    out.version = root["version"].toInt(1);
    out.createdAt = static_cast<qint64>(root["createdAt"].toDouble());

    out.entries.clear();
    for (auto v : root["entries"].toArray()) out.entries.append(entryFromJson(v.toObject()));

    out.folders.clear();
    for (auto v : root["folders"].toArray()) {
        QJsonObject o = v.toObject();
        out.folders.append({o["id"].toString(), o["name"].toString(), o["icon"].toString()});
    }

    QJsonObject s = root["settings"].toObject();
    out.settings.autoLockMinutes = s["autoLockMinutes"].toInt(5);
    out.settings.clipboardClearSeconds = s["clipboardClearSeconds"].toInt(20);
    out.settings.concealByDefault = s["concealByDefault"].toBool(true);
    out.settings.lockOnMinimize = s["lockOnMinimize"].toBool(true);
    out.settings.minimizeToTray = s["minimizeToTray"].toBool(true);
    out.settings.quickCapture = s["quickCapture"].toBool(true);
    out.settings.revealSeconds = s["revealSeconds"].toInt(20);
    out.settings.theme = s["theme"].toString("dark");
    out.settings.kdf = s["kdf"].toString("moderate");
    return true;
}

// ---------------------------------------------------------------------------
// container <-> on-disk JSON envelope
// ---------------------------------------------------------------------------
QByteArray containerToJson(const vc::Container& c) {
    QJsonObject o;
    o["magic"] = "SVLT-CPP";
    o["version"] = c.version;
    o["kdf"] = "argon2id";
    o["salt"] = QString::fromLatin1(toQBA(c.salt).toBase64());
    o["ops"] = static_cast<double>(c.ops);
    o["mem"] = static_cast<double>(c.mem);
    o["nonce"] = QString::fromLatin1(toQBA(c.nonce).toBase64());
    o["keyfile"] = c.keyfile;
    o["ct"] = QString::fromLatin1(toQBA(c.ct).toBase64());
    return QJsonDocument(o).toJson(QJsonDocument::Indented);
}

bool containerFromJson(const QByteArray& json, vc::Container& out) {
    QJsonParseError err{};
    QJsonDocument doc = QJsonDocument::fromJson(json, &err);
    if (err.error != QJsonParseError::NoError || !doc.isObject()) return false;
    QJsonObject o = doc.object();
    if (o["magic"].toString() != "SVLT-CPP") return false;
    out.version = o["version"].toInt(1);
    out.salt = toBytes(QByteArray::fromBase64(o["salt"].toString().toLatin1()));
    out.ops = static_cast<unsigned long long>(o["ops"].toDouble());
    out.mem = static_cast<std::size_t>(o["mem"].toDouble());
    out.nonce = toBytes(QByteArray::fromBase64(o["nonce"].toString().toLatin1()));
    out.keyfile = o["keyfile"].toBool();
    out.ct = toBytes(QByteArray::fromBase64(o["ct"].toString().toLatin1()));
    return true;
}

// ---------------------------------------------------------------------------
// paths / kdf
// ---------------------------------------------------------------------------
QString defaultVaultPath() {
    QString dir = QStandardPaths::writableLocation(QStandardPaths::GenericDataLocation) + "/SalehVault";
    QDir().mkpath(dir);
    return dir + "/vault.svlt";
}

bool vaultExists(const QString& path) { return QFile::exists(path); }

vc::KdfParams kdfFor(const QString& preset) {
    if (preset == "interactive") return vc::kdfInteractive();
    if (preset == "sensitive") return vc::kdfSensitive();
    return vc::kdfModerate();
}

bool metaKeyfileRequired(const QString& path) {
    QFile f(path);
    if (!f.open(QIODevice::ReadOnly)) return false;
    vc::Container c;
    if (!containerFromJson(f.readAll(), c)) return false;
    return c.keyfile;
}

// ---------------------------------------------------------------------------
// file operations
// ---------------------------------------------------------------------------
static bool writeContainer(const QString& path, const vc::Container& c, QString& err) {
    QSaveFile f(path);
    if (!f.open(QIODevice::WriteOnly)) {
        err = "Cannot open vault file for writing.";
        return false;
    }
    f.write(containerToJson(c));
    if (!f.commit()) {
        err = "Failed to write the vault file.";
        return false;
    }
    QFile::setPermissions(path, QFile::ReadOwner | QFile::WriteOwner);  // 0600
    return true;
}

bool createVault(const QString& path, const QString& password, const QByteArray& keyfile,
                 const QString& kdfPreset, Data& outData, QString& err) {
    Data d;
    d.version = 1;
    d.createdAt = QDateTime::currentMSecsSinceEpoch();
    d.folders = {{"personal", "Personal", "◆"}, {"work", "Work", "▲"}, {"finance", "Finance", "$"}};
    d.settings.kdf = kdfPreset;
    try {
        vc::Container c = vc::seal(sstr(QString::fromUtf8(serialize(d))), sstr(password), toBytes(keyfile), kdfFor(kdfPreset));
        if (!writeContainer(path, c, err)) return false;
    } catch (const std::exception& e) {
        err = QString::fromUtf8(e.what());
        return false;
    }
    outData = d;
    return true;
}

bool unlock(const QString& path, const QString& password, const QByteArray& keyfile, Data& out, QString& err) {
    QFile f(path);
    if (!f.open(QIODevice::ReadOnly)) {
        err = "No vault found.";
        return false;
    }
    vc::Container c;
    if (!containerFromJson(f.readAll(), c)) {
        err = "The vault file is corrupt or not a valid vault.";
        return false;
    }
    std::string plain;
    if (!vc::open(c, sstr(password), toBytes(keyfile), plain)) {
        err = "Wrong master password or keyfile.";
        return false;
    }
    if (!deserialize(QByteArray::fromStdString(plain), out)) {
        err = "Decrypted data could not be parsed.";
        return false;
    }
    return true;
}

bool save(const QString& path, const QString& password, const QByteArray& keyfile,
          const QString& kdfPreset, const Data& data, QString& err) {
    try {
        vc::Container c = vc::seal(sstr(QString::fromUtf8(serialize(data))), sstr(password), toBytes(keyfile), kdfFor(kdfPreset));
        return writeContainer(path, c, err);
    } catch (const std::exception& e) {
        err = QString::fromUtf8(e.what());
        return false;
    }
}

bool exportBackup(const QString& srcPath, const QString& dstPath, QString& err) {
    QFile::remove(dstPath);
    if (!QFile::copy(srcPath, dstPath)) {
        err = "Could not write the backup file.";
        return false;
    }
    return true;
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------
QString newId() {
    return QString::fromLatin1(toQBA(vc::randomBytes(12)).toHex());
}

Entry newEntry(const QString& type) {
    Entry e;
    e.id = newId();
    e.type = type;
    e.created = e.updated = QDateTime::currentMSecsSinceEpoch();
    return e;
}

QString detectCardBrand(const QString& number) {
    QString n = number;
    n.remove(' ');
    if (n.startsWith('4')) return "Visa";
    if (n.startsWith("34") || n.startsWith("37")) return "Amex";
    if (n.startsWith('5')) return "Mastercard";
    if (n.startsWith("6")) return "Discover";
    if (n.startsWith("35")) return "JCB";
    if (n.startsWith("62")) return "UnionPay";
    return "Card";
}

QString domainOf(const QString& url) {
    if (url.isEmpty()) return {};
    QUrl u(url.contains("://") ? url : "https://" + url);
    QString h = u.host();
    if (h.startsWith("www.")) h = h.mid(4);
    return h.isEmpty() ? url : h;
}

// ---------------------------------------------------------------------------
// security audit
// ---------------------------------------------------------------------------
Audit audit(const QVector<Entry>& entries) {
    Audit a;
    QVector<const Entry*> logins;
    for (const auto& e : entries)
        if (e.type == "login" && !e.password.isEmpty()) logins.append(&e);

    a.totalWithPasswords = logins.size();
    if (logins.isEmpty()) return a;

    QHash<QByteArray, QVector<const Entry*>> byHash;
    double entropySum = 0;
    const qint64 now = QDateTime::currentMSecsSinceEpoch();
    const qint64 year = 365LL * 24 * 3600 * 1000;

    for (const Entry* e : logins) {
        vc::Strength s = vc::analyzeStrength(sstr(e->password));
        entropySum += s.entropyBits;
        if (s.score <= 1)
            a.weak.append({e->id, e->title, QString("~%1 bits").arg(static_cast<int>(s.entropyBits))});

        QByteArray h = QCryptographicHash::hash(e->password.toUtf8(), QCryptographicHash::Sha256);
        byHash[h].append(e);

        if (now - (e->updated ? e->updated : e->created) > year)
            a.old.append({e->id, e->title, "over a year old"});
        if (e->totp.isEmpty())
            a.no2fa.append({e->id, e->title, "no 2FA"});
        if (e->url.startsWith("http://", Qt::CaseInsensitive))
            a.insecure.append({e->id, e->title, "HTTP (not HTTPS)"});
    }

    for (auto it = byHash.begin(); it != byHash.end(); ++it) {
        if (it.value().size() > 1)
            for (const Entry* e : it.value())
                a.reused.append({e->id, e->title, QString("reused ×%1").arg(it.value().size())});
    }

    a.avgEntropy = entropySum / logins.size();
    const int total = logins.size();
    const int penalty = a.weak.size() * 14 + a.reused.size() * 10 + a.old.size() * 4 +
                        a.no2fa.size() * 3 + a.insecure.size() * 6;
    a.score = std::max(0, std::min(100, 100 - penalty / total));
    return a;
}

}  // namespace vault
