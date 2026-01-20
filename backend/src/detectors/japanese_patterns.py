"""
Japanese-specific PII pattern recognizers for Presidio
"""
import re
from presidio_analyzer import Pattern, PatternRecognizer
from presidio_analyzer import RecognizerResult


class JapanesePhoneRecognizer(PatternRecognizer):
    """Recognizer for Japanese phone numbers"""

    PATTERNS = [
        Pattern(
            "JP_PHONE_LANDLINE",
            r"0\d{1,4}-?\d{1,4}-?\d{4}",
            0.7
        ),
        Pattern(
            "JP_PHONE_MOBILE",
            r"0[789]0-?\d{4}-?\d{4}",
            0.85
        ),
        Pattern(
            "JP_PHONE_TOLL_FREE",
            r"0120-?\d{3}-?\d{3}",
            0.9
        ),
    ]

    def __init__(self):
        super().__init__(
            supported_entity="JP_PHONE_NUMBER",
            patterns=self.PATTERNS,
            name="JapanesePhoneRecognizer",
            supported_language="en"
        )


class JapanesePostalCodeRecognizer(PatternRecognizer):
    """Recognizer for Japanese postal codes"""

    PATTERNS = [
        Pattern(
            "JP_POSTAL_CODE",
            r"〒?\d{3}-?\d{4}",
            0.9
        ),
    ]

    def __init__(self):
        super().__init__(
            supported_entity="JP_POSTAL_CODE",
            patterns=self.PATTERNS,
            name="JapanesePostalCodeRecognizer",
            supported_language="en"
        )


class JapaneseAddressRecognizer(PatternRecognizer):
    """Recognizer for Japanese addresses"""

    PATTERNS = [
        Pattern(
            "JP_ADDRESS",
            r"(東京都|北海道|(?:京都|大阪)府|.{2,3}県).{1,4}[市区町村].+?(\d+[-−]\d+|\d+番地?)",
            0.6
        ),
    ]

    def __init__(self):
        super().__init__(
            supported_entity="JP_ADDRESS",
            patterns=self.PATTERNS,
            name="JapaneseAddressRecognizer",
            supported_language="en"
        )


class JapaneseMyNumberRecognizer(PatternRecognizer):
    """Recognizer for Japanese My Number (Individual Number)"""

    PATTERNS = [
        Pattern(
            "JP_MY_NUMBER",
            r"\d{4}[\s-]?\d{4}[\s-]?\d{4}",
            0.7
        ),
    ]

    def __init__(self):
        super().__init__(
            supported_entity="JP_MY_NUMBER",
            patterns=self.PATTERNS,
            name="JapaneseMyNumberRecognizer",
            supported_language="en"
        )


class JapaneseCurrencyRecognizer(PatternRecognizer):
    """Recognizer for Japanese currency amounts"""

    PATTERNS = [
        Pattern(
            "JP_CURRENCY",
            r"[¥￥]\s?[\d,]+",
            0.8
        ),
        Pattern(
            "JP_CURRENCY_KANJI",
            r"\d[\d,]*\s?[万億兆]?円",
            0.7
        ),
    ]

    def __init__(self):
        super().__init__(
            supported_entity="JP_CURRENCY",
            patterns=self.PATTERNS,
            name="JapaneseCurrencyRecognizer",
            supported_language="en"
        )


class JapaneseCompanyRecognizer(PatternRecognizer):
    """Recognizer for Japanese company names"""

    PATTERNS = [
        Pattern(
            "JP_COMPANY_KABUSHIKI_PRE",
            r"株式会社[ァ-ヶー\u4e00-\u9fafA-Za-z0-9]{1,20}",
            0.75
        ),
        Pattern(
            "JP_COMPANY_KABUSHIKI_POST",
            r"[ァ-ヶー\u4e00-\u9fafA-Za-z0-9]{1,20}株式会社",
            0.75
        ),
        Pattern(
            "JP_COMPANY_YUGEN_PRE",
            r"有限会社[ァ-ヶー\u4e00-\u9fafA-Za-z0-9]{1,20}",
            0.75
        ),
        Pattern(
            "JP_COMPANY_YUGEN_POST",
            r"[ァ-ヶー\u4e00-\u9fafA-Za-z0-9]{1,20}有限会社",
            0.75
        ),
        Pattern(
            "JP_COMPANY_GODO",
            r"合同会社[ァ-ヶー\u4e00-\u9fafA-Za-z0-9]{1,20}",
            0.75
        ),
        Pattern(
            "JP_COMPANY_INC",
            r"[A-Za-z0-9]{2,20}\s?Inc\.?",
            0.6
        ),
        Pattern(
            "JP_COMPANY_CORP",
            r"[A-Za-z0-9]{2,20}\s?Corp\.?",
            0.6
        ),
        Pattern(
            "JP_COMPANY_LLC",
            r"[A-Za-z0-9]{2,20}\s?LLC",
            0.6
        ),
    ]

    def __init__(self):
        super().__init__(
            supported_entity="JP_COMPANY",
            patterns=self.PATTERNS,
            name="JapaneseCompanyRecognizer",
            supported_language="en"
        )


class APIKeyRecognizer(PatternRecognizer):
    """Recognizer for common API keys"""

    PATTERNS = [
        Pattern(
            "OPENAI_API_KEY",
            r"sk-[a-zA-Z0-9]{20,}",
            0.95
        ),
        Pattern(
            "AWS_ACCESS_KEY",
            r"AKIA[0-9A-Z]{16}",
            0.95
        ),
        Pattern(
            "GENERIC_API_KEY",
            r"(?:api[_-]?key|apikey|access[_-]?token)['\"]?\s*[:=]\s*['\"]?([a-zA-Z0-9_\-]{20,})",
            0.7
        ),
    ]

    def __init__(self):
        super().__init__(
            supported_entity="API_KEY",
            patterns=self.PATTERNS,
            name="APIKeyRecognizer",
            supported_language="en"
        )


class JapaneseHonorificNameRecognizer(PatternRecognizer):
    """
    Recognizer for Japanese names with honorific suffixes
    e.g., 田中様, 山田さん, 佐藤氏
    """

    # Generic terms to exclude (not personal names)
    DENY_LIST = {
        "お客様", "皆様", "各位", "担当者様", "御担当者様", "ご担当者様",
        "関係者様", "責任者様", "代表者様", "管理者様", "窓口様",
        "御中", "貴社様", "弊社", "当社", "御社",
        "皆さん", "皆さま", "みなさま", "あなた様",
        "お客さん", "お客さま", "先生", "先輩", "後輩",
        "部長", "課長", "係長", "社長", "会長", "専務", "常務", "取締役",
    }

    PATTERNS = [
        Pattern(
            "JP_NAME_SAMA",
            r"[ぁ-んァ-ヶー\u4e00-\u9faf]{1,6}様",
            0.6
        ),
        Pattern(
            "JP_NAME_SAN",
            r"[ぁ-んァ-ヶー\u4e00-\u9faf]{1,6}さん",
            0.6
        ),
        Pattern(
            "JP_NAME_SHI",
            r"[ぁ-んァ-ヶー\u4e00-\u9faf]{1,6}氏",
            0.6
        ),
        Pattern(
            "JP_NAME_DONO",
            r"[ぁ-んァ-ヶー\u4e00-\u9faf]{1,6}殿",
            0.6
        ),
    ]

    def __init__(self):
        super().__init__(
            supported_entity="JP_PERSON_NAME",
            patterns=self.PATTERNS,
            name="JapaneseHonorificNameRecognizer",
            supported_language="en"
        )

    def analyze(self, text: str, entities, nlp_artifacts=None):
        """Override to filter out deny list terms"""
        results = super().analyze(text, entities, nlp_artifacts)

        # Filter out matches that are in the deny list
        filtered_results = []
        for result in results:
            matched_text = text[result.start:result.end]
            if matched_text not in self.DENY_LIST:
                filtered_results.append(result)

        return filtered_results


def get_japanese_recognizers():
    """Returns a list of all Japanese pattern recognizers"""
    return [
        JapanesePhoneRecognizer(),
        JapanesePostalCodeRecognizer(),
        JapaneseAddressRecognizer(),
        JapaneseMyNumberRecognizer(),
        JapaneseCurrencyRecognizer(),
        JapaneseCompanyRecognizer(),
        JapaneseHonorificNameRecognizer(),
        APIKeyRecognizer(),
    ]
