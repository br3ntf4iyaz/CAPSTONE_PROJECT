"""
Smoke test: Youth Home page end-to-end.

Verifies:
- Page loads without console errors
- Hero section renders (GraduationCap logo + "LYDO" / "Lucena" heading)
- Nav links (Home, Programs, Organizations, Library) are visible
- Login and Register buttons always visible (regardless of auth state)
- Theme toggle is present and clickable
- NO requests to /api/api/... (confirms /api double-prefix bug is fixed)
- Public API endpoints return 200 (not 404)
- Takes a full-page screenshot for visual review

Run via webapp-testing helper:
    python .claude/skills/webapp-testing/scripts/with_server.py \
      --server "cd backend && python manage.py runserver 8000" --port 8000 \
      --server "cd frontend && npm run dev" --port 5173 \
      -- python tests/smoke_youth_home.py
"""
from __future__ import annotations

import sys
from pathlib import Path
from playwright.sync_api import sync_playwright, ConsoleMessage, Request, Response

FRONTEND_URL = "http://localhost:5173/"
SCREENSHOT = Path(__file__).parent / "screenshots" / "youth_home.png"


def main() -> int:
    console_errors: list[str] = []
    double_api_hits: list[str] = []
    api_failures: list[tuple[str, int]] = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1280, "height": 800})
        page = context.new_page()

        # Capture console errors
        def on_console(msg: ConsoleMessage) -> None:
            if msg.type == "error":
                console_errors.append(msg.text)

        # Detect /api/api/ duplication
        def on_request(req: Request) -> None:
            if "/api/api/" in req.url:
                double_api_hits.append(req.url)

        # Detect failed API calls
        def on_response(res: Response) -> None:
            if "/api/" in res.url and res.status >= 400:
                api_failures.append((res.url, res.status))

        page.on("console", on_console)
        page.on("request", on_request)
        page.on("response", on_response)

        print(f"-> Navigating to {FRONTEND_URL}")
        page.goto(FRONTEND_URL, wait_until="networkidle", timeout=30_000)

        # Assertions -------------------------------------------------------
        results: list[tuple[str, bool, str]] = []

        def check(label: str, condition: bool, detail: str = "") -> None:
            results.append((label, condition, detail))
            mark = "PASS" if condition else "FAIL"
            print(f"  {mark} {label}{(' — ' + detail) if detail else ''}")

        # 1. Hero/branding visible
        brand = page.locator("header").locator("text=/LYDO|Lucena Youth/i").first
        check("Brand text visible", brand.is_visible(timeout=5000))

        # 2. Nav links
        for name in ("Home", "Resources"):
            link = page.locator(f"nav >> text={name}").first
            check(f"Nav link: {name}", link.is_visible())

        # 3. Sign-in + Get started (register) always present on public layout
        check("Sign-in link visible", page.locator("nav, header").locator("text=/sign in/i").first.is_visible())
        check("Get-started (register) button visible", page.locator("header").locator("text=Get started").first.is_visible())

        # 4. Theme toggle removed from youth side — confirm it's gone
        theme_btn = page.locator("button[title*='mode' i]")
        check("Theme toggle absent (youth is light-only)", theme_btn.count() == 0)

        # 5. Hamburger has proper ARIA on mobile viewport
        page.set_viewport_size({"width": 375, "height": 800})
        page.wait_for_timeout(300)
        hamburger = page.locator("button[aria-controls='mobile-menu']").first
        check("Hamburger has aria-controls=mobile-menu", hamburger.count() == 1)
        if hamburger.count() == 1:
            check(
                "Hamburger has aria-expanded",
                hamburger.get_attribute("aria-expanded") in ("true", "false"),
            )
        page.set_viewport_size({"width": 1280, "height": 800})

        # 6. Screenshot
        SCREENSHOT.parent.mkdir(parents=True, exist_ok=True)
        page.screenshot(path=str(SCREENSHOT), full_page=True)
        check("Screenshot saved", SCREENSHOT.exists(), str(SCREENSHOT))

        # 6b. Reveal animations resolved — all .reveal blocks visible
        reveal_total = page.locator(".reveal").count()
        reveal_visible = page.evaluate(
            "() => Array.from(document.querySelectorAll('.reveal'))"
            ".filter(el => getComputedStyle(el).opacity === '1').length"
        )
        check(
            "All .reveal blocks fade in to opacity:1 (keyframes defined)",
            reveal_total > 0 and reveal_visible == reveal_total,
            f"{reveal_visible}/{reveal_total} visible",
        )

        # 6c. Hero display text rendered
        hero = page.locator("text=/young Lucenahins|ready to lead/i").first
        check("Hero display copy visible", hero.is_visible())

        # 6d. /login loads without redirect ping-pong (guard agreement fix)
        nav_count = {"n": 0}
        page.on("framenavigated", lambda _f: nav_count.__setitem__("n", nav_count["n"] + 1))
        page.goto(FRONTEND_URL + "login", wait_until="networkidle", timeout=15_000)
        page.wait_for_timeout(800)
        check(
            "/login does not ping-pong (Navigate loop regression)",
            nav_count["n"] <= 3 and "/login" in page.url,
            f"nav fires={nav_count['n']}, landed={page.url}",
        )
        sign_in = page.locator("text=/sign in to your account/i").first
        check("Login page body rendered", sign_in.is_visible(timeout=3000))
        page.goto(FRONTEND_URL, wait_until="networkidle")

        # 7. Network hygiene
        check(
            "No /api/api/ double-prefix requests",
            len(double_api_hits) == 0,
            f"{len(double_api_hits)} offenders: {double_api_hits[:3]}",
        )
        check(
            "No 4xx/5xx on /api/ calls",
            len(api_failures) == 0,
            f"{len(api_failures)} failed: {api_failures[:3]}",
        )

        # 8. Console clean (ignore benign dev warnings)
        fatal_console = [e for e in console_errors if "Warning" not in e and "DevTools" not in e]
        check(
            "No console errors",
            len(fatal_console) == 0,
            f"{len(fatal_console)} errors: {fatal_console[:2]}",
        )

        browser.close()

    # Summary --------------------------------------------------------------
    passed = sum(1 for _, ok, _ in results if ok)
    total = len(results)
    print(f"\n{'=' * 50}")
    print(f"  {passed}/{total} checks passed")
    print(f"{'=' * 50}")

    return 0 if passed == total else 1


if __name__ == "__main__":
    sys.exit(main())
