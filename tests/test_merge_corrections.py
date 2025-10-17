import pytest

from safari_gpt_proofreader import Correction, merge_corrections


def test_merges_touching_corrections():
    corrections = [
        Correction(start=0, end=4, replacement="This"),
        Correction(start=4, end=7, replacement=" is"),
    ]

    merged = merge_corrections(corrections)

    assert merged == [Correction(start=0, end=7, replacement="This is")]


def test_preserves_sorted_order():
    corrections = [
        Correction(start=10, end=11, replacement="e"),
        Correction(start=0, end=4, replacement="This"),
        Correction(start=4, end=7, replacement=" is"),
    ]

    merged = merge_corrections(corrections)

    assert merged == [
        Correction(start=0, end=7, replacement="This is"),
        Correction(start=10, end=11, replacement="e"),
    ]


def test_does_not_merge_when_gap_exists():
    corrections = [
        Correction(start=0, end=4, replacement="This"),
        Correction(start=6, end=7, replacement="!")
    ]

    merged = merge_corrections(corrections)

    assert merged == corrections


def test_merges_overlapping_corrections_within_span():
    corrections = [
        Correction(start=0, end=5, replacement="hello"),
        Correction(start=2, end=4, replacement="yy"),
    ]

    merged = merge_corrections(corrections)

    assert merged == [Correction(start=0, end=5, replacement="heyyo")]


def test_merges_when_second_extends_beyond_first():
    corrections = [
        Correction(start=0, end=3, replacement="abc"),
        Correction(start=2, end=5, replacement="XYZ"),
    ]

    merged = merge_corrections(corrections)

    assert merged == [Correction(start=0, end=5, replacement="abXYZ")]


def test_empty_input_returns_empty_list():
    assert merge_corrections([]) == []


def test_invalid_range_raises_value_error():
    with pytest.raises(ValueError):
        Correction(start=5, end=4, replacement="oops")
