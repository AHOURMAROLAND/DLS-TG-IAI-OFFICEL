"""
Service de configuration et validation des formats de tournoi.
Centralise toutes les règles métier sur les nombres d'équipes et formats.
"""
from dataclasses import dataclass
from typing import Optional


# ─── Constantes ───────────────────────────────────────────────────────────────

# Élimination directe : puissances de 2 uniquement (bracket propre)
ELIMINATION_VALID_SIZES = [4, 8, 16, 32]

# Championnat : round-robin, max 20 équipes (sinon trop de matchs)
CHAMPIONSHIP_MIN = 4
CHAMPIONSHIP_MAX = 20

# Poules : nombre pair, min 8, max 48
GROUPS_MIN = 8
GROUPS_MAX = 48


# ─── Dataclasses ──────────────────────────────────────────────────────────────

@dataclass
class GroupConfig:
    """Configuration d'une phase de poules."""
    group_count: int          # Nombre de poules
    teams_per_group: int      # Équipes par poule
    qualified_per_group: int  # Qualifiés par poule
    total_qualified: int      # Total qualifiés pour la phase élim
    next_power_of_2: int      # Puissance de 2 cible pour la phase élim
    best_thirds: int          # Nombre de meilleurs 3èmes à repêcher (0 si pas nécessaire)
    label: str                # Description lisible

    @property
    def is_clean(self) -> bool:
        """True si le total qualifiés est exactement une puissance de 2."""
        return self.best_thirds == 0


@dataclass
class TournamentValidation:
    """Résultat de validation d'une configuration de tournoi."""
    valid: bool
    error: Optional[str] = None
    suggestion: Optional[str] = None


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _is_power_of_2(n: int) -> bool:
    return n > 0 and (n & (n - 1)) == 0


def _next_power_of_2(n: int) -> int:
    """Retourne la plus petite puissance de 2 >= n."""
    if n <= 0:
        return 1
    p = 1
    while p < n:
        p <<= 1
    return p


def _prev_power_of_2(n: int) -> int:
    """Retourne la plus grande puissance de 2 <= n."""
    if n <= 0:
        return 1
    p = 1
    while p * 2 <= n:
        p <<= 1
    return p


# ─── Validation ───────────────────────────────────────────────────────────────

def validate_tournament_size(
    tournament_type: str,
    max_teams: int,
    elimination_type: str = "single",
) -> TournamentValidation:
    """Valide le nombre d'équipes selon le format."""

    if max_teams < 4:
        return TournamentValidation(False, "Minimum 4 équipes requises")

    if tournament_type == "elimination":
        if max_teams not in ELIMINATION_VALID_SIZES:
            valid_str = ", ".join(str(n) for n in ELIMINATION_VALID_SIZES)
            # Trouver la valeur valide la plus proche
            closest = min(ELIMINATION_VALID_SIZES, key=lambda x: abs(x - max_teams))
            return TournamentValidation(
                False,
                f"L'élimination directe nécessite une puissance de 2. Valeurs valides : {valid_str}",
                f"Utiliser {closest} équipes",
            )
        return TournamentValidation(True)

    elif tournament_type == "championship":
        if max_teams > CHAMPIONSHIP_MAX:
            return TournamentValidation(
                False,
                f"Le championnat supporte maximum {CHAMPIONSHIP_MAX} équipes "
                f"(sinon trop de matchs : {max_teams * (max_teams - 1) // 2} matchs)",
                f"Réduire à {CHAMPIONSHIP_MAX} équipes ou utiliser le format Poules",
            )
        if max_teams % 2 != 0:
            return TournamentValidation(
                False,
                "Le nombre d'équipes doit être pair pour le championnat",
                f"Utiliser {max_teams - 1} ou {max_teams + 1} équipes",
            )
        return TournamentValidation(True)

    elif tournament_type == "groups":
        if max_teams < GROUPS_MIN:
            return TournamentValidation(
                False,
                f"Le format Poules nécessite minimum {GROUPS_MIN} équipes",
            )
        if max_teams > GROUPS_MAX:
            return TournamentValidation(
                False,
                f"Maximum {GROUPS_MAX} équipes pour le format Poules",
            )
        if max_teams % 2 != 0:
            return TournamentValidation(
                False,
                "Le nombre d'équipes doit être pair",
                f"Utiliser {max_teams - 1} ou {max_teams + 1} équipes",
            )
        return TournamentValidation(True)

    return TournamentValidation(False, f"Format inconnu : {tournament_type}")


# ─── Suggestions de configuration de poules ───────────────────────────────────

def suggest_group_configs(max_teams: int) -> list[GroupConfig]:
    """
    Génère toutes les configurations de poules valides pour un nombre d'équipes donné.
    Triées par pertinence (configs "propres" en premier, puis par nombre de poules).
    """
    if max_teams < GROUPS_MIN or max_teams % 2 != 0:
        return []

    configs = []

    # Tester toutes les combinaisons (nb_poules, taille_poule)
    for group_count in range(2, max_teams // 2 + 1):
        if max_teams % group_count != 0:
            continue  # Pas de répartition équitable

        teams_per_group = max_teams // group_count

        if teams_per_group < 3 or teams_per_group > 8:
            continue  # Taille de poule invalide

        # Pour chaque nombre de qualifiés par poule possible
        for qualified_per_group in range(1, teams_per_group):
            total_qualified = group_count * qualified_per_group

            if total_qualified < 4:
                continue  # Pas assez pour une phase élim

            next_p2 = _next_power_of_2(total_qualified)
            best_thirds = next_p2 - total_qualified  # Meilleurs 3èmes à repêcher

            # Limiter le repêchage à max 1/3 des qualifiés (sinon ça perd son sens)
            if best_thirds > total_qualified // 2:
                continue

            # Construire le label
            if best_thirds == 0:
                label = (
                    f"{group_count} poules × {teams_per_group} équipes — "
                    f"{qualified_per_group} qualifié(s)/poule → {total_qualified} en phase élim"
                )
            else:
                label = (
                    f"{group_count} poules × {teams_per_group} équipes — "
                    f"{qualified_per_group} qualifié(s)/poule + {best_thirds} meilleur(s) 3ème(s) "
                    f"→ {next_p2} en phase élim"
                )

            configs.append(GroupConfig(
                group_count=group_count,
                teams_per_group=teams_per_group,
                qualified_per_group=qualified_per_group,
                total_qualified=total_qualified,
                next_power_of_2=next_p2,
                best_thirds=best_thirds,
                label=label,
            ))

    # Trier : configs propres (best_thirds=0) en premier, puis par nb_poules croissant
    configs.sort(key=lambda c: (c.best_thirds, c.group_count))

    # Dédupliquer les configs identiques (même group_count + qualified_per_group)
    seen = set()
    unique = []
    for c in configs:
        key = (c.group_count, c.qualified_per_group)
        if key not in seen:
            seen.add(key)
            unique.append(c)

    return unique


def get_best_group_config(max_teams: int) -> Optional[GroupConfig]:
    """Retourne la meilleure configuration de poules pour un nombre d'équipes."""
    configs = suggest_group_configs(max_teams)
    return configs[0] if configs else None


def get_elimination_phase_from_teams(n_teams: int) -> str:
    """Retourne la phase d'élimination selon le nombre d'équipes qualifiées."""
    if n_teams >= 16:
        return "r16"
    elif n_teams >= 8:
        return "quarterfinal"
    elif n_teams >= 4:
        return "semifinal"
    else:
        return "final"


def championship_match_count(n_teams: int, legs: str = "single") -> int:
    """Calcule le nombre total de matchs d'un championnat."""
    base = n_teams * (n_teams - 1) // 2
    return base * 2 if legs == "double" else base


# ─── Nombres valides pour le frontend ─────────────────────────────────────────

def get_valid_team_counts(tournament_type: str) -> list[int]:
    """Retourne la liste des nombres d'équipes valides pour un format donné."""
    if tournament_type == "elimination":
        return ELIMINATION_VALID_SIZES

    elif tournament_type == "championship":
        return list(range(CHAMPIONSHIP_MIN, CHAMPIONSHIP_MAX + 1, 2))  # pairs de 4 à 20

    elif tournament_type == "groups":
        return list(range(GROUPS_MIN, GROUPS_MAX + 1, 2))  # pairs de 8 à 48

    return []
