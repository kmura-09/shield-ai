"""
Custom dictionary-based PII detection
"""
import json
import csv
import re
from pathlib import Path
from dataclasses import dataclass, field
from typing import Optional
from datetime import datetime


@dataclass
class DictionaryEntry:
    """Single dictionary entry"""
    value: str
    label: str
    category: str  # companies, projects, persons, custom


@dataclass
class Dictionary:
    """Custom dictionary for PII detection"""
    version: str = "1.0"
    updated_at: str = ""
    entries: list[DictionaryEntry] = field(default_factory=list)

    def add_entry(self, value: str, label: str, category: str = "custom"):
        """Add an entry to the dictionary"""
        # Check for duplicates
        for entry in self.entries:
            if entry.value == value:
                return False
        self.entries.append(DictionaryEntry(value=value, label=label, category=category))
        self.updated_at = datetime.now().isoformat()
        return True

    def remove_entry(self, value: str) -> bool:
        """Remove an entry from the dictionary"""
        for i, entry in enumerate(self.entries):
            if entry.value == value:
                self.entries.pop(i)
                self.updated_at = datetime.now().isoformat()
                return True
        return False

    def to_dict(self) -> dict:
        """Convert to dictionary format for JSON serialization"""
        grouped = {"companies": [], "projects": [], "persons": [], "custom": []}
        for entry in self.entries:
            if entry.category in grouped:
                grouped[entry.category].append({"value": entry.value, "label": entry.label})
            else:
                grouped["custom"].append({"value": entry.value, "label": entry.label})

        return {
            "version": self.version,
            "updated_at": self.updated_at,
            "entries": grouped
        }

    @classmethod
    def from_dict(cls, data: dict) -> "Dictionary":
        """Create Dictionary from dict"""
        entries = []
        for category, items in data.get("entries", {}).items():
            for item in items:
                entries.append(DictionaryEntry(
                    value=item["value"],
                    label=item.get("label", "機密情報"),
                    category=category
                ))
        return cls(
            version=data.get("version", "1.0"),
            updated_at=data.get("updated_at", ""),
            entries=entries
        )


class DictionaryManager:
    """Manages custom dictionaries"""

    def __init__(self, dictionary_dir: str = "dictionaries"):
        self.dictionary_dir = Path(dictionary_dir)
        self.dictionary_dir.mkdir(parents=True, exist_ok=True)
        self.custom_path = self.dictionary_dir / "custom.json"
        self._dictionary: Optional[Dictionary] = None

    @property
    def dictionary(self) -> Dictionary:
        """Load dictionary lazily"""
        if self._dictionary is None:
            self._dictionary = self._load_dictionary()
        return self._dictionary

    def _load_dictionary(self) -> Dictionary:
        """Load dictionary from file"""
        if self.custom_path.exists():
            try:
                with open(self.custom_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                return Dictionary.from_dict(data)
            except Exception as e:
                print(f"Error loading dictionary: {e}")
        return Dictionary()

    def save_dictionary(self):
        """Save dictionary to file"""
        with open(self.custom_path, "w", encoding="utf-8") as f:
            json.dump(self.dictionary.to_dict(), f, ensure_ascii=False, indent=2)

    def add_entry(self, value: str, label: str, category: str = "custom") -> bool:
        """Add entry and save"""
        result = self.dictionary.add_entry(value, label, category)
        if result:
            self.save_dictionary()
        return result

    def remove_entry(self, value: str) -> bool:
        """Remove entry and save"""
        result = self.dictionary.remove_entry(value)
        if result:
            self.save_dictionary()
        return result

    def import_csv(self, csv_content: str) -> int:
        """
        Import entries from CSV content

        Expected format:
        種別,値,ラベル
        会社名,株式会社ABC,会社名
        """
        category_map = {
            "会社名": "companies",
            "会社": "companies",
            "企業": "companies",
            "プロジェクト": "projects",
            "案件": "projects",
            "個人名": "persons",
            "人名": "persons",
            "その他": "custom",
            "カスタム": "custom",
        }

        count = 0
        reader = csv.reader(csv_content.strip().split("\n"))

        # Skip header
        header = next(reader, None)

        for row in reader:
            if len(row) < 2:
                continue

            category_ja = row[0].strip()
            value = row[1].strip()
            label = row[2].strip() if len(row) > 2 else category_ja

            category = category_map.get(category_ja, "custom")

            if value and self.dictionary.add_entry(value, label, category):
                count += 1

        if count > 0:
            self.save_dictionary()

        return count

    def get_all_entries(self) -> list[DictionaryEntry]:
        """Get all dictionary entries"""
        return self.dictionary.entries


@dataclass
class DictionaryDetection:
    """Result of dictionary-based detection"""
    entity_type: str
    text: str
    start: int
    end: int
    score: float = 0.95
    label: str = "機密情報"


class DictionaryDetector:
    """Detects PII based on custom dictionary"""

    def __init__(self, manager: DictionaryManager):
        self.manager = manager

    def detect(self, text: str) -> list[DictionaryDetection]:
        """Detect dictionary entries in text"""
        detections = []

        for entry in self.manager.get_all_entries():
            # Find all occurrences
            pattern = re.escape(entry.value)
            for match in re.finditer(pattern, text):
                detections.append(DictionaryDetection(
                    entity_type=f"DICT_{entry.category.upper()}",
                    text=match.group(),
                    start=match.start(),
                    end=match.end(),
                    score=0.95,
                    label=entry.label
                ))

        return detections
