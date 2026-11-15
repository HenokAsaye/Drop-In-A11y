# /// script
# requires-python = ">=3.13"
# dependencies = ["weasyprint==70.0"]
# ///
"""Build the tagged PDF copy of a lesson handout from its accessible HTML.

The HTML is the only source. The PDF is written as PDF/UA-1, so it keeps the document language,
the title, real headings, the table headers, the figure's alt text, and the links of the HTML, in
the same reading order.

    uv run scripts/build_notes_pdf.py assets/documents/networking-101-notes.html

Page size and print colors come from the handout's own `@media print` rules. Elements marked
`data-copy="html"` appear only in the web page and `data-copy="pdf" hidden` only in the PDF, so
each copy can point to the other one.
"""

import argparse
import base64
import mimetypes
import re
from pathlib import Path

from weasyprint import CSS, HTML

PDF_COPY_STYLES = CSS(
    string="""
    [data-copy="html"] { display: none; }
    [data-copy="pdf"] { display: block; }
    """
)

IMAGE_SOURCE = re.compile(r'(<img\b[^>]*?\bsrc=")([^"]+)(")')


def inline_images(markup: str, folder: Path) -> str:
    """Embed each local image as a data URL.

    The PDF is rendered without a base URL so its links stay relative to wherever the copy is
    saved, instead of pointing at this machine's file system.
    """

    def embed(match: re.Match[str]) -> str:
        source = match.group(2)
        if ":" in source:
            return match.group(0)
        image = (folder / source).resolve()
        if folder.resolve() not in image.parents:
            raise ValueError(f"Image {source!r} is outside {folder}")
        media_type = mimetypes.guess_type(image.name)[0] or "application/octet-stream"
        data = base64.b64encode(image.read_bytes()).decode("ascii")
        return f"{match.group(1)}data:{media_type};base64,{data}{match.group(3)}"

    return IMAGE_SOURCE.sub(embed, markup)


def build_pdf(source: Path, target: Path) -> None:
    markup = inline_images(source.read_text(encoding="utf-8"), source.parent)
    HTML(string=markup).write_pdf(target, stylesheets=[PDF_COPY_STYLES], pdf_variant="pdf/ua-1")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("source", type=Path, help="accessible HTML handout")
    parser.add_argument("--output", type=Path, help="PDF path (default: next to the HTML)")
    arguments = parser.parse_args()
    target = arguments.output or arguments.source.with_suffix(".pdf")
    build_pdf(arguments.source, target)
    print(f"Wrote {target}")


if __name__ == "__main__":
    main()
