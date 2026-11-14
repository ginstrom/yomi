"""`yomi-audio`: the command line.

    yomi-audio source add <file> --id ID --collection C --licence L --author A --url U ...
    yomi-audio source remove <id>
    yomi-audio impulse build [NAME ...]
    yomi-audio sfx audition <cue> ... [--out DIR] [--spectrogram]
    yomi-audio sfx build [--bank B] [--cue C]
    yomi-audio sfx check
    yomi-audio voice design <voice> [--emotions E,...] [--candidates N] [--neutral WAV] [--out DIR]
    yomi-audio voice bakeoff [--redesign]
    yomi-audio voice render

The voice commands need the `tts` extra (uv run --project tools/audio --extra tts ...).

Every command takes `--root` (default: the repository's `audio/`). A user's
mistake prints one line naming what is at fault and exits 1; so does any
other failure (its type and message, never a traceback).
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
    remove = source.add_parser("remove", parents=[root], help="delete a source no recipe names, file and entry")
    remove.add_argument("id")
    remove.set_defaults(run=_source_remove)

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
    sfx_build = sfx.add_parser("build", parents=[root], help="render changed cues, check them, write the banks and manifest")
    sfx_build.add_argument("--bank", help="also rebuild this bank")
    sfx_build.add_argument("--cue", help="also rebuild this cue's bank")
    sfx_build.set_defaults(run=_sfx_build)
    sfx_check = sfx.add_parser("check", parents=[root], help="fail if a built file is stale, altered or over budget")
    sfx_check.set_defaults(run=_sfx_check)

    voice = groups.add_parser("voice", help="narration (needs the tts extra)").add_subparsers(dest="command", required=True)
    design = voice.add_parser("design", parents=[root], help="emotion reference-clip candidates for a voice of voices.toml")
    design.add_argument("voice", help="the voice's table in voices.toml (e.g. narrator)")
    design.add_argument("--emotions", help="comma-separated (default: every one the voice declares but neutral)")
    design.add_argument("--candidates", type=int, default=None, help="candidates per emotion (default 4)")
    design.add_argument("--neutral", type=Path, help="the neutral reference (default: the voice's clips.neutral)")
    design.add_argument("--out", type=Path, help="output folder (default: <root>/.audition/voice-<voice>/)")
    design.set_defaults(run=_voice_design)
    bakeoff = voice.add_parser("bakeoff", parents=[root], help="render the narration listening test into bakeoff/")
    bakeoff.add_argument("--redesign", action="store_true", help="design the narrators again even if bakeoff/designed/ holds them")
    bakeoff.set_defaults(run=_voice_bakeoff)
    render = voice.add_parser("render", parents=[root], help="render the narration lines whose inputs changed")
    render.set_defaults(run=_voice_render)
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


def _source_remove(args) -> int:
    from .sources import remove_source

    entry = remove_source(args.root, args.id)
    print(f"removed {entry['id']}: {entry['file']}")
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


def _sfx_build(args) -> int:
    from .build import build

    build(args.root, bank=args.bank, cue=args.cue)
    return 0


def _sfx_check(args) -> int:
    from .build import BuildFailed, check

    problems = check(args.root)
    if problems:
        raise BuildFailed("sfx check", problems)
    return 0


def _voice_design(args) -> int:
    from .config import load_config
    from .design import design_emotions
    from .voice import CANDIDATES, real_encoder, real_engines

    candidates = CANDIDATES if args.candidates is None else args.candidates
    emotions = None
    if args.emotions is not None:
        emotions = [e.strip() for e in args.emotions.split(",") if e.strip()]
        if not emotions:
            raise AudioError("--emotions names no emotion (leave it out for every declared one)")
    config = load_config(args.root)
    # Refuse a bad voice, emotion or reference before loading any model.
    design_emotions(
        config, args.voice, _Lazy(lambda: real_engines()["qwen3_design"]), _Lazy(real_encoder),
        out=args.out, neutral=args.neutral, emotions=emotions, candidates=candidates,
    )
    return 0


class _Lazy:
    """Builds the real engine or encoder on first use, so a refusal loads nothing."""

    def __init__(self, make):
        self._make, self._made = make, None

    def __getattr__(self, name):
        if self._made is None:
            self._made = self._make()
        return getattr(self._made, name)


def _voice_render(args) -> int:
    from .config import load_config
    from .render import render_lines
    from .voice import real_engines

    render_lines(load_config(args.root), _LazyEngines(real_engines))
    return 0


class _LazyEngines:
    """The real engines, built on first lookup, so a refusal or a run with nothing to render loads no model."""

    def __init__(self, make):
        self._make, self._made = make, None

    def _engines(self):
        if self._made is None:
            self._made = self._make()
        return self._made

    def __contains__(self, name):
        return name in self._engines()

    def __getitem__(self, name):
        return self._engines()[name]


def _voice_bakeoff(args) -> int:
    from .config import load_config
    from .voice import bakeoff, real_encoder, real_engines

    out = bakeoff(load_config(args.root), real_engines(), real_encoder(), redesign=args.redesign)
    print(f"wrote {out}: c01.wav ... c32.wav, key.json, score.md, neutral_candidates/, designed/")
    return 0


def main(argv: list[str] | None = None) -> int:
    args = _parser().parse_args(argv)
    args.root = (args.root or default_root()).resolve()
    try:
        return args.run(args)
    except AudioError as error:
        print(f"yomi-audio: {error}", file=sys.stderr)
        return 1
    except Exception as error:  # a fault the tool did not foresee: still one line, no traceback
        detail = " ".join(str(error).split())
        print(f"yomi-audio: {args.group} {args.command}: unexpected {type(error).__name__}: {detail}", file=sys.stderr)
        return 1
