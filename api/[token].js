export default async function handler(req, res) {
  // 1. Allow CORS so you can use this in your app without errors
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { token } = req.query;

  if (!token) {
    return res.status(400).json({ error: 'Token is required' });
  }

  try {
    const url = `https://www.jiosaavn.com/api.php?__call=webapi.get&token=${token}&type=artist&p=50&n_song=50&n_album=50&sub_type=&category=&sort_order=&includeMetaTags=0&ctx=wap6dot0&api_version=4&_format=json&_marker=0`;
    
    // 2. Fetch data imitating a browser to bypass blocks
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": "https://www.jiosaavn.com/"
      }
    });

    if (!response.ok) {
      throw new Error(`JioSaavn responded with status: ${response.status}`);
    }

    const responseText = await response.text();
    
    // 3. Clean the response text safely (removes hidden characters before JSON)
    const startIndex = responseText.indexOf('{');
    if (startIndex === -1) {
      throw new Error("JioSaavn did not return valid JSON");
    }

    const cleanText = responseText.substring(startIndex);
    const data = JSON.parse(cleanText);

    // ==========================================
    // FILTERING FUNCTIONS (To remove extra data)
    // ==========================================

    // Format for Singles & Latest Releases
    const formatAlbumOrSingle = (item) => ({
      title: item.title || "",
      type: item.type || "",
      year: item.year || "",
      song_count: item.more_info?.song_count || "",
      image_link: item.image || "",
      perma_url: item.perma_url || ""
    });

    // Format for Playlists (Dedicated & Featured)
    const formatPlaylist = (item) => ({
      title: item.title || "",
      type: item.type || "",
      song_count: item.more_info?.song_count || "",
      image_link: item.image || "",
      perma_url: item.perma_url || ""
    });

    // Format for Similar Artists
    const formatArtist = (item) => {
      let parsedRoles = item.roles || "";
      // Parse stringified JSON for roles if needed
      try {
        if (typeof parsedRoles === 'string' && parsedRoles.startsWith('{')) {
          parsedRoles = JSON.parse(parsedRoles);
        }
      } catch (e) { }

      return {
        name: item.name || "",
        roles: parsedRoles,
        image_link: item.image_url || "",
        artist_id: item.id || item._id || ""
      };
    };

    // ==========================================
    // FINAL RESPONSE BUILDER
    // ==========================================
    const result = {
      artistId: data.artistId || "",
      name: data.name || "",
      subtitle: data.subtitle || "",
      image: data.image || "",
      follower_count: data.follower_count || "",
      type: data.type || "artist",
      isVerified: data.isVerified || false,
      is_followed: data.is_followed || false,
      dominantLanguage: data.dominantLanguage || "",
      dominantType: data.dominantType || "",
      
      modules: {
        singles: (data.singles ||[]).map(formatAlbumOrSingle),
        latest_release: (data.latest_release ||[]).map(formatAlbumOrSingle),
        dedicated_artist_playlist: (data.dedicated_artist_playlist ||[]).map(formatPlaylist),
        featured_artist_playlist: (data.featured_artist_playlist ||[]).map(formatPlaylist),
        similarArtists: (data.similarArtists ||[]).map(formatArtist)
      }
    };

    // 4. Send successful JSON response
    res.status(200).json(result);
    
  } catch (error) {
    // Return clear error message if it fails
    res.status(500).json({ error: 'Failed to fetch data from JioSaavn', details: error.message });
  }
}
