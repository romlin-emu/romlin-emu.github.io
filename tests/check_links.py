"""Check local HTML references and CSS assets without making network requests."""

import re
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit


def css_urls(text):
    # shortcut: handles this site's url() values; use a CSS parser if syntax grows.
    return re.findall(r"url\(\s*['\"]?([^'\")\s]+)['\"]?\s*\)", text)


class Page(HTMLParser):
    def __init__(self, text):
        super().__init__()
        self.ids = set()
        self.references = []
        self.feed(text)

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if attrs.get("id"):
            self.ids.add(attrs["id"])
        if tag == "a" and attrs.get("name"):
            self.ids.add(attrs["name"])
        for name in ("href", "src", "poster"):
            if attrs.get(name):
                self.references.append(attrs[name])
        if attrs.get("srcset"):
            # shortcut: plain file srcsets only; use a srcset parser if data URLs are added.
            self.references.extend(item.split()[0] for item in attrs["srcset"].split(",") if item.strip())
        self.references.extend(css_urls(attrs.get("style", "")))


def check_site(root):
    root = root.resolve()
    pages = {path: Page(path.read_text(encoding="utf-8")) for path in root.rglob("*.html")}
    sources = {path: page.references for path, page in pages.items()}
    for path in root.rglob("*.css"):
        sources[path] = css_urls(path.read_text(encoding="utf-8"))
    errors = []
    for source, references in sources.items():
        for reference in references:
            url = urlsplit(reference)
            if url.scheme or url.netloc:
                continue
            path = unquote(url.path)
            if not path:
                target = source
            else:
                base = root if path.startswith("/") else source.parent
                target = (base / path.lstrip("/")).resolve()
            if not target.is_relative_to(root):
                problem = "outside site root"
            else:
                if target.is_dir():
                    target /= "index.html"
                if not target.is_file():
                    problem = "missing file"
                elif url.fragment and target in pages and unquote(url.fragment) not in pages[target].ids:
                    problem = "missing fragment"
                else:
                    continue
            errors.append(f"{source.relative_to(root)}: {reference}: {problem}")
    return errors


if __name__ == "__main__":
    errors = check_site(Path(__file__).resolve().parents[1])
    if errors:
        raise SystemExit("\n".join(errors))
    print("Local HTML references and CSS assets OK")
