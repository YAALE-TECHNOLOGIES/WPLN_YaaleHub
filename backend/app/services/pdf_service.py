from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from reportlab.lib.units import inch
import os

def generate_certificate(candidate_name, module_name, score, result, date_str, output_path):
    c = canvas.Canvas(output_path, pagesize=A4)
    width, height = A4
    
    # Border
    c.setLineWidth(5)
    c.rect(0.5*inch, 0.5*inch, width-1*inch, height-1*inch)
    
    # Header
    c.setFont("Helvetica-Bold", 32)
    c.drawCentredString(width/2, height - 2*inch, "CERTIFICATE OF COMPLETION")
    
    c.setFont("Helvetica", 18)
    c.drawCentredString(width/2, height - 2.8*inch, "This is to certify that")
    
    c.setFont("Helvetica-BoldOblique", 24)
    c.drawCentredString(width/2, height - 3.5*inch, candidate_name)
    
    c.setFont("Helvetica", 16)
    c.drawCentredString(width/2, height - 4.2*inch, f"has successfully completed the assessment module:")
    
    c.setFont("Helvetica-Bold", 20)
    c.drawCentredString(width/2, height - 4.8*inch, module_name)
    
    c.setFont("Helvetica", 16)
    c.drawCentredString(width/2, height - 5.5*inch, f"Score: {score}% | Result: {result}")
    
    c.setFont("Helvetica", 12)
    c.drawCentredString(width/2, height - 7*inch, f"Date: {date_str}")
    
    c.setFont("Helvetica-Bold", 14)
    c.drawCentredString(width/2, height - 8*inch, "WPLN Assessment Authority")
    
    c.save()
    return output_path
