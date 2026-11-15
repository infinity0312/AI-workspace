@echo off
setlocal EnableExtensions
if exist "%USERPROFILE%\.cargo\bin\cargo.exe" set "PATH=%USERPROFILE%\.cargo\bin;%PATH%"
if not defined AKW_VS_DEV_CMD if exist "%ProgramFiles(x86)%\Microsoft Visual Studio\Installer\vswhere.exe" (
  for /f "usebackq delims=" %%v in (`"%ProgramFiles(x86)%\Microsoft Visual Studio\Installer\vswhere.exe" -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath`) do set "AKW_VS_DEV_CMD=%%v\Common7\Tools\VsDevCmd.bat"
)
if defined AKW_VS_DEV_CMD (
  call "%AKW_VS_DEV_CMD%" -no_logo -arch=amd64 -host_arch=amd64
  if errorlevel 1 exit /b 1
)
where cargo >nul 2>nul
if errorlevel 1 (
  echo Install the Rust MSVC toolchain before building Windows.
  exit /b 1
)
where cl >nul 2>nul
if errorlevel 1 (
  echo Microsoft C++ Build Tools were not found. Set AKW_VS_DEV_CMD to VsDevCmd.bat.
  exit /b 1
)
call %*
exit /b %errorlevel%
