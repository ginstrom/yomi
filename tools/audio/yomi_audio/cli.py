"""`yomi-audio`: the command line.

    yomi-audio source add <file> --id ID --collection C --licence L --author A --url U ...
    yomi-audio impulse build [NAME ...]
    yomi-audio sfx audition <cue> ... [--out DIR] [--spectrogram]

Every command takes `--root` (default: the repository's `audio/`). A user's
mistake prints one line naming what is at fault and exits 1.
"""
import argparse
import sys
from pathlib import Path

from . import __version__
from .config import default_root
from .errors import AudioError


def _root_option() -> argparse.ArgumentParser:
    parent = argparse.ArgumentParser(add_help=False)
    parent.add_argument("--root", type=Path, default=None, help="the audio project (default: the repository's audio/)")
    return parent


def _parser() -> argparse.ArgumentParser:
    root = _root_option()
    parser = argparse.ArgumentParser(prog="yomi-audio", description="Yomi's audio tool.")
    parser.add_argument("--version", action="version", version=f"yomi-audio {__version__}")
    groups = parser.add_subparsers(dest="group", required=True)

    source = groups.add_parser("source", help="the sources registry").add_subparsers(dest="command", required=True)
    add = source.add_parser("add", parents=[root], help="trim, mono, resample and register a source")
    add.add_argument("file", type=Path)
    add.add_argument("--id", required=True)
    add.add_argument("--collection", required=True)
    add.add_argument("--licence", required=True)
    add.add_argument("--author", required=True)
    add.add_argument("--url", required=True)
    add.add_argument("--original", help="its path or name in the pack or site (default: the file's name)")
    add.add_argument("--start", type=float, help="seconds of the original to start at")
    add.add_argument("--end", type=float, help="seconds of the original to end at")
    add.add_argument("--notes")
    add.set_defaults(run=_source_add)

    impulse = groups.add_parser("impulse", help="reverb impulses").add_subparsers(dest="command", required=True)
    build = impulse.add_parser("build", parents=[root], help="render impulses/<name>.toml to <name>.flac")
    build.add_argument("names", nargs="*", help="only these impulses (default: all)")
    build.set_defaults(run=_impulse_build)

    sfx = groups.add_parser("sfx", help="sound-effect recipes").add_subparsers(dest="command", required=True)
    audition = sfx.add_parser("audition", parents=[root], help="render a cue's variants to WAV and measure them")
    audition.add_argument("cues", nargs="+", metavar="cue")
    audition.add_argument("--out", type=Path, help="output folder (default: <root>/.audition/<cue>/)")
    audition.add_argument("--spectrogram", action="store_true", help="also write a spectrogram PNG per variant")
    audition.set_defaults(run=_sfx_audition)
    return parser


def _source_add(args) -> int:
    from .sources import add_source

    entry = add_source(
        args.root, args.file, id=args.id, collection=args.collection, licence=args.licence,
        author=args.author, url=args.url, original=args.original, start=args.start, end=args.end,
        notes=args.notes,
    )
    print(f"added {entry['id']}: {entry['file']} ({entry['sha256'][:12]})")
    return 0


def _impulse_build(args) -> int:
    from .impulses import build_impulses

    for path, changed in build_impulses(args.root, args.names or None):
        print(f"{'wrote' if changed else 'unchanged'} {path.relative_to(args.root)}")
    return 0


def _sfx_audition(args) -> int:
    from .audition import audition

    audition(args.root, args.cues, out=args.out, spectrogram=args.spectrogram)
    return 0


def main(argv: list[str] | None = None) -> int:
    args = _parser().parse_args(argv)
    args.root = (args.root or default_root()).resolve()
    try:
        return args.run(args)
    except AudioError as error:
        print(f"yomi-audio: {error}", file=sys.stderr)
        return 1
