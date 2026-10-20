"""Phase 1 browser verification. Run with the dev stack up: python3 tests/e2e/phase1.py"""
import re, sys, time, random
from playwright.sync_api import sync_playwright, expect

BASE = "http://localhost:5173"
results, problems = [], []
uid = f"{int(time.time())}{random.randint(100,999)}"
EMAIL, PW, NEW_PW = f"e2e{uid}@example.com", "Passw0rdOne", "Passw0rdTwo"

def check(name, ok, detail=""):
    results.append((name, ok, detail))
    print(("PASS " if ok else "FAIL ") + name + (f"  -> {detail}" if detail and not ok else ""))

with sync_playwright() as p:
    browser = p.chromium.launch()
    ctx = browser.new_context(viewport={"width": 1440, "height": 900})
    page = ctx.new_page()
    console_errors, failed_requests = [], []
    page.on("console", lambda m: console_errors.append(m.text) if m.type == "error" else None)
    page.on("pageerror", lambda e: console_errors.append(f"PAGEERROR {e}"))
    page.on("response", lambda r: failed_requests.append(f"{r.status} {r.request.method} {r.url}")
            if r.status >= 500 else None)

    # ---- Landing ----
    page.goto(BASE)
    check("landing hero text", page.get_by_role("heading", level=1).inner_text().strip() == "Study Smarter. Prepare Better. Get Interview Ready.")
    check("landing CTA 'Get Started' present", page.get_by_role("link", name="Get Started").first.is_visible())
    for anchor in ["how-it-works", "features"]:
        check(f"landing anchor #{anchor} exists", page.locator(f"#{anchor}").count() == 1)

    # ---- Protected route redirect ----
    page.goto(f"{BASE}/dashboard")
    page.wait_for_url(re.compile(r"/login$"))
    check("protected /dashboard redirects to /login when signed out", True)

    # ---- Signup validation ----
    page.goto(f"{BASE}/signup")
    page.get_by_role("button", name="Create account").click()
    check("signup shows client-side field errors", page.get_by_text("Name is required.").is_visible())
    page.get_by_label("Full name").fill("Alex Rivera")
    page.get_by_label("Email").fill(EMAIL)
    page.get_by_label("Password", exact=True).fill("weak")
    page.get_by_role("button", name="Create account").click()
    check("weak password rejected with message", page.get_by_text(re.compile("at least 8 characters")).count() >= 1)

    # ---- Signup success ----
    page.get_by_label("Password", exact=True).fill(PW)
    page.get_by_role("button", name="Create account").click()
    page.wait_for_url(re.compile(r"/dashboard$"))
    check("signup -> dashboard", True)
    greeting = page.get_by_role("heading", level=1).inner_text()
    check("dashboard greets by first name", re.match(r"Good (morning|afternoon|evening), Alex$", greeting) is not None, greeting)

    # ---- Session persistence across reload ----
    page.reload()
    page.wait_for_selector("h1")
    check("session persists after reload", "/dashboard" in page.url and "Alex" in page.get_by_role("heading", level=1).inner_text())

    # ---- Signed-in user is bounced off /login ----
    page.goto(f"{BASE}/login")
    page.wait_for_url(re.compile(r"/dashboard$"))
    check("signed-in user redirected away from /login", True)

    # ---- Every sidebar link resolves (no dead nav) ----
    hrefs = page.locator("aside nav a, aside a[href]").evaluate_all("els => [...new Set(els.map(e => e.getAttribute('href')))]")
    ok_all = True
    for h in hrefs:
        page.goto(BASE + h)
        page.wait_for_selector("main h1")
        if page.locator("text=Page not found").count():
            ok_all = False; problems.append(f"dead nav link {h}")
    check(f"all {len(hrefs)} sidebar links resolve to a page", ok_all, str(problems))

    # ---- Logout ----
    page.goto(f"{BASE}/dashboard")
    page.get_by_role("button", name="Sign out").click()
    page.wait_for_url(re.compile(r"/login$"))
    page.goto(f"{BASE}/dashboard")
    page.wait_for_url(re.compile(r"/login$"))
    check("logout ends session (dashboard requires login again)", True)

    # ---- Wrong password / unknown email produce the same message ----
    page.goto(f"{BASE}/login")
    page.get_by_label("Email").fill(EMAIL)
    page.get_by_label("Password", exact=True).fill("WrongPass123")
    page.get_by_role("button", name="Sign in").click()
    page.get_by_role("alert").filter(has_text="Incorrect email or password").wait_for()
    check("wrong password -> friendly error", True)
    page.get_by_label("Email").fill(f"nobody{uid}@example.com")
    page.get_by_role("button", name="Sign in").click()
    page.get_by_role("alert").filter(has_text="Incorrect email or password").wait_for()
    check("unknown email -> identical error", True)

    # ---- Forgot -> reset -> login with new password ----
    page.goto(f"{BASE}/forgot-password")
    page.get_by_label("Email").fill(EMAIL)
    page.get_by_role("button", name="Send reset link").click()
    page.get_by_text("Development mode: email delivery is simulated.").wait_for()
    check("forgot-password shows clearly-labelled dev link", True)
    page.get_by_role("link", name="Open reset link").click()
    page.wait_for_url(re.compile(r"/reset-password\?token="))
    page.get_by_label("New password", exact=True).fill(NEW_PW)
    page.get_by_label("Confirm new password").fill("Mismatch123")
    page.get_by_role("button", name="Update password").click()
    check("mismatched confirm rejected", page.get_by_text("Passwords do not match.").is_visible())
    page.get_by_label("Confirm new password").fill(NEW_PW)
    page.get_by_role("button", name="Update password").click()
    page.wait_for_url(re.compile(r"/login$"))
    check("reset success -> login with success notice", page.get_by_text("Password updated").is_visible())
    page.get_by_label("Email").fill(EMAIL)
    page.get_by_label("Password", exact=True).fill(NEW_PW)
    page.get_by_role("button", name="Sign in").click()
    page.wait_for_url(re.compile(r"/dashboard$"))
    check("login with NEW password works", True)

    # ---- 404 ----
    page.goto(f"{BASE}/definitely-not-a-page")
    check("404 page renders", page.get_by_role("heading", name="Page not found").is_visible())

    # ---- Dark mode toggle persists ----
    page.goto(f"{BASE}/dashboard"); page.wait_for_selector("h1")
    page.get_by_role("button", name="Switch to dark theme").first.click()
    check("dark mode applies", page.evaluate("document.documentElement.classList.contains('dark')"))
    page.reload(); page.wait_for_selector("h1")
    check("dark mode persists across reload", page.evaluate("document.documentElement.classList.contains('dark')"))
    page.get_by_role("button", name="Switch to light theme").first.click()

    # ---- Responsive: no horizontal overflow at every required width ----
    for path, authed in [("/", False), ("/login", False), ("/signup", False), ("/dashboard", True)]:
        for w in [1920, 1440, 1024, 768, 390, 360]:
            page.set_viewport_size({"width": w, "height": 800})
            page.goto(BASE + path); page.wait_for_selector("h1")
            over = page.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth")
            if over > 0:
                check(f"no horizontal overflow {path} @{w}px", False, f"{over}px overflow")
    check("no horizontal overflow on any page/width combination tested", all(ok for n, ok, _ in results if n.startswith("no horizontal overflow ") ) )

    # ---- Mobile drawer ----
    page.set_viewport_size({"width": 390, "height": 800})
    page.goto(f"{BASE}/dashboard"); page.wait_for_selector("h1")
    check("sidebar hidden on mobile", not page.locator("aside").is_visible())
    page.get_by_role("button", name="Open menu").click()
    dialog = page.get_by_role("dialog", name="Navigation menu")
    check("mobile drawer opens", dialog.is_visible())
    page.keyboard.press("Escape")
    check("Escape closes drawer", not dialog.is_visible())
    page.get_by_role("button", name="Open menu").click()
    dialog.get_by_role("link", name="Subjects").click()
    page.wait_for_url(re.compile(r"/subjects$"))
    check("navigating from drawer closes it", not page.get_by_role("dialog").is_visible())

    check("no browser console errors", len(console_errors) == 0, "; ".join(console_errors[:5]))
    check("no HTTP 5xx responses", len(failed_requests) == 0, "; ".join(failed_requests[:5]))
    browser.close()

failed = [r for r in results if not r[1]]
print(f"\n{len(results)-len(failed)}/{len(results)} checks passed")
sys.exit(1 if failed else 0)
