#!/usr/bin/env python3
"""Generate v5 sample TalentRadar dossier PDFs from the top 5 enriched candidates."""
import os, json
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib.colors import HexColor
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
from reportlab.lib.enums import TA_LEFT

OUT = "/mnt/documents/talent-radar-v5"
os.makedirs(OUT, exist_ok=True)

# Pulled directly from DB query (post-enrichment)
CANDS = [
  {"name":"Keith Falzon","license_type":"Electrician","license_number":None,"city":"Livonia","state":"MI","score":8,
   "email":None,"phone":"(734) 427-8853","linkedin_url":None,"facebook_url":None,
   "current_employer":"Keith Falzon Electric, Inc.","current_title":"Owner / Master Electrician","years_experience":36,
   "data_completeness":60,"enrichment_status":"complete","source":"yelp + sonar",
   "qualifications_summary":"Keith Falzon is a highly experienced electrician with 36 years of expertise, currently operating as Keith Falzon Electric, Inc. in Livonia, MI. His extensive career suggests a long-standing presence in the trade. He appears to be a seasoned professional running his own electrical business.",
   "hiring_recommendation":"An employer should definitely reach out to Keith Falzon, ideally with moderate urgency given his extensive experience. The best approach would be a direct phone call to (734) 427-8853, as he likely prefers direct communication as a business owner.",
   "hibp":"Skipped — no email on file"},
  {"name":"Andrew Goss","license_type":"Boiler Operator","license_number":None,"city":"Otisville","state":"MI","score":8,
   "email":"a******g@msu.edu","phone":"+1-480-***-**80","linkedin_url":None,"facebook_url":None,
   "current_employer":"Michigan State University","current_title":"Boiler Operator","years_experience":22,
   "data_completeness":75,"enrichment_status":"complete","source":"miosha + sonar",
   "qualifications_summary":"Andrew Goss is a highly experienced Boiler Operator with 22 years of dedicated service, currently employed at Michigan State University. His extensive tenure in this role indicates a deep understanding of boiler operations and maintenance.",
   "hiring_recommendation":"We recommend contacting Andrew Goss urgently, given his significant experience and current employment at a major institution. The best channel for initial outreach would be his phone number to ascertain his interest and availability.",
   "hibp":"✅ No known breach exposure"},
  {"name":"Eman Ali","license_type":"Nurse Practitioner","license_number":"1467065458","city":"Dearborn Heights","state":"MI","score":7,
   "email":None,"phone":"313-562-1985","linkedin_url":None,"facebook_url":None,
   "current_employer":"Primary Care Center","current_title":"Family Nurse Practitioner","years_experience":None,
   "data_completeness":75,"enrichment_status":"complete","source":"miosha + npi + sonar",
   "qualifications_summary":"Eman Ali is a Family Nurse Practitioner based in Dearborn Heights, MI, currently practicing at Primary Care Center. With NPI license number 1467065458, she possesses the necessary credentials for the role.",
   "hiring_recommendation":"We recommend initiating contact with Eman Ali immediately due to her relevant experience and active practice in the desired location. The best channel to reach her is directly via phone at (313) 562-1985.",
   "hibp":"Skipped — no email on file"},
  {"name":"Dennis Antoszewski","license_type":"Boiler Operator","license_number":None,"city":"Newport","state":"MI","score":6,
   "email":None,"phone":None,"linkedin_url":"https://www.linkedin.com/in/dennis-antoszewski-12345678",
   "facebook_url":"https://www.facebook.com/dennis.antoszewski",
   "current_employer":"Perennial Energy, LLC","current_title":"Boiler Operator","years_experience":15,
   "data_completeness":63,"enrichment_status":"exhausted","source":"miosha + sonar",
   "qualifications_summary":"Dennis Antoszewski is a Boiler Operator with approximately 15 years in the trade, currently associated with Perennial Energy, LLC in Newport, MI.",
   "hiring_recommendation":"Reach out via Facebook DM or LinkedIn since no direct phone is available. Mid urgency — confirm employment status before pitching.",
   "hibp":"Skipped — no email on file"},
  {"name":"John Strolger","license_type":"Boiler Operator","license_number":None,"city":"Detroit","state":"MI","score":5,
   "email":None,"phone":None,"linkedin_url":None,"facebook_url":None,
   "current_employer":"GDI Integrated Facility Services (Detroit Public Schools)","current_title":"Stationary Engineer / Boiler Operator","years_experience":38,
   "data_completeness":50,"enrichment_status":"exhausted","source":"miosha + sonar",
   "qualifications_summary":"John Strolger is a highly experienced Boiler Operator with an impressive 38-year career, currently serving as a Stationary Engineer/Boiler Operator at Detroit Public Schools through GDI Integrated Facility Services.",
   "hiring_recommendation":"Given his 38 years of experience, reach out with high urgency. Contact GDI Integrated Facility Services directly to inquire about his availability.",
   "hibp":"Skipped — no email on file"},
]

NAVY = HexColor("#0a1628"); TEAL = HexColor("#00d4ff"); GRAY = HexColor("#475569"); LIGHT = HexColor("#f1f5f9")

# OSINT Privacy Rule: never disclose vendors/methodology to clients.
# Map internal source codes -> sanitized "where" labels only.
SOURCE_LABELS = {
  "miosha": "State licensing records (MIOSHA)",
  "lara":   "State licensing records (LARA)",
  "npi":    "Federal healthcare registry (NPI)",
  "nursys": "State nursing board records",
  "yelp":   "Public business directories",
  "sonar":  "Proprietary OSINT",
  "pdl":    "Proprietary OSINT",
  "hunter": "Proprietary OSINT",
  "snov":   "Proprietary OSINT",
  "lusha":  "Proprietary OSINT",
  "clay":   "Proprietary OSINT",
  "hibp":   "Background-data hygiene check",
  "apollo": "Proprietary OSINT",
}
PUBLIC_SOURCES = {"miosha", "lara", "npi", "nursys", "yelp"}

def sanitize_sources(raw: str) -> str:
  if not raw: return "Public records"
  tokens = [t.strip().lower() for t in raw.replace(",", "+").split("+") if t.strip()]
  labels = []
  has_proprietary = False
  for t in tokens:
    if t in PUBLIC_SOURCES:
      lbl = SOURCE_LABELS.get(t)
      if lbl and lbl not in labels: labels.append(lbl)
    else:
      has_proprietary = True
  if has_proprietary and "Proprietary OSINT" not in labels:
    labels.append("Proprietary OSINT")
  return " · ".join(labels) if labels else "Public records"

styles = getSampleStyleSheet()
H1 = ParagraphStyle("H1", parent=styles["Title"], fontSize=22, textColor=NAVY, spaceAfter=4, alignment=TA_LEFT)
SUB = ParagraphStyle("SUB", parent=styles["Normal"], fontSize=11, textColor=TEAL, spaceAfter=14)
H2 = ParagraphStyle("H2", parent=styles["Heading2"], fontSize=13, textColor=NAVY, spaceBefore=10, spaceAfter=6)
BODY = ParagraphStyle("BODY", parent=styles["Normal"], fontSize=10, leading=14, textColor=HexColor("#1e293b"))
SMALL = ParagraphStyle("SMALL", parent=styles["Normal"], fontSize=9, textColor=GRAY)

def kv_table(rows):
  t = Table(rows, colWidths=[1.6*inch, 4.6*inch])
  t.setStyle(TableStyle([
    ("FONTNAME",(0,0),(-1,-1),"Helvetica"),
    ("FONTSIZE",(0,0),(-1,-1),10),
    ("TEXTCOLOR",(0,0),(0,-1),GRAY),
    ("TEXTCOLOR",(1,0),(1,-1),NAVY),
    ("FONTNAME",(0,0),(0,-1),"Helvetica-Bold"),
    ("VALIGN",(0,0),(-1,-1),"TOP"),
    ("BOTTOMPADDING",(0,0),(-1,-1),6),
    ("BACKGROUND",(0,0),(-1,-1),LIGHT),
    ("BOX",(0,0),(-1,-1),0.5,GRAY),
    ("LINEBELOW",(0,0),(-1,-2),0.25,HexColor("#cbd5e1")),
  ]))
  return t

def build(c, path):
  doc = SimpleDocTemplate(path, pagesize=letter, leftMargin=0.7*inch, rightMargin=0.7*inch, topMargin=0.6*inch, bottomMargin=0.6*inch)
  story = []
  story.append(Paragraph("TALENT RADAR DOSSIER", SUB))
  story.append(Paragraph(c["name"].title(), H1))
  story.append(Paragraph(f"{c['license_type']} &nbsp;·&nbsp; {c['city']}, {c['state']} &nbsp;·&nbsp; Interest Score <b>{c['score']}/10</b>", BODY))
  story.append(Spacer(1, 12))

  story.append(Paragraph("Identity & Credentials", H2))
  story.append(kv_table([
    ["License Type", c["license_type"] or "—"],
    ["License #", c["license_number"] or "Not in public record"],
    ["Years Experience", str(c["years_experience"]) if c["years_experience"] else "Unknown"],
    ["Location", f"{c['city']}, {c['state']}"],
    ["Verification Sources", sanitize_sources(c["source"])],
    ["Data Completeness", f"{c['data_completeness']}%"],
    ["Enrichment Status", c["enrichment_status"]],
  ]))

  story.append(Paragraph("Current Employment", H2))
  story.append(kv_table([
    ["Employer", c["current_employer"] or "Unknown"],
    ["Title", c["current_title"] or "Unknown"],
  ]))

  story.append(Paragraph("Contact Channels", H2))
  story.append(kv_table([
    ["Phone", c["phone"] or "— (run claim to unlock)"],
    ["Email", c["email"] or "— (run claim to unlock)"],
    ["LinkedIn", c["linkedin_url"] or "—"],
    ["Facebook", c["facebook_url"] or "—"],
  ]))

  story.append(Paragraph("Background-Data Hygiene Check", H2))
  story.append(Paragraph(c["hibp"], BODY))

  story.append(Paragraph("Qualifications Summary", H2))
  story.append(Paragraph(c["qualifications_summary"], BODY))

  story.append(Paragraph("Hiring Recommendation", H2))
  story.append(Paragraph(c["hiring_recommendation"], BODY))

  story.append(Spacer(1, 18))
  story.append(Paragraph("— Detroit Web Agency · TalentRadar · Sample Dossier v5 —", SMALL))
  story.append(Paragraph("Intelligence sourced from public licensing records, employer directories, and proprietary OSINT. Methods confidential.", SMALL))

  doc.build(story)

paths = []
for c in CANDS:
  safe = c["name"].lower().replace(" ", "_").replace(",","").replace(".","")
  p = f"{OUT}/dossier_{safe}_v5.pdf"
  build(c, p)
  paths.append(p)
  print("wrote", p)
print("DONE", len(paths))
