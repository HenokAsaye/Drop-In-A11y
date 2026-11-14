"""Write the API's OpenAPI document to disk; the TypeScript contracts are generated from it."""

import json
import sys
from pathlib import Path

from app.main import create_app


def main() -> None:
    if len(sys.argv) != 2:
        sys.exit("usage: python -m scripts.export_openapi <output.json>")
    output = Path(sys.argv[1])
    schema = create_app().openapi()
    output.write_text(json.dumps(schema, indent=2, sort_keys=True, ensure_ascii=False) + "\n")
    print(f"OpenAPI schema written to {output}")


if __name__ == "__main__":
    main()
