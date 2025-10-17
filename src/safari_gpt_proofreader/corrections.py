"""Utilities for manipulating text corrections.

This module defines a :class:`Correction` data structure together with helper
functions that operate on ordered correction spans.  The central utility is
``merge_corrections`` which combines overlapping or adjacent corrections into a
single edit.  The function is performance critical because it is used on every
model response before rendering a diff for the user, so even subtle off-by-one
errors may surface as duplicated highlights in the UI.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable, List


@dataclass(frozen=True)
class Correction:
    """Represents a text edit suggested by the proofreader.

    Attributes
    ----------
    start:
        The zero-based index where the edit begins (inclusive).
    end:
        The zero-based index where the edit ends (exclusive).  ``end`` must be
        greater than or equal to ``start``.
    replacement:
        The replacement text that should take the place of the span being
        corrected.
    """

    start: int
    end: int
    replacement: str

    def __post_init__(self) -> None:  # type: ignore[override]
        if self.end < self.start:
            raise ValueError(
                "Correction.end must be greater than or equal to Correction.start"
            )


def merge_corrections(corrections: Iterable[Correction]) -> List[Correction]:
    """Merge overlapping or touching corrections into coalesced edits.

    Historically the implementation only merged corrections when the next span
    *strictly* overlapped the previous one.  Touching edits (where
    ``corr.start == prev.end``) were treated as distinct operations which lead
    to double counting of inserted text in the rendered diff.  The function now
    merges touching edits by concatenating their replacement text, ensuring that
    the proofreader output matches the intended final text.

    Parameters
    ----------
    corrections:
        An iterable of :class:`Correction` objects.  The input may be unsorted;
        the function sorts it by ``start`` (and ``end`` as a tiebreaker).

    Returns
    -------
    list of :class:`Correction`
        The minimal list of non-overlapping corrections ordered by ``start``.
    """

    sorted_corrections = sorted(corrections, key=lambda c: (c.start, c.end))
    if not sorted_corrections:
        return []

    merged: List[Correction] = [sorted_corrections[0]]
    for current in sorted_corrections[1:]:
        previous = merged[-1]
        if current.start <= previous.end:
            new_end = max(previous.end, current.end)
            overlap = max(previous.end - current.start, 0)
            if overlap:
                combined_replacement = (
                    previous.replacement + current.replacement[overlap:]
                )
            else:
                combined_replacement = previous.replacement + current.replacement

            merged[-1] = Correction(previous.start, new_end, combined_replacement)
        else:
            merged.append(current)

    return merged
