"""
Sanitisation des entrées utilisateur — protection XSS.
Supprime les balises HTML et les caractères de contrôle dangereux.
"""
import re
import html

# Caractères de contrôle (hors tab/newline légitimes)
_CONTROL_CHARS = re.compile(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]')

# Balises HTML basiques
_HTML_TAGS = re.compile(r'<[^>]+>')

# Séquences d'entités HTML
_HTML_ENTITIES = re.compile(r'&[a-zA-Z0-9#]+;')


def sanitize_text(value: str, max_length: int | None = None) -> str:
    """
    Nettoie une chaîne de caractères :
    1. Strip des espaces en début/fin
    2. Suppression des caractères de contrôle
    3. Suppression des balises HTML
    4. Décodage puis ré-encodage des entités HTML (évite &lt;script&gt;)
    5. Troncature si max_length fourni

    Retourne la chaîne nettoyée.
    """
    if not isinstance(value, str):
        return str(value)

    value = value.strip()
    value = _CONTROL_CHARS.sub('', value)
    value = _HTML_TAGS.sub('', value)
    # Décoder les entités HTML puis les ré-encoder pour neutraliser les injections
    value = html.unescape(value)
    value = html.escape(value, quote=False)
    # Ré-unescape les apostrophes et guillemets légitimes (on veut juste bloquer <script>)
    value = value.replace('&amp;', '&')

    if max_length:
        value = value[:max_length]

    return value


def sanitize_pseudo(value: str) -> str:
    """Pseudo : alphanumérique + tirets/underscores/espaces uniquement."""
    value = sanitize_text(value, max_length=50)
    # Garder uniquement les caractères autorisés dans un pseudo
    value = re.sub(r'[^\w\s\-\.]', '', value, flags=re.UNICODE)
    return value.strip()


def sanitize_tournament_name(value: str) -> str:
    """Nom de tournoi : texte libre mais sans HTML ni caractères dangereux."""
    return sanitize_text(value, max_length=100)
