// ============================================================================
//  Vault — additional dialogs that make the app feel like a full suite:
//    • ThemePickerDialog     — a visual gallery of every colour palette
//    • PasswordHistoryDialog — browse / copy / restore previous passwords
//    • StatsDialog           — a dashboard of vault statistics & health
//    • AboutDialog           — app / crypto information + keyboard shortcuts
// ============================================================================
#pragma once
#include <QDialog>
#include <QString>
#include <QVector>

#include "browserimport.hpp"
#include "vault.hpp"

class QLineEdit;
class QVBoxLayout;
class QLabel;
class QCheckBox;

// Visual palette gallery. Live-previews on hover/selection and returns the id.
class ThemePickerDialog : public QDialog {
    Q_OBJECT
public:
    explicit ThemePickerDialog(const QString& currentId, QWidget* parent = nullptr);
    QString selected() const { return selected_; }

signals:
    void preview(const QString& id);

private:
    QString selected_;
    QString original_;
};

// Browse the rolling history of previous passwords for one entry.
class PasswordHistoryDialog : public QDialog {
    Q_OBJECT
public:
    PasswordHistoryDialog(const QString& title, const QStringList& history, QWidget* parent = nullptr);
    QString restored() const { return restored_; }

signals:
    void copyRequested(const QString& value);

private:
    QString restored_;
};

// A dashboard: totals, health, coverage and per-type / per-folder breakdowns.
class StatsDialog : public QDialog {
    Q_OBJECT
public:
    explicit StatsDialog(const vault::Data& data, QWidget* parent = nullptr);
};

// About / help.
class AboutDialog : public QDialog {
    Q_OBJECT
public:
    explicit AboutDialog(QWidget* parent = nullptr);
};

// Discover, search, categorise and import saved browser logins.
class BrowserImportDialog : public QDialog {
    Q_OBJECT
public:
    explicit BrowserImportDialog(QWidget* parent = nullptr);
    QVector<bimport::Credential> selected() const { return chosen_; }

private:
    struct Row { class QWidget* w; QCheckBox* cb; bimport::Credential cred; QString hay; };
    void rescan();
    void rebuild();
    void applyFilter();
    QVector<bimport::Credential> all_;
    QVector<Row> rows_;
    QVector<bimport::Credential> chosen_;
    QLineEdit* search_ = nullptr;
    QVBoxLayout* listLayout_ = nullptr;
    QLabel* status_ = nullptr;
    QString methodFilter_ = "all";
    QString query_;
};

// Create / rename / re-icon / delete folders.
class FolderManagerDialog : public QDialog {
    Q_OBJECT
public:
    explicit FolderManagerDialog(const QVector<vault::Folder>& folders, QWidget* parent = nullptr);
    QVector<vault::Folder> folders() const;

private:
    void addRow(const vault::Folder& f);
    class QVBoxLayout* rows_ = nullptr;
    struct Row { class QLineEdit* icon; class QLineEdit* name; QString id; class QWidget* container; };
    QVector<Row> items_;
};
