export default async function handler(req, res) {
  // 1. Allow CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 2. Get language from URL query (?ln=hindi), default to 'hindi' if missing
  const { ln } = req.query;
  const language = ln || 'hindi';

  try {
    const headers = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      "Accept": "application/json, text/plain, */*",
      "Accept-Language": "en-US,en;q=0.9",
      "Referer": "https://www.jiosaavn.com/"
    };

    // 3. URLs for both APIs (dynamically injecting the requested language)
    const songsUrl = `https://www.jiosaavn.com/api.php?__call=content.getTrending&api_version=4&_format=json&_marker=0&ctx=wap6dot0&entity_type=song&entity_language=${language}`;
    const playlistsUrl = `https://www.jiosaavn.com/api.php?__call=content.getTrending&api_version=4&_format=json&_marker=0&ctx=wap6dot0&entity_type=playlist&entity_language=${language}`;

    // Fetch both APIs at the exact same time (makes your API 2x faster)
    const [songsRes, playlistsRes] = await Promise.all([
      fetch(songsUrl, { headers }),
      fetch(playlistsUrl, { headers })
    ]);

    if (!songsRes.ok || !playlistsRes.ok) {
      throw new Error("Failed to fetch trending data from JioSaavn");
    }

    const songsText = await songsRes.text();
    const playlistsText = await playlistsRes.text();

    // 4. Safe JSON Cleaner (Trending API returns an Array `[...]` instead of Object `{...}`)
    const parseData = (text) => {
      const startIndex = text.indexOf('[');
      if (startIndex === -1) return [];
      return JSON.parse(text.substring(startIndex));
    };

    const songsData = parseData(songsText);
    const playlistsData = parseData(playlistsText);

    // ==========================================
    // FILTERING FUNCTIONS
    // ==========================================

    // Format Trending Songs
    const trendings = songsData.map(song => {
      // Safely extract just the artist names and separate by comma
      let artistNames = "";
      if (song.more_info?.artistMap?.primary_artists) {
        artistNames = song.more_info.artistMap.primary_artists.map(a => a.name).join(", ");
      } else if (song.subtitle) {
        // Fallback just in case
        artistNames = song.subtitle.split(' - ')[0]; 
      }

      return {
        title: song.title || "",
        type: song.type || "song",
        artists: artistNames,
        image_link: song.image || "",
        perma_url: song.perma_url || ""
      };
    });

    // Format Featured Playlists
    const featured_playlists = playlistsData.map(playlist => ({
      title: playlist.title || "",
      type: playlist.type || "playlist",
      subtitle: playlist.subtitle || "",
      image_link: playlist.image || "",
      perma_url: playlist.perma_url || ""
    }));

    // 5. Send Final Response
    res.status(200).json({
      trendings: trendings,
      featured_playlists: featured_playlists
    });

  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch trending data', details: error.message });
  }
}
