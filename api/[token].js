export default async function handler(req, res) {
  // 1. Set CORS headers to allow requests from any app/frontend
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { token } = req.query;

  if (!token) {
    return res.status(400).json({ error: 'Token is required' });
  }

  try {
    const url = `https://www.jiosaavn.com/api.php?__call=webapi.get&token=${token}&type=artist&p=50&n_song=50&n_album=50&sub_type=&category=&sort_order=&includeMetaTags=0&ctx=wap6dot0&api_version=4&_format=json&_marker=0`;
    
    // 2. Fetch data from JioSaavn mimicking a real Google Chrome Browser
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
    
    // 3. Clean the response (JioSaavn sometimes sends hidden characters before the JSON)
    const startIndex = responseText.indexOf('{');
    if (startIndex === -1) {
      throw new Error("JioSaavn did not return valid JSON");
    }

    const cleanText = responseText.substring(startIndex);
    const data = JSON.parse(cleanText);

    // 4. Extract exactly the data and modules you requested
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
        singles: data.singles ||[],
        latest_release: data.latest_release ||[],
        dedicated_artist_playlist: data.dedicated_artist_playlist || [],
        featured_artist_playlist: data.featured_artist_playlist ||[],
        similarArtists: data.similarArtists ||[]
      }
    };

    // 5. Send successful response
    res.status(200).json(result);
    
  } catch (error) {
    // Return detailed error if something fails
    res.status(500).json({ error: 'Failed to fetch data from JioSaavn', details: error.message });
  }
}
