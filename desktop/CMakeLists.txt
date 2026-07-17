# ============================================================================
#  Vault — native Linux password manager (Qt6 + libsodium)
# ============================================================================
cmake_minimum_required(VERSION 3.16)
project(saleh-vault VERSION 1.0.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_AUTOMOC ON)

if(NOT CMAKE_BUILD_TYPE)
    set(CMAKE_BUILD_TYPE Release)
endif()

find_package(Qt6 REQUIRED COMPONENTS Widgets Sql)
find_package(OpenSSL REQUIRED)
find_package(PkgConfig REQUIRED)
pkg_check_modules(SODIUM REQUIRED libsodium)

add_executable(saleh-vault
    src/main.cpp
    src/crypto.cpp
    src/vault.cpp
    src/generator.cpp
    src/authdialog.cpp
    src/dialogs.cpp
    src/extradialogs.cpp
    src/commandpalette.cpp
    src/browserimport.cpp
    src/mainwindow.cpp
)

target_include_directories(saleh-vault PRIVATE ${SODIUM_INCLUDE_DIRS})
target_link_libraries(saleh-vault PRIVATE Qt6::Widgets Qt6::Sql OpenSSL::Crypto ${SODIUM_LIBRARIES})
target_link_directories(saleh-vault PRIVATE ${SODIUM_LIBRARY_DIRS})
target_compile_options(saleh-vault PRIVATE -Wall -Wextra ${SODIUM_CFLAGS_OTHER})

# ---- install ---------------------------------------------------------------
include(GNUInstallDirs)
install(TARGETS saleh-vault RUNTIME DESTINATION ${CMAKE_INSTALL_BINDIR})
install(FILES resources/saleh-vault.desktop
        DESTINATION ${CMAKE_INSTALL_DATAROOTDIR}/applications)
install(FILES resources/icon.png
        DESTINATION ${CMAKE_INSTALL_DATAROOTDIR}/icons/hicolor/512x512/apps
        RENAME saleh-vault.png)

# ---- optional crypto self-test target (no Qt) ------------------------------
add_executable(vault-selftest EXCLUDE_FROM_ALL src/selftest.cpp src/crypto.cpp)
target_include_directories(vault-selftest PRIVATE ${SODIUM_INCLUDE_DIRS})
target_link_libraries(vault-selftest PRIVATE ${SODIUM_LIBRARIES})
target_link_directories(vault-selftest PRIVATE ${SODIUM_LIBRARY_DIRS})

# ---- optional headless UI smoke test ---------------------------------------
add_executable(vault-smoke EXCLUDE_FROM_ALL
    src/smoketest.cpp
    src/crypto.cpp
    src/vault.cpp
    src/generator.cpp
    src/authdialog.cpp
    src/dialogs.cpp
    src/extradialogs.cpp
    src/commandpalette.cpp
    src/browserimport.cpp
    src/mainwindow.cpp
)
target_include_directories(vault-smoke PRIVATE ${SODIUM_INCLUDE_DIRS})
target_link_libraries(vault-smoke PRIVATE Qt6::Widgets Qt6::Sql OpenSSL::Crypto ${SODIUM_LIBRARIES})
target_link_directories(vault-smoke PRIVATE ${SODIUM_LIBRARY_DIRS})

# ---- CPack: .deb -----------------------------------------------------------
set(CPACK_GENERATOR "DEB")
set(CPACK_PACKAGE_NAME "saleh-vault")
set(CPACK_PACKAGE_VERSION "${PROJECT_VERSION}")
set(CPACK_PACKAGE_CONTACT "Saleh Saghafiani <salehcodez@gmail.com>")
set(CPACK_PACKAGE_DESCRIPTION_SUMMARY "Zero-knowledge encrypted password vault (Qt6 + libsodium)")
set(CPACK_DEBIAN_PACKAGE_MAINTAINER "Saleh Saghafiani <salehcodez@gmail.com>")
set(CPACK_DEBIAN_PACKAGE_SECTION "utils")
set(CPACK_DEBIAN_PACKAGE_PRIORITY "optional")
set(CPACK_DEBIAN_PACKAGE_HOMEPAGE "https://saleh.im/vault")
set(CPACK_DEBIAN_PACKAGE_ARCHITECTURE "amd64")
# Auto-resolve shared-library deps when dpkg-shlibdeps is available, plus a
# sensible explicit floor.
set(CPACK_DEBIAN_PACKAGE_SHLIBDEPS ON)
set(CPACK_DEBIAN_PACKAGE_DEPENDS "libsodium23 | libsodium23t64, libqt6widgets6, libqt6gui6, libqt6core6, libqt6sql6, libssl3 | libssl3t64")
# Optional: secret-tool (libsecret) lets us read browser keyring passwords.
set(CPACK_DEBIAN_PACKAGE_RECOMMENDS "libsecret-tools")
# Cleanly supersede the old Electron-based package (same .desktop path).
set(CPACK_DEBIAN_PACKAGE_CONFLICTS "saleh-vault-desktop")
set(CPACK_DEBIAN_PACKAGE_REPLACES "saleh-vault-desktop")
set(CPACK_DEBIAN_PACKAGE_PROVIDES "saleh-vault-desktop")
set(CPACK_PACKAGE_FILE_NAME "saleh-vault_${PROJECT_VERSION}_amd64")
include(CPack)
