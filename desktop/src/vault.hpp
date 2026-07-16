// ============================================================================
//  Vault — data model, encrypted file storage & offline security audit.
//
//  The decrypted vault lives only in memory. What touches disk is a single
//  JSON envelope containing the Argon2id parameters and the XChaCha20-Poly1305
//  ciphertext produced by crypto.cpp. There is no network, no telemetry.
// ============================================================================
#pragma once

#include <QByteArray>
#include <QString>
#include <QStringList>
#include <QVector>

#include "crypto.hpp"

namespace vault {

// A single item. Fields not relevant to a given type stay empty.
struct Entry {
    QString id;
    QString type;  // login | note | card | identity | totp
    QString title;
    bool favorite = false;
    QString folder;
    QStringList tags;
    QString notes;
    qint64 created = 0;
    qint64 updated = 0;
    qint64 usedAt = 0;

    // login
    QString username;
    QString password;
    QString url;
    QString totp;  // otpauth:// or base32
    QStringList passwordHistory;

    // card
    QString cardholder;
    QString cardNumber;
    QString cardExpiry;
    QString cardCvv;
    QString cardBrand;

    // identity
    QString fullName;
    QString email;
    QString phone;
    QString address;

    // standalone totp
    QString otpSecret;
    QString otpIssuer;
};

struct Settings {
    int autoLockMinutes = 5;
    int clipboardClearSeconds = 20;
    bool concealByDefault = true;
    bool lockOnMinimize = true;
    bool minimizeToTray = true;
    bool quickCapture = true;    // global-hotkey credential capture
    int revealSeconds = 20;      // auto-reconceal revealed secrets
    QString theme = "dark";      // dark | light
    QString kdf = "moderate";    // interactive | moderate | sensitive
};

struct Folder {
    QString id;
    QString name;
    QString icon;
};

struct Data {
    int version = 1;
    QVector<Entry> entries;
    QVector<Folder> folders;
    Settings settings;
    qint64 createdAt = 0;
};

// ---- (de)serialisation of the decrypted model <-> JSON ---------------------
QByteArray serialize(const Data& d);
bool deserialize(const QByteArray& json, Data& out);

// ---- envelope (crypto Container) <-> on-disk JSON --------------------------
QByteArray containerToJson(const vc::Container& c);
bool containerFromJson(const QByteArray& json, vc::Container& out);

// ---- file operations -------------------------------------------------------
QString defaultVaultPath();       // ~/.local/share/SalehVault/vault.svlt
bool vaultExists(const QString& path);
bool metaKeyfileRequired(const QString& path);  // peek: does this vault need a keyfile?

vc::KdfParams kdfFor(const QString& preset);

// Create a fresh empty vault file. Returns true on success.
bool createVault(const QString& path, const QString& password, const QByteArray& keyfile,
                 const QString& kdfPreset, Data& outData, QString& err);

// Decrypt an existing vault. Returns true on success; sets err otherwise.
bool unlock(const QString& path, const QString& password, const QByteArray& keyfile,
            Data& out, QString& err);

// Re-encrypt and persist the model with the current password/keyfile.
bool save(const QString& path, const QString& password, const QByteArray& keyfile,
          const QString& kdfPreset, const Data& data, QString& err);

// Encrypted backup (identical envelope, copied to another path).
bool exportBackup(const QString& srcPath, const QString& dstPath, QString& err);

// ---- helpers ---------------------------------------------------------------
QString newId();
Entry newEntry(const QString& type);
QString detectCardBrand(const QString& number);
QString domainOf(const QString& url);

// ---- security audit --------------------------------------------------------
struct AuditIssue {
    QString entryId;
    QString title;
    QString detail;
};
struct Audit {
    int score = 100;             // 0..100
    int totalWithPasswords = 0;
    double avgEntropy = 0;
    QVector<AuditIssue> weak;
    QVector<AuditIssue> reused;
    QVector<AuditIssue> old;
    QVector<AuditIssue> no2fa;
    QVector<AuditIssue> insecure;
};
Audit audit(const QVector<Entry>& entries);

}  // namespace vault
