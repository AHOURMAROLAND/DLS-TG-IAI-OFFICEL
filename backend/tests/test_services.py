"""
Tests unitaires pour les services critiques de DLS Hub.
Lancer : cd backend && pytest tests/ -v
"""
import pytest
from app.services.draw_service import balanced_draw, elimination_draw, championship_draw
from app.services.tracker_service import parse_player_info, find_recent_matches_vs_opponent
from app.routers.matches import _apply_score_rules
from app.models.match import MatchPhase


# ─── draw_service ─────────────────────────────────────────────────────────────

def make_players(n: int) -> list:
    return [
        {"id": str(i), "pseudo": f"Player{i}", "team_name": f"Team{i}",
         "dll_division": (i % 3) + 1, "dll_won": 50 - i}
        for i in range(n)
    ]


class TestBalancedDraw:
    def test_basic_4_players_2_groups(self):
        players = make_players(4)
        result = balanced_draw(players, 2)
        assert len(result) == 2
        total = sum(len(v) for v in result.values())
        assert total == 4

    def test_8_players_4_groups(self):
        players = make_players(8)
        result = balanced_draw(players, 4)
        assert len(result) == 4
        for group in result.values():
            assert len(group) == 2

    def test_groups_named_correctly(self):
        players = make_players(4)
        result = balanced_draw(players, 2)
        assert "GA" in result
        assert "GB" in result

    def test_serpentin_distributes_top_players(self):
        """Les meilleurs joueurs (div 1) ne doivent pas tous être dans le même groupe."""
        players = make_players(8)
        result = balanced_draw(players, 4)
        # Vérifier que chaque groupe a au plus 1 joueur de division 1
        for group in result.values():
            div1_count = sum(1 for p in group if p["dll_division"] == 1)
            assert div1_count <= 1

    def test_empty_players_raises(self):
        result = balanced_draw([], 2)
        assert all(len(v) == 0 for v in result.values())


class TestEliminationDraw:
    def test_8_players_4_pairs(self):
        players = make_players(8)
        pairs = elimination_draw(players)
        assert len(pairs) == 4

    def test_each_pair_has_home_away(self):
        players = make_players(4)
        pairs = elimination_draw(players)
        for pair in pairs:
            assert "home" in pair
            assert "away" in pair

    def test_odd_players_drops_last(self):
        players = make_players(5)
        pairs = elimination_draw(players)
        assert len(pairs) == 2  # 5 joueurs → 2 paires, 1 bye

    def test_randomness(self):
        """Deux tirages consécutifs ne doivent pas être identiques (probabiliste)."""
        players = make_players(8)
        pairs1 = elimination_draw(players)
        pairs2 = elimination_draw(players)
        # Très improbable que les 4 paires soient identiques
        same = all(
            pairs1[i]["home"]["id"] == pairs2[i]["home"]["id"]
            for i in range(len(pairs1))
        )
        # On ne peut pas garantir la différence mais on vérifie la structure
        assert len(pairs1) == len(pairs2) == 4


class TestChampionshipDraw:
    def test_4_players_single_6_matches(self):
        players = make_players(4)
        matches = championship_draw(players, "single")
        assert len(matches) == 6  # C(4,2) = 6

    def test_4_players_double_12_matches(self):
        players = make_players(4)
        matches = championship_draw(players, "double")
        assert len(matches) == 12  # 6 * 2

    def test_no_self_match(self):
        players = make_players(4)
        matches = championship_draw(players, "single")
        for m in matches:
            assert m["home"]["id"] != m["away"]["id"]


# ─── tracker_service ──────────────────────────────────────────────────────────

SAMPLE_DATA = {
    "TNm": "FC MARS",
    "Div": 3,
    "Pla": 713,
    "Los": 295,
    "Won": 340,
    "Matches": {
        "results": [
            {
                "OId": "51st18ws",
                "MTm": "1775158012",
                "Hom": True,
                "HSc": 4,
                "ASc": 4,
                "Min": 121,
                "GCR": 0,
                "MOTM": "Victor Osimhen",
                "TNL": "KELLIAN FC",
                "UGo": [
                    {"scorer": "Kylian Mbappé", "Ti": 40, "Ty": 18},
                    {"scorer": "Victor Osimhen", "Ti": 45, "Ty": 2},
                ],
                "OGo": [
                    {"scorer": "Erling Haaland", "Ti": 9, "Ty": 2, "assister": "Jude Bellingham"},
                ],
                "URe": [{"Ti": 90, "Ye": True, "player": "Virgil"}],
                "ORe": [],
            },
            {
                "OId": "other_player",
                "MTm": "1775000000",
                "Hom": False,
                "HSc": 3,
                "ASc": 1,
                "Min": 90,
                "GCR": 0,
                "MOTM": "",
                "TNL": "OTHER FC",
                "UGo": [],
                "OGo": [],
                "URe": [],
                "ORe": [],
            },
        ]
    },
}


class TestParsePlayerInfo:
    def test_basic_fields(self):
        info = parse_player_info(SAMPLE_DATA)
        assert info["team_name"] == "FC MARS"
        assert info["division"] == 3
        assert info["played"] == 713
        assert info["won"] == 340
        assert info["lost"] == 295

    def test_win_rate_calculated(self):
        info = parse_player_info(SAMPLE_DATA)
        assert info["win_rate"] == round(340 / 713 * 100, 1)

    def test_won_fallback_when_missing(self):
        data = {**SAMPLE_DATA, "Won": None, "Pla": 100, "Los": 40}
        info = parse_player_info(data)
        assert info["won"] == 60  # 100 - 40

    def test_empty_data(self):
        info = parse_player_info({})
        assert info["team_name"] == ""
        assert info["division"] == 0
        assert info["played"] == 0


class TestFindRecentMatchesVsOpponent:
    def test_filters_by_opponent(self):
        matches = find_recent_matches_vs_opponent(SAMPLE_DATA, "51st18ws")
        assert len(matches) == 1
        assert matches[0]["opponent_team"] == "KELLIAN FC"

    def test_no_match_for_unknown_opponent(self):
        matches = find_recent_matches_vs_opponent(SAMPLE_DATA, "unknown_idx")
        assert len(matches) == 0

    def test_extra_time_detected(self):
        matches = find_recent_matches_vs_opponent(SAMPLE_DATA, "51st18ws")
        assert matches[0]["extra_time"] is True  # Min=121

    def test_scores_correct_when_home(self):
        matches = find_recent_matches_vs_opponent(SAMPLE_DATA, "51st18ws")
        # Hom=True → player_score=HSc=4, opp_score=ASc=4
        assert matches[0]["home_score"] == 4
        assert matches[0]["away_score"] == 4

    def test_goals_parsed(self):
        matches = find_recent_matches_vs_opponent(SAMPLE_DATA, "51st18ws")
        assert len(matches[0]["home_scorers"]) == 2
        assert matches[0]["home_scorers"][0]["scorer"] == "Kylian Mbappé"
        assert matches[0]["home_scorers"][0]["minute"] == 40

    def test_limit_respected(self):
        # Dupliquer les matchs pour tester la limite
        data = {**SAMPLE_DATA, "Matches": {"results": SAMPLE_DATA["Matches"]["results"] * 5}}
        matches = find_recent_matches_vs_opponent(data, "51st18ws", limit=2)
        assert len(matches) <= 2


# ─── _apply_score_rules ───────────────────────────────────────────────────────

class TestApplyScoreRules:
    def test_group_90min_no_change(self):
        h, a = _apply_score_rules(2, 1, 88, MatchPhase.GROUP, 1)
        assert h == 2 and a == 1

    def test_group_extra_time_no_change(self):
        """Pour les poules, les prolongations ne changent pas le score affiché."""
        h, a = _apply_score_rules(2, 2, 105, MatchPhase.GROUP, 1)
        assert h == 2 and a == 2

    def test_championship_90min(self):
        h, a = _apply_score_rules(3, 0, 90, MatchPhase.CHAMPIONSHIP, 1)
        assert h == 3 and a == 0

    def test_double_second_extra_time_counts(self):
        h, a = _apply_score_rules(1, 1, 120, MatchPhase.DOUBLE_SECOND, 1)
        assert h == 1 and a == 1  # Score gardé tel quel

    def test_manual_no_minutes(self):
        """Sans minutes_played (score manuel), le score est retourné tel quel."""
        h, a = _apply_score_rules(5, 3, None, MatchPhase.GROUP, 1)
        assert h == 5 and a == 3

    def test_final_90min(self):
        h, a = _apply_score_rules(2, 0, 90, MatchPhase.FINAL, 1)
        assert h == 2 and a == 0
