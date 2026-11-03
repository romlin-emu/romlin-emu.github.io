import tempfile
import unittest
from pathlib import Path

from check_links import check_site


class LinkChecks(unittest.TestCase):
    def test_references(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "guide").mkdir()
            (root / "image.png").write_bytes(b"fixture")
            (root / "style.css").write_text('body { background: url("image.png"); }')
            (root / "index.html").write_text('''
                <h1 id="hello world">Hello</h1>
                <a href="/guide/?version=1#install">Guide</a>
                <a href="#hello%20world">Heading</a>
                <a href="https://example.invalid/missing">External</a>
                <a href="//example.invalid/missing">External</a>
                <a href="mailto:hello@example.invalid">Mail</a>
                <link href="style.css?v=1" rel="stylesheet">
                <img src="image.png" srcset="image.png 1x, /image.png 2x">
                <div style="background: url(image.png)"></div>
            ''')
            (root / "guide/index.html").write_text('<h1 id="install">Install</h1><a href="../#hello%20world">Home</a>')
            self.assertEqual(check_site(root), [])

            (root / "image.png").unlink()
            (root / "guide/index.html").write_text('<h1 id="renamed">Install</h1>')
            errors = check_site(root)
            self.assertTrue(any("missing fragment" in error for error in errors))
            self.assertTrue(any("style.css: image.png: missing file" in error for error in errors))
            self.assertTrue(any("index.html: /image.png: missing file" in error for error in errors))

    def test_missing_files_and_fragments(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "index.html").write_text('''
                <script src="missing.js"></script>
                <a href="#absent">Broken anchor</a>
                <a href="/missing/">Broken page</a>
                <a href="../outside.html">Outside root</a>
            ''')
            self.assertEqual(len(check_site(root)), 4)


if __name__ == "__main__":
    unittest.main()
