cask "depdok" do
  version "0.28.0"
  sha256 :no_check

  name "Depdok"
  desc "A Lightweight, offline-first
editor for developers"
  homepage "https://depdok.com"

  on_macos do
    url "https://github.com/hudy9x/depdok-ladi/releases/download/v#{version}/Depdok_#{version}_aarch64.dmg"

    app "Depdok.app"

    zap trash: [
      "~/Library/Application Support/com.tauri.dev",
      "~/Library/Caches/com.tauri.dev",
      "~/Library/Preferences/com.tauri.dev.plist",
      "~/Library/Saved Application State/com.tauri.dev.savedState",
    ]

    caveats <<~EOS
      If you encounter the "App is damaged" error, please run the following command:
        sudo xattr -rd com.apple.quarantine "/Applications/Depdok.app"

      Or install with the --no-quarantine flag:
        brew install --cask --no-quarantine depdok
    EOS
  end
end
