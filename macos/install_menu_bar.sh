#!/bin/zsh
set -euo pipefail

script_dir=${0:A:h}
application_root=${ANTI_TURTLE_APPLICATION_ROOT:-"${HOME}/Applications"}
application_path="${application_root}/Anti Turtle Menu.app"
contents_path="${application_path}/Contents"
executable_path="${contents_path}/MacOS/AntiTurtleMenu"

mkdir -p "${contents_path}/MacOS"
/usr/bin/swiftc \
  -O \
  -framework AppKit \
  "${script_dir}/AntiTurtleMenu.swift" \
  -o "${executable_path}"
/bin/cp "${script_dir}/AntiTurtleMenu-Info.plist" "${contents_path}/Info.plist"
/bin/chmod 755 "${executable_path}"
/usr/bin/codesign --force --sign - "${application_path}" >/dev/null

print "Installed: ${application_path}"
print "Launch with:"
print "  open '${application_path}' --args --base-url https://YOUR_DEPLOYMENT.example --session head-demo --mode HEAD"
