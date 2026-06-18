!macro NSIS_HOOK_POSTINSTALL
  # Write file context menu
  WriteRegStr HKCU "Software\Classes\*\shell\Depdok" "" "Open with Depdok"
  WriteRegStr HKCU "Software\Classes\*\shell\Depdok" "Icon" "$INSTDIR\Depdok.exe,0"
  WriteRegStr HKCU "Software\Classes\*\shell\Depdok\command" "" '"$INSTDIR\Depdok.exe" "%1"'

  # Write directory context menu
  WriteRegStr HKCU "Software\Classes\Directory\shell\Depdok" "" "Open Folder with Depdok"
  WriteRegStr HKCU "Software\Classes\Directory\shell\Depdok" "Icon" "$INSTDIR\Depdok.exe,0"
  WriteRegStr HKCU "Software\Classes\Directory\shell\Depdok\command" "" '"$INSTDIR\Depdok.exe" "%V"'

  # Write directory background context menu
  WriteRegStr HKCU "Software\Classes\Directory\Background\shell\Depdok" "" "Open Folder with Depdok"
  WriteRegStr HKCU "Software\Classes\Directory\Background\shell\Depdok" "Icon" "$INSTDIR\Depdok.exe,0"
  WriteRegStr HKCU "Software\Classes\Directory\Background\shell\Depdok\command" "" '"$INSTDIR\Depdok.exe" "%V"'
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  # Delete registry keys
  DeleteRegKey HKCU "Software\Classes\*\shell\Depdok"
  DeleteRegKey HKCU "Software\Classes\Directory\shell\Depdok"
  DeleteRegKey HKCU "Software\Classes\Directory\Background\shell\Depdok"
!macroend
