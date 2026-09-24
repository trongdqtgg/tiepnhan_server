; ============================================================================
;  server-installer.nsi - Bo cai dat Windows (Setup.exe) cho SERVER He thong bat so (MUC 116)
;  Duoc scripts/build-release.js bien dich tu dong (makensis) - KHONG can mo file nay bang tay.
;  Tham so truyen vao: -DVERSION=x.y.z -DSTAGE=<thu muc da dong goi> -DOUTFILE=<file .exe>
;                      -DICON=<file .ico> [-DHAS_NODE neu goi co kem node\node.exe 64-bit]
;
;  Giu dung cac quyet dinh da chot trong README:
;   - Muc 37/38: mac dinh cai vao O DIA KHAC o chua Windows (vd D:\HeThongBatSo) neu may co; BAT
;     BUOC chon o khac neu may co o khac (tru khi dang cap nhat ban da cai).
;   - Muc 40: cai xong la TU KHOI DONG CUNG WINDOWS luon (khong can tick) - goi
;     tools\service.ps1 -Action install (Task Scheduler, tai khoan SYSTEM, chay nen, tu chay lai).
;   - KHONG BAO GIO ghi de .env, data\ (CSDL), kiosk-questions.json - khong nam trong goi.
;   - Go cai dat: dung server, tat tu khoi dong, xoa phan mem nhung GIU LAI du lieu + cau hinh.
;  Cai im lang (cap nhat hang loat): Setup.exe /S  [ /D=D:\HeThongBatSo  - phai o CUOI dong lenh ]
; ============================================================================
!ifdef TEST_AMD64
  Target amd64-unicode ; CHI dung de tu kiem thu duoi wine64 - ban phat hanh la x86-unicode (chay moi Windows)
!else
  Unicode true
!endif
ManifestDPIAware true

!include "MUI2.nsh"
!include "LogicLib.nsh"
!include "FileFunc.nsh"
!include "TextFunc.nsh"
!include "x64.nsh"

!ifndef VERSION
  !define VERSION "0.0.0"
!endif
!ifndef STAGE
  !error "Thieu -DSTAGE=<thu muc goi da dong goi>"
!endif
!ifndef OUTFILE
  !define OUTFILE "HeThongBatSo-Server-Setup-${VERSION}.exe"
!endif

!define APP_NAME "Hệ thống bắt số - Server"
!define APP_DIRNAME "HeThongBatSo"
!define PUBLISHER "Hệ thống bắt số"
!define UNINST_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\HeThongBatSoServer"
!define SM_DIR "$SMPROGRAMS\Hệ thống bắt số - Server"
!define PS_CMD 'powershell.exe -NoProfile -ExecutionPolicy Bypass -File'

Name "${APP_NAME} ${VERSION}"
OutFile "${OUTFILE}"
InstallDir "C:\${APP_DIRNAME}"
RequestExecutionLevel admin
SetCompressor /SOLID lzma
ShowInstDetails show
ShowUninstDetails show
BrandingText "${APP_NAME} ${VERSION}"
VIProductVersion "${VERSION}.0"
VIAddVersionKey /LANG=0 "ProductName" "${APP_NAME}"
VIAddVersionKey /LANG=0 "ProductVersion" "${VERSION}"
VIAddVersionKey /LANG=0 "FileVersion" "${VERSION}"
VIAddVersionKey /LANG=0 "FileDescription" "Bộ cài đặt ${APP_NAME}"
VIAddVersionKey /LANG=0 "CompanyName" "${PUBLISHER}"
VIAddVersionKey /LANG=0 "LegalCopyright" "${PUBLISHER}"

!ifdef ICON
  !define MUI_ICON "${ICON}"
  !define MUI_UNICON "${ICON}"
!endif
!define MUI_ABORTWARNING

Var SysDrive
Var OtherDrive
Var IsUpgrade
Var Port

; ---------- Trang giao dien ----------
!define MUI_WELCOMEPAGE_TITLE "Cài đặt ${APP_NAME} ${VERSION}"
!define MUI_WELCOMEPAGE_TEXT "Chương trình sẽ cài máy chủ Hệ thống bắt số lên máy này.$\r$\n$\r$\nSau khi cài, máy chủ tự chạy nền và TỰ KHỞI ĐỘNG CÙNG WINDOWS (không cần đăng nhập, không hiện cửa sổ).$\r$\n$\r$\nNếu đang có bản cũ, cấu hình (.env) và dữ liệu (thư mục data) được GIỮ NGUYÊN.$\r$\n$\r$\nBấm Tiếp để tiếp tục."
!insertmacro MUI_PAGE_WELCOME
!define MUI_PAGE_CUSTOMFUNCTION_PRE DirPre
!define MUI_PAGE_CUSTOMFUNCTION_LEAVE DirLeave
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!define MUI_FINISHPAGE_TITLE "Đã cài đặt xong"
!define MUI_FINISHPAGE_TEXT "Máy chủ đang chạy nền và sẽ tự khởi động cùng Windows.$\r$\n$\r$\nQuản lý trong Start Menu > Hệ thống bắt số - Server: Trạng thái, Dừng, Khởi động lại, Chạy có cửa sổ (chẩn đoán).$\r$\n$\r$\nNhớ sửa mật khẩu nhân viên (STAFF_PASSWORD) trong file .env ở thư mục cài đặt, rồi chọn Khởi động lại máy chủ."
!define MUI_FINISHPAGE_RUN
!define MUI_FINISHPAGE_RUN_TEXT "Mở Hệ thống bắt số trên trình duyệt"
!define MUI_FINISHPAGE_RUN_FUNCTION OpenWeb
!define MUI_FINISHPAGE_SHOWREADME ""
!define MUI_FINISHPAGE_SHOWREADME_FUNCTION OpenEnv
!define MUI_FINISHPAGE_SHOWREADME_TEXT "Mở file cấu hình .env để sửa"
!define MUI_FINISHPAGE_SHOWREADME_NOTCHECKED
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

!insertmacro MUI_LANGUAGE "Vietnamese"

; ---------- Khoi tao ----------
; Tim o dia cung (DRIVE_FIXED = 3) DAU TIEN khac o chua Windows - bo qua USB, o CD/DVD, o mang.
; Tu duyet D..Z bang GetDriveTypeW (thay cho ${GetDrives} cua FileFunc - bi loi tren ban 64-bit).
Function FindOtherDrive
  StrCpy $OtherDrive ""
  StrCpy $R3 "DEFGHIJKLMNOPQRSTUVWXYZ"
  StrCpy $R4 0
  ${Do}
    StrCpy $R1 $R3 1 $R4
    ${IfThen} $R1 == "" ${|} ${ExitDo} ${|}
    IntOp $R4 $R4 + 1
    ${If} "$R1:" != $SysDrive
      System::Call 'kernel32::GetDriveTypeW(w "$R1:\") i .R2'
      ${If} $R2 == 3
        StrCpy $OtherDrive "$R1:"
        ${ExitDo}
      ${EndIf}
    ${EndIf}
  ${Loop}
FunctionEnd

Function .onInit
  StrCpy $SysDrive $WINDIR 2
  StrCpy $IsUpgrade "0"

  !ifdef HAS_NODE
    ${IfNot} ${RunningX64}
      MessageBox MB_ICONSTOP "Máy chủ Hệ thống bắt số cần Windows 64-bit. Máy này đang chạy Windows 32-bit."
      Abort
    ${EndIf}
  !endif
  ${If} ${RunningX64}
    SetRegView 64
  ${EndIf}

  ; Da cai truoc do -> cap nhat DUNG thu muc cu (giu nguyen .env, data)
  ReadRegStr $0 HKLM "${UNINST_KEY}" "InstallLocation"
  ${If} $0 != ""
  ${AndIf} ${FileExists} "$0\*.*"
    StrCpy $INSTDIR $0
    StrCpy $IsUpgrade "1"
    Return
  ${EndIf}

  Call FindOtherDrive
  ; Chi doi mac dinh khi nguoi dung KHONG truyen /D=... (van la gia tri InstallDir goc)
  ${If} $OtherDrive != ""
  ${AndIf} $INSTDIR == "C:\${APP_DIRNAME}"
    StrCpy $INSTDIR "$OtherDrive\${APP_DIRNAME}"
  ${EndIf}
FunctionEnd

Function DirPre
  ; Cap nhat ban da cai: khong cho doi thu muc (tranh tach roi du lieu cu)
  ${If} $IsUpgrade == "1"
    Abort
  ${EndIf}
FunctionEnd

Function DirLeave
  StrCpy $0 $INSTDIR 2
  ${If} $0 == $SysDrive
  ${AndIf} $OtherDrive != ""
    MessageBox MB_ICONEXCLAMATION "Vui lòng cài vào ổ đĩa KHÁC ổ chứa Windows ($SysDrive) để tránh mất dữ liệu khi cài lại Windows.$\r$\n$\r$\nVí dụ: $OtherDrive\${APP_DIRNAME}"
    Abort
  ${EndIf}
FunctionEnd

Function ReadPort
  StrCpy $Port ""
  ClearErrors
  ${ConfigRead} "$INSTDIR\.env" "PORT=" $Port
  ${If} ${Errors}
    ClearErrors
    ${ConfigRead} "$INSTDIR\.env.example" "PORT=" $Port
  ${EndIf}
  ${TrimNewLines} $Port $Port
  ${If} $Port == ""
    StrCpy $Port "4000"
  ${EndIf}
FunctionEnd

Function OpenEnv
  Exec '"$WINDIR\notepad.exe" "$INSTDIR\.env"'
FunctionEnd

Function OpenWeb
  Call ReadPort
  ExecShell "open" "http://localhost:$Port/"
FunctionEnd

; ---------- Cai dat ----------
Section "Install"
  SetShellVarContext all

  DetailPrint "Dừng máy chủ đang chạy (nếu có)..."
  ${If} ${FileExists} "$INSTDIR\tools\service.ps1"
    nsExec::ExecToLog '${PS_CMD} "$INSTDIR\tools\service.ps1" -Action stop'
    Pop $0
  ${EndIf}
  ; Ban cai cu (Inno Setup, muc 31-41): tac vu cung ten + tien trinh HeThongBatSo.exe
  nsExec::Exec 'schtasks.exe /end /tn HeThongBatSo_AutoStart'
  Pop $0
  nsExec::Exec 'taskkill.exe /f /im HeThongBatSo.exe'
  Pop $0
  Sleep 1500

  ; Xoa ma nguon/thu vien cu truoc khi chep ban moi (tranh sot file cu). KHONG dung toi public\
  ; (co the chua anh logo/nen don vi tu them), data\, .env, kiosk-questions.json, logs\.
  RMDir /r "$INSTDIR\src"
  RMDir /r "$INSTDIR\node_modules"
  RMDir /r "$INSTDIR\node"
  RMDir /r "$INSTDIR\tools"

  SetOutPath "$INSTDIR"
  SetOverwrite on
  File /r "${STAGE}\*.*"
!ifdef ICON
  File "/oname=$INSTDIR\app.ico" "${ICON}"
!endif

  WriteUninstaller "$INSTDIR\uninstall.exe"

  DetailPrint "Bật tự khởi động cùng Windows và chạy máy chủ nền..."
  nsExec::ExecToLog '${PS_CMD} "$INSTDIR\tools\service.ps1" -Action install'
  Pop $0
  ${If} $0 != "0"
    DetailPrint "CẢNH BÁO: bật tự khởi động chưa thành công (mã $0) - chạy lại install-autostart.bat trong thư mục cài đặt."
    IfSilent +2
      MessageBox MB_ICONEXCLAMATION "Chưa bật được tự khởi động cùng Windows (mã $0).$\r$\nChạy lại file install-autostart.bat trong thư mục cài đặt, hoặc xem logs\server.log."
  ${EndIf}

  ; Shortcut
  Call ReadPort
  WriteINIStr "$INSTDIR\Mo he thong bat so.url" "InternetShortcut" "URL" "http://localhost:$Port/"
  WriteINIStr "$INSTDIR\Mo he thong bat so.url" "InternetShortcut" "IconFile" "$INSTDIR\app.ico"
  WriteINIStr "$INSTDIR\Mo he thong bat so.url" "InternetShortcut" "IconIndex" "0"
  CreateDirectory "${SM_DIR}"
  CreateShortCut "${SM_DIR}\Mở Hệ thống bắt số.lnk" "$INSTDIR\Mo he thong bat so.url" "" "$INSTDIR\app.ico"
  CreateShortCut "${SM_DIR}\Trạng thái máy chủ.lnk" "$INSTDIR\status-server.bat" "" "$INSTDIR\app.ico"
  CreateShortCut "${SM_DIR}\Khởi động lại máy chủ.lnk" "$INSTDIR\install-autostart.bat" "" "$INSTDIR\app.ico"
  CreateShortCut "${SM_DIR}\Dừng máy chủ.lnk" "$INSTDIR\stop-server.bat" "" "$INSTDIR\app.ico"
  CreateShortCut "${SM_DIR}\Chạy có cửa sổ (chẩn đoán lỗi).lnk" "$INSTDIR\start-server.bat" "" "$INSTDIR\app.ico"
  CreateShortCut "${SM_DIR}\Thư mục cài đặt (.env, logs).lnk" "$INSTDIR"
  CreateShortCut "${SM_DIR}\Gỡ cài đặt.lnk" "$INSTDIR\uninstall.exe"
  CreateShortCut "$DESKTOP\Hệ thống bắt số.lnk" "$INSTDIR\Mo he thong bat so.url" "" "$INSTDIR\app.ico"

  ; Add/Remove Programs
  WriteRegStr HKLM "${UNINST_KEY}" "DisplayName" "${APP_NAME}"
  WriteRegStr HKLM "${UNINST_KEY}" "DisplayVersion" "${VERSION}"
  WriteRegStr HKLM "${UNINST_KEY}" "Publisher" "${PUBLISHER}"
  WriteRegStr HKLM "${UNINST_KEY}" "InstallLocation" "$INSTDIR"
  WriteRegStr HKLM "${UNINST_KEY}" "DisplayIcon" "$INSTDIR\app.ico"
  WriteRegStr HKLM "${UNINST_KEY}" "UninstallString" '"$INSTDIR\uninstall.exe"'
  WriteRegStr HKLM "${UNINST_KEY}" "QuietUninstallString" '"$INSTDIR\uninstall.exe" /S'
  WriteRegDWORD HKLM "${UNINST_KEY}" "NoModify" 1
  WriteRegDWORD HKLM "${UNINST_KEY}" "NoRepair" 1
  ${GetSize} "$INSTDIR" "/S=0K" $0 $1 $2
  IntFmt $0 "0x%08X" $0
  WriteRegDWORD HKLM "${UNINST_KEY}" "EstimatedSize" "$0"
SectionEnd

; ---------- Go cai dat ----------
Function un.onInit
  ${If} ${RunningX64}
    SetRegView 64
  ${EndIf}
FunctionEnd

Section "Uninstall"
  SetShellVarContext all
  DetailPrint "Dừng máy chủ và tắt tự khởi động cùng Windows..."
  ${If} ${FileExists} "$INSTDIR\tools\service.ps1"
    nsExec::ExecToLog '${PS_CMD} "$INSTDIR\tools\service.ps1" -Action uninstall'
    Pop $0
  ${EndIf}
  nsExec::Exec 'schtasks.exe /delete /tn HeThongBatSo_AutoStart /f'
  Pop $0
  Sleep 1500

  ; Xoa phan mem - GIU LAI: data\ (CSDL), .env, kiosk-questions.json, logs\, public\ (anh don vi)
  RMDir /r "$INSTDIR\src"
  RMDir /r "$INSTDIR\node_modules"
  RMDir /r "$INSTDIR\node"
  RMDir /r "$INSTDIR\tools"
  Delete "$INSTDIR\*.bat"
  Delete "$INSTDIR\package.json"
  Delete "$INSTDIR\package-lock.json"
  Delete "$INSTDIR\README.md"
  Delete "$INSTDIR\.env.example"
  Delete "$INSTDIR\kiosk-questions.example.json"
  Delete "$INSTDIR\Mo he thong bat so.url"
  Delete "$INSTDIR\app.ico"
  Delete "$INSTDIR\uninstall.exe"
  RMDir "$INSTDIR"

  RMDir /r "${SM_DIR}"
  Delete "$DESKTOP\Hệ thống bắt số.lnk"
  DeleteRegKey HKLM "${UNINST_KEY}"

  IfFileExists "$INSTDIR\*.*" 0 +2
    DetailPrint "Đã GIỮ LẠI dữ liệu và cấu hình tại $INSTDIR (data, .env, kiosk-questions.json, logs, public) - xoá tay nếu không cần."
SectionEnd
