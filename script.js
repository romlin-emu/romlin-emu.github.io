const platform = navigator.userAgentData?.platform || navigator.platform || "";
const os = /mac/i.test(platform) ? "Mac" : /win/i.test(platform) ? "Windows" : /linux/i.test(platform) ? "Linux" : null;

if (os) {
  for (const a of document.querySelectorAll("[data-os-label]")) a.textContent = `Download for ${os}`;
}

// The first build for each system is the one its Download button gets; the rest are offered beside it.
const builds = [
  { os: "Mac", label: "Mac with Apple silicon", name: "Mac", match: /macos.*\.zip$/ },
  { os: "Windows", label: "Windows", name: "Windows", match: /windows.*\.zip$/ },
  { os: "Linux", label: "Linux", name: "Linux AppImage", match: /\.AppImage$/ },
  { os: "Linux", label: "Debian and Ubuntu", name: ".deb", match: /\.deb$/ },
  { os: "Linux", label: "Fedora and openSUSE", name: ".rpm", match: /\.rpm$/ },
];

fetch("https://api.github.com/repos/romlin-emu/romlin/releases/latest")
  .then(r => r.ok ? r.json() : null)
  .then(release => {
    if (!release) return;
    const version = release.tag_name.replace(/^v/, "");
    const tag = document.querySelector("[data-tag]");
    tag.textContent = release.tag_name;
    tag.hidden = false;

    const url = build => release.assets.find(a => build.match.test(a.name))?.browser_download_url;
    const mine = builds.find(b => b.os === os);
    const direct = mine && url(mine);
    if (direct) {
      for (const a of document.querySelectorAll("[data-os-label]")) a.href = direct;
    }
    for (const p of document.querySelectorAll("[data-version]")) {
      p.textContent = direct ? `Version ${version} for ${mine.label}` : `Version ${version} for macOS, Windows and Linux`;
    }

    const others = document.querySelector("[data-others]");
    for (const build of builds) {
      if (build === mine && direct) continue;
      const href = url(build);
      if (!href) continue;
      const a = document.createElement("a");
      a.href = href;
      a.textContent = build.name;
      others.append(a);
    }
    if (others.children.length) {
      others.prepend(direct ? "Also for " : "Download for ");
      others.hidden = false;
    }
  })
  .catch(() => {});

for (const switcher of document.querySelectorAll(".switcher")) {
  const buttons = switcher.querySelectorAll("button[data-look]");
  for (const button of buttons) {
    button.addEventListener("click", () => {
      for (const b of buttons) b.setAttribute("aria-pressed", String(b === button));
      for (const img of switcher.querySelectorAll("img[data-look]")) {
        img.classList.toggle("is-on", img.dataset.look === button.dataset.look);
      }
    });
  }
}
