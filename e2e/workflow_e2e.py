"""End-to-end test: the full request life-cycle through the browser UI across three roles.

Run against a seeded server:  pip install playwright pillow && playwright install chromium
                              BASE_URL=http://localhost:4000 python3 e2e/workflow_e2e.py
"""
import os, re
from PIL import Image, ImageDraw
from playwright.sync_api import sync_playwright, expect

BASE = 'http://localhost:4000'
here = os.path.dirname(os.path.abspath(__file__))
BASE = os.environ.get('BASE_URL', BASE)
img = os.path.join(here, 'fault.jpg')
im = Image.new('RGB', (800, 600), (210, 200, 185))
d = ImageDraw.Draw(im)
d.rectangle([300, 200, 500, 420], fill=(240, 240, 235), outline=(120, 120, 120), width=6)
d.ellipse([360, 260, 390, 290], fill=(40, 40, 40)); d.ellipse([410, 260, 440, 290], fill=(40, 40, 40))
d.line([500, 200, 560, 150], fill=(30, 30, 30), width=8)
im.save(img, quality=85)

def login(browser, email):
    ctx = browser.new_context(viewport={'width': 1366, 'height': 900})
    p = ctx.new_page()
    p.goto(BASE + '/login')
    p.fill('#email', email); p.fill('#password', 'CampusFix@2026')
    p.click('button[type=submit]')
    p.wait_for_url(BASE + '/')
    return p

with sync_playwright() as pw:
    b = pw.chromium.launch()
    student = login(b, 'student@campusfix.app')
    admin = login(b, 'admin@campusfix.app')
    admin.goto(BASE + '/')  # admin watches dashboard for live update

    # 1. Validation messages on empty submit
    student.goto(BASE + '/requests/new')
    student.click('text=Submit request')
    expect(student.get_by_text('Choose a category')).to_be_visible()
    expect(student.get_by_text('Use at least 5 characters')).to_be_visible()
    print('ok: client-side validation messages shown')

    # 2. Submit with photo
    student.click('text=Electricity & Power')
    student.fill('#title', 'Socket sparking in reading room')
    student.fill('#description', 'The wall socket beside the third table sparks whenever a charger is plugged in.')
    student.fill('#location', 'Main Library')
    student.fill('#room', 'Reading room 2')
    student.click('text=Safety risk or major outage')
    student.set_input_files('#images', img)
    student.click('text=Submit request')
    student.wait_for_url(re.compile(r'/requests/[0-9a-f-]{36}$'))
    req_url = student.url
    ref = student.locator('.ref-stamp').first.inner_text()
    expect(student.get_by_text('Reported fault')).to_be_visible()
    print('ok: request submitted', ref)

    # 3. Admin sees it live (no reload) in Needs assignment
    expect(admin.get_by_text('Socket sparking in reading room').first).to_be_visible(timeout=8000)
    print('ok: admin dashboard updated in real time')

    # 4. Admin assigns to Ibrahim Musa
    admin.goto(req_url)
    admin.click('text=Assign officer')
    admin.locator('label', has_text='Ibrahim Musa').click()
    admin.fill('#assign-note', 'Isolate the circuit before inspection.')
    admin.click('button:has-text("Assign")>> nth=-1')
    expect(admin.get_by_text('Assigned to Ibrahim Musa').first).to_be_visible()
    print('ok: assigned')

    # Student page updates live
    expect(student.locator('text=Assigned').first).to_be_visible(timeout=8000)

    # 5. Officer starts and completes
    officer = login(b, 'ibrahim.musa@campusfix.app')
    officer.goto(req_url)
    officer.click('text=Start work'); officer.click('button:has-text("Start work") >> nth=-1')
    expect(officer.get_by_text('Mark as completed')).to_be_visible()
    officer.click('text=Put on hold')
    officer.click('button:has-text("Put on hold") >> nth=-1')
    expect(officer.get_by_text('Explain why the job is on hold')).to_be_visible()
    officer.click('button:has-text("Back")')
    officer.click('text=Mark as completed')
    officer.fill('#status-comment', 'Replaced the damaged socket and tested the circuit.')
    officer.set_input_files('#completion-images', img)
    officer.click('button:has-text("Mark completed")')
    expect(officer.get_by_text('Waiting for the requester to confirm the repair.')).to_be_visible()
    print('ok: officer started and completed (with completion photo)')

    # 6. Student confirms with rating
    student.goto(req_url)
    student.click('text=Confirm it is fixed')
    student.click('[aria-label="5 stars"]')
    student.fill('#status-comment', 'Quick and tidy work, thank you.')
    student.click('text=Confirm and close')
    expect(student.get_by_text('This request is finished.')).to_be_visible()
    expect(student.get_by_text('Requester rating')).to_be_visible()
    print('ok: student confirmed and rated; request closed')

    # 7. RBAC on the frontend: student cannot open admin pages
    student.goto(BASE + '/users')
    expect(student.get_by_text("You don't have access to this page")).to_be_visible()
    print('ok: role guard blocks student from /users')

    # 8. Notifications exist for student
    student.goto(BASE + '/notifications')
    expect(student.get_by_text(ref).first).to_be_visible()
    print('ok: notifications listed')

    # 9. Logout then protected route redirects
    student.click('[aria-label="Sign out"]')
    student.wait_for_url(BASE + '/login')
    student.goto(BASE + '/requests')
    student.wait_for_url(re.compile('/login'))
    print('ok: logout and redirect to login')
    b.close()
print('ALL E2E CHECKS PASSED')
