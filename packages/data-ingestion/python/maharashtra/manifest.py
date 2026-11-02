"""Official Maharashtra NEET-PG 2025 document manifest (CET Cell S3)."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

DocKind = Literal[
    "merit_list",
    "seat_matrix",
    "allotment",
    "registered_list",
    "virtual_vacancy",
    "clear_vacancy",
    "notice",
]

RoundTag = Literal["R1", "R2", "R3", "STRAY", "CAP3", "NA"]
VersionTag = Literal["original", "updated", "revised", "provisional"]


@dataclass(frozen=True)
class MahDocumentSpec:
    key: str
    url: str
    kind: DocKind
    round: RoundTag
    version: VersionTag
    filename: str
    subdir: str
    publication_date: str | None = None
    notes: str | None = None


def repo_root() -> str:
    from pathlib import Path

    return str(Path(__file__).resolve().parents[4])


def data_root(year: int = 2025) -> str:
    from pathlib import Path

    return str(Path(repo_root()) / "data" / "maharashtra" / str(year))


MAHarashtra_2025_DOCUMENTS: list[MahDocumentSpec] = [
    MahDocumentSpec(
        key="merit_r1",
        url="https://statecetcell.s3.ap-south-1.amazonaws.com/PGM-25/02-pgm-merit-r1.pdf",
        kind="merit_list",
        round="R1",
        version="provisional",
        filename="02-pgm-merit-r1.pdf",
        subdir="merit_lists",
        publication_date="2025-11-24",
    ),
    MahDocumentSpec(
        key="merit_cap3",
        url="https://statecetcell.s3.ap-south-1.amazonaws.com/PGM-25/pgm-merit-cap3.pdf",
        kind="merit_list",
        round="R3",
        version="provisional",
        filename="pgm-merit-cap3.pdf",
        subdir="merit_lists",
    ),
    MahDocumentSpec(
        key="registered_cap3",
        url="https://statecetcell.s3.ap-south-1.amazonaws.com/PGM-25/pgm-reg-cap3.pdf",
        kind="registered_list",
        round="CAP3",
        version="provisional",
        filename="pgm-reg-cap3.pdf",
        subdir="merit_lists",
        publication_date="2026-02-05",
    ),
    MahDocumentSpec(
        key="seat_matrix_r1_govt",
        url="https://statecetcell.s3.ap-south-1.amazonaws.com/PGM-25/05-Final+PGM25-Categorywise+Govt+_+Degree.pdf",
        kind="seat_matrix",
        round="R1",
        version="original",
        filename="05-Final-PGM25-Govt-Degree.pdf",
        subdir="seat_matrices/round_1",
    ),
    MahDocumentSpec(
        key="seat_matrix_r1_pvt",
        url="https://statecetcell.s3.ap-south-1.amazonaws.com/PGM-25/07-Final+PGM25-Categorywise+Pvt+with+Per--WEBFILE..pdf",
        kind="seat_matrix",
        round="R1",
        version="original",
        filename="07-Final-PGM25-Pvt.pdf",
        subdir="seat_matrices/round_1",
    ),
    MahDocumentSpec(
        key="seat_matrix_r2_original",
        url="https://statecetcell.s3.ap-south-1.amazonaws.com/PGM-25/PGM_R2_Seat.pdf",
        kind="seat_matrix",
        round="R2",
        version="original",
        filename="PGM_R2_Seat.pdf",
        subdir="seat_matrices/round_2/original",
        publication_date="2025-12-22",
    ),
    MahDocumentSpec(
        key="seat_matrix_r2_updated",
        url="https://statecetcell.s3.ap-south-1.amazonaws.com/PGM-25/PGM_R2_Seat23Dec.pdf.pdf",
        kind="seat_matrix",
        round="R2",
        version="updated",
        filename="PGM_R2_Seat23Dec.pdf",
        subdir="seat_matrices/round_2/updated",
        publication_date="2025-12-23",
        notes="Primary final R2 matrix per CET; do not overwrite original.",
    ),
    MahDocumentSpec(
        key="seat_matrix_r3",
        url="https://statecetcell.s3.ap-south-1.amazonaws.com/PGM-25/PGM_R3_Seat.pdf",
        kind="seat_matrix",
        round="R3",
        version="provisional",
        filename="PGM_R3_Seat.pdf",
        subdir="seat_matrices/round_3",
        publication_date="2026-02-09",
    ),
    MahDocumentSpec(
        key="allotment_r1",
        url="https://statecetcell.s3.ap-south-1.amazonaws.com/PGM-25/SelList_R1.pdf",
        kind="allotment",
        round="R1",
        version="original",
        filename="SelList_R1.pdf",
        subdir="allotments/round_1",
    ),
    MahDocumentSpec(
        key="allotment_r2",
        url="https://statecetcell.s3.ap-south-1.amazonaws.com/PGM-25/SelList_R2.pdf",
        kind="allotment",
        round="R2",
        version="original",
        filename="SelList_R2.pdf",
        subdir="allotments/round_2",
    ),
    MahDocumentSpec(
        key="allotment_r3",
        url="https://statecetcell.s3.ap-south-1.amazonaws.com/PGM-25/Revised_SelList_R3.pdf",
        kind="allotment",
        round="R3",
        version="revised",
        filename="Revised_SelList_R3.pdf",
        subdir="allotments/round_3",
    ),
]
