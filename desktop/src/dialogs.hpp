#pragma once
#include <QDialog>
#include <QHash>

#include "vault.hpp"

class QLineEdit;
class QTextEdit;
class QComboBox;
class QCheckBox;
class QLabel;
class QSpinBox;
class QTimer;

// Add / edit any of the five item types in one adaptive form.
class EntryDialog : public QDialog {
    Q_OBJECT
public:
    EntryDialog(const vault::Entry& e, const QVector<vault::Folder>& folders, QWidget* parent = nullptr);
    vault::Entry result() const;

private:
    void refreshTotp();
    QLineEdit* pwEdit_ = nullptr;
    QLabel* pwStrength_ = nullptr;
    QLabel* totpPreview_ = nullptr;
    QTimer* totpTimer_ = nullptr;
    QHash<QString, QLineEdit*> fields_;
    QTextEdit* notes_ = nullptr;
    QTextEdit* address_ = nullptr;
    QComboBox* folder_ = nullptr;
    QLineEdit* tags_ = nullptr;
    QCheckBox* favorite_ = nullptr;
    vault::Entry e_;
    QVector<vault::Folder> folders_;
};

// App preferences + master-password / backup / wipe actions.
class SettingsDialog : public QDialog {
    Q_OBJECT
public:
    SettingsDialog(const vault::Settings& s, QWidget* parent = nullptr);
    vault::Settings result() const;

signals:
    void changeMasterRequested();
    void exportRequested();
    void wipeRequested();
    void openFolderRequested();
    void themePreview(const QString& mode);

private:
    QSpinBox* autoLock_ = nullptr;
    QSpinBox* clip_ = nullptr;
    QSpinBox* reveal_ = nullptr;
    QCheckBox* conceal_ = nullptr;
    QCheckBox* lockMin_ = nullptr;
    QCheckBox* tray_ = nullptr;
    QCheckBox* quick_ = nullptr;
    QComboBox* theme_ = nullptr;
    QComboBox* kdf_ = nullptr;
    vault::Settings s_;
};

// Read-only security audit report.
class AuditDialog : public QDialog {
    Q_OBJECT
public:
    AuditDialog(const vault::Audit& a, QWidget* parent = nullptr);
};

// Small change-master-password dialog: returns new password + optional keyfile.
class ChangeMasterDialog : public QDialog {
    Q_OBJECT
public:
    explicit ChangeMasterDialog(QWidget* parent = nullptr);
    QString currentPassword() const;
    QString newPassword() const;

private:
    QLineEdit* cur_ = nullptr;
    QLineEdit* nw_ = nullptr;
    QLineEdit* nw2_ = nullptr;
    QLabel* err_ = nullptr;
};
