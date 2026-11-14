package app

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http/httptest"
	"net/url"
	"os"
	"strings"
	"testing"
	"time"
	"unicode/utf8"

	"git.subcult.tv/subculture-collective/arkhiv-riot-grrrl/internal/catalog"
	"git.subcult.tv/subculture-collective/arkhiv-riot-grrrl/internal/fixtures"
	"git.subcult.tv/subculture-collective/arkhiv-riot-grrrl/internal/storage"
	"github.com/jackc/pgx/v5"
)

// The name matches TestArchiveIntegration so make test-integration runs it.
func TestArchiveIntegrationSearch(t *testing.T) {
	dsn := os.Getenv("TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("requires disposable TEST_DATABASE_URL")
	}
	cfg, err := pgx.ParseConfig(dsn)
	if err != nil || cfg.Host != "db" || cfg.User != "dev" || cfg.Password != "disposable-dev-only" {
		t.Fatal("requires isolated launcher database")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()
	admin, err := pgx.ConnectConfig(ctx, cfg)
	if err != nil {
		t.Fatal(err)
	}
	defer admin.Close(context.Background())
	name := fmt.Sprintf("arkhiv_search_%d", time.Now().UnixNano())
	if _, err = admin.Exec(ctx, "CREATE DATABASE "+pgx.Identifier{name}.Sanitize()); err != nil {
		t.Fatal(err)
	}
	defer admin.Exec(context.Background(), "DROP DATABASE "+pgx.Identifier{name}.Sanitize()+" WITH (FORCE)")
	u, _ := url.Parse(dsn)
	u.Path = "/" + name
	db, err := catalog.Open(ctx, u.String())
	if err != nil {
		t.Fatal(err)
	}
	defer db.Pool.Close()
	if err = db.Migrate(ctx, "../../../migrations"); err != nil {
		t.Fatal(err)
	}
	store, err := storage.Open(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	defer store.Close()
	t.Setenv("ARKHIV_FIXTURE", "1")
	if err = fixtures.Seed(ctx, db, store); err != nil {
		t.Fatal(err)
	}
	if _, err = db.Pool.Exec(ctx, `UPDATE variants SET public_approved=true`); err != nil {
		t.Fatal(err)
	}

	// Metadata field names are not values: none of these words occurs in a
	// fixture's metadata values or page text.
	for _, publicOnly := range []bool{true, false} {
		db.PublicOnly = publicOnly
		words := []string{"title", "creator", "date", "language", "subjects"}
		if !publicOnly {
			words = append(words, "file", "key", "rights")
		}
		for _, q := range words {
			docs, total, err := db.List(ctx, "fixture-zines", q, "", "", 50, 0, false)
			if err != nil || total != 0 || len(docs) != 0 {
				t.Fatalf("public-only=%v q=%q matched a field name: total=%d error=%v", publicOnly, q, total, err)
			}
		}
		for _, q := range []string{"author", "aid", "unknown", "en"} {
			_, total, err := db.List(ctx, "fixture-zines", q, "", "", 50, 0, true)
			if err != nil || total != 1 {
				t.Fatalf("public-only=%v q=%q missed a metadata value: total=%d error=%v", publicOnly, q, total, err)
			}
		}
	}

	// A match far into the page text must appear in the snippet, and OCR junk
	// runs (one long token, then punctuation that ts_headline does not count
	// as words) must not make the snippet unbounded.
	id := catalog.ID("fixture-zines", "synthetic", "Mutual aid fixture")
	doc, err := db.Get(ctx, id, true)
	if err != nil {
		t.Fatal(err)
	}
	long := strings.Repeat("filler words before the match ", 100) + strings.Repeat("x", 2000) + " " + strings.Repeat("-", 2000) + " Solidarity knownword appears here. " + strings.Repeat("trailing text after ", 100)
	if _, err = db.Pool.Exec(ctx, `UPDATE page_text SET text=$2 WHERE asset_sha=$1 AND page=2`, doc.Variants[0].SHA, long); err != nil {
		t.Fatal(err)
	}
	checkSnippet := func(where, snippet string) {
		t.Helper()
		if !strings.Contains(snippet, "knownword") || utf8.RuneCountInString(snippet) > 400 || strings.Contains(snippet, "<b>") {
			t.Fatalf("%s snippet lacks the match or is unbounded: %q", where, snippet)
		}
	}
	docs, _, err := db.List(ctx, "fixture-zines", "knownword", "", "", 50, 0, true)
	if err != nil || len(docs) != 1 || len(docs[0].Hits) == 0 || docs[0].Hits[0].Page != 2 {
		t.Fatalf("catalog hit: %+v %v", docs, err)
	}
	checkSnippet("catalog", docs[0].Hits[0].Snippet)

	w := httptest.NewRecorder()
	ArchiveHandler(db, store).ServeHTTP(w, httptest.NewRequest("GET", "/api/assets/"+doc.Variants[0].ID+"/search?q=knownword", nil))
	var hits []catalog.Hit
	if w.Code != 200 || json.Unmarshal(w.Body.Bytes(), &hits) != nil || len(hits) != 1 || hits[0].Page != 2 {
		t.Fatalf("asset search: %d %s", w.Code, w.Body.String())
	}
	checkSnippet("asset", hits[0].Snippet)
}
