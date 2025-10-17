"""Core utilities for the Safari GPT proofreader project."""

from .corrections import Correction, merge_corrections

__all__ = ["Correction", "merge_corrections"]
