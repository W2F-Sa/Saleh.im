// ============================================================================
//  Vault — browser credential import.
//
//  Discovers logins saved by Chromium-family browsers (Chrome, Chromium,
//  Brave, Edge, Vivaldi, Opera) and Firefox, and reports for each site:
//     • the sign-in method  — "Sign in with Google / GitHub / …" (federated)
//                              or a plain username + password login,
//     • the username        — always available (stored in the clear by Chrome),
//     • the password        — decrypted when the OS keyring permits it
//                              (Linux "v10/v11" AES-128-CBC scheme), otherwise
//                              reported as locked (never guessed, never fails).
//
//  Reading is done from a private copy of the browser's "Login Data" SQLite
//  file so it works even while the browser is open. Nothing is written back to
//  the browser and nothing leaves the machine.
// ============================================================================
#pragma once

#include <QString>
#include <QVector>

namespace bimport {

// How the user signs in to a given site.
enum class Method { Password, Google, GitHub, Facebook, Apple, Microsoft, Federated, Unknown };

QString methodLabel(Method m);
QString methodKey(Method m);   // stable lowercase id, e.g. "google"

struct Credential {
    QString browser;      // "Chrome", "Brave", "Firefox", …
    QString site;         // pretty host, e.g. github.com
    QString origin;       // full origin/url
    QString username;     // may be empty
    QString password;     // decrypted value (empty if locked/none)
    bool passwordKnown = false;   // true if we actually recovered a password
    Method method = Method::Password;
    QString provider;     // federated provider host (when Method::Federated/…)
    qint64 created = 0;    // ms epoch (0 if unknown)
    int timesUsed = 0;
};

struct Profile {
    QString browser;      // display name
    QString family;       // "chromium" | "firefox"
    QString name;         // profile name (Default / Profile 1 / dev-edition…)
    QString path;         // absolute path to the profile directory
    QString loginData;    // absolute path to Login Data / logins.json
    QString keyringApp;   // secret-service "application" attribute for the key
};

// Find every browser profile that has saved logins.
QVector<Profile> detectProfiles();

// Read + (best-effort) decrypt every credential from a profile.
// `note` receives a short human status (e.g. how many passwords were locked).
QVector<Credential> readProfile(const Profile& p, QString& note);

// Round-trips a Chromium-style "v10" blob through the decryptor to validate
// the OpenSSL PBKDF2 + AES-128-CBC path. Returns true when it recovers a UTF-8
// secret exactly. Used by the smoke test.
bool selfTest();

}  // namespace bimport
