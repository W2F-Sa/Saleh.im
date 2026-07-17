#pragma once
#include <QByteArray>
#include <QMainWindow>
#include <QPair>
#include <QVector>

#include "vault.hpp"

class QListWidget;
class QLineEdit;
class QVBoxLayout;
class QWidget;
class QPushButton;
class QSystemTrayIcon;
class QTimer;
class QLabel;
class QComboBox;
class QIcon;
class QPoint;

// The unlocked application: sidebar filters, entry list, detail pane, tray,
// shortcuts, auto-lock, clipboard auto-clear, command palette, trash, import/
// export, statistics dashboard and all item operations.
class MainWindow : public QMainWindow {
    Q_OBJECT
public:
    MainWindow(const QString& path, const QString& password, const QByteArray& keyfile,
               const QString& kdfPreset, const vault::Data& data, QWidget* parent = nullptr);

protected:
    void changeEvent(QEvent* e) override;
    void closeEvent(QCloseEvent* e) override;
    bool eventFilter(QObject* o, QEvent* e) override;

private:
    // ui
    void buildUi();
    void buildMenuBar();
    void buildTray();
    void installShortcuts();
    void manageFolders();
    void rebuildSidebar();
    void rebuildList();
    void showDetail(const QString& id);
    void addDetailRow(QVBoxLayout* v, const QString& label, const QString& value, bool copyable, bool secret = false);
    void addTotpRow(QVBoxLayout* v, const QString& secret);
    void addCustomFieldRows(QVBoxLayout* v, const vault::Entry& e);

    // actions
    void newEntry(const QString& type);
    void editEntry(const QString& id);
    void deleteEntry(const QString& id);       // soft-delete → trash
    void restoreEntry(const QString& id);
    void purgeEntry(const QString& id);        // permanent
    void emptyTrash();
    void duplicateEntry(const QString& id);
    void toggleFavorite(const QString& id);
    void moveToFolder(const QString& id, const QString& folderId);
    void showHistory(const QString& id);
    void listContextMenu(const QPoint& pos);
    void quickCapture();
    void openVaultFolder();
    void updateStats();
    QIcon avatarFor(const vault::Entry& e) const;
    void bumpUsed(const QString& id);
    void openGenerator();
    void openAudit();
    void openStats();
    void openAbout();
    void openCommandPalette();
    void openSettings();
    void pickTheme();
    void importItems();
    void importFromBrowsers();
    void exportItems();
    void changeMaster();
    void exportBackup();
    void wipeVault();
    void lock();
    void copyValue(const QString& text);
    void applyTheme(const QString& id);

    // persistence
    void persist();
    const vault::Entry* findEntry(const QString& id) const;

    QString path_;
    QString password_;
    QByteArray keyfile_;
    QString kdfPreset_;
    vault::Data data_;

    QString filter_ = "all";
    QString search_;
    QString selectedId_;
    bool reveal_ = false;

    QWidget* sidebar_ = nullptr;
    QVBoxLayout* sidebarLayout_ = nullptr;
    QLineEdit* searchEdit_ = nullptr;
    QComboBox* sortCombo_ = nullptr;
    QLabel* statsLabel_ = nullptr;
    QLabel* crumbLabel_ = nullptr;
    QTimer* revealTimer_ = nullptr;
    QListWidget* list_ = nullptr;
    QWidget* detail_ = nullptr;
    QVBoxLayout* detailLayout_ = nullptr;

    QSystemTrayIcon* tray_ = nullptr;
    QTimer* idleTimer_ = nullptr;
    QTimer* totpTimer_ = nullptr;
    QTimer* clipTimer_ = nullptr;
    QString lastClip_;
    QLabel* totpLabel_ = nullptr;  // live code in the detail pane
    QString totpSecretForDetail_;
    QVector<QPair<QPushButton*, QString>> toolIcons_;  // toolbar buttons → icon name (re-tinted on theme change)
    bool quitting_ = false;
};
