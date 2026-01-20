"""
LLM-based PII detection using Ollama
"""
import json
import re
from typing import Optional
from dataclasses import dataclass

try:
    from ollama import Client
    OLLAMA_AVAILABLE = True
except ImportError:
    OLLAMA_AVAILABLE = False


@dataclass
class LLMDetection:
    """Represents a single LLM detection result"""
    entity_type: str
    text: str
    start: int
    end: int
    score: float = 0.8


SYSTEM_PROMPT = """あなたは機密情報検出AIです。
与えられたテキストから機密情報を検出してください。

検出対象:
- 個人名（顧客名、担当者名）
- 企業名（取引先、競合他社）
- プロジェクト名（社外秘のコードネーム）
- その他、外部に出すべきでない情報

注意:
- メールアドレス、電話番号、住所、金額などは別システムで検出するため、ここでは検出不要
- 一般名詞や公開情報は検出しない

必ずJSON形式で回答:
{
  "detected": [
    {"type": "個人名", "value": "検出した文字列"},
    {"type": "会社名", "value": "検出した文字列"}
  ]
}

検出なしの場合:
{"detected": []}
"""


class LLMDetector:
    """LLM-based detector for context-aware PII detection"""

    def __init__(
        self,
        model: str = "gemma2:9b",
        base_url: str = "http://localhost:11434"
    ):
        self.model = model
        self.base_url = base_url
        self._client: Optional[Client] = None

    @property
    def client(self) -> Optional[Client]:
        """Lazy initialization of Ollama client"""
        if not OLLAMA_AVAILABLE:
            return None
        if self._client is None:
            self._client = Client(host=self.base_url)
        return self._client

    def is_available(self) -> bool:
        """Check if Ollama is available"""
        if not OLLAMA_AVAILABLE or self.client is None:
            return False
        try:
            self.client.list()
            return True
        except Exception:
            return False

    def detect(self, text: str) -> list[LLMDetection]:
        """
        Detect PII using LLM

        Args:
            text: Input text to analyze

        Returns:
            List of LLMDetection objects
        """
        if not self.is_available():
            return []

        try:
            response = self.client.chat(
                model=self.model,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": f"以下のテキストを分析:\n\n{text}"}
                ],
                format="json",
                options={
                    "temperature": 0.1,
                    "num_predict": 500,
                }
            )

            content = response["message"]["content"]
            result = json.loads(content)

            detections = []
            for item in result.get("detected", []):
                value = item.get("value", "")
                if not value:
                    continue

                # Find position in original text
                start = text.find(value)
                if start == -1:
                    continue

                detections.append(LLMDetection(
                    entity_type=self._map_type(item.get("type", "機密情報")),
                    text=value,
                    start=start,
                    end=start + len(value),
                    score=0.75
                ))

            return detections

        except Exception as e:
            print(f"LLM detection error: {e}")
            return []

    def _map_type(self, japanese_type: str) -> str:
        """Map Japanese type names to entity types"""
        mapping = {
            "個人名": "PERSON",
            "会社名": "ORGANIZATION",
            "企業名": "ORGANIZATION",
            "プロジェクト名": "PROJECT_NAME",
            "機密情報": "CONFIDENTIAL",
        }
        return mapping.get(japanese_type, "CONFIDENTIAL")
