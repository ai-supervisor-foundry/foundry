export const GEMINI_API_USAGE_EXHAUSTED = {
    response: `Loaded cached credentials.
    Server 'chrome-devtools' supports tool updates. Listening for changes...
    Error when talking to Gemini API Full report available at: /tmp/gemini-client-error-Turn.run-sendMessageStream-2026-01-01T10-36-16-891Z.json
    [API Error: You have exhausted your capacity on this model. Your quota will reset after 2h52m39s.]
    An unexpected critical error occurred:[object Object]`,
    exitCode: 1,
    detailedError: {
        "error": {
          "message": "You have exhausted your capacity on this model. Your quota will reset after 2h36m24s.",
          "stack": "TerminalQuotaError: You have exhausted your capacity on this model. Your quota will reset after 2h36m24s.\n    at classifyGoogleError (file:///home/ahmedhaider/.nvm/versions/node/v24.12.0/lib/node_modules/@google/gemini-cli/node_modules/@google/gemini-cli-core/dist/src/utils/googleQuotaErrors.js:136:28)\n    at retryWithBackoff (file:///home/ahmedhaider/.nvm/versions/node/v24.12.0/lib/node_modules/@google/gemini-cli/node_modules/@google/gemini-cli-core/dist/src/utils/retry.js:127:37)\n    at process.processTicksAndRejections (node:internal/process/task_queues:103:5)\n    at async GeminiChat.makeApiCallAndProcessStream (file:///home/ahmedhaider/.nvm/versions/node/v24.12.0/lib/node_modules/@google/gemini-cli/node_modules/@google/gemini-cli-core/dist/src/core/geminiChat.js:411:32)\n    at async GeminiChat.streamWithRetries (file:///home/ahmedhaider/.nvm/versions/node/v24.12.0/lib/node_modules/@google/gemini-cli/node_modules/@google/gemini-cli-core/dist/src/core/geminiChat.js:236:40)\n    at async Turn.run (file:///home/ahmedhaider/.nvm/versions/node/v24.12.0/lib/node_modules/@google/gemini-cli/node_modules/@google/gemini-cli-core/dist/src/core/turn.js:60:30)\n    at async GeminiClient.sendMessageStream (file:///home/ahmedhaider/.nvm/versions/node/v24.12.0/lib/node_modules/@google/gemini-cli/node_modules/@google/gemini-cli-core/dist/src/core/client.js:399:26)\n    at async file:///home/ahmedhaider/.nvm/versions/node/v24.12.0/lib/node_modules/@google/gemini-cli/dist/src/nonInteractiveCli.js:192:34\n    at async main (file:///home/ahmedhaider/.nvm/versions/node/v24.12.0/lib/node_modules/@google/gemini-cli/dist/src/gemini.js:445:9)"
        },
        "context": [
          {
            "role": "user",
            "parts": [
              {
                "text": "This is the Gemini CLI. We are setting up the context for our chat.\nToday's date is Thursday, January 1, 2026 (formatted according to the user's locale).\nMy operating system is: linux\nThe project's temporary directory is: /home/ahmedhaider/.gemini/tmp/e3f7af0b0cbce80ecee4547d7c25ca7a38c5c6e2ae227a13a3a89838066b7e01\nI'm currently working in the directory: /home/ahmedhaider\nHere is the folder structure of the current working directories:\n\nShowing up to 200 items (files + folders). Folders or files indicated with ... contain more items not shown, were ignored, or the display limit (200 items) was reached.\n\n/home/ahmedhaider/\n├───.awsp\n├───.bash_history\n├───.bash_history-17740.tmp\n├───.bash_history-39221.tmp\n├───.bash_logout\n├───.bashrc\n├───.claude.json\n├───.claude.json.backup\n├───.cursorignore\n├───.emulator_console_auth_token\n├───.gitconfig\n├───.lesshst\n├───.profile\n├───.psql_history\n├───.scala_history\n├───.sudo_as_admin_successful\n├───.viminfo\n├───.wget-hsts\n├───.yarnrc\n├───bloatware_list.txt\n├───cs\n├───fix-xfce-logout.sh\n├───installed_software.txt\n├───k9s_linux_amd64.deb.1\n├───power_analysis_report.md\n├───winehq.key\n├───.android/\n│   ├───adb.5037\n│   ├───adbkey\n│   ├───adbkey.pub\n│   ├───analytics.settings\n│   ├───debug.keystore\n│   ├───emu-last-feature-flags.protobuf\n│   ├───emu-update-last-check.ini\n│   ├───modem-nv-ram-5554\n│   └───avd/\n├───.ansible/\n│   ├───cp/\n│   └───tmp/\n├───.aws/\n│   ├───.cursorignore\n│   ├───config\n│   ├───credentials\n│   └───.cursor/\n├───.cache/\n│   ├───event-sound-cache.tdb.ddd0795b15cc43f58bd9c3c7bdf95ddf.x86_64-pc-linux-gnu\n│   ├───motd.legal-displayed\n│   ├───claude/\n│   ├───coursier/\n│   ├───Cursor/\n│   ├───evolution/\n│   ├───fontconfig/\n│   ├───gnome-calculator/\n│   ├───gnome-desktop-thumbnailer/\n│   ├───Google/\n│   ├───google-chrome/\n│   ├───gstreamer-1.0/\n│   ├───ibus/\n│   ├───ibus-table/\n│   ├───JNA/\n│   ├───mesa_shader_cache/\n│   ├───Microsoft/\n│   ├───microsoft-edge/\n│   ├───mozilla/\n│   ├───node-gyp/\n│   ├───obexd/\n│   ├───opera/\n│   ├───pip/\n│   ├───pnpm/\n│   ├───puppeteer/\n│   ├───samba/\n│   ├───sessions/\n│   ├───thumbnails/\n│   ├───totem/\n│   ├───tracker3/\n│   ├───typescript/\n│   ├───ubuntu-pro/\n│   ├───ubuntu-report/\n│   ├───update-manager-core/\n│   ├───vscode-ripgrep/\n│   └───yarn/\n├───.claude/\n│   ├───history.jsonl\n│   ├───debug/\n│   ├───downloads/\n│   ├───plugins/\n│   ├───projects/\n│   ├───shell-snapshots/\n│   ├───statsig/\n│   └───todos/\n├───.codeium/\n│   └───windsurf/\n├───.codex/\n│   ├───auth.json\n│   ├───config.toml\n│   ├───history.jsonl\n│   ├───version.json\n│   ├───log/\n│   ├───sessions/\n│   └───skills/\n├───.config/\n│   ├───.gsd-keyboard.settings-ported\n│   ├───gnome-initial-setup-done\n│   ├───GNOME-xdg-terminals.list\n│   ├───mimeapps.list\n│   ├───monitors.xml\n│   ├───monitors.xml~\n│   ├───ubuntu-xdg-terminals.list\n│   ├───user-dirs.dirs\n│   ├───user-dirs.locale\n│   ├───xdg-terminals.list\n│   ├───Android Open Source Project/\n│   ├───Code/\n│   ├───cursor/\n│   ├───Cursor/\n│   ├───dconf/\n│   ├───enchant/\n│   ├───eog/\n│   ├───evolution/\n│   ├───gh/\n│   ├───gh-copilot/\n│   ├───glib-2.0/\n│   ├───gnome-session/\n│   ├───goa-1.0/\n│   ├───Google/\n│   ├───google-chrome/\n│   ├───google-chrome-for-testing/\n│   ├───gtk-3.0/\n│   ├───gtk-4.0/\n│   ├───ibus/\n│   ├───k9s/\n│   ├───menus/\n│   ├───microsoft-edge/\n│   ├───nautilus/\n│   ├───ngrok/\n│   ├───opera/\n│   ├───paradox-launcher-v2/\n│   ├───procps/\n│   ├───pulse/\n│   ├───RedisInsight/\n│   ├───Signal/\n│   ├───systemd/\n│   ├───Thunar/\n│   ├───tiling-assistant/\n│   ├───totem/\n│   ├───unity3d/\n│   ├───update-notifier/\n│   ├───Windsurf/\n│   └───xfce4/\n├───.copilot/\n│   ├───command-history-state.json\n│   ├───config.json\n│   ├───logs/\n│   ├───pkg/\n│   └───session-state/\n├───.cursor/\n│   ├───argv.json\n│   ├───cli-config.json\n│   ├───...\n│   └───...\n├───.cursor-server/\n├───.docker/\n├───.dotnet/\n├───.expo/\n├───.gemini/\n├───.gnome/\n├───.gnupg/\n├───.java/\n├───.kube/\n├───.local/\n├───.mozilla/\n├───.npm/\n├───.nvm/\n├───.paradoxlauncher/\n├───.pki/\n├───.pm2/\n├───.redis-insight/\n├───.ssh/\n├───.steam/\n├───.terraform.d/\n├───.tfenv/\n├───.vscode/\n├───.vscode-server/\n├───.windsurf/\n├───.yarn/\n├───Android/\n├───build/\n├───Desktop/\n├───docs/\n├───Documents/\n├───Downloads/\n├───excalidraw/\n├───macbookshare/\n├───Music/\n├───ONEDRIVE/\n├───Pictures/\n├───Public/\n├───snap/\n├───temp/\n├───Templates/\n├───Videos/\n└───work/\n\nReminder: Do not return an empty response when a tool call is required.\n\nMy setup is complete. I will provide my first command in the next turn."
              }
            ]
          },
          {
            "role": "user",
            "parts": [
              {
                "text": "hi"
              }
            ]
          },
          {
            "role": "user",
            "parts": [
              {
                "text": "hi"
              }
            ]
          }
        ]
      }
}