"""Narration engines behind one adapter (`base.Engine`).

`base.py` and the engine modules import without the `tts` extra; an engine
loads mlx-audio and its weights only when it first renders.
"""
