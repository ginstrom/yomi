"""The one error the tool raises for a user's mistake.

The CLI catches it and prints its message (which names the cue, source,
field or line at fault) on one line, exiting non-zero, with no traceback.
"""


class AudioError(Exception):
    pass
