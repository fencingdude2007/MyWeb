from app.services.gdocs import google_site_name, is_google_workspace
from app.services.pdf import is_pdf_url


def test_is_pdf_url() -> None:
    assert is_pdf_url("https://arxiv.org/pdf/1706.03762.pdf")
    assert is_pdf_url("https://site.com/paper.PDF?download=1")
    assert not is_pdf_url("https://example.com/article")


def test_google_workspace_detection() -> None:
    doc = "https://docs.google.com/document/d/1AbC_dEf/edit"
    sheet = "https://docs.google.com/spreadsheets/d/1AbC_dEf/edit#gid=0"
    slides = "https://docs.google.com/presentation/d/1AbC_dEf/edit"
    assert is_google_workspace(doc) and google_site_name(doc) == "Google Docs"
    assert is_google_workspace(sheet) and google_site_name(sheet) == "Google Sheets"
    assert is_google_workspace(slides) and google_site_name(slides) == "Google Slides"
    assert not is_google_workspace("https://example.com/doc")
