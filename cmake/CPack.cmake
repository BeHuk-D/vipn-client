set(CPACK_PACKAGE_VENDOR            ${CLIENT_ORGANIZATION_NAME})
set(CPACK_PACKAGE_VERSION           ${AMNEZIAVPN_VERSION})
if(WIN32)
    set(CPACK_PACKAGE_FILE_NAME "${CLIENT_APPLICATION_NAME}_${AMNEZIAVPN_VERSION}_windows_x64")
elseif(APPLE AND NOT IOS AND NOT MACOS_NE)
    set(CPACK_PACKAGE_FILE_NAME "${CLIENT_APPLICATION_NAME}_${AMNEZIAVPN_VERSION}_macos_x64")
elseif(LINUX AND NOT ANDROID)
    set(CPACK_PACKAGE_FILE_NAME "${CLIENT_APPLICATION_NAME}_${AMNEZIAVPN_VERSION}_linux_x64")
endif()
set(CPACK_PACKAGE_DESCRIPTION_SUMMARY "${CLIENT_APP_DESCRIPTION}")
set(CPACK_PACKAGE_INSTALL_DIRECTORY ${CLIENT_APPLICATION_NAME})
set(CPACK_PACKAGE_EXECUTABLES       "${CLIENT_TARGET_NAME};${CLIENT_APPLICATION_NAME}")
set(CPACK_PRE_BUILD_SCRIPTS         ${CMAKE_CURRENT_LIST_DIR}/sign_binaries.cmake)
set(CPACK_POST_BUILD_SCRIPTS        ${CMAKE_CURRENT_LIST_DIR}/sign_packages.cmake)
set(CPACK_PROJECT_CONFIG_FILE       ${CMAKE_CURRENT_LIST_DIR}/CPackOptions.cmake)
set(CPACK_RESOURCE_FILE_LICENSE     ${CMAKE_SOURCE_DIR}/deploy/data/LICENSE.txt)

list(PREPEND CPACK_COMPONENTS_ALL ${CLIENT_APPLICATION_NAME})

if(APPLE)
    set(CPACK_GENERATOR productbuild)
else()
    set(CPACK_GENERATOR IFW)
endif()

# === CPack IFW generator settings ===
set(CPACK_IFW_PACKAGE_NAME                          ${CLIENT_APPLICATION_NAME})
set(CPACK_IFW_PACKAGE_TITLE                         ${CLIENT_APPLICATION_NAME})
set(CPACK_IFW_PACKAGE_WIZARD_DEFAULT_WIDTH          600)
set(CPACK_IFW_PACKAGE_WIZARD_DEFAULT_HEIGHT         380)
set(CPACK_IFW_PACKAGE_WIZARD_STYLE                  Modern)
set(CPACK_IFW_PACKAGE_REMOVE_TARGET_DIR             ON)
set(CPACK_IFW_PACKAGE_ALLOW_SPACE_IN_PATH           ON)
set(CPACK_IFW_PACKAGE_ALLOW_NON_ASCII_CHARACTERS    ON)
set(CPACK_IFW_PACKAGE_CONTROL_SCRIPT                ${CMAKE_SOURCE_DIR}/deploy/installer/qif/controlscript.js)

# === CPack WIX generator settings ===
set(CPACK_WIX_VERSION               4)
set(CPACK_WIX_UPGRADE_GUID          "{5E585DCA-03D3-485D-9276-011C816D3402}")
set(CPACK_WIX_PRODUCT_ICON          ${CMAKE_SOURCE_DIR}/client/images/app.ico)
set(CPACK_WIX_CUSTOM_XMLNS          "util=http://wixtoolset.org/schemas/v4/wxs/util")
string(REPLACE "-" "_" _VIPN_WIX_SERVICE_FILE_ID "${CLIENT_SERVICE_NAME}.exe")
set(_VIPN_WIX_PATCH_SERVICE_SRC     ${CMAKE_SOURCE_DIR}/deploy/installer/wix/service_install_patch.xml.in)
set(_VIPN_WIX_PATCH_CLOSE_APP_SRC   ${CMAKE_SOURCE_DIR}/deploy/installer/wix/close_client_patch.xml.in)
set(_VIPN_WIX_PATCH_SERVICE         ${CMAKE_CURRENT_BINARY_DIR}/service_install_patch.xml)
set(_VIPN_WIX_PATCH_CLOSE_APP       ${CMAKE_CURRENT_BINARY_DIR}/close_client_patch.xml)
configure_file("${_VIPN_WIX_PATCH_SERVICE_SRC}" "${_VIPN_WIX_PATCH_SERVICE}" @ONLY)
configure_file("${_VIPN_WIX_PATCH_CLOSE_APP_SRC}" "${_VIPN_WIX_PATCH_CLOSE_APP}" @ONLY)
file(TO_CMAKE_PATH                  "${_VIPN_WIX_PATCH_SERVICE}" _VIPN_WIX_PATCH_SERVICE_CMAKE)
file(TO_CMAKE_PATH                  "${_VIPN_WIX_PATCH_CLOSE_APP}" _VIPN_WIX_PATCH_CLOSE_APP_CMAKE)
list(APPEND CPACK_WIX_PATCH_FILE    "${_VIPN_WIX_PATCH_SERVICE_CMAKE}" "${_VIPN_WIX_PATCH_CLOSE_APP_CMAKE}")
list(APPEND CPACK_WIX_EXTENSIONS    "WixToolset.Util.wixext")

# === CPack productbuild generator settings ===
set(CPACK_PRODUCTBUILD_IDENTIFIER       org.vipn)
set(CPACK_PREFLIGHT_AMNEZIAVPN_SCRIPT   ${CMAKE_SOURCE_DIR}/deploy/data/macos/post_uninstall.sh)
set(CPACK_POSTFLIGHT_AMNEZIAVPN_SCRIPT  ${CMAKE_SOURCE_DIR}/deploy/data/macos/post_install.sh)
set(CPACK_POSTFLIGHT_UNINSTALL_SCRIPT   ${CMAKE_SOURCE_DIR}/deploy/data/macos/post_uninstall.sh)
# provide custom CPack.distribution.dist.in
list(APPEND CMAKE_MODULE_PATH           ${CMAKE_SOURCE_DIR}/deploy/data/macos)

if(LINUX AND NOT ANDROID)
    install(FILES
        ${CMAKE_SOURCE_DIR}/deploy/data/linux/${CLIENT_APPLICATION_NAME}.service
        ${CMAKE_SOURCE_DIR}/deploy/data/linux/${CLIENT_APPLICATION_NAME}.png
        ${CMAKE_SOURCE_DIR}/deploy/data/linux/${CLIENT_APPLICATION_NAME}.desktop
        ${CMAKE_SOURCE_DIR}/deploy/data/linux/post_install.sh
        ${CMAKE_SOURCE_DIR}/deploy/data/linux/post_uninstall.sh
        DESTINATION "."
        COMPONENT ${CLIENT_APPLICATION_NAME}
    )
endif()

if(WIN32)
    install(FILES
        ${CMAKE_SOURCE_DIR}/deploy/data/windows/post_install.cmd
        ${CMAKE_SOURCE_DIR}/deploy/data/windows/post_uninstall.cmd
        DESTINATION "."
        COMPONENT ${CLIENT_APPLICATION_NAME}
    )

    set(CMAKE_INSTALL_SYSTEM_RUNTIME_LIBS_SKIP TRUE)
    include(InstallRequiredSystemLibraries)
    if(CMAKE_INSTALL_SYSTEM_RUNTIME_LIBS)
        install(PROGRAMS ${CMAKE_INSTALL_SYSTEM_RUNTIME_LIBS}
            DESTINATION "."
            COMPONENT ${CLIENT_APPLICATION_NAME}
        )
    else()
        message(WARNING "MSVC runtime libraries were not found, packages will not ship them")
    endif()
endif()

if (APPLE AND NOT IOS AND NOT MACOS_NE)
    install(FILES ${CMAKE_SOURCE_DIR}/deploy/data/macos/AmneziaVPN.plist
        DESTINATION "${CLIENT_APPLICATION_NAME}.app/Contents/Resources"
        COMPONENT ${CLIENT_APPLICATION_NAME}
    )
endif()

include(CPackIFW)
cpack_ifw_configure_component(${CLIENT_APPLICATION_NAME}
    VERSION ${AMNEZIAVPN_VERSION}
    RELEASE_DATE ${RELEASE_DATE}
    REQUIRES_ADMIN_RIGHTS
    FORCED_INSTALLATION
    SCRIPT ${CMAKE_SOURCE_DIR}/deploy/installer/qif/componentscript.js
)

include(CPack)
cpack_add_component(Uninstall
    DISPLAY_NAME "Uninstall ${CLIENT_APPLICATION_NAME}"
    REQUIRES_ADMIN_RIGHTS
    DISABLED
)
