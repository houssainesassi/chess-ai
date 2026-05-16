type NavigationHandler = (path: string) => void;

const NAV_MAP: Array<{ words: string[]; path: string }> = [
  { words: ["lobby", "go to lobby", "home", "main menu"], path: "/lobby" },
  { words: ["settings", "open settings", "preferences"], path: "/settings" },
  { words: ["history", "game history", "past games"], path: "/history" },
  { words: ["play ai", "play computer", "single player", "vs computer"], path: "/game" },
  { words: ["profile", "my profile"], path: "/profile" },
];

const SCROLL_MAP: Array<{ words: string[]; dy: number }> = [
  { words: ["scroll down", "down", "move down"], dy: 200 },
  { words: ["scroll up", "up", "move up"], dy: -200 },
  { words: ["page down", "next page"], dy: 600 },
  { words: ["page up", "previous page"], dy: -600 },
];

const CHESS_UCI = /^[a-h][1-8]\s*(to\s*)?[a-h][1-8]/i;

export class CommandRegistry {
  private navHandler: NavigationHandler | null = null;
  private extraCommands: Array<{ keywords: string[]; action: () => void }> = [];

  registerNavigation(fn: NavigationHandler) {
    this.navHandler = fn;
  }

  register(keywords: string[], action: () => void) {
    this.extraCommands.push({ keywords, action });
    return () => {
      this.extraCommands = this.extraCommands.filter((c) => c.action !== action);
    };
  }

  /** Returns true if a command was matched and fired */
  match(rawTranscript: string): boolean {
    const t = rawTranscript.toLowerCase().trim();

    // Don't intercept chess UCI moves — game page handles those
    if (CHESS_UCI.test(t)) return false;

    // Extra registered commands (page-level)
    for (const cmd of this.extraCommands) {
      if (cmd.keywords.some((k) => t.includes(k.toLowerCase()))) {
        cmd.action();
        return true;
      }
    }

    // Navigation
    for (const nav of NAV_MAP) {
      if (nav.words.some((w) => t.includes(w))) {
        this.navHandler?.(nav.path);
        return true;
      }
    }

    // Scroll
    for (const s of SCROLL_MAP) {
      if (s.words.some((w) => t.includes(w))) {
        window.scrollBy({ top: s.dy, behavior: "smooth" });
        return true;
      }
    }

    // DOM scan
    return this._matchDOM(t);
  }

  private _matchDOM(t: string): boolean {
    const candidates = Array.from(
      document.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], [role="button"], [role="menuitem"], [data-ai-label]'
      )
    ).filter((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && r.top >= 0 && r.bottom <= window.innerHeight + 200;
    });

    let best: HTMLElement | null = null;
    let bestScore = 0;

    for (const el of candidates) {
      const label = (
        el.getAttribute("data-ai-label") ||
        el.getAttribute("aria-label") ||
        el.textContent
      )
        ?.replace(/\s+/g, " ")
        .trim()
        .toLowerCase();

      if (!label || label.length < 2) continue;

      const score = this._score(t, label);
      if (score > 0.55 && score > bestScore) {
        bestScore = score;
        best = el;
      }
    }

    if (best) {
      best.focus();
      best.click();
      return true;
    }

    return false;
  }

  private _score(query: string, label: string): number {
    if (label === query) return 1;
    if (query.includes(label) || label.includes(query)) return 0.92;

    const qw = query.split(/\s+/).filter((w) => w.length >= 3);
    const lw = label.split(/\s+/).filter((w) => w.length >= 2);
    if (!qw.length || !lw.length) return 0;

    let hits = 0;
    for (const q of qw) {
      if (lw.some((l) => l.includes(q) || q.includes(l))) hits++;
    }
    return hits / Math.max(qw.length, lw.length);
  }
}

export const commandRegistry = new CommandRegistry();
