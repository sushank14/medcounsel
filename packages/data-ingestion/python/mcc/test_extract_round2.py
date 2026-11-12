"""Unit checks for MCC Round 2 row parsing. PDF extraction is covered by the audit files."""

from extract_round2_vacancies import classify_table_row, parse_branch, parse_category, parse_institute, parse_seats


def test_specialty_codes_with_hyphens():
    parsed = parse_branch("M.D. Community Medicine/Social and Preventive Medicine (P-SM)")
    assert parsed["degree"] == "MD"
    assert parsed["specialty_code"] == "P-SM"
    assert parse_branch("M.D. Emergency Medicine (E-CC)")["specialty_code"] == "E-CC"
    assert parse_branch("M.S. Otorhinolaryngology/ENT (EN-T)")["specialty_code"] == "EN-T"
    assert parse_branch("M.D. Immuno Haematology and Blood Transfusion (T- FM)")["specialty_code"] == "T-FM"
    assert parse_branch("Diploma in Obstetrics and Gynaecology (D.G.O.) (D- GO)")["specialty_code"] == "D-GO"


def test_mch_and_diploma_titles():
    assert parse_branch("M.Ch. (Neuro Surgery) (NUSR)")["degree"] == "MCh"
    diploma = parse_branch("Dermatology, Venereology and Leprosy (D.D.V.L.) (DDVL)")
    assert diploma["degree"] == "Diploma"
    assert diploma["specialty_code"] == "DDVL"
    dnb = parse_branch("(NBEMS-DIPLOMA) PAEDIATRICS (NDCH)")
    assert dnb["degree"] == "DNB Diploma"
    assert dnb["specialty"] == "PAEDIATRICS"


def test_category_and_seats_are_not_guessed():
    assert parse_category("BC PH")["reservation"] == "OBC"
    assert parse_category("BC PH")["pwd"] is True
    assert parse_category("OP NO")["reservation"] == "UR"
    assert "unparsed_category" in parse_category("XYZ")["notes"]
    assert parse_seats("")[0] is None
    assert parse_seats("2")[0] == 2


def test_institute_code_and_total_row():
    code, name, notes = parse_institute("Andhra Medical College, Visakhapatnam (700475)")
    assert code == "700475"
    assert "Andhra Medical College" in name
    assert notes == []
    assert classify_table_row(["", "", "", "", "", "", "15387"]) == "total"
    assert classify_table_row(
        ["Delhi", "Deemed University", "College (700001)", "All India", "M.D. Anatomy (ANAT)", "OP NO", "1"]
    ) == "data"


if __name__ == "__main__":
    test_specialty_codes_with_hyphens()
    test_mch_and_diploma_titles()
    test_category_and_seats_are_not_guessed()
    test_institute_code_and_total_row()
    print("ok")
