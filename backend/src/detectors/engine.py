"""
Main detection engine combining Presidio, Dictionary, and LLM detection
"""
from dataclasses import dataclass, field
from typing import Optional
from pathlib import Path
from presidio_analyzer import AnalyzerEngine, RecognizerRegistry
from presidio_anonymizer import AnonymizerEngine
from presidio_anonymizer.entities import OperatorConfig

from .japanese_patterns import get_japanese_recognizers
from .llm_detector import LLMDetector
from .dictionary import DictionaryManager, DictionaryDetector


@dataclass
class Detection:
    """Represents a detected PII entity"""
    entity_type: str
    text: str
    start: int
    end: int
    score: float
    method: str  # "regex" or "llm"


@dataclass
class DetectionResult:
    """Result of PII detection"""
    original_text: str
    masked_text: str
    detections: list[Detection] = field(default_factory=list)
    processing_time_ms: float = 0.0


# Entity type to Japanese label mapping
ENTITY_LABELS = {
    "PERSON": "個人名",
    "ORGANIZATION": "会社名",
    "EMAIL_ADDRESS": "メールアドレス",
    "PHONE_NUMBER": "電話番号",
    "JP_PHONE_NUMBER": "電話番号",
    "CREDIT_CARD": "クレジットカード",
    "JP_POSTAL_CODE": "郵便番号",
    "JP_ADDRESS": "住所",
    "JP_MY_NUMBER": "マイナンバー",
    "JP_CURRENCY": "金額",
    "JP_COMPANY": "会社名",
    "JP_PERSON_NAME": "個人名",
    "API_KEY": "APIキー",
    "IP_ADDRESS": "IPアドレス",
    "URL": "URL",
    "PROJECT_NAME": "プロジェクト名",
    "CONFIDENTIAL": "機密情報",
    # Dictionary-based detections
    "DICT_COMPANIES": "会社名",
    "DICT_PROJECTS": "プロジェクト名",
    "DICT_PERSONS": "個人名",
    "DICT_CUSTOM": "機密情報",
}


class ShieldAIEngine:
    """
    Main detection engine for ShieldAI

    Combines:
    - Presidio pattern-based detection
    - Custom Japanese patterns
    - LLM-based context detection (optional)
    """

    def __init__(
        self,
        use_llm: bool = False,
        llm_model: str = "gemma2:9b",
        ollama_url: str = "http://localhost:11434",
        min_text_length_for_llm: int = 50,
        dictionary_dir: str = "dictionaries"
    ):
        self.use_llm = use_llm
        self.min_text_length_for_llm = min_text_length_for_llm

        # Initialize Presidio
        self.registry = RecognizerRegistry()
        self.registry.load_predefined_recognizers()

        # Add Japanese recognizers
        for recognizer in get_japanese_recognizers():
            self.registry.add_recognizer(recognizer)

        self.analyzer = AnalyzerEngine(registry=self.registry)
        self.anonymizer = AnonymizerEngine()

        # Initialize Dictionary detector
        self.dictionary_manager = DictionaryManager(dictionary_dir)
        self.dictionary_detector = DictionaryDetector(self.dictionary_manager)

        # Initialize LLM detector
        self.llm_detector = LLMDetector(
            model=llm_model,
            base_url=ollama_url
        ) if use_llm else None

    def detect(self, text: str, language: str = "en") -> DetectionResult:
        """
        Detect PII in text

        Args:
            text: Input text to analyze
            language: Language code (default: "ja")

        Returns:
            DetectionResult with detections and masked text
        """
        import time
        start_time = time.time()

        detections: list[Detection] = []

        # Stage 1: Presidio pattern detection
        presidio_results = self.analyzer.analyze(
            text=text,
            language=language,
            entities=None  # Detect all entities
        )

        for result in presidio_results:
            detections.append(Detection(
                entity_type=result.entity_type,
                text=text[result.start:result.end],
                start=result.start,
                end=result.end,
                score=result.score,
                method="regex"
            ))

        # Stage 2: Dictionary-based detection
        dict_results = self.dictionary_detector.detect(text)
        for result in dict_results:
            detections.append(Detection(
                entity_type=result.entity_type,
                text=result.text,
                start=result.start,
                end=result.end,
                score=result.score,
                method="dictionary"
            ))

        # Stage 3: LLM detection (if enabled and no detections yet)
        if (
            self.use_llm
            and self.llm_detector
            and len(detections) == 0
            and len(text) >= self.min_text_length_for_llm
        ):
            llm_results = self.llm_detector.detect(text)
            for result in llm_results:
                detections.append(Detection(
                    entity_type=result.entity_type,
                    text=result.text,
                    start=result.start,
                    end=result.end,
                    score=result.score,
                    method="llm"
                ))

        # Generate masked text
        masked_text = self._mask_text(text, detections)

        processing_time = (time.time() - start_time) * 1000

        return DetectionResult(
            original_text=text,
            masked_text=masked_text,
            detections=detections,
            processing_time_ms=processing_time
        )

    def _mask_text(self, text: str, detections: list[Detection]) -> str:
        """Replace detected entities with labels"""
        if not detections:
            return text

        # Remove overlapping detections, keeping higher score ones
        filtered = self._remove_overlapping(detections)

        # Sort by position (descending) to replace from end to start
        sorted_detections = sorted(filtered, key=lambda d: d.start, reverse=True)

        result = text
        for detection in sorted_detections:
            label = ENTITY_LABELS.get(detection.entity_type, "機密情報")
            result = result[:detection.start] + f"[{label}]" + result[detection.end:]

        return result

    def _remove_overlapping(self, detections: list[Detection]) -> list[Detection]:
        """Remove overlapping detections with priority: dictionary > specific patterns > generic NLP"""
        if not detections:
            return []

        def get_priority(d: Detection) -> tuple:
            # Priority: dictionary (highest) > regex patterns > generic NLP
            # Lower number = higher priority
            if d.method == "dictionary":
                method_priority = 0
            elif d.entity_type.startswith("JP_") or d.entity_type in ("EMAIL_ADDRESS", "CREDIT_CARD", "API_KEY"):
                method_priority = 1
            elif d.entity_type in ("PERSON", "ORGANIZATION"):
                method_priority = 3  # Generic NLP - lowest priority
            else:
                method_priority = 2

            # For same priority: prefer longer span first (handles containment), then higher score
            return (method_priority, -(d.end - d.start), -d.score)

        sorted_dets = sorted(detections, key=get_priority)

        result = []
        for det in sorted_dets:
            # Check if this detection overlaps with any already accepted
            should_add = True
            for accepted in result:
                # Check for overlap
                if not (det.end <= accepted.start or det.start >= accepted.end):
                    # There's overlap - skip this detection
                    should_add = False
                    break
            if should_add:
                result.append(det)

        return result

    def get_entity_label(self, entity_type: str) -> str:
        """Get Japanese label for entity type"""
        return ENTITY_LABELS.get(entity_type, "機密情報")

    def is_llm_available(self) -> bool:
        """Check if LLM is available"""
        if self.llm_detector:
            return self.llm_detector.is_available()
        return False
