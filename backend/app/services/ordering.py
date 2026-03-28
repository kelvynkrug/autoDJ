"""
Algoritmo de ordenacao inteligente de playlist.
Otimiza transicoes considerando BPM, key (Camelot), energy e danceability.
"""

import logging

from app.models.schemas import OrderedTrack, TrackForOrdering
from app.utils.camelot import camelot_distance

logger = logging.getLogger(__name__)

# Pesos da funcao de custo
W_BPM = 0.35
W_KEY = 0.30
W_ENERGY = 0.20
W_DANCEABILITY = 0.15

# BPM: diferenca maxima considerada (acima disso, custo = 1.0)
MAX_BPM_DIFF = 20.0

# Camelot: distancia maxima no wheel
MAX_CAMELOT_DIST = 6


def _transition_cost(a: TrackForOrdering, b: TrackForOrdering) -> float:
    """
    Custo de transicao entre duas tracks (0 = perfeita, 1 = pessima).
    """
    bpm_cost = min(abs(a.bpm - b.bpm) / MAX_BPM_DIFF, 1.0)

    cam_dist = camelot_distance(a.camelot, b.camelot)
    key_cost = min(cam_dist / MAX_CAMELOT_DIST, 1.0)

    energy_cost = abs(a.energy - b.energy)
    dance_cost = abs(a.danceability - b.danceability)

    return (W_BPM * bpm_cost + W_KEY * key_cost + W_ENERGY * energy_cost
            + W_DANCEABILITY * dance_cost)


def _greedy_nearest_neighbor(
    tracks: list[TrackForOrdering],
    start_idx: int = 0,
) -> list[int]:
    """Constroi ordem inicial com nearest-neighbor guloso."""
    n = len(tracks)
    visited = [False] * n
    order = [start_idx]
    visited[start_idx] = True

    for _ in range(n - 1):
        current = order[-1]
        best_next = -1
        best_cost = float("inf")

        for j in range(n):
            if visited[j]:
                continue
            cost = _transition_cost(tracks[current], tracks[j])
            if cost < best_cost:
                best_cost = cost
                best_next = j

        if best_next == -1:
            break

        order.append(best_next)
        visited[best_next] = True

    return order


def _two_opt_improve(
    tracks: list[TrackForOrdering],
    order: list[int],
    max_iterations: int = 100,
) -> list[int]:
    """Refinamento 2-opt: troca segmentos para reduzir custo total."""
    n = len(order)
    if n < 4:
        return order

    improved = True
    iteration = 0

    while improved and iteration < max_iterations:
        improved = False
        iteration += 1

        for i in range(1, n - 2):
            for j in range(i + 1, n):
                old_cost = _segment_cost(tracks, order, i, j)
                new_order = order[:i] + order[i : j + 1][::-1] + order[j + 1 :]
                new_cost = _segment_cost(tracks, new_order, i, j)

                if new_cost < old_cost - 1e-6:
                    order = new_order
                    improved = True

    return order


def _segment_cost(
    tracks: list[TrackForOrdering], order: list[int], i: int, j: int
) -> float:
    """Custo das bordas afetadas por um 2-opt swap entre posicoes i e j."""
    cost = 0.0

    if i > 0:
        cost += _transition_cost(tracks[order[i - 1]], tracks[order[i]])
    if j < len(order) - 1:
        cost += _transition_cost(tracks[order[j]], tracks[order[j + 1]])

    for k in range(i, j):
        cost += _transition_cost(tracks[order[k]], tracks[order[k + 1]])

    return cost


def optimize_order(
    tracks: list[TrackForOrdering],
    start_track_id: str | None = None,
) -> list[OrderedTrack]:
    """Ordena tracks para transicoes suaves."""
    if len(tracks) <= 1:
        return [
            OrderedTrack(
                track_id=t.track_id,
                position=i,
                title=t.title,
                transition_score=1.0,
            )
            for i, t in enumerate(tracks)
        ]

    start_idx = 0
    if start_track_id:
        for i, t in enumerate(tracks):
            if t.track_id == start_track_id:
                start_idx = i
                break

    # Fase 1: Greedy
    order = _greedy_nearest_neighbor(tracks, start_idx)

    # Fase 2: 2-opt refinement
    order = _two_opt_improve(tracks, order)

    # Montar resultado
    result: list[OrderedTrack] = []
    for pos, idx in enumerate(order):
        track = tracks[idx]
        if pos == 0:
            score = 1.0
        else:
            prev_track = tracks[order[pos - 1]]
            cost = _transition_cost(prev_track, track)
            score = 1.0 - cost

        result.append(
            OrderedTrack(
                track_id=track.track_id,
                position=pos,
                title=track.title,
                transition_score=round(score, 3),
            )
        )

    return result
