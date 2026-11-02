from pathlib import Path

import pytest

from compare_matrices import compare_matrix_versions
from extract_merit import parse_merit_page_text
from extract_registered import parse_registered_text
from extract_seat_matrix import parse_seat_matrix_text

REPO = Path(__file__).resolve().parents[4]
IMPORTS = REPO / "data" / "imports" / "maharashtra"


def test_registered_block_parsing():
    sample = """
258005797
25661021819
67131
382
SC
1
"""
    rows = parse_registered_text(sample, 1)
    assert len(rows) == 1
    assert rows[0].air == 67131
    assert rows[0].sml_rank == 1


def test_merit_block_parsing():
    sample = """
195
25661012304
PUKALE SNEHA BHASKAR
258002479
NT(C)-4
2045
611
"""
    rows = parse_merit_page_text(sample, 2)
    assert len(rows) == 1
    assert rows[0].sml_rank == 195
    assert rows[0].neet_score == 611


def test_matrix_compare_detects_change():
    left = [{"college_code": "1", "branch_code": "0111S", "category": "OPEN", "seat_type": "G", "quota": "STATE", "seat_count": 2}]
    right = [{"college_code": "1", "branch_code": "0111S", "category": "OPEN", "seat_type": "G", "quota": "STATE", "seat_count": 3}]
    out = compare_matrix_versions(left, right, "a", "b")
    assert out["changes_count"] == 1
    assert out["changes"][0]["change_type"] == "seat_added"


@pytest.mark.skipif(not (IMPORTS / "2025-reg-cap3.pdf").exists(), reason="PDF not cached")
def test_registered_pdf_smoke():
    from extract_registered import extract_registered_pdf

    rows = extract_registered_pdf(str(IMPORTS / "2025-reg-cap3.pdf"))
    assert len(rows) > 6000


@pytest.mark.skipif(not (IMPORTS / "2025-r3-seat-matrix.pdf").exists(), reason="PDF not cached")
def test_seat_matrix_pdf_smoke():
    from extract_seat_matrix import extract_seat_matrix_pdf

    rows = extract_seat_matrix_pdf(str(IMPORTS / "2025-r3-seat-matrix.pdf"))
    assert len(rows) > 500
