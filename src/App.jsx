import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * Book Finder – Open Library (with Extras)
 * Framework: React (single-file component)
 * Styling: Minimal CSS-in-JS via a <style> tag for portability
 * Features (Enhanced):
 *  - Search by title
 *  - Result grid with cover, title, authors, year
 *  - Loading / error / empty states
 *  - Pagination via "Load more"
 *  - Filters: Year range, Author keyword
 *  - Favorites via localStorage
 *  - Details modal with description & subjects
 */

export default function App() {
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [numFound, setNumFound] = useState(null);
  const [filters, setFilters] = useState({ author: "", yearFrom: "", yearTo: "" });
  const [favorites, setFavorites] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("favorites") || "[]");
    } catch {
      return [];
    }
  });
  const [details, setDetails] = useState(null);

  const abortRef = useRef(null);

  const canLoadMore = useMemo(() => {
    if (numFound == null) return false;
    return books.length < numFound;
  }, [books.length, numFound]);

  useEffect(() => {
    if (!query) return; // don't fetch on mount
    fetchBooks(query, page, { append: page > 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, page]);

  function onSubmit(e) {
    e.preventDefault();
    if (!input.trim()) return;
    setBooks([]);
    setNumFound(null);
    setPage(1);
    setQuery(input.trim());
  }

  async function fetchBooks(q, p, { append = false } = {}) {
    try {
      setLoading(true);
      setError("");
      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const url = new URL("https://openlibrary.org/search.json");
      url.searchParams.set("title", q);
      url.searchParams.set("page", String(p));
      if (filters.author) url.searchParams.set("author", filters.author);
      if (filters.yearFrom) url.searchParams.set("fromYear", filters.yearFrom);
      if (filters.yearTo) url.searchParams.set("toYear", filters.yearTo);

      const res = await fetch(url.toString(), { signal: controller.signal });
      if (!res.ok) throw new Error(`Request failed: ${res.status}`);
      const data = await res.json();
      const docs = Array.isArray(data.docs) ? data.docs : [];

      setNumFound(typeof data.numFound === "number" ? data.numFound : docs.length);
      setBooks(prev => (append ? [...prev, ...normalizeDocs(docs)] : normalizeDocs(docs)));
    } catch (err) {
      if (err.name === "AbortError") return; // ignore cancelled
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  function normalizeDocs(docs) {
    return docs.map((d, i) => ({
      key: d.key || `${d.title}-${d.first_publish_year}-${i}`,
      title: d.title || "Untitled",
      authors: d.author_name || [],
      year: d.first_publish_year || null,
      coverId: d.cover_i || null,
      workKey: d.key || null,
    }));
  }

  function coverUrl(coverId) {
    if (!coverId) return "https://via.placeholder.com/128x192?text=No+Cover";
    return `https://covers.openlibrary.org/b/id/${coverId}-M.jpg`;
  }

  function toggleFavorite(book) {
    const exists = favorites.some(f => f.key === book.key);
    let newFavs;
    if (exists) {
      newFavs = favorites.filter(f => f.key !== book.key);
    } else {
      newFavs = [...favorites, book];
    }
    setFavorites(newFavs);
    localStorage.setItem("favorites", JSON.stringify(newFavs));
  }

  async function openDetails(book) {
    if (!book.workKey) return;
    try {
      setLoading(true);
      const res = await fetch(`https://openlibrary.org${book.workKey}.json`);
      const data = await res.json();
      setDetails({
        ...book,
        description: data.description?.value || data.description || "No description available.",
        subjects: data.subjects || [],
      });
    } catch (err) {
      setError("Could not fetch details.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.page}>
      <StyleTag />
      <header style={styles.header}>
        <div style={styles.brand}>
          <span role="img" aria-label="books">📚</span> ALEX BOOK FINDER
        </div>
        <form onSubmit={onSubmit} style={styles.searchRow}>
          <input
            type="text"
            placeholder="Search by book title (e.g., Harry Potter)"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            style={styles.input}
          />
          <button type="submit" style={styles.button} disabled={loading}>
            {loading ? "Searching..." : "Search"}
          </button>
        </form>
        <div style={styles.filters}>
          <input
            type="text"
            placeholder="Filter by author"
            value={filters.author}
            onChange={(e) => setFilters({ ...filters, author: e.target.value })}
            style={styles.input}
          />
          <input
            type="number"
            placeholder="Year from"
            value={filters.yearFrom}
            onChange={(e) => setFilters({ ...filters, yearFrom: e.target.value })}
            style={styles.input}
          />
          <input
            type="number"
            placeholder="Year to"
            value={filters.yearTo}
            onChange={(e) => setFilters({ ...filters, yearTo: e.target.value })}
            style={styles.input}
          />
        </div>
      </header>

      <main style={styles.main}>
        {error && (
          <div className="alert error">⚠️ {error}</div>
        )}

        {!error && query && !loading && books.length === 0 && (
          <div className="alert">No results for “{query}”. Try another title.</div>
        )}

        {numFound != null && (
          <div className="meta">Found {numFound.toLocaleString()} result{numFound === 1 ? "" : "s"} for “{query}”.</div>
        )}

        <section style={styles.grid}>
          {books.map((b) => (
            <article key={b.key} style={styles.card}>
              <div style={styles.coverWrap}>
                <img src={coverUrl(b.coverId)} alt={`${b.title} cover`} style={styles.cover} />
              </div>
              <div style={styles.cardBody}>
                <h3 className="title" title={b.title}>{b.title}</h3>
                <p className="muted">{b.authors.length ? b.authors.join(", ") : "Unknown author"}</p>
                <p className="muted">{b.year ? b.year : "Year N/A"}</p>
              </div>
              <div style={styles.cardActions}>
                <button onClick={() => openDetails(b)} style={styles.smallBtn}>Details</button>
                <button onClick={() => toggleFavorite(b)} style={styles.smallBtn}>
                  {favorites.some(f => f.key === b.key) ? "★ Unfavorite" : "☆ Favorite"}
                </button>
              </div>
            </article>
          ))}
        </section>

        <div style={styles.actions}>
          {canLoadMore && (
            <button
              style={styles.loadMore}
              onClick={() => setPage((p) => p + 1)}
              disabled={loading}
            >
              {loading ? "Loading..." : "Load more"}
            </button>
          )}
        </div>
      </main>

      {details && (
        <div style={styles.modalOverlay} onClick={() => setDetails(null)}>
          <div style={styles.modal} onClick={e => e.stopPropagation()}>
            <h2>{details.title}</h2>
            <p><strong>Authors:</strong> {details.authors.join(", ")}</p>
            <p><strong>Year:</strong> {details.year}</p>
            <p><strong>Description:</strong> {details.description}</p>
            {details.subjects.length > 0 && <p><strong>Subjects:</strong> {details.subjects.join(", ")}</p>}
            <button onClick={() => setDetails(null)} style={styles.button}>Close</button>
          </div>
        </div>
      )}

      <footer style={styles.footer}>
        <span>
          Data from <a href="https://openlibrary.org/developers/api" target="_blank" rel="noreferrer">Open Library</a>
        </span>
      </footer>
    </div>
  );
}

function StyleTag() {
  return (
    <style>{`
      :root {
        --bg: #0b1020;
        --panel: #121a33;
        --muted: #9aa3b2;
        --text: #e8ecf4;
        --accent: #5b8cff;
        --border: #223055;
      }
      * { box-sizing: border-box; }
      body { margin: 0; font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; background: var(--bg); color: var(--text); }
      a { color: var(--accent); text-decoration: none; }
      .alert {
        background: #14203d; border: 1px solid var(--border); color: var(--text);
        padding: 12px 14px; border-radius: 12px; margin: 8px 0 16px;
      }
      .alert.error { border-color: #ff5b7f; }
      .meta { color: var(--muted); margin: 10px 2px 16px; font-size: 14px; }
      .title { margin: 0 0 6px; font-size: 16px; line-height: 1.3; }
      .muted { color: var(--muted); margin: 0 0 4px; font-size: 13px; }
      @media (max-width: 480px) {
        .title { font-size: 15px; }
      }
    `}</style>
  );
}

const styles = {
  page: { minHeight: "100vh", display: "flex", flexDirection: "column" },
  header: {
    padding: "20px 16px",
    position: "sticky",
    top: 0,
    background: "linear-gradient(180deg, rgba(11,16,32,0.95), rgba(11,16,32,0.65))",
    backdropFilter: "blur(6px)",
    borderBottom: "1px solid var(--border)",
    zIndex: 10,
  },
  brand: { fontWeight: 700, fontSize: 20, marginBottom: 12 },
  searchRow: { display: "flex", gap: 8, marginBottom: 12 },
  filters: { display: "flex", gap: 8, flexWrap: "wrap" },
  input: {
    flex: 1,
    padding: "12px 14px",
    borderRadius: 12,
    border: "1px solid var(--border)",
    background: "var(--panel)",
    color: "var(--text)",
    outline: "none",
    minWidth: 120,
  },
  button: {
    padding: "12px 16px",
    borderRadius: 12,
    border: "1px solid var(--border)",
    background: "var(--accent)",
    color: "white",
    fontWeight: 600,
    cursor: "pointer",
  },
  main: { padding: "18px 16px", maxWidth: 1200, width: "100%", margin: "0 auto", flex: 1 },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
    gap: 14,
  },
  card: {
    border: "1px solid var(--border)",
    background: "var(--panel)",
    borderRadius: 16,
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
  },
  coverWrap: { width: "100%", aspectRatio: "2 / 3", background: "#0f1630" },
  cover: { width: "100%", height: "100%", objectFit: "cover", display: "block" },
  cardBody: { padding: 12, flex: 1 },
  cardActions: { display: "flex", gap: 6, padding: 8 },
  smallBtn: {
    flex: 1,
    fontSize: 12,
    padding: "6px 8px",
    borderRadius: 8,
    border: "1px solid var(--border)",
    background: "transparent",
    color: "var(--text)",
    cursor: "pointer",
  },
  actions: { display: "flex", justifyContent: "center", padding: 16 },
  loadMore: {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid var(--border)",
    background: "transparent",
    color: "var(--text)",
    cursor: "pointer",
  },
  footer: {
    padding: 14,
    borderTop: "1px solid var(--border)",
    color: "var(--muted)",
    textAlign: "center",
  },
  modalOverlay: {
    position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
    background: "rgba(0,0,0,0.6)", display: "flex", justifyContent: "center", alignItems: "center",
  },
  modal: {
    background: "var(--panel)", borderRadius: 16, padding: 20, maxWidth: 500, color: "var(--text)",
  },
};
