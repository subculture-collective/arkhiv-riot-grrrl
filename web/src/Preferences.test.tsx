import { afterEach, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  FavoriteButton,
  FavoriteShelf,
  useBrowserFavorites,
  type BrowserFavorites,
} from "./Preferences";

afterEach(() => vi.unstubAllGlobals());

it("keeps temporary favorites and their warning after controls remount", () => {
  let stored = '["old"]';
  let denied = true;
  vi.stubGlobal("localStorage", {
    getItem: () => stored,
    setItem: (_key: string, value: string) => {
      if (denied) throw new Error("Storage denied");
      stored = value;
    },
  });
  let favorites: ReturnType<typeof useBrowserFavorites>;
  function Controls() {
    favorites = useBrowserFavorites("remount-regression");
    return <p>{favorites.ids.join(",")} {favorites.notice}</p>;
  }
  renderToStaticMarkup(<Controls />);
  favorites!.toggle("new");
  const remounted = renderToStaticMarkup(<Controls />);
  expect(remounted).toContain("old,new");
  expect(remounted).toContain("Browser storage is unavailable");
  expect(stored).toBe('["old"]');
  denied = false;
  favorites!.toggle("old");
  const recovered = renderToStaticMarkup(<Controls />);
  expect(recovered).toContain("new");
  expect(recovered).not.toContain("Browser storage is unavailable");
  expect(JSON.parse(stored)).toEqual(["new"]);
});

const favoritesWith = (ids: string[]): BrowserFavorites => ({
  ids,
  toggle: () => {},
  notice: "",
});

it("keeps one favorite button name that contains the visible text", () => {
  const unsaved = renderToStaticMarkup(
    <FavoriteButton id="a" title="Zine" favorites={favoritesWith([])} />,
  );
  const saved = renderToStaticMarkup(
    <FavoriteButton id="a" title="Zine" favorites={favoritesWith(["a"])} />,
  );
  for (const [html, pressed] of [
    [unsaved, "false"],
    [saved, "true"],
  ]) {
    expect(html).toContain('aria-label="Favorite Zine"');
    expect(html).toContain(`aria-pressed="${pressed}"`);
    expect(html).toContain(">Favorite</button>");
  }
});

it("counts favorites in plain English for the collection name", () => {
  const shelf = (ids: string[]) =>
    renderToStaticMarkup(
      <FavoriteShelf
        favorites={favoritesWith(ids)}
        scope="riot-grrrl"
        label="Riot Grrrl Zine Archive"
        resolve={() => new Promise(() => {})}
      />,
    ).replace(/<!-- -->/g, "");
  expect(shelf(["a"])).toContain(
    "1 reference saved in this browser for Riot Grrrl Zine Archive.",
  );
  expect(shelf(["a", "b"])).toContain(
    "2 references saved in this browser for Riot Grrrl Zine Archive.",
  );
  expect(shelf([])).toContain("0 references saved");
  expect(shelf(["a"])).not.toContain("for riot-grrrl");
});
