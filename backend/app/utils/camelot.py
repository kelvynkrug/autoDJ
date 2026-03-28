KEY_TO_CAMELOT: dict[tuple[str, str], str] = {
    ("C", "major"): "8B",
    ("A", "minor"): "8A",
    ("G", "major"): "9B",
    ("E", "minor"): "9A",
    ("D", "major"): "10B",
    ("B", "minor"): "10A",
    ("A", "major"): "11B",
    ("F#", "minor"): "11A",
    ("E", "major"): "12B",
    ("C#", "minor"): "12A",
    ("B", "major"): "1B",
    ("G#", "minor"): "1A",
    ("F#", "major"): "2B",
    ("Eb", "minor"): "2A",
    ("Db", "major"): "3B",
    ("Bb", "minor"): "3A",
    ("Ab", "major"): "4B",
    ("F", "minor"): "4A",
    ("Eb", "major"): "5B",
    ("C", "minor"): "5A",
    ("Bb", "major"): "6B",
    ("G", "minor"): "6A",
    ("F", "major"): "7B",
    ("D", "minor"): "7A",
}

CAMELOT_TO_KEY: dict[str, tuple[str, str]] = {v: k for k, v in KEY_TO_CAMELOT.items()}

# Aliases (enharmonicos)
_ENHARMONIC_MAP: dict[str, str] = {
    "Gb": "F#",
    "D#": "Eb",
    "A#": "Bb",
    "G#": "Ab",  # como nota raiz para major
}


def key_to_camelot(key: str, mode: str) -> str | None:
    """Converte key musical (ex: 'C', 'F#') + mode ('major'/'minor') para Camelot."""
    normalized_key = _ENHARMONIC_MAP.get(key, key)
    return KEY_TO_CAMELOT.get((normalized_key, mode.lower()))


def _parse_camelot(code: str) -> tuple[int, str] | None:
    """Extrai numero e letra de um codigo Camelot (ex: '8B' -> (8, 'B'))."""
    if not code or len(code) < 2:
        return None
    letter = code[-1].upper()
    if letter not in ("A", "B"):
        return None
    try:
        number = int(code[:-1])
    except ValueError:
        return None
    if not 1 <= number <= 12:
        return None
    return number, letter


def is_compatible(key1: str, key2: str) -> bool:
    """
    Verifica compatibilidade Camelot entre duas keys.

    Compativel se:
    - Mesmo codigo (ex: 8A == 8A)
    - Mesmo numero, letra diferente (relativa: 8A <-> 8B)
    - Numero adjacente (+/-1), mesma letra (ex: 8A <-> 7A, 8A <-> 9A)
    Numeros sao ciclicos: 1 e 12 sao adjacentes.
    """
    p1 = _parse_camelot(key1)
    p2 = _parse_camelot(key2)
    if p1 is None or p2 is None:
        return False

    num1, letter1 = p1
    num2, letter2 = p2

    if num1 == num2:
        return True

    if letter1 == letter2:
        diff = abs(num1 - num2)
        return diff == 1 or diff == 11  # ciclico: 1 <-> 12

    return False


def camelot_distance(key1: str, key2: str) -> int:
    """
    Distancia entre dois codigos Camelot.
    0 = identico, 1 = adjacente/relativa, 2+ = incompativel.
    """
    p1 = _parse_camelot(key1)
    p2 = _parse_camelot(key2)
    if p1 is None or p2 is None:
        return 99

    num1, letter1 = p1
    num2, letter2 = p2

    if num1 == num2 and letter1 == letter2:
        return 0

    if num1 == num2:
        return 1

    num_diff = min(abs(num1 - num2), 12 - abs(num1 - num2))

    if letter1 == letter2:
        return num_diff

    return num_diff + 1
